"use client";

import { motion } from "framer-motion";

// A single circular progress ring, Whoop-dashboard style — SVG stroke-dash
// animated on mount. Kept generic (value/color/label) so recovery, sleep,
// and strain can all reuse it with their own scale/color.
export function Ring({
  value, max = 100, size = 140, strokeWidth = 12, color, label, sublabel,
}: {
  value: number; max?: number; size?: number; strokeWidth?: number; color: string; label: string; sublabel?: string;
}) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const pct = Math.max(0, Math.min(1, value / max));

  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} strokeWidth={strokeWidth} className="stroke-black/5 dark:stroke-white/8" fill="none" />
        <motion.circle
          cx={size / 2} cy={size / 2} r={radius} strokeWidth={strokeWidth} stroke={color} fill="none" strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: circumference * (1 - pct) }}
          transition={{ duration: 1.1, ease: [0.22, 1, 0.36, 1] }}
        />
      </svg>
      <div className="absolute flex flex-col items-center">
        <span className="font-display text-3xl font-extrabold" style={{ color }}>{label}</span>
        {sublabel && <span className="text-xs font-semibold text-(--color-ink-soft)">{sublabel}</span>}
      </div>
    </div>
  );
}

export function recoveryColor(score: number | null | undefined): string {
  if (score == null) return "var(--color-ink-soft)";
  if (score >= 67) return "var(--color-brand-green)";
  if (score >= 34) return "var(--color-brand-amber)";
  return "var(--color-brand-pink)";
}
