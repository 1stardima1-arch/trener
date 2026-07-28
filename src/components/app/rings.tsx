"use client";

import { motion } from "framer-motion";
import { ArrowUp, ArrowDown } from "lucide-react";

// A circular progress ring — SVG stroke-dash animated on mount, with a soft
// colored glow behind it (breathing gently when `glow` is set) and a
// drop-shadow on the stroke itself, so the headline numbers read as "alive"
// rather than a flat screenshot. Kept generic (value/color/label) so
// recovery, sleep, and strain all reuse it with their own scale/color.
export function Ring({
  value, max = 100, size = 140, strokeWidth = 12, color, label, sublabel, glow = false, deltaVsYesterday,
}: {
  value: number; max?: number; size?: number; strokeWidth?: number; color: string;
  label: string; sublabel?: string; glow?: boolean; deltaVsYesterday?: number | null;
}) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const pct = Math.max(0, Math.min(1, value / max));
  const fontSize = Math.max(14, Math.round(size * 0.22));

  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      {glow && (
        <motion.div
          className="absolute inset-0 rounded-full"
          style={{ background: color, filter: `blur(${size * 0.18}px)` }}
          initial={{ opacity: 0 }}
          animate={{ opacity: [0.16, 0.3, 0.16] }}
          transition={{ duration: 3.6, repeat: Infinity, ease: "easeInOut" }}
        />
      )}
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} strokeWidth={strokeWidth} className="stroke-white/6" fill="none" />
        <motion.circle
          cx={size / 2} cy={size / 2} r={radius} strokeWidth={strokeWidth} stroke={color} fill="none" strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: circumference * (1 - pct) }}
          transition={{ duration: 1.3, ease: [0.22, 1, 0.36, 1] }}
          style={{ filter: `drop-shadow(0 0 ${Math.max(3, strokeWidth * 0.4)}px ${color}99)` }}
        />
      </svg>
      <div className="absolute flex flex-col items-center">
        <span className="font-display font-extrabold" style={{ color, fontSize }}>{label}</span>
        {sublabel && <span className="text-xs font-semibold text-(--color-ink-soft)">{sublabel}</span>}
        {deltaVsYesterday != null && Math.abs(deltaVsYesterday) >= 1 && (
          <span className={`mt-0.5 flex items-center gap-0.5 text-[0.65rem] font-bold ${deltaVsYesterday > 0 ? "text-(--color-brand-green)" : "text-(--color-brand-pink)"}`}>
            {deltaVsYesterday > 0 ? <ArrowUp className="h-2.5 w-2.5" /> : <ArrowDown className="h-2.5 w-2.5" />}
            {Math.abs(Math.round(deltaVsYesterday))}
          </span>
        )}
      </div>
    </div>
  );
}

