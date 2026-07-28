"use client";

import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip } from "recharts";
import { CHART } from "@/lib/chart-colors";

export function SleepChart({ data }: { data: { date: string; hours: number; score: number | null }[] }) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <AreaChart data={data}>
        <defs>
          <linearGradient id="sleepFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={CHART.blue} stopOpacity={0.35} />
            <stop offset="100%" stopColor={CHART.blue} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke={CHART.grid} vertical={false} />
        <XAxis dataKey="date" tick={{ fontSize: 11, fill: CHART.textSecondary }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fontSize: 11, fill: CHART.textSecondary }} axisLine={false} tickLine={false} width={28} />
        <Tooltip contentStyle={{ background: CHART.surface, border: "none", borderRadius: 12, fontSize: 12 }} />
        <Area type="monotone" dataKey="hours" stroke={CHART.blue} strokeWidth={2} fill="url(#sleepFill)" />
      </AreaChart>
    </ResponsiveContainer>
  );
}
