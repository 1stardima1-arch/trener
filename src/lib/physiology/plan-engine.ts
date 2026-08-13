// The adaptive training-plan generator. Two halves:
//  1) generateMesocycle — builds several weeks of prescribed sessions from
//     a periodization template (classic base→build→peak→taper, 3:1
//     load:deload weeks, an 80/20 polarized easy:hard split — Seiler 2010)
//     fitted to the athlete's own stated weekly availability and current
//     zones.
//  2) adjustForReadiness / reactToCompletedSession — the day-to-day
//     feedback loop: every session or night of sleep can change tomorrow's
//     (or today's) prescription, and every change carries a plain-language
//     reason. This is the literal "the plan changes and tells you why" loop
//     from the product brief — implemented as deterministic, auditable
//     rules, not an opaque model call.

import { WEEKDAYS, type Weekday } from "@/lib/sports";
import { trimp } from "./training-load";
import type { Zone } from "./zones";

export type PlanPhase = "BASE" | "BUILD" | "PEAK" | "TAPER" | "RACE" | "RECOVERY" | "MAINTENANCE" | "OFF_SEASON";
export type TargetType = "ENDURANCE_ZONE2" | "THRESHOLD" | "VO2MAX" | "TEMPO" | "LONG" | "STRENGTH" | "MOBILITY" | "REST" | "RACE";

export type DraftPlanItem = {
  date: string; // YYYY-MM-DD
  sport: string;
  title: string;
  targetType: TargetType;
  description: string;
  targetDurationSec: number | null;
  targetLoad: number | null;
  structure: unknown;
  explanation: string;
};

export type AthleteContext = {
  primarySport: string;
  experienceYears: number | null;
  goalType: string | null;
  goalEventDate: string | null; // YYYY-MM-DD
  weeklyAvailabilityMin: Partial<Record<Weekday, number>>;
  lthr: number | null;
  maxHr: number | null;
  restingHr: number | null;
  hrZones: Zone[] | null;
  wantsStrength: boolean;
};

export function phaseForWeek(weekStartDate: Date, goalEventDate: string | null): PlanPhase {
  if (!goalEventDate) return "MAINTENANCE";
  const weeksUntil = Math.floor((new Date(goalEventDate).getTime() - weekStartDate.getTime()) / (7 * 86400000));
  if (weeksUntil <= 0) return "RACE";
  if (weeksUntil <= 1) return "TAPER";
  if (weeksUntil <= 3) return "PEAK";
  if (weeksUntil <= 8) return "BUILD";
  return "BASE";
}

const PHASE_LABEL: Record<PlanPhase, string> = {
  BASE: "базовая", BUILD: "развивающая", PEAK: "пиковая", TAPER: "снижение нагрузки перед стартом",
  RACE: "старт", RECOVERY: "восстановительная", MAINTENANCE: "поддерживающая", OFF_SEASON: "межсезонье",
};

// How many of the week's *hard* session slots (threshold/VO2max/tempo) vs
// easy slots, by phase — implements the 80/20 polarized principle while
// still ramping intensity share up as an event approaches.
const HARD_SLOT_FRACTION: Record<PlanPhase, number> = {
  BASE: 0.15, BUILD: 0.25, PEAK: 0.3, TAPER: 0.2, RACE: 0, RECOVERY: 0.1, MAINTENANCE: 0.2, OFF_SEASON: 0.1,
};

function estimateLoadForZone(durationMin: number, zoneMidHr: number, ctx: AthleteContext): number | null {
  if (!ctx.restingHr || !ctx.maxHr) return null;
  return Math.round(trimp({ durationMin, avgHr: zoneMidHr, restingHr: ctx.restingHr, maxHr: ctx.maxHr }));
}

function toDateStr(d: Date) {
  return d.toISOString().slice(0, 10);
}

// Builds one mesocycle (a run of `weeks` calendar weeks starting from the
// Monday on/before `startDate`). Every 4th week is a deload (60% volume) —
// the classic 3:1 loading pattern — unless the phase is already TAPER/RACE.
export function generateMesocycle(params: {
  ctx: AthleteContext;
  startDate: Date;
  weeks: number;
}): DraftPlanItem[] {
  const { ctx, weeks } = params;
  const items: DraftPlanItem[] = [];

  const monday = new Date(params.startDate);
  const dow = (monday.getDay() + 6) % 7; // 0 = Monday
  monday.setDate(monday.getDate() - dow);
  monday.setHours(0, 0, 0, 0);

  const availableDays = WEEKDAYS.filter((d) => (ctx.weeklyAvailabilityMin[d] ?? 0) > 0);
  const zone2 = ctx.hrZones?.find((z) => z.zone === 2) ?? null;
  const threshold = ctx.hrZones?.find((z) => z.zone === 4) ?? null;
  const vo2 = ctx.hrZones?.find((z) => z.zone === 6) ?? null;

  for (let w = 0; w < weeks; w++) {
    const weekStart = new Date(monday);
    weekStart.setDate(weekStart.getDate() + w * 7);
    const goalEventDateStr = ctx.goalEventDate;
    const phase = phaseForWeek(weekStart, goalEventDateStr);
    const isDeloadWeek = phase !== "TAPER" && phase !== "RACE" && (w + 1) % 4 === 0;
    const loadMultiplier = isDeloadWeek ? 0.6 : phase === "TAPER" ? 0.5 : 1;

    const hardCount = Math.max(availableDays.length <= 2 ? 0 : 1, Math.round(availableDays.length * HARD_SLOT_FRACTION[phase]));
    // Space hard days out (never back-to-back) by picking every other
    // available day starting from the 2nd slot, so a hard session is
    // always followed by at least one easier day.
    const hardDaySet = new Set<Weekday>();
    for (let i = 1, picked = 0; i < availableDays.length && picked < hardCount; i += 2, picked++) {
      hardDaySet.add(availableDays[i]);
    }
    const longDay: Weekday | null =
      availableDays.length > 0 ? (availableDays.includes("sun") ? "sun" : availableDays.includes("sat") ? "sat" : availableDays[availableDays.length - 1]) : null;

    for (const day of WEEKDAYS) {
      const date = new Date(weekStart);
      date.setDate(date.getDate() + WEEKDAYS.indexOf(day));
      const dateStr = toDateStr(date);
      const availMin = ctx.weeklyAvailabilityMin[day] ?? 0;

      if (availMin <= 0) {
        items.push({
          date: dateStr, sport: ctx.primarySport, title: "День отдыха", targetType: "REST",
          description: "Полный отдых или лёгкая активность по желанию (прогулка, растяжка).",
          targetDurationSec: null, targetLoad: 0, structure: null,
          explanation: `В твоей недельной доступности на ${WEEKDAY_RU[day]} нет времени на тренировку — это плановый день отдыха.`,
        });
        continue;
      }

      const isRaceDay = phase === "RACE" && day === longDay;
      if (isRaceDay) {
        items.push({
          date: dateStr, sport: ctx.primarySport, title: ctx.goalType === "RACE" ? "Старт 🏁" : "Ключевая тренировка",
          targetType: "RACE",
          description: "Целевой старт цикла. Разминка по протоколу, далее — по плану гонки.",
          targetDurationSec: Math.round(availMin * 60), targetLoad: null, structure: null,
          explanation: "Это дата твоей цели — вся предыдущая подготовка вела к этому дню.",
        });
        continue;
      }

      const isLong = day === longDay && availMin >= 40 && phase !== "TAPER";
      const isHard = hardDaySet.has(day) && !isLong;
      const durationSec = Math.round(availMin * 60 * loadMultiplier * (isLong ? 1 : 0.85));

      if (isLong) {
        items.push(longSessionItem(dateStr, ctx, durationSec, phase, isDeloadWeek, zone2));
      } else if (isHard) {
        const useVo2 = phase === "PEAK" || phase === "BUILD";
        items.push(hardSessionItem(dateStr, ctx, durationSec, phase, useVo2 ? vo2 : threshold, useVo2 ? "VO2MAX" : "THRESHOLD"));
      } else if (ctx.wantsStrength && day !== longDay && (WEEKDAYS.indexOf(day) === 1 || WEEKDAYS.indexOf(day) === 4) && phase !== "TAPER") {
        items.push({
          date: dateStr, sport: "strength", title: "Силовая + стабилизация", targetType: "STRENGTH",
          description: "Общая силовая работа: корпус, ягодичные, стабилизаторы голеностопа/колена — снижает риск травм и поддерживает мощность на утомлении.",
          targetDurationSec: Math.min(durationSec, 45 * 60), targetLoad: null, structure: null,
          explanation: "Раз-два в неделю силовая работа встроена в план — исследования показывают, что она снижает риск травм у выносливых спортсменов без вреда для аэробной формы.",
        });
      } else {
        items.push(easySessionItem(dateStr, ctx, durationSec, phase, isDeloadWeek, zone2));
      }
    }
  }

  return items;
}

const WEEKDAY_RU: Record<Weekday, string> = { mon: "понедельник", tue: "вторник", wed: "среду", thu: "четверг", fri: "пятницу", sat: "субботу", sun: "воскресенье" };

function easySessionItem(date: string, ctx: AthleteContext, durationSec: number, phase: PlanPhase, deload: boolean, zone2: Zone | null): DraftPlanItem {
  const mid = zone2 ? Math.round((zone2.min + zone2.max) / 2) : null;
  return {
    date, sport: ctx.primarySport, title: "Лёгкая аэробная (Z2)", targetType: "ENDURANCE_ZONE2",
    description: zone2 ? `Держи пульс в зоне 2 (${zone2.min}-${zone2.max} уд/мин) — разговорный темп, без напряжения.` : "Лёгкий, разговорный темп — не превышай ощущение «легко».",
    targetDurationSec: durationSec, targetLoad: mid ? estimateLoadForZone(durationSec / 60, mid, ctx) : null,
    structure: { blocks: [{ type: "steady", zone: 2, durationSec }] },
    explanation: `${deload ? "Разгрузочная неделя — " : ""}${PHASE_LABEL[phase]} фаза строится в основном на аэробной базе: 80% тренировок в лёгкой зоне даёт основной рост выносливости с минимальным риском перетренированности.`,
  };
}

function longSessionItem(date: string, ctx: AthleteContext, durationSec: number, phase: PlanPhase, deload: boolean, zone2: Zone | null): DraftPlanItem {
  return {
    date, sport: ctx.primarySport, title: "Длинная тренировка", targetType: "LONG",
    description: zone2 ? `Длинная равномерная работа в зоне 1-2 (до ${zone2.max} уд/мин), последние 10-15% можно чуть приподнять темп.` : "Длинная равномерная работа в комфортном темпе.",
    targetDurationSec: durationSec, targetLoad: zone2 ? estimateLoadForZone(durationSec / 60, zone2.max, ctx) : null,
    structure: { blocks: [{ type: "steady", zone: 2, durationSec: Math.round(durationSec * 0.85) }, { type: "steady", zone: 3, durationSec: Math.round(durationSec * 0.15) }] },
    explanation: `Еженедельная длинная тренировка развивает выносливость и экономичность движения — ключевой элемент подготовки в ${PHASE_LABEL[phase]} фазе.${deload ? " На этой неделе объём снижен для восстановления." : ""}`,
  };
}

function hardSessionItem(date: string, ctx: AthleteContext, durationSec: number, phase: PlanPhase, zone: Zone | null, kind: "THRESHOLD" | "VO2MAX"): DraftPlanItem {
  const isVo2 = kind === "VO2MAX";
  const workSec = isVo2 ? 180 : 480;
  const restSec = isVo2 ? 120 : 180;
  const reps = Math.max(3, Math.min(isVo2 ? 8 : 5, Math.floor((durationSec * 0.6) / (workSec + restSec))));
  return {
    date, sport: ctx.primarySport, title: isVo2 ? "Интервалы VO2max" : "Пороговая тренировка", targetType: isVo2 ? "VO2MAX" : "THRESHOLD",
    description: zone
      ? `Разминка 15 мин, затем ${reps}×${Math.round(workSec / 60)} мин в зоне ${zone.zone} (${zone.min}-${zone.max} уд/мин) с ${Math.round(restSec / 60)} мин лёгкого восстановления между повторами, заминка 10 мин.`
      : `Разминка, затем ${reps} интервалов по ${Math.round(workSec / 60)} мин в тяжёлом, но контролируемом темпе.`,
    targetDurationSec: durationSec, targetLoad: zone ? estimateLoadForZone(durationSec / 60, zone.min, ctx) : null,
    structure: { blocks: [{ type: "warmup", durationSec: 900 }, { type: "intervals", reps, workSec, restSec, zone: zone?.zone ?? (isVo2 ? 6 : 4) }, { type: "cooldown", durationSec: 600 }] },
    explanation: isVo2
      ? `${PHASE_LABEL[phase]} фаза — момент поднимать VO2max: короткие интервалы у потолка аэробной мощности дают наибольший стимул к росту МПК.`
      : `${PHASE_LABEL[phase]} фаза — пороговая работа напрямую сдвигает LT2 вверх, позволяя держать более высокий темп/мощность дольше без закисления.`,
  };
}

// ---------------- Day-to-day adaptation ----------------

export type ReadinessContext = {
  recoveryScore: number | null;
  recoveryBand: "LOW" | "MEDIUM" | "HIGH" | null;
  topRecoveryNote: string | null;
  acwrRisk: "LOW" | "MODERATE" | "HIGH" | "UNDERTRAINED" | null;
  acwrRatio: number | null;
  sleepDebtHours: number | null;
  // 1-5 self-report (WHOOP Journal / Garmin-style) — deliberately not folded
  // into recoveryScore itself (see the DailyMetric schema comment), but
  // still allowed to downgrade today's session: an athlete who reports
  // heavy soreness or stress can be right in a way HRV/RHR haven't caught
  // up to yet (next night's readings will reflect it; today's plan
  // shouldn't wait for that).
  subjectiveSoreness: number | null;
  subjectiveStress: number | null;
};

export type AdjustmentResult = { changed: boolean; item: DraftPlanItem; reason: string | null };

const HARD_TYPES: TargetType[] = ["THRESHOLD", "VO2MAX", "TEMPO", "LONG"];

// The daily readiness→plan feedback loop. Deterministic and fully
// explainable: every branch produces the exact sentence shown to the
// athlete, so "why did my workout change" always has a real answer.
export function adjustForReadiness(planned: DraftPlanItem, ctx: ReadinessContext): AdjustmentResult {
  if (planned.targetType === "REST" || planned.targetType === "RACE") {
    return { changed: false, item: planned, reason: null };
  }

  if (ctx.acwrRisk === "HIGH" && HARD_TYPES.includes(planned.targetType)) {
    return {
      changed: true,
      reason: `Соотношение острой/хронической нагрузки (ACWR) сейчас ${ctx.acwrRatio} — это зона повышенного риска травмы (Gabbett, 2016). Сегодняшняя тяжёлая тренировка заменена на лёгкую, чтобы не рисковать.`,
      item: downgrade(planned, "Лёгкая аэробная (замена из-за риска перегрузки)"),
    };
  }

  if (ctx.subjectiveSoreness != null && ctx.subjectiveSoreness >= 4 && ctx.subjectiveStress != null && ctx.subjectiveStress >= 4 && HARD_TYPES.includes(planned.targetType)) {
    return {
      changed: true,
      reason: `По самоотчёту сегодня высокая мышечная усталость и стресс (${ctx.subjectiveSoreness}/5 и ${ctx.subjectiveStress}/5) — это не всегда сразу видно по ВСР и пульсу покоя, но игнорировать такое сочетание рискованно. Тяжёлая тренировка заменена на лёгкую.`,
      item: downgrade(planned, "Лёгкая аэробная (по самочувствию)"),
    };
  }

  if (ctx.recoveryBand === "LOW" && HARD_TYPES.includes(planned.targetType)) {
    return {
      changed: true,
      reason: `Готовность сегодня низкая (${ctx.recoveryScore}/100)${ctx.topRecoveryNote ? " — " + ctx.topRecoveryNote : ""}. Тяжёлая тренировка перенесена: организм ещё не восстановился настолько, чтобы извлечь пользу из высокой интенсивности, а риск лишь растёт.`,
      item: downgrade(planned, "Лёгкая аэробная (снижено из-за низкой готовности)"),
    };
  }

  if (ctx.recoveryScore != null && ctx.recoveryScore < 25 && planned.targetType !== "ENDURANCE_ZONE2") {
    return {
      changed: true,
      reason: `Готовность критически низкая (${ctx.recoveryScore}/100). Сегодня — полный отдых вместо тренировки, чтобы не наращивать усталость дальше.`,
      item: { ...planned, title: "День отдыха (по готовности)", targetType: "REST", description: "Полный отдых — тело сигналит о необходимости восстановления.", targetDurationSec: null, targetLoad: 0, structure: null },
    };
  }

  if (ctx.sleepDebtHours != null && ctx.sleepDebtHours >= 3 && HARD_TYPES.includes(planned.targetType)) {
    return {
      changed: true,
      reason: `Накопленный дефицит сна ≈${ctx.sleepDebtHours.toFixed(1)} ч. Интенсивность сегодня снижена — недосып ухудшает и качество самой тяжёлой тренировки, и её эффект.`,
      item: downgrade(planned, "Темповая вместо интервалов (недосып)"),
    };
  }

  if (ctx.recoveryBand === "HIGH" && planned.targetType === "ENDURANCE_ZONE2") {
    return {
      changed: false,
      reason: `Готовность высокая (${ctx.recoveryScore}/100) — план подтверждён без изменений, но у тебя есть запас, чтобы при желании прибавить темп во второй половине тренировки.`,
      item: planned,
    };
  }

  return { changed: false, item: planned, reason: null };
}

function downgrade(item: DraftPlanItem, title: string): DraftPlanItem {
  const durationSec = item.targetDurationSec ? Math.round(item.targetDurationSec * 0.75) : null;
  return { ...item, title, targetType: "ENDURANCE_ZONE2", description: "Лёгкая аэробная работа в разговорном темпе — восстановительная нагрузка вместо запланированной интенсивности.", targetDurationSec: durationSec, structure: { blocks: durationSec ? [{ type: "steady", zone: 2, durationSec }] : [] } };
}

export type SessionQuality = "PRODUCTIVE" | "NEUTRAL" | "UNPRODUCTIVE" | "MISSED";

// Compares a completed activity back against what was prescribed, so the
// dashboard can say e.g. "productive session" or "cut short" and feed that
// judgement into tomorrow's plan, closing the loop the other direction.
export function evaluateCompletedSession(params: {
  plannedDurationSec: number | null;
  actualDurationSec: number;
  plannedTargetType: TargetType;
  avgHr: number | null;
  targetZone: Zone | null;
  rpe: number | null;
}): { quality: SessionQuality; note: string } {
  const durationRatio = params.plannedDurationSec ? params.actualDurationSec / params.plannedDurationSec : 1;

  if (durationRatio < 0.5) {
    return { quality: "MISSED", note: "Тренировка выполнена менее чем наполовину от плана — засчитана как незавершённая." };
  }

  const inZone = params.avgHr != null && params.targetZone ? params.avgHr >= params.targetZone.min - 5 && params.avgHr <= params.targetZone.max + 8 : null;

  if (durationRatio >= 0.9 && inZone !== false) {
    return { quality: "PRODUCTIVE", note: "Объём и интенсивность совпали с планом — качественная, продуктивная тренировка." };
  }
  if (durationRatio < 0.75 || inZone === false) {
    return {
      quality: "UNPRODUCTIVE",
      note:
        inZone === false
          ? "Средний пульс заметно отличался от целевой зоны — тренировка выполнена, но не в нужном тренировочном эффекте."
          : "Тренировка сокращена относительно плана — часть тренировочного эффекта недополучена.",
    };
  }
  return { quality: "NEUTRAL", note: "Тренировка выполнена близко к плану." };
}
