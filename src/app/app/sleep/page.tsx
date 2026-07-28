import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { SleepChart } from "@/components/app/sleep-chart";
import { LogSleepForm } from "@/components/app/log-sleep-form";
import { Moon, AlarmClock } from "lucide-react";

export default async function SleepPage() {
  const session = await auth();
  const userId = session!.user.id;
  const profile = await prisma.athleteProfile.findUnique({ where: { userId } });

  const since = new Date();
  since.setDate(since.getDate() - 14);
  const metrics = await prisma.dailyMetric.findMany({ where: { userId, date: { gte: since } }, orderBy: { date: "asc" } });

  const chartData = metrics
    .filter((m) => m.sleepDurationSec)
    .map((m) => ({ date: m.date.toLocaleDateString("ru-RU", { day: "numeric", month: "short" }), hours: Math.round((m.sleepDurationSec! / 3600) * 10) / 10, score: m.sleepScore }));

  const latest = metrics.at(-1);
  const debtHours = latest?.sleepDebtSec ? Math.round((latest.sleepDebtSec / 3600) * 10) / 10 : 0;
  const avgHours = chartData.length ? Math.round((chartData.reduce((a, d) => a + d.hours, 0) / chartData.length) * 10) / 10 : null;

  return (
    <div>
      <h1 className="font-display flex items-center gap-2 text-2xl font-extrabold sm:text-3xl"><Moon className="h-6 w-6 text-(--color-brand-blue)" /> Сон</h1>
      <p className="mt-1 text-(--color-ink-soft)">Цель: {profile?.sleepGoalHours ?? 8} ч/ночь.</p>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="card-surface p-5">
          <div className="text-xs font-bold uppercase tracking-wide text-(--color-ink-soft)">Прошлой ночью</div>
          <div className="font-display mt-1 text-2xl font-extrabold">{latest?.sleepDurationSec ? `${Math.round((latest.sleepDurationSec / 3600) * 10) / 10} ч` : "—"}</div>
        </div>
        <div className="card-surface p-5">
          <div className="text-xs font-bold uppercase tracking-wide text-(--color-ink-soft)">Среднее за 14 дней</div>
          <div className="font-display mt-1 text-2xl font-extrabold">{avgHours ? `${avgHours} ч` : "—"}</div>
        </div>
        <div className="card-surface p-5">
          <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-(--color-ink-soft)"><AlarmClock className="h-3.5 w-3.5" /> Долг сна</div>
          <div className="font-display mt-1 text-2xl font-extrabold" style={{ color: debtHours > 1.5 ? "var(--color-brand-pink)" : "var(--color-brand-green)" }}>{debtHours} ч</div>
        </div>
      </div>

      <div className="mt-6 card-surface p-5">
        {chartData.length > 1 ? <SleepChart data={chartData} /> : <p className="py-10 text-center text-sm text-(--color-ink-soft)">Пока мало данных для графика — запиши сон за несколько ночей.</p>}
      </div>

      <div className="mt-6">
        <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-(--color-ink-soft)">Записать сон вручную</h2>
        <LogSleepForm />
        <p className="mt-2 text-xs text-(--color-ink-soft)">Если Garmin/Polar подключены — сон подтягивается автоматически, ручная запись не обязательна.</p>
      </div>
    </div>
  );
}
