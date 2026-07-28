import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { isAdminSession } from "@/lib/admin";
import { ensureDailyMetricRow, computeAndSaveDailyMetric, ensureTodayPlanItem, ensureDailyBriefing } from "@/lib/engine";
import { sportLabel, formatDuration } from "@/lib/sports";
import { Ring, recoveryColor, recoveryBand } from "@/components/app/rings";
import { AskCoachBar } from "@/components/app/ask-coach-bar";
import { ChevronLeft, ChevronRight, Moon, Dumbbell, Apple, Activity as ActivityIcon, Zap, Plus, CheckCircle2, AlertTriangle, Sparkles } from "lucide-react";

function toDateStr(d: Date) {
  return d.toISOString().slice(0, 10);
}
function todayStr() {
  return toDateStr(new Date());
}
function addDays(dateStr: string, delta: number) {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + delta);
  return toDateStr(d);
}

const SEVERITY_COLOR: Record<string, string> = { POSITIVE: "var(--color-brand-green)", WARNING: "var(--color-brand-pink)", INFO: "var(--color-brand-blue)" };

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ date?: string }> }) {
  const session = await auth();
  if (isAdminSession(session)) redirect("/app/admin");
  const userId = session!.user.id;

  const { date: dateParam } = await searchParams;
  const today = todayStr();
  const date = dateParam && dateParam <= today ? dateParam : today;
  const isToday = date === today;

  const profile = await prisma.athleteProfile.findUnique({ where: { userId } });
  if (!profile?.onboardingCompletedAt) {
    return <div className="card-surface p-8 text-center text-(--color-ink-soft)">Заверши настройку профиля, чтобы увидеть дашборд.</div>;
  }

  let briefing: string | null = null;
  if (isToday) {
    try {
      await ensureDailyMetricRow(userId, date);
      await computeAndSaveDailyMetric(userId, date);
      await ensureTodayPlanItem(userId);
      briefing = await ensureDailyBriefing(userId, date);
    } catch (e) {
      console.error("dashboard recompute failed", e);
    }
  }

  const [metric, yesterdayMetric, planItems, insights, deviceCount] = await Promise.all([
    prisma.dailyMetric.findUnique({ where: { userId_date: { userId, date: new Date(date) } } }),
    prisma.dailyMetric.findUnique({ where: { userId_date: { userId, date: new Date(addDays(date, -1)) } } }),
    prisma.planItem.findMany({ where: { userId, date: new Date(date) } }),
    prisma.insight.findMany({ where: { userId, date: new Date(date) }, orderBy: { createdAt: "desc" } }),
    prisma.deviceConnection.count({ where: { userId, status: "CONNECTED" } }),
  ]);
  const planItem = planItems[0];
  const warnings = insights.filter((i) => i.severity === "WARNING" && (i.type === "ILLNESS_RISK" || i.type === "OVERREACHING_RISK"));

  const firstName = session!.user.name?.split(" ")[0] ?? "";
  const sleepHours = metric?.sleepDurationSec ? Math.round((metric.sleepDurationSec / 3600) * 10) / 10 : null;
  const yesterdaySleepHours = yesterdayMetric?.sleepDurationSec ? Math.round((yesterdayMetric.sleepDurationSec / 3600) * 10) / 10 : null;
  const dateLabel = isToday ? "СЕГОДНЯ" : new Date(date).toLocaleDateString("ru-RU", { weekday: "short", day: "numeric", month: "short" }).toUpperCase();
  const band = recoveryBand(metric?.recoveryScore);

  return (
    <div>
      <div className="flex items-center justify-center gap-4">
        <Link href={`/app?date=${addDays(date, -1)}`} className="press-spring flex h-8 w-8 items-center justify-center rounded-full bg-(--color-surface) text-(--color-ink-soft)">
          <ChevronLeft className="h-4 w-4" />
        </Link>
        <span className="min-w-[7rem] text-center text-xs font-bold tracking-widest text-(--color-ink-soft)">{dateLabel}</span>
        {!isToday ? (
          <Link href={`/app?date=${addDays(date, 1)}`} className="press-spring flex h-8 w-8 items-center justify-center rounded-full bg-(--color-surface) text-(--color-ink-soft)">
            <ChevronRight className="h-4 w-4" />
          </Link>
        ) : (
          <span className="flex h-8 w-8 items-center justify-center rounded-full text-(--color-ink-soft)/30"><ChevronRight className="h-4 w-4" /></span>
        )}
      </div>
      <h1 className="font-display mt-1 text-center text-2xl font-extrabold tracking-tight">{firstName ? `Привет, ${firstName}` : "Тренер"}</h1>

      {warnings.length > 0 && (
        <div className="mt-4 rounded-2xl border border-(--color-brand-pink)/25 bg-(--color-brand-pink)/8 p-4">
          {warnings.map((w) => (
            <div key={w.id} className="flex items-start gap-2.5">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-(--color-brand-pink)" />
              <div>
                <div className="text-sm font-bold text-(--color-brand-pink)">{w.title}</div>
                <p className="mt-0.5 text-sm text-(--color-ink-soft)">{w.body}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {isToday && briefing && (
        <div className="siri-panel relative mt-4 overflow-hidden p-5">
          <div className="relative z-10 flex items-start gap-3">
            <span className="siri-orb mt-0.5 h-8 w-8 shrink-0" />
            <div>
              <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-white/50"><Sparkles className="h-3 w-3" /> Слово тренера</div>
              <p className="mt-1.5 text-sm leading-relaxed text-white/90">{briefing}</p>
            </div>
          </div>
        </div>
      )}

      <div className="mt-6 grid grid-cols-3 items-end gap-2 sm:gap-4">
        <div className="flex flex-col items-center gap-1.5">
          <Ring value={sleepHours ?? 0} max={profile.sleepGoalHours} size={96} strokeWidth={9} color="var(--color-brand-blue)" label={sleepHours != null ? `${sleepHours}ч` : "—"} deltaVsYesterday={sleepHours != null && yesterdaySleepHours != null ? sleepHours - yesterdaySleepHours : null} />
          <span className="text-[0.65rem] font-bold uppercase tracking-wide text-(--color-ink-soft)">Сон</span>
        </div>
        <div className="flex flex-col items-center gap-1.5">
          <Ring value={metric?.recoveryScore ?? 0} size={140} strokeWidth={13} color={recoveryColor(metric?.recoveryScore)} label={metric?.recoveryScore != null ? `${metric.recoveryScore}%` : "—"} glow={band === "HIGH"} deltaVsYesterday={metric?.recoveryScore != null && yesterdayMetric?.recoveryScore != null ? metric.recoveryScore - yesterdayMetric.recoveryScore : null} />
          <span className="text-[0.65rem] font-bold uppercase tracking-wide text-(--color-ink-soft)">Восстановление</span>
        </div>
        <div className="flex flex-col items-center gap-1.5">
          <Ring value={metric?.strain ?? 0} max={21} size={96} strokeWidth={9} color="var(--color-brand-violet)" label={metric?.strain != null ? metric.strain.toFixed(1) : "—"} />
          <span className="text-[0.65rem] font-bold uppercase tracking-wide text-(--color-ink-soft)">Нагрузка</span>
        </div>
      </div>

      {isToday && (
        <div className="mt-6">
          <AskCoachBar />
        </div>
      )}

      <div className="mt-4 grid grid-cols-2 gap-3">
        <Link href="/app/health" className="card-surface press-spring p-4">
          <div className="flex items-center gap-1.5 text-[0.65rem] font-bold uppercase tracking-wide text-(--color-ink-soft)"><ActivityIcon className="h-3.5 w-3.5" /> Health Monitor</div>
          <div className="mt-1.5 text-sm font-bold">
            {metric?.hrvMs || metric?.restingHr ? "Данные обновлены" : "Ожидание данных"}
          </div>
        </Link>
        {deviceCount === 0 ? (
          <Link href="/app/devices" className="card-surface press-spring p-4">
            <div className="text-[0.65rem] font-bold uppercase tracking-wide text-(--color-ink-soft)">Устройства</div>
            <div className="mt-1.5 text-sm font-bold text-(--color-brand-amber)">Подключить</div>
          </Link>
        ) : (
          <Link href="/app/nutrition" className="card-surface press-spring p-4">
            <div className="flex items-center gap-1.5 text-[0.65rem] font-bold uppercase tracking-wide text-(--color-ink-soft)"><Apple className="h-3.5 w-3.5" /> Питание</div>
            <div className="mt-1.5 text-sm font-bold">Норма на сегодня</div>
          </Link>
        )}
      </div>

      {planItem && (
        <div className="mt-6 card-surface p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-(--color-ink-soft)">
              <Dumbbell className="h-4 w-4" /> Мой день
            </div>
            <Link href="/app/training" className="text-sm font-semibold text-(--color-brand-blue)">Весь план</Link>
          </div>
          <div className="mt-2 flex items-center justify-between gap-2">
            <div className="min-w-0">
              <div className="font-display truncate text-xl font-bold">{planItem.title}</div>
              <p className="mt-1 text-sm text-(--color-ink-soft)">{planItem.description}</p>
            </div>
            {planItem.status === "COMPLETED" && <CheckCircle2 className="h-6 w-6 shrink-0 text-(--color-brand-green)" />}
          </div>
          {planItem.targetDurationSec && <div className="mt-2 text-sm font-semibold">{formatDuration(planItem.targetDurationSec)}</div>}
          <div className="mt-4 rounded-2xl bg-(--color-paper-dim) p-4 text-sm">
            <div className="flex items-center gap-1.5 font-bold"><Zap className="h-4 w-4 text-(--color-brand-amber)" /> Почему именно так</div>
            <p className="mt-1.5 text-(--color-ink-soft)">{planItem.adjustReason ?? planItem.explanation}</p>
          </div>
        </div>
      )}

      <div className="mt-6 flex items-center justify-between">
        <h2 className="text-sm font-bold uppercase tracking-wide text-(--color-ink-soft)">Тренировки дня</h2>
        <Link href="/app/training" className="press-spring flex h-8 w-8 items-center justify-center rounded-full bg-(--color-surface) text-(--color-ink-soft)"><Plus className="h-4 w-4" /></Link>
      </div>
      <div className="mt-3 space-y-2">
        {planItems.length === 0 && <div className="card-surface p-5 text-center text-sm text-(--color-ink-soft)">Пока пусто.</div>}
        {planItems.map((p) => (
          <div key={p.id} className="card-surface flex items-center gap-3 p-4">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-(--color-brand-blue)/12 text-(--color-brand-blue)"><Dumbbell className="h-4 w-4" /></span>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-semibold">{p.title}</div>
              <div className="text-xs text-(--color-ink-soft)">{sportLabel(p.sport)}</div>
            </div>
            {p.status === "COMPLETED" && <CheckCircle2 className="h-4 w-4 shrink-0 text-(--color-brand-green)" />}
          </div>
        ))}
      </div>

      {insights.length > 0 && (
        <div className="mt-8">
          <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-(--color-ink-soft)">Лента изменений</h2>
          <div className="space-y-2.5">
            {insights.map((i) => (
              <div key={i.id} className="card-surface flex items-start gap-3 p-4">
                <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: SEVERITY_COLOR[i.severity] ?? SEVERITY_COLOR.INFO }} />
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-bold">{i.title}</div>
                  <p className="mt-0.5 text-sm text-(--color-ink-soft)">{i.body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {!isToday && (
        <div className="mt-8 flex justify-center">
          <Link href="/app" className="press-spring flex items-center gap-1.5 rounded-full bg-(--color-surface) px-5 py-2.5 text-sm font-bold"><Moon className="h-4 w-4" /> Вернуться к сегодня</Link>
        </div>
      )}
    </div>
  );
}
