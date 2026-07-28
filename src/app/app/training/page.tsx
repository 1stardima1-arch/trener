import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { sportLabel, formatDuration, formatPace, kmFromMeters } from "@/lib/sports";
import { LogActivityPanel } from "@/components/app/log-activity-panel";
import { StepTestForm } from "@/components/app/step-test-form";
import { PlanItemActions } from "@/components/app/plan-item-actions";
import { Zap, Target, Gauge } from "lucide-react";

function fmtDate(d: Date) {
  return d.toLocaleDateString("ru-RU", { weekday: "short", day: "numeric", month: "short" });
}

const STATUS_LABEL: Record<string, string> = { PLANNED: "План", COMPLETED: "Выполнено", SKIPPED: "Пропущено", MODIFIED: "Изменено" };
const STATUS_COLOR: Record<string, string> = { PLANNED: "var(--color-ink-soft)", COMPLETED: "var(--color-brand-green)", SKIPPED: "var(--color-brand-pink)", MODIFIED: "var(--color-brand-amber)" };

export default async function TrainingPage() {
  const session = await auth();
  const userId = session!.user.id;
  const profile = await prisma.athleteProfile.findUnique({ where: { userId } });

  const start = new Date();
  start.setDate(start.getDate() - 2);
  start.setHours(0, 0, 0, 0);
  const end = new Date();
  end.setDate(end.getDate() + 7);

  const [items, snapshot, recentActivities] = await Promise.all([
    prisma.planItem.findMany({ where: { userId, date: { gte: start, lte: end } }, orderBy: { date: "asc" } }),
    profile ? prisma.thresholdSnapshot.findFirst({ where: { userId, sport: profile.primarySport }, orderBy: { computedAt: "desc" } }) : null,
    prisma.activity.findMany({ where: { userId }, orderBy: { startedAt: "desc" }, take: 8 }),
  ]);

  const todayStr = new Date().toISOString().slice(0, 10);
  const hrZones = snapshot?.hrZones as Array<{ zone: number; label: string; min: number; max: number }> | null;
  const paceZones = snapshot?.paceZones as Array<{ zone: number; label: string; min: number; max: number }> | null;

  return (
    <div>
      <h1 className="font-display text-2xl font-extrabold sm:text-3xl">Тренировки</h1>
      <p className="mt-1 text-(--color-ink-soft)">План адаптируется под твою готовность каждый день.</p>

      <div className="mt-6 space-y-2.5">
        {items.map((item) => {
          const isToday = item.date.toISOString().slice(0, 10) === todayStr;
          return (
            <div key={item.id} id={isToday ? "why" : undefined} className={`card-surface p-5 ${isToday ? "shadow-(--shadow-glow)" : ""}`}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-(--color-ink-soft)">
                  {fmtDate(item.date)} {isToday && <span className="rounded-full bg-(--color-brand-blue)/15 px-2 py-0.5 text-(--color-brand-blue)">Сегодня</span>}
                </div>
                <span className="text-xs font-bold" style={{ color: STATUS_COLOR[item.status] }}>{STATUS_LABEL[item.status]}</span>
              </div>
              <div className="mt-1.5 font-display text-lg font-bold">{item.title}</div>
              <p className="mt-1 text-sm text-(--color-ink-soft)">{item.description}</p>
              <div className="mt-2 flex flex-wrap gap-3 text-sm font-semibold">
                {item.targetDurationSec && <span>{formatDuration(item.targetDurationSec)}</span>}
                {item.targetLoad != null && <span className="text-(--color-ink-soft)">нагрузка ≈{Math.round(item.targetLoad)}</span>}
              </div>
              {(item.adjustReason || isToday) && (
                <div className="mt-3 rounded-2xl bg-(--color-paper-dim) p-3.5 text-sm">
                  <div className="flex items-center gap-1.5 font-bold text-xs uppercase tracking-wide text-(--color-ink-soft)"><Zap className="h-3.5 w-3.5 text-(--color-brand-amber)" /> Почему</div>
                  <p className="mt-1 text-(--color-ink-soft)">{item.adjustReason ?? item.explanation}</p>
                </div>
              )}
              {item.status === "PLANNED" && <PlanItemActions planItemId={item.id} />}
            </div>
          );
        })}
        {items.length === 0 && <div className="card-surface p-6 text-center text-(--color-ink-soft)">План ещё формируется — загляни чуть позже.</div>}
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <div>
          <h2 className="mb-3 flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-(--color-ink-soft)"><Target className="h-4 w-4" /> Твои зоны</h2>
          <div className="card-surface p-5">
            {!snapshot ? (
              <p className="text-sm text-(--color-ink-soft)">Пороги ещё не рассчитаны — пройди степ-тест с лактатом ниже или подожди первых тренировок с пульсом.</p>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div><div className="text-xs text-(--color-ink-soft)">ЧСС порог (LTHR)</div><div className="font-bold">{snapshot.lthrBpm ?? "—"} уд/мин</div></div>
                  <div><div className="text-xs text-(--color-ink-soft)">VO2max</div><div className="font-bold">{snapshot.vo2max ?? "—"} мл/кг/мин</div></div>
                  <div><div className="text-xs text-(--color-ink-soft)">LT2 темп</div><div className="font-bold">{formatPace(snapshot.lt2PaceSecPerKm)}</div></div>
                  <div><div className="text-xs text-(--color-ink-soft)">LT2 лактат</div><div className="font-bold">{snapshot.lt2Mmol ?? "—"} ммоль/л</div></div>
                </div>
                {hrZones && (
                  <div className="mt-4 space-y-1.5">
                    {hrZones.map((z) => (
                      <div key={z.zone} className="flex items-center justify-between rounded-lg bg-(--color-paper-dim) px-3 py-1.5 text-xs">
                        <span className="font-semibold">Z{z.zone} · {z.label}</span>
                        <span className="text-(--color-ink-soft)">{z.min}-{z.max} уд/мин</span>
                      </div>
                    ))}
                  </div>
                )}
                {paceZones && (
                  <div className="mt-4 space-y-1.5">
                    <div className="text-xs font-bold uppercase tracking-wide text-(--color-ink-soft)">Зоны темпа</div>
                    {paceZones.map((z) => (
                      <div key={z.zone} className="flex items-center justify-between rounded-lg bg-(--color-paper-dim) px-3 py-1.5 text-xs">
                        <span className="font-semibold">Z{z.zone} · {z.label}</span>
                        <span className="text-(--color-ink-soft)">{formatPace(z.max)}–{formatPace(z.min)}</span>
                      </div>
                    ))}
                  </div>
                )}
                <p className="mt-3 text-xs text-(--color-ink-soft)">{snapshot.explanation}</p>
              </>
            )}
          </div>

          <h2 className="mb-3 mt-6 flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-(--color-ink-soft)"><Gauge className="h-4 w-4" /> Степ-тест на лактат</h2>
          <StepTestForm defaultSport={profile?.primarySport ?? "running"} />
        </div>

        <div>
          <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-(--color-ink-soft)">Записать тренировку</h2>
          <LogActivityPanel defaultSport={profile?.primarySport ?? "running"} />

          <h2 className="mb-3 mt-6 text-sm font-bold uppercase tracking-wide text-(--color-ink-soft)">Последние тренировки</h2>
          <div className="space-y-2">
            {recentActivities.map((a) => (
              <div key={a.id} className="card-surface flex items-center gap-3 p-3.5">
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold">{sportLabel(a.sport)} · {formatDuration(a.durationSec)}</div>
                  <div className="text-xs text-(--color-ink-soft)">{a.startedAt.toLocaleDateString("ru-RU")} {a.distanceM ? `· ${kmFromMeters(a.distanceM)} км` : ""} {a.avgHr ? `· ${a.avgHr} уд/мин` : ""}</div>
                </div>
              </div>
            ))}
            {recentActivities.length === 0 && <div className="card-surface p-5 text-center text-sm text-(--color-ink-soft)">Пока нет тренировок.</div>}
          </div>
        </div>
      </div>
    </div>
  );
}
