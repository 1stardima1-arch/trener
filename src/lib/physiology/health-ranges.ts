// Simple "is this within a healthy range" checks for the Health Monitor
// grid. Where we have the athlete's own rolling baseline (HRV, RHR) the
// check is personalized (±1 SD); where we don't (SpO2, respiratory rate,
// blood pressure, skin temp) it falls back to standard clinical reference
// ranges. This is informational, not diagnostic — see /terms.

export type RangeCheck = { withinRange: boolean | null; rangeLabel: string };

export function checkRespiratoryRate(rpm: number | null): RangeCheck {
  if (rpm == null) return { withinRange: null, rangeLabel: "—" };
  return { withinRange: rpm >= 12 && rpm <= 20, rangeLabel: "12–20 вдох/мин" };
}

export function checkSpo2(pct: number | null): RangeCheck {
  if (pct == null) return { withinRange: null, rangeLabel: "—" };
  return { withinRange: pct >= 95, rangeLabel: "от 95%" };
}

export function checkBaseline(value: number | null, baseline: { mean: number; stdDev: number } | null): RangeCheck {
  if (value == null || !baseline) return { withinRange: null, rangeLabel: "недостаточно данных" };
  const lo = Math.round(baseline.mean - baseline.stdDev);
  const hi = Math.round(baseline.mean + baseline.stdDev);
  return { withinRange: value >= lo && value <= hi, rangeLabel: `${lo}–${hi} (твоя норма)` };
}

export function checkSkinTemp(deviationC: number | null): RangeCheck {
  if (deviationC == null) return { withinRange: null, rangeLabel: "—" };
  return { withinRange: Math.abs(deviationC) <= 1, rangeLabel: "±1°C от нормы" };
}

export function checkBloodPressure(sys: number | null, dia: number | null): RangeCheck {
  if (sys == null || dia == null) return { withinRange: null, rangeLabel: "—" };
  return { withinRange: sys >= 90 && sys <= 130 && dia >= 60 && dia <= 85, rangeLabel: "до 130/85" };
}
