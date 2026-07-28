// Training-zone calculators. Everything is threshold-anchored (Friel's
// 7-zone LTHR model / Coggan's 7-zone FTP model) rather than the older
// %HRmax model, because zone WIDTH relative to threshold is far more
// individual than a flat % of max HR — two athletes with the same HRmax can
// have very different LTHR, and %HRmax zones put them in the wrong zone.
// %HRmax is kept only as a last-resort fallback for brand-new users with no
// threshold data yet at all.

export type Zone = { zone: number; label: string; min: number; max: number };

export function hrZonesFromLthr(lthr: number, maxHr?: number): Zone[] {
  // Friel 7-zone model, bounds as % of LTHR.
  const bounds = [
    { zone: 1, label: "Восстановление", lo: 0, hi: 0.81 },
    { zone: 2, label: "Аэробная база (Z2)", lo: 0.81, hi: 0.89 },
    { zone: 3, label: "Темповая", lo: 0.89, hi: 0.94 },
    { zone: 4, label: "Порог (Sub-LT2)", lo: 0.94, hi: 1.0 },
    { zone: 5, label: "Порог+ (Super-LT2)", lo: 1.0, hi: 1.03 },
    { zone: 6, label: "VO2max", lo: 1.03, hi: 1.06 },
    { zone: 7, label: "Анаэробная / спринт", lo: 1.06, hi: 1.15 },
  ];
  const cap = maxHr ?? Math.round(lthr * 1.1);
  return bounds.map((b) => ({
    zone: b.zone,
    label: b.label,
    min: Math.round(lthr * b.lo),
    max: b.zone === 7 ? cap : Math.round(lthr * b.hi),
  }));
}

export function hrZonesFromMaxHr(maxHr: number): Zone[] {
  // Classic 5-zone %HRmax fallback — coarser, used only until we have a
  // real threshold estimate (see ThresholdSnapshot.method).
  const bounds = [
    { zone: 1, label: "Очень легко", lo: 0.5, hi: 0.6 },
    { zone: 2, label: "Легко", lo: 0.6, hi: 0.7 },
    { zone: 3, label: "Средне", lo: 0.7, hi: 0.8 },
    { zone: 4, label: "Тяжело", lo: 0.8, hi: 0.9 },
    { zone: 5, label: "Максимум", lo: 0.9, hi: 1.0 },
  ];
  return bounds.map((b) => ({ zone: b.zone, label: b.label, min: Math.round(maxHr * b.lo), max: Math.round(maxHr * b.hi) }));
}

export function powerZonesFromFtp(ftpWatts: number): Zone[] {
  // Coggan 7-zone model, bounds as % of FTP (≈ LT2 power for a ~60min effort).
  const bounds = [
    { zone: 1, label: "Восстановление", lo: 0, hi: 0.55 },
    { zone: 2, label: "Выносливость (Z2)", lo: 0.55, hi: 0.75 },
    { zone: 3, label: "Темповая", lo: 0.75, hi: 0.9 },
    { zone: 4, label: "Порог (FTP)", lo: 0.9, hi: 1.05 },
    { zone: 5, label: "VO2max", lo: 1.05, hi: 1.2 },
    { zone: 6, label: "Анаэробная ёмкость", lo: 1.2, hi: 1.5 },
    { zone: 7, label: "Нейромышечная", lo: 1.5, hi: 3.0 },
  ];
  return bounds.map((b) => ({ zone: b.zone, label: b.label, min: Math.round(ftpWatts * b.lo), max: Math.round(ftpWatts * b.hi) }));
}

// Pace zones from threshold pace (sec/km) — note pace is inverted (faster =
// smaller number), so zone 1 (easiest) has the LARGEST sec/km bounds.
export function paceZonesFromThresholdPace(thresholdPaceSecPerKm: number): Zone[] {
  const bounds = [
    { zone: 1, label: "Восстановление", lo: 1.29, hi: 10 },
    { zone: 2, label: "Аэробная база (Z2)", lo: 1.14, hi: 1.29 },
    { zone: 3, label: "Темповая", lo: 1.06, hi: 1.14 },
    { zone: 4, label: "Порог", lo: 1.0, hi: 1.06 },
    { zone: 5, label: "VO2max", lo: 0.88, hi: 1.0 },
    { zone: 6, label: "Анаэробная / спринт", lo: 0.6, hi: 0.88 },
  ];
  return bounds.map((b) => ({
    zone: b.zone,
    label: b.label,
    min: Math.round(thresholdPaceSecPerKm * b.lo),
    max: Math.round(thresholdPaceSecPerKm * b.hi),
  }));
}

// Tanaka et al. 2001 — more accurate across age ranges than the old 220-age
// rule, used only as a fallback when the athlete has no measured/manual max HR.
export function estimateMaxHr(age: number): number {
  return Math.round(208 - 0.7 * age);
}
