"use client";

import { ResponsiveContainer, BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Cell } from "recharts";
import { CHART } from "@/lib/chart-colors";
import { recoveryColor } from "@/components/app/rings";

export function RecoveryBarChart({ data }: { data: { date: string; score: number | null }[] }) {
  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={data}>
        <CartesianGrid stroke={CHART.grid} vertical={false} />
        <XAxis dataKey="date" tick={{ fontSize: 11, fill: CHART.textSecondary }} axisLine={false} tickLine={false} />
        <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: CHART.textSecondary }} axisLine={false} tickLine={false} width={28} />
        <Tooltip contentStyle={{ background: CHART.surface, border: "none", borderRadius: 12, fontSize: 12 }} />
        <Bar dataKey="score" radius={[6, 6, 6, 6]}>
          {data.map((d, i) => (
            <Cell key={i} fill={d.score != null ? recoveryColor(d.score) : "rgba(255,255,255,0.08)"} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

export function HrvLineChart({ data }: { data: { date: string; hrv: number | null }[] }) {
  return (
    <ResponsiveContainer width="100%" height={200}>
      <LineChart data={data}>
        <CartesianGrid stroke={CHART.grid} vertical={false} />
        <XAxis dataKey="date" tick={{ fontSize: 11, fill: CHART.textSecondary }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fontSize: 11, fill: CHART.textSecondary }} axisLine={false} tickLine={false} width={28} />
        <Tooltip contentStyle={{ background: CHART.surface, border: "none", borderRadius: 12, fontSize: 12 }} />
        <Line type="monotone" dataKey="hrv" stroke={CHART.blue} strokeWidth={2} dot={{ r: 3, fill: CHART.blue }} connectNulls />
      </LineChart>
    </ResponsiveContainer>
  );
}

export function StrainBarChart({ data }: { data: { date: string; strain: number | null }[] }) {
  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={data}>
        <CartesianGrid stroke={CHART.grid} vertical={false} />
        <XAxis dataKey="date" tick={{ fontSize: 11, fill: CHART.textSecondary }} axisLine={false} tickLine={false} />
        <YAxis domain={[0, 21]} tick={{ fontSize: 11, fill: CHART.textSecondary }} axisLine={false} tickLine={false} width={28} />
        <Tooltip contentStyle={{ background: CHART.surface, border: "none", borderRadius: 12, fontSize: 12 }} />
        <Bar dataKey="strain" radius={[6, 6, 6, 6]} fill="#8b5cf6" />
      </BarChart>
    </ResponsiveContainer>
  );
}
