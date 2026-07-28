// Lactate/HR threshold detection — runs entirely on normalized
// (intensity, lactate) pairs, so it works identically whether the intensity
// axis is heart rate, pace, or power and whichever device produced the
// numbers. This is what makes threshold detection "device-agnostic" per the
// product brief: nothing here ever looks at which brand of watch or meter
// the sample came from.

export type StepPoint = {
  step: number;
  intensity: number; // HR (bpm), pace (sec/km, LOWER=harder so we negate before fitting), or power (W)
  intensityKind: "hr" | "pace" | "power";
  lactateMmol: number;
};

export type ThresholdResult = {
  intensity: number;
  intensityKind: "hr" | "pace" | "power";
  lactateMmol: number;
  method: string;
  confidence: number; // 0..1
};

// Normalizes pace so "harder" always means "larger number" like HR/power do
// — pace is sec/km, so faster (harder) effort is a SMALLER number. Every
// curve-fitting routine below assumes intensity increases with effort.
function toMonotonicIntensity(p: StepPoint): number {
  return p.intensityKind === "pace" ? -p.intensity : p.intensity;
}
function fromMonotonicIntensity(x: number, kind: StepPoint["intensityKind"]): number {
  return kind === "pace" ? -x : x;
}

// Quadratic least-squares fit y = a*x^2 + b*x + c — a lightweight stand-in
// for the 3rd-order polynomial typically used in exercise-physiology
// software, chosen because a step test rarely has enough points (5-8) to
// stably fit a cubic without overfitting a wiggle into the curve.
function quadraticFit(xs: number[], ys: number[]): (x: number) => number {
  const n = xs.length;
  const sx = xs.reduce((a, b) => a + b, 0);
  const sx2 = xs.reduce((a, b) => a + b * b, 0);
  const sx3 = xs.reduce((a, b) => a + b * b * b, 0);
  const sx4 = xs.reduce((a, b) => a + b * b * b * b, 0);
  const sy = ys.reduce((a, b) => a + b, 0);
  const sxy = xs.reduce((a, b, i) => a + b * ys[i], 0);
  const sx2y = xs.reduce((a, b, i) => a + b * b * ys[i], 0);

  // Solve the 3x3 normal-equations system [sx4 sx3 sx2; sx3 sx2 sx; sx2 sx n] * [a b c] = [sx2y sxy sy]
  const A = [
    [sx4, sx3, sx2],
    [sx3, sx2, sx],
    [sx2, sx, n],
  ];
  const B = [sx2y, sxy, sy];
  const [a, b, c] = solve3x3(A, B);
  return (x: number) => a * x * x + b * x + c;
}

function solve3x3(A: number[][], B: number[]): [number, number, number] {
  // Cramer's rule — fine at this fixed 3x3 size, no need for a general solver.
  const det = (m: number[][]) =>
    m[0][0] * (m[1][1] * m[2][2] - m[1][2] * m[2][1]) -
    m[0][1] * (m[1][0] * m[2][2] - m[1][2] * m[2][0]) +
    m[0][2] * (m[1][0] * m[2][1] - m[1][1] * m[2][0]);
  const D = det(A) || 1e-9;
  const Da = det([B, [A[1][0], A[1][1], A[1][2]], [A[2][0], A[2][1], A[2][2]]].map((r, i) =>
    i === 0 ? [B[0], A[0][1], A[0][2]] : A[i]
  ) as number[][]);
  const Db = det([
    [A[0][0], B[0], A[0][2]],
    [A[1][0], B[1], A[1][2]],
    [A[2][0], B[2], A[2][2]],
  ]);
  const Dc = det([
    [A[0][0], A[0][1], B[0]],
    [A[1][0], A[1][1], B[1]],
    [A[2][0], A[2][1], B[2]],
  ]);
  return [Da / D, Db / D, Dc / D];
}

// Dmax: fit a curve through the step points, draw a straight line from the
// first to the last point, and pick the point on the curve that sits
// furthest (perpendicular distance) below that line — the point of steepest
// upward inflection in the lactate curve. Standard method from Cheng et al.
// 1992, widely used because (unlike a fixed 4mmol OBLA cutoff) it adapts to
// each individual's own curve shape.
export function computeDmax(points: StepPoint[]): ThresholdResult | null {
  if (points.length < 4) return null;
  const kind = points[0].intensityKind;
  const xs = points.map(toMonotonicIntensity);
  const ys = points.map((p) => p.lactateMmol);
  const curve = quadraticFit(xs, ys);

  const x1 = xs[0], y1 = curve(xs[0]);
  const x2 = xs[xs.length - 1], y2 = curve(xs[xs.length - 1]);
  const lineLen = Math.hypot(x2 - x1, y2 - y1) || 1e-9;

  let best = { dist: -Infinity, x: x1, y: y1 };
  const samples = 200;
  for (let i = 0; i <= samples; i++) {
    const x = x1 + ((x2 - x1) * i) / samples;
    const y = curve(x);
    // perpendicular distance from (x,y) to the line (x1,y1)-(x2,y2)
    const dist = Math.abs((y2 - y1) * x - (x2 - x1) * y + x2 * y1 - y2 * x1) / lineLen;
    if (dist > best.dist) best = { dist, x, y };
  }

  return {
    intensity: fromMonotonicIntensity(best.x, kind),
    intensityKind: kind,
    lactateMmol: Math.max(0, best.y),
    method: "DMAX",
    confidence: points.length >= 5 ? 0.8 : 0.6,
  };
}

// Modified Dmax (Bishop et al. 1998): same idea as Dmax, but the reference
// line starts at the first point where lactate rises ≥0.4 mmol/L above the
// lowest step, not at the very first step — better behaved for athletes
// whose lactate barely moves for the first 1-2 easy steps.
export function computeModifiedDmax(points: StepPoint[]): ThresholdResult | null {
  if (points.length < 4) return null;
  const baseline = Math.min(...points.map((p) => p.lactateMmol));
  const startIdx = points.findIndex((p) => p.lactateMmol >= baseline + 0.4);
  const slice = startIdx > 0 ? points.slice(startIdx) : points;
  const result = computeDmax(slice);
  return result ? { ...result, method: "MODIFIED_DMAX" } : null;
}

// OBLA (onset of blood lactate accumulation): the classic fixed-threshold
// method — linear interpolation between the two bracketing steps to find
// the intensity at which lactate crosses a fixed concentration. 2 mmol/L is
// the conventional proxy for LT1 (aerobic threshold), 4 mmol/L for LT2
// (anaerobic threshold) — Sjödin & Jacobs 1981.
export function computeObla(points: StepPoint[], targetMmol: number): ThresholdResult | null {
  if (points.length < 2) return null;
  const sorted = [...points].sort((a, b) => toMonotonicIntensity(a) - toMonotonicIntensity(b));
  for (let i = 0; i < sorted.length - 1; i++) {
    const a = sorted[i], b = sorted[i + 1];
    if (a.lactateMmol <= targetMmol && b.lactateMmol >= targetMmol) {
      const frac = b.lactateMmol === a.lactateMmol ? 0 : (targetMmol - a.lactateMmol) / (b.lactateMmol - a.lactateMmol);
      const xa = toMonotonicIntensity(a), xb = toMonotonicIntensity(b);
      const x = xa + (xb - xa) * frac;
      return {
        intensity: fromMonotonicIntensity(x, a.intensityKind),
        intensityKind: a.intensityKind,
        lactateMmol: targetMmol,
        method: `OBLA_${targetMmol}MMOL`,
        confidence: 0.7,
      };
    }
  }
  return null;
}

export type DerivedThresholds = {
  lt1: ThresholdResult | null;
  lt2: ThresholdResult | null;
  explanation: string;
};

// Orchestrator: runs every method that has enough data and picks the most
// individualized one available (Dmax family over fixed OBLA cutoffs),
// falling back gracefully when the step test is too short for a curve fit.
// Always returns *something* the plan engine can use plus a plain-language
// explanation of exactly how the number was derived — never a bare number
// with no way to audit it.
export function deriveThresholds(points: StepPoint[]): DerivedThresholds {
  if (points.length < 3) {
    return { lt1: null, lt2: null, explanation: "Недостаточно ступеней теста (нужно минимум 3) — пороги не рассчитаны." };
  }

  const modDmax = computeModifiedDmax(points);
  const dmax = computeDmax(points);
  const lt2 = modDmax ?? dmax ?? computeObla(points, 4);
  const lt1 = computeObla(points, 2) ?? (lt2 ? { ...lt2, lactateMmol: 2, method: "ESTIMATED_FROM_LT2", confidence: 0.4 } : null);

  const parts: string[] = [];
  if (lt1) parts.push(`LT1 (аэробный порог, ~2 ммоль/л) определён методом ${lt1.method.replace(/_/g, " ")}.`);
  if (lt2) parts.push(`LT2 (анаэробный порог) определён методом ${lt2.method.replace(/_/g, " ")} — точка на кривой лактата с максимальным отклонением от прямой между первой и последней ступенью теста.`);
  if (!lt1 && !lt2) parts.push("Не удалось построить кривую лактата по этим точкам.");

  return { lt1, lt2, explanation: parts.join(" ") };
}

// ---------------- HR-only threshold (no lactate meter at all) ----------------

export type HrSample = { t: number; hr: number };

// Estimates LTHR from a steady, hard, sustained effort (classic "30-minute
// test" protocol: average HR of the last 20 minutes of a ~30-minute
// time-trial-effort run/ride) — Joe Friel's field-test method, the standard
// way endurance coaches estimate threshold HR without any lab equipment.
export function estimateLthrFromSteadyEffort(samples: HrSample[], effortDurationSec: number): ThresholdResult | null {
  if (samples.length < 10 || effortDurationSec < 600) return null;
  const last = samples[samples.length - 1].t;
  const windowStart = last - Math.min(effortDurationSec, last) * (2 / 3); // last ~20 of last 30 min, scaled to whatever duration we got
  const windowSamples = samples.filter((s) => s.t >= windowStart);
  if (windowSamples.length < 5) return null;
  const avgHr = windowSamples.reduce((a, s) => a + s.hr, 0) / windowSamples.length;
  return {
    intensity: Math.round(avgHr),
    intensityKind: "hr",
    lactateMmol: 4, // LTHR from a field test approximates the LT2/OBLA-4mmol HR
    method: "FIELD_TEST_30MIN",
    confidence: 0.55,
  };
}
