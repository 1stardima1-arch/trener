"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { SleepChart } from "@/components/app/sleep-chart";
import { RecoveryBarChart, HrvLineChart, StrainBarChart } from "@/components/app/trend-charts";
import { CheckCircle2, XCircle, HeartPulse } from "lucide-react";
import type { RangeCheck } from "@/lib/physiology/health-ranges";

const TABS = ["overview", "sleep", "recovery", "strain"] as const;
const TAB_LABEL: Record<(typeof TABS)[number], string> = { overview: "Обзор", sleep: "Сон", recovery: "Восстановление", strain: "Нагрузка" };

export type HealthMetricRow = {
  date: string; hrv: number | null; restingHr: number | null; respiratoryRate: number | null;
  spo2: number | null; skinTempDeviationC: number | null; recoveryScore: number | null; strain: number | null;
  sleepHours: number | null; sleepScore: number | null;
};

export function HealthTabs({
  rows, latestHr, bloodPressureLabel, checks, sleepGoalHours,
}: {
  rows: HealthMetricRow[];
  latestHr: number | null;
  bloodPressureLabel: string;
  checks: { respiratoryRate: RangeCheck; spo2: RangeCheck; restingHr: RangeCheck; hrv: RangeCheck; skinTemp: RangeCheck; bloodPressure: RangeCheck };
  sleepGoalHours: number;
}) {
  const [tab, setTab] = useState<(typeof TABS)[number]>("overview");
  const latest = rows.at(-1);

  return (
    <div>
      <div className="flex gap-1 overflow-x-auto rounded-full bg-(--color-surface) p-1">
        {TABS.map((t) => (
          <button key={t} onClick={() => setTab(t)} className={cn("flex-1 whitespace-nowrap rounded-full px-4 py-2 text-xs font-bold transition-colors", tab === t ? "bg-white/10 text-white" : "text-(--color-ink-soft)")}>
            {TAB_LABEL[t]}
          </button>
        ))}
      </div>

      {tab === "overview" && (
        <div className="mt-5 space-y-4">
          <div className="card-surface p-5">
            <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-(--color-ink-soft)"><HeartPulse className="h-3.5 w-3.5" /> Пульс покоя</div>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="font-display text-4xl font-extrabold">{latestHr ?? "—"}</span>
              <span className="text-sm text-(--color-ink-soft)">уд/мин</span>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <MetricCard label="Частота дыхания" value={latest?.respiratoryRate != null ? `${latest.respiratoryRate.toFixed(1)} rpm` : "—"} check={checks.respiratoryRate} />
            <MetricCard label="Сатурация O2" value={latest?.spo2 != null ? `${latest.spo2}%` : "—"} check={checks.spo2} />
            <MetricCard label="Пульс покоя" value={latest?.restingHr != null ? `${latest.restingHr} bpm` : "—"} check={checks.restingHr} />
            <MetricCard label="ВСР (HRV)" value={latest?.hrv != null ? `${latest.hrv.toFixed(0)} мс` : "—"} check={checks.hrv} />
            <MetricCard label="Темп. кожи (откл.)" value={latest?.skinTempDeviationC != null ? `${latest.skinTempDeviationC > 0 ? "+" : ""}${latest.skinTempDeviationC.toFixed(1)}°C` : "—"} check={checks.skinTemp} />
            <MetricCard label="Давление" value={bloodPressureLabel} check={checks.bloodPressure} />
          </div>
        </div>
      )}

      {tab === "sleep" && (
        <div className="mt-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <StatBox label="Сон прошлой ночью" value={latest?.sleepHours != null ? `${latest.sleepHours} ч` : "—"} />
            <StatBox label="Цель сна" value={`${sleepGoalHours} ч`} />
          </div>
          <div className="card-surface p-5">
            {rows.filter((r) => r.sleepHours != null).length > 1 ? (
              <SleepChart data={rows.filter((r) => r.sleepHours != null).map((r) => ({ date: r.date, hours: r.sleepHours!, score: r.sleepScore }))} />
            ) : (
              <p className="py-10 text-center text-sm text-(--color-ink-soft)">Пока мало данных для графика.</p>
            )}
          </div>
        </div>
      )}

      {tab === "recovery" && (
        <div className="mt-5 space-y-4">
          <div className="card-surface p-5">
            <div className="mb-2 text-xs font-bold uppercase tracking-wide text-(--color-ink-soft)">Готовность за 7 дней</div>
            <RecoveryBarChart data={rows.slice(-7).map((r) => ({ date: r.date, score: r.recoveryScore }))} />
          </div>
          <div className="card-surface p-5">
            <div className="mb-2 text-xs font-bold uppercase tracking-wide text-(--color-ink-soft)">Вариабельность сердечного ритма</div>
            <HrvLineChart data={rows.slice(-7).map((r) => ({ date: r.date, hrv: r.hrv }))} />
          </div>
        </div>
      )}

      {tab === "strain" && (
        <div className="mt-5 space-y-4">
          <div className="card-surface p-5">
            <div className="mb-2 text-xs font-bold uppercase tracking-wide text-(--color-ink-soft)">Нагрузка за 7 дней</div>
            <StrainBarChart data={rows.slice(-7).map((r) => ({ date: r.date, strain: r.strain }))} />
          </div>
        </div>
      )}
    </div>
  );
}

function MetricCard({ label, value, check }: { label: string; value: string; check: RangeCheck }) {
  return (
    <div className="card-surface p-4">
      <div className="text-xs font-bold uppercase tracking-wide text-(--color-ink-soft)">{label}</div>
      <div className="font-display mt-1 text-xl font-extrabold">{value}</div>
      {check.withinRange != null && (
        <div className={cn("mt-1.5 flex items-center gap-1 text-[0.68rem] font-semibold", check.withinRange ? "text-(--color-brand-green)" : "text-(--color-brand-pink)")}>
          {check.withinRange ? <CheckCircle2 className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
          {check.rangeLabel}
        </div>
      )}
    </div>
  );
}

function StatBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="card-surface p-5">
      <div className="text-xs font-bold uppercase tracking-wide text-(--color-ink-soft)">{label}</div>
      <div className="font-display mt-1 text-2xl font-extrabold">{value}</div>
    </div>
  );
}
