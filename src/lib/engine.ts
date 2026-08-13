// Orchestration layer: wires the pure src/lib/physiology/* formulas to the
// database. Every device sync route, the FIT upload route, manual-entry
// actions, and the daily cron all funnel through the functions here instead
// of duplicating "fetch data → run formula → write result → log why" in
// each caller.

import { prisma } from "@/lib/prisma";
import { ageFromBirthDate, sportLabel } from "@/lib/sports";
import { deriveThresholds, type StepPoint } from "@/lib/physiology/threshold";
import { hrZonesFromLthr, hrZonesFromMaxHr, paceZonesFromThresholdPace, powerZonesFromFtp, estimateMaxHr } from "@/lib/physiology/zones";
import { estimateVo2max } from "@/lib/physiology/vo2max";
import { trimp, rpeLoad, computeCtlAtlTsb, computeAcwr, computeDailyStrain, type DayLoad } from "@/lib/physiology/training-load";
import { computeRecoveryScore, computeSleepScore, rollingBaseline, detectAnomalies } from "@/lib/physiology/recovery";
import { generateMesocycle, adjustForReadiness, evaluateCompletedSession, phaseForWeek, type AthleteContext, type ReadinessContext, type DraftPlanItem } from "@/lib/physiology/plan-engine";
import { narrateInsight, generateDailyBriefing } from "@/lib/ai";
import { asJson } from "@/lib/utils";
import type { DataSource } from "@prisma/client";

function dateStr(d: Date | string): string {
  return (typeof d === "string" ? d : d.toISOString()).slice(0, 10);
}

async function writeInsight(userId: string, date: string, type: string, title: string, deterministicReason: string, severity: "INFO" | "POSITIVE" | "WARNING", metrics?: Record<string, unknown>) {
  const body = await narrateInsight({ title, deterministicReason, metrics });
  await prisma.insight.create({ data: { userId, date: new Date(date), type, title, body, severity } });
}

// ---------------- Thresholds / VO2max ----------------

// A one-time seed snapshot from a test the athlete already did elsewhere
// (entered during onboarding) — lower confidence than a real Dmax
// computation since we can't audit how it was derived, but still real
// enough to build zones from immediately instead of waiting on device data.
export async function saveReportedThresholds(userId: string, sport: string, reported: {
  lthrBpm?: number | null; maxHrBpm?: number | null; restingHrBpm?: number | null;
  lt2PaceSecPerKm?: number | null; lt2PowerW?: number | null; lt2Mmol?: number | null; vo2max?: number | null;
}) {
  const hasAny = Object.values(reported).some((v) => v != null);
  if (!hasAny) return null;

  const hrZones = reported.lthrBpm ? hrZonesFromLthr(reported.lthrBpm, reported.maxHrBpm ?? undefined) : null;
  const paceZones = reported.lt2PaceSecPerKm ? paceZonesFromThresholdPace(reported.lt2PaceSecPerKm) : null;
  const powerZones = reported.lt2PowerW ? powerZonesFromFtp(reported.lt2PowerW) : null;

  return prisma.thresholdSnapshot.create({
    data: {
      userId, sport,
      lthrBpm: reported.lthrBpm, maxHrBpm: reported.maxHrBpm, restingHrBpm: reported.restingHrBpm,
      lt2PaceSecPerKm: reported.lt2PaceSecPerKm, lt2PowerW: reported.lt2PowerW, lt2Mmol: reported.lt2Mmol,
      vo2max: reported.vo2max, vo2maxMethod: reported.vo2max ? "Указано атлетом (предыдущее тестирование)" : undefined,
      hrZones: asJson(hrZones), paceZones: asJson(paceZones), powerZones: asJson(powerZones),
      confidence: 0.5, method: "ATHLETE_REPORTED",
      explanation: "Значения указаны тобой на основании предыдущего тестирования — будут уточняться по мере накопления собственных данных тренировок.",
    },
  });
}

export async function computeAndSaveThresholds(userId: string, sport: string) {
  const [profile, latestTest, activities] = await Promise.all([
    prisma.athleteProfile.findUnique({ where: { userId } }),
    prisma.lactateTest.findFirst({ where: { userId, sport }, orderBy: { testedAt: "desc" } }),
    prisma.activity.findMany({ where: { userId, sport, startedAt: { gte: new Date(Date.now() - 180 * 86400000) } }, orderBy: { startedAt: "desc" }, take: 50 }),
  ]);
  if (!profile) return null;

  const age = ageFromBirthDate(profile.birthDate);
  const maxHr = profile.maxHrManual ?? (age ? estimateMaxHr(age) : null);
  const restingHr = profile.restingHrManual ?? null;

  let lt1 = null as ReturnType<typeof deriveThresholds>["lt1"];
  let lt2 = null as ReturnType<typeof deriveThresholds>["lt2"];
  let explanation = "Пороги пока не рассчитаны — недостаточно данных теста.";
  let method = "NONE";

  if (latestTest && Array.isArray(latestTest.steps) && latestTest.steps.length >= 3) {
    const points = (latestTest.steps as unknown as Array<Record<string, unknown>>)
      .map((s, i): StepPoint | null => {
        const lactateMmol = Number(s.lactateMmol);
        if (!Number.isFinite(lactateMmol)) return null;
        if (typeof s.intensityHr === "number") return { step: i, intensity: s.intensityHr, intensityKind: "hr", lactateMmol };
        if (typeof s.intensityPowerW === "number") return { step: i, intensity: s.intensityPowerW, intensityKind: "power", lactateMmol };
        if (typeof s.intensityPaceSecPerKm === "number") return { step: i, intensity: s.intensityPaceSecPerKm, intensityKind: "pace", lactateMmol };
        return null;
      })
      .filter((p): p is StepPoint => p !== null);

    const derived = deriveThresholds(points);
    lt1 = derived.lt1;
    lt2 = derived.lt2;
    explanation = derived.explanation;
    method = lt2?.method ?? "NONE";
  }

  const lthr = lt2?.intensityKind === "hr" ? Math.round(lt2.intensity) : profile.lthrManual ?? (maxHr ? Math.round(maxHr * 0.92) : null);
  const lt2PaceSecPerKm = lt2?.intensityKind === "pace" ? lt2.intensity : null;
  const lt2PowerW = lt2?.intensityKind === "power" ? lt2.intensity : null;

  const bestRace = pickBestRacePerformance(activities);
  const vo2 = estimateVo2max({
    age, sex: profile.sex, weightKg: profile.weightKg, heightCm: profile.heightCm,
    experienceYears: profile.experienceYears, maxHr, restingHr, sport,
    lt2PaceSecPerKm, lt2PowerW, bestRecentRace: bestRace,
  });

  const hrZones = lthr ? hrZonesFromLthr(lthr, maxHr ?? undefined) : maxHr ? hrZonesFromMaxHr(maxHr) : null;
  const paceZones = lt2PaceSecPerKm ? paceZonesFromThresholdPace(lt2PaceSecPerKm) : null;
  const powerZones = lt2PowerW ? powerZonesFromFtp(lt2PowerW) : null;

  const fullExplanation = [
    explanation,
    vo2 ? `VO2max оценён как ${vo2.vo2max} мл/кг/мин (${vo2.method}, доверие ${(vo2.confidence * 100).toFixed(0)}%).` : null,
    !lt2 && profile.lthrManual ? "Используется указанный вручную порог ЧСС до первого теста на лактат." : null,
  ].filter(Boolean).join(" ");

  return prisma.thresholdSnapshot.create({
    data: {
      userId, sport,
      lt1Mmol: lt1?.lactateMmol, lt1Hr: lt1?.intensityKind === "hr" ? Math.round(lt1.intensity) : null,
      lt1PaceSecPerKm: lt1?.intensityKind === "pace" ? lt1.intensity : null, lt1PowerW: lt1?.intensityKind === "power" ? lt1.intensity : null,
      lt2Mmol: lt2?.lactateMmol, lt2Hr: lt2?.intensityKind === "hr" ? Math.round(lt2.intensity) : null,
      lt2PaceSecPerKm, lt2PowerW,
      lthrBpm: lthr, maxHrBpm: maxHr, restingHrBpm: restingHr,
      vo2max: vo2?.vo2max, vo2maxMethod: vo2?.method,
      hrZones: asJson(hrZones), paceZones: asJson(paceZones), powerZones: asJson(powerZones),
      confidence: vo2?.confidence ?? (lt2 ? lt2.confidence : 0.3),
      method: method !== "NONE" ? method : vo2 ? "VO2MAX_ONLY" : "MANUAL_DEFAULT",
      explanation: fullExplanation || "Недостаточно данных для точного расчёта — используются консервативные значения по умолчанию.",
    },
  });
}

function pickBestRacePerformance(activities: { distanceM: number | null; durationSec: number; sport: string }[]) {
  const RACE_DISTANCES = [1000, 5000, 10000, 21097, 42195];
  let best: { distanceMeters: number; durationSec: number; paceSecPerKm: number } | null = null;
  for (const a of activities) {
    if (!a.distanceM || a.durationSec < 480) continue;
    const closest = RACE_DISTANCES.find((d) => Math.abs(a.distanceM! - d) / d < 0.08);
    if (!closest) continue;
    const paceSecPerKm = a.durationSec / (a.distanceM / 1000);
    if (!best || paceSecPerKm < best.paceSecPerKm) best = { distanceMeters: a.distanceM, durationSec: a.durationSec, paceSecPerKm };
  }
  return best;
}

// ---------------- Daily metric (recovery / strain) ----------------

export async function computeAndSaveDailyMetric(userId: string, date: string) {
  const [profile, existing, history, activityLoads] = await Promise.all([
    prisma.athleteProfile.findUnique({ where: { userId } }),
    prisma.dailyMetric.findUnique({ where: { userId_date: { userId, date: new Date(date) } } }),
    prisma.dailyMetric.findMany({ where: { userId, date: { lt: new Date(date), gte: new Date(Date.now() - 21 * 86400000) } }, orderBy: { date: "asc" } }),
    getDailyLoadSeries(userId, date),
  ]);
  if (!existing) return null;

  const sleepScore = existing.sleepDurationSec
    ? computeSleepScore({
        durationSec: existing.sleepDurationSec,
        goalHours: profile?.sleepGoalHours ?? 8,
        deepSec: existing.sleepStages && typeof existing.sleepStages === "object" ? (existing.sleepStages as Record<string, number>).deepSec : null,
        remSec: existing.sleepStages && typeof existing.sleepStages === "object" ? (existing.sleepStages as Record<string, number>).remSec : null,
        awakeSec: existing.sleepStages && typeof existing.sleepStages === "object" ? (existing.sleepStages as Record<string, number>).awakeSec : null,
      })
    : existing.sleepScore;

  const sleepDebtSec = existing.sleepDurationSec != null ? Math.max(0, Math.round((profile?.sleepGoalHours ?? 8) * 3600 - existing.sleepDurationSec)) : null;

  const hrvBaseline = rollingBaseline(history.map((h) => h.hrvMs).filter((v): v is number => v != null));
  const rhrBaseline = rollingBaseline(history.map((h) => h.restingHr).filter((v): v is number => v != null));

  const { tsb } = computeCtlAtlTsb(activityLoads).slice(-1)[0] ?? { tsb: null };

  const recovery = computeRecoveryScore({
    hrvMs: existing.hrvMs, hrvBaselineMean: hrvBaseline?.mean ?? null, hrvBaselineStdDev: hrvBaseline?.stdDev ?? null,
    restingHr: existing.restingHr, rhrBaselineMean: rhrBaseline?.mean ?? null, rhrBaselineStdDev: rhrBaseline?.stdDev ?? null,
    sleepScore: sleepScore ?? null, tsb, yesterdayStrain: history.at(-1)?.strain ?? null,
  });

  const todayLoad = activityLoads.at(-1)?.load ?? 0;
  const strain = computeDailyStrain(todayLoad);

  const prevScore = existing.recoveryScore;
  const updated = await prisma.dailyMetric.update({
    where: { userId_date: { userId, date: new Date(date) } },
    data: { sleepScore: sleepScore ?? undefined, sleepDebtSec: sleepDebtSec ?? undefined, recoveryScore: recovery.score, recoveryBreakdown: asJson(recovery.breakdown), strain },
  });

  if (prevScore == null || Math.abs(prevScore - recovery.score) >= 15) {
    const top = [...recovery.breakdown].sort((a, b) => Math.abs(b.weight * (b.contribution - 50)) - Math.abs(a.weight * (a.contribution - 50)))[0];
    await writeInsight(
      userId, date, "RECOVERY_CHANGE",
      recovery.band === "LOW" ? "Низкая готовность сегодня" : recovery.band === "HIGH" ? "Отличная готовность сегодня" : "Готовность на сегодня обновлена",
      `Оценка готовности: ${recovery.score}/100. ${top?.note ?? ""}`,
      recovery.band === "LOW" ? "WARNING" : recovery.band === "HIGH" ? "POSITIVE" : "INFO",
      { score: recovery.score, breakdown: recovery.breakdown }
    );
  }

  // Early-warning pattern detection (illness/overreaching/positive trend) —
  // runs off the same baselines, plus a short trend window and ACWR. Only
  // written once per calendar day per flag type, so repeated dashboard
  // loads don't spam the insight feed.
  const hrvLast7 = [...history.slice(-6).map((h) => h.hrvMs), existing.hrvMs].filter((v): v is number => v != null);
  const rhrLast7 = [...history.slice(-6).map((h) => h.restingHr), existing.restingHr].filter((v): v is number => v != null);
  const acwr = computeAcwr(activityLoads);
  const anomalies = detectAnomalies({
    hrvMs: existing.hrvMs, hrvBaselineMean: hrvBaseline?.mean ?? null, hrvBaselineStdDev: hrvBaseline?.stdDev ?? null,
    restingHr: existing.restingHr, rhrBaselineMean: rhrBaseline?.mean ?? null, rhrBaselineStdDev: rhrBaseline?.stdDev ?? null,
    hrvLast7, rhrLast7, tsb, acwrRisk: acwr.risk,
  });
  for (const flag of anomalies) {
    const already = await prisma.insight.findFirst({ where: { userId, date: new Date(date), type: flag.type } });
    if (already) continue;
    await writeInsight(userId, date, flag.type, flag.title, flag.message, flag.severity, { hrvLast7, rhrLast7, tsb, acwr: acwr.ratio });
  }

  return updated;
}

async function getDailyLoadSeries(userId: string, throughDate: string): Promise<DayLoad[]> {
  const start = new Date(throughDate);
  start.setDate(start.getDate() - 45);
  const activities = await prisma.activity.findMany({
    where: { userId, startedAt: { gte: start, lte: new Date(new Date(throughDate).getTime() + 86400000) } },
    select: { startedAt: true, trainingLoad: true },
  });
  const byDate = new Map<string, number>();
  for (const a of activities) byDate.set(dateStr(a.startedAt), (byDate.get(dateStr(a.startedAt)) ?? 0) + (a.trainingLoad ?? 0));

  const series: DayLoad[] = [];
  const cursor = new Date(start);
  const end = new Date(throughDate);
  while (cursor <= end) {
    const d = dateStr(cursor);
    series.push({ date: d, load: byDate.get(d) ?? 0 });
    cursor.setDate(cursor.getDate() + 1);
  }
  return series;
}

// ---------------- Training plan ----------------

async function buildAthleteContext(userId: string): Promise<{ ctx: AthleteContext; profile: NonNullable<Awaited<ReturnType<typeof prisma.athleteProfile.findUnique>>> } | null> {
  const profile = await prisma.athleteProfile.findUnique({ where: { userId } });
  if (!profile) return null;
  const snapshot = await prisma.thresholdSnapshot.findFirst({ where: { userId, sport: profile.primarySport }, orderBy: { computedAt: "desc" } });
  const age = ageFromBirthDate(profile.birthDate);
  const maxHr = snapshot?.maxHrBpm ?? profile.maxHrManual ?? (age ? estimateMaxHr(age) : null);
  const lthr = snapshot?.lthrBpm ?? profile.lthrManual ?? null;
  const hrZones = (snapshot?.hrZones as unknown as ReturnType<typeof hrZonesFromLthr>) ?? (lthr ? hrZonesFromLthr(lthr, maxHr ?? undefined) : maxHr ? hrZonesFromMaxHr(maxHr) : null);

  return {
    profile,
    ctx: {
      primarySport: profile.primarySport,
      experienceYears: profile.experienceYears,
      goalType: profile.goalType,
      goalEventDate: profile.goalEventDate ? dateStr(profile.goalEventDate) : null,
      weeklyAvailabilityMin: (profile.weeklyAvailabilityMin as Record<string, number>) ?? {},
      lthr, maxHr, restingHr: snapshot?.restingHrBpm ?? profile.restingHrManual ?? null,
      hrZones, wantsStrength: profile.primarySport !== "strength",
    },
  };
}

export async function ensureActivePlan(userId: string) {
  const existing = await prisma.trainingPlan.findFirst({ where: { userId, status: "ACTIVE" }, orderBy: { startDate: "desc" } });
  if (existing) return existing;

  const built = await buildAthleteContext(userId);
  if (!built) return null;
  const { ctx, profile } = built;

  const draft = generateMesocycle({ ctx, startDate: new Date(), weeks: 4 });
  const plan = await prisma.trainingPlan.create({
    data: {
      userId, goalType: profile.goalType, goalEventName: profile.goalEventName,
      goalEventDate: profile.goalEventDate, phase: phaseForWeek(new Date(), ctx.goalEventDate), status: "ACTIVE",
      startDate: new Date(draft[0]?.date ?? new Date()),
    },
  });
  await prisma.planItem.createMany({ data: draft.map((d) => toPlanItemData(d, plan.id, userId)) });
  return plan;
}

function toPlanItemData(d: DraftPlanItem, planId: string, userId: string) {
  return {
    planId, userId, date: new Date(d.date), sport: d.sport, title: d.title, targetType: d.targetType,
    description: d.description, targetDurationSec: d.targetDurationSec, targetLoad: d.targetLoad,
    structure: asJson(d.structure), explanation: d.explanation,
  };
}

// Extends the plan with another mesocycle once existing PlanItems run out —
// called lazily by ensureTodayPlanItem rather than on a fixed schedule.
async function extendPlanIfNeeded(userId: string, planId: string) {
  const last = await prisma.planItem.findFirst({ where: { planId }, orderBy: { date: "desc" } });
  const daysLeft = last ? Math.floor((last.date.getTime() - Date.now()) / 86400000) : -1;
  if (daysLeft > 5) return;

  const built = await buildAthleteContext(userId);
  if (!built) return;
  const start = last ? new Date(last.date.getTime() + 86400000) : new Date();
  const draft = generateMesocycle({ ctx: built.ctx, startDate: start, weeks: 4 });
  await prisma.planItem.createMany({ data: draft.map((d) => toPlanItemData(d, planId, userId)) });
}

export async function ensureTodayPlanItem(userId: string, opts?: { force?: boolean }) {
  const plan = await ensureActivePlan(userId);
  if (!plan) return null;
  await extendPlanIfNeeded(userId, plan.id);

  const today = dateStr(new Date());
  let item = await prisma.planItem.findFirst({ where: { userId, planId: plan.id, date: new Date(today) } });
  if (!item) return null;
  if (item.status !== "PLANNED") return item; // already completed/skipped — never re-adjust after the fact
  if (item.adjustReason && !opts?.force) return item; // already adjusted today, and nothing is asking for a re-check

  const metric = await prisma.dailyMetric.findUnique({ where: { userId_date: { userId, date: new Date(today) } } });
  const loads = await getDailyLoadSeries(userId, today);
  const acwr = computeAcwr(loads);

  const readiness: ReadinessContext = {
    recoveryScore: metric?.recoveryScore ?? null,
    recoveryBand: metric?.recoveryScore != null ? (metric.recoveryScore >= 67 ? "HIGH" : metric.recoveryScore >= 34 ? "MEDIUM" : "LOW") : null,
    topRecoveryNote: (metric?.recoveryBreakdown as Array<{ note: string }> | null)?.[0]?.note ?? null,
    acwrRisk: acwr.risk, acwrRatio: acwr.ratio,
    sleepDebtHours: metric?.sleepDebtSec != null ? metric.sleepDebtSec / 3600 : null,
    subjectiveSoreness: metric?.subjectiveSoreness ?? null,
    subjectiveStress: metric?.subjectiveStress ?? null,
  };

  const draftItem: DraftPlanItem = {
    date: today, sport: item.sport, title: item.title, targetType: item.targetType as DraftPlanItem["targetType"],
    description: item.description, targetDurationSec: item.targetDurationSec, targetLoad: item.targetLoad,
    structure: item.structure, explanation: item.explanation,
  };
  const result = adjustForReadiness(draftItem, readiness);

  if (result.changed) {
    item = await prisma.planItem.update({
      where: { id: item.id },
      data: {
        title: result.item.title, targetType: result.item.targetType, description: result.item.description,
        targetDurationSec: result.item.targetDurationSec, structure: asJson(result.item.structure),
        adjustReason: result.reason,
      },
    });
    await writeInsight(userId, today, "PLAN_ADJUSTED", "План на сегодня изменён", result.reason ?? "", "INFO", { readiness });
  } else if (result.reason) {
    // Confirmed-as-is but with a note (e.g. "you have headroom today").
    item = await prisma.planItem.update({ where: { id: item.id }, data: { adjustReason: result.reason } });
  }

  return item;
}

// ---------------- Activity ingestion ----------------

export async function ingestActivity(userId: string, provider: DataSource, parsed: {
  externalId?: string | null; sport: string; startedAt: Date; durationSec: number; distanceM?: number | null;
  elevationGainM?: number | null; avgHr?: number | null; maxHr?: number | null; avgPaceSecPerKm?: number | null;
  avgPowerW?: number | null; normalizedPowerW?: number | null; avgCadence?: number | null; calories?: number | null;
  samples?: unknown; sourceFileName?: string | null; isStepTest?: boolean; perceivedExertion?: number | null;
}) {
  const profile = await prisma.athleteProfile.findUnique({ where: { userId } });

  let trainingLoad: number | null = null;
  if (parsed.avgHr && profile?.restingHrManual && profile?.maxHrManual) {
    trainingLoad = Math.round(trimp({ durationMin: parsed.durationSec / 60, avgHr: parsed.avgHr, restingHr: profile.restingHrManual, maxHr: profile.maxHrManual, sex: profile.sex }));
  } else if (parsed.perceivedExertion) {
    trainingLoad = Math.round(rpeLoad(parsed.durationSec / 60, parsed.perceivedExertion));
  }

  const activityData = {
    userId, provider, trainingLoad,
    sport: parsed.sport, startedAt: parsed.startedAt, durationSec: parsed.durationSec,
    distanceM: parsed.distanceM, elevationGainM: parsed.elevationGainM, avgHr: parsed.avgHr, maxHr: parsed.maxHr,
    avgPaceSecPerKm: parsed.avgPaceSecPerKm, avgPowerW: parsed.avgPowerW, normalizedPowerW: parsed.normalizedPowerW,
    avgCadence: parsed.avgCadence, calories: parsed.calories, samples: asJson(parsed.samples),
    sourceFileName: parsed.sourceFileName, isStepTest: parsed.isStepTest ?? false, perceivedExertion: parsed.perceivedExertion,
  };

  const activity = parsed.externalId
    ? await prisma.activity.upsert({
        where: { userId_provider_externalId: { userId, provider, externalId: parsed.externalId } },
        update: {},
        create: { ...activityData, externalId: parsed.externalId },
      })
    : await prisma.activity.create({ data: activityData });

  const date = dateStr(parsed.startedAt);
  await ensureDailyMetricRow(userId, date);
  await computeAndSaveDailyMetric(userId, date);

  if (parsed.isStepTest) {
    await computeAndSaveThresholds(userId, parsed.sport);
  }

  // Try to reconcile against today's plan item, if this activity is for today.
  if (date === dateStr(new Date())) {
    const item = await prisma.planItem.findFirst({ where: { userId, date: new Date(date), status: "PLANNED" } });
    if (item) {
      const zone = (item.structure as { blocks?: Array<{ zone?: number }> } | null)?.blocks?.find((b) => b.zone)?.zone ?? null;
      const targetZone = null; // zone bounds would need a fresh threshold lookup; kept simple, duration/HR-presence still drives the verdict
      const evalResult = evaluateCompletedSession({
        plannedDurationSec: item.targetDurationSec, actualDurationSec: parsed.durationSec,
        plannedTargetType: item.targetType as DraftPlanItem["targetType"], avgHr: parsed.avgHr ?? null,
        targetZone, rpe: parsed.perceivedExertion ?? null,
      });
      await prisma.planItem.update({ where: { id: item.id }, data: { status: "COMPLETED", activityId: activity.id } });
      await writeInsight(userId, date, "SESSION_LOGGED", evalResult.quality === "PRODUCTIVE" ? "Продуктивная тренировка засчитана" : evalResult.quality === "UNPRODUCTIVE" ? "Тренировка не в полном объёме" : "Тренировка засчитана", evalResult.note, evalResult.quality === "PRODUCTIVE" ? "POSITIVE" : evalResult.quality === "UNPRODUCTIVE" ? "WARNING" : "INFO", { zone });
    }
  }

  return activity;
}

async function ensureDailyMetricRow(userId: string, date: string) {
  await prisma.dailyMetric.upsert({
    where: { userId_date: { userId, date: new Date(date) } },
    update: {},
    create: { userId, date: new Date(date) },
  });
}

export { ensureDailyMetricRow };

// ---------------- Daily briefing ----------------

// Generated once per calendar day (idempotent — a cached briefing is never
// regenerated), after recovery/plan have already been computed, so it can
// synthesize the whole picture instead of racing the numbers it's supposed
// to summarize. Call this last in the daily pipeline (dashboard page /
// cron), after computeAndSaveDailyMetric and ensureTodayPlanItem.
export async function ensureDailyBriefing(userId: string, date: string) {
  const existing = await prisma.dailyMetric.findUnique({ where: { userId_date: { userId, date: new Date(date) } } });
  if (existing?.coachBriefing) return existing.coachBriefing;

  const [profile, planItem, warnings] = await Promise.all([
    prisma.athleteProfile.findUnique({ where: { userId } }),
    prisma.planItem.findFirst({ where: { userId, date: new Date(date) } }),
    prisma.insight.findMany({ where: { userId, date: new Date(date), severity: "WARNING" }, orderBy: { createdAt: "desc" }, take: 2 }),
  ]);

  const context: Record<string, unknown> = {
    вид_спорта: profile ? sportLabel(profile.primarySport) : null,
    готовность: existing?.recoveryScore != null ? `${existing.recoveryScore}/100` : "нет данных",
    сон_часов: existing?.sleepDurationSec ? Math.round((existing.sleepDurationSec / 3600) * 10) / 10 : null,
    нагрузка_сегодня: existing?.strain,
    самочувствие_энергия: existing?.subjectiveEnergy != null ? `${existing.subjectiveEnergy}/5` : null,
    самочувствие_мышечная_усталость: existing?.subjectiveSoreness != null ? `${existing.subjectiveSoreness}/5` : null,
    самочувствие_стресс: existing?.subjectiveStress != null ? `${existing.subjectiveStress}/5` : null,
    самочувствие_заметка: existing?.subjectiveNote ?? null,
    план: planItem ? { название: planItem.title, тип: planItem.targetType, причина: planItem.adjustReason ?? planItem.explanation } : null,
    тревожные_флаги: warnings.length ? warnings.map((w) => w.title) : null,
  };

  const briefing = await generateDailyBriefing(context);
  await prisma.dailyMetric.update({ where: { userId_date: { userId, date: new Date(date) } }, data: { coachBriefing: briefing } });
  return briefing;
}
