// Training-load quantification: how hard was a session, and how is
// accumulated load trending. Two well-established models, both citable:
// Banister's TRIMP (per-session load from HR) and the CTL/ATL/TSB
// impulse-response model popularized by Coggan/TrainingPeaks (fitness,
// fatigue, form). ACWR flags the classic Gabbett injury-risk ratio.

// Banister TRIMP (1991), exponential (sex-weighted) variant — weights time
// at higher %HRR far more heavily than time at low %HRR, which is what
// makes a short hard interval session score comparably to a long easy one.
export function trimp(params: {
  durationMin: number;
  avgHr: number;
  restingHr: number;
  maxHr: number;
  sex?: "MALE" | "FEMALE" | "OTHER" | null;
}): number {
  const hrr = (params.avgHr - params.restingHr) / Math.max(params.maxHr - params.restingHr, 1);
  const clamped = Math.max(0, Math.min(1, hrr));
  const y = params.sex === "FEMALE" ? 1.67 : 1.92;
  const k = params.sex === "FEMALE" ? 0.86 : 0.64;
  return params.durationMin * clamped * k * Math.exp(y * clamped);
}

// Power-based equivalent (TSS-style) for cycling/rowing when FTP is known —
// intensity factor squared is what makes an all-out 20min effort score
// similarly per-minute to a much longer tempo ride.
export function powerLoad(params: { durationSec: number; normalizedPowerW: number; ftpWatts: number }): number {
  const intensityFactor = params.normalizedPowerW / Math.max(params.ftpWatts, 1);
  return (params.durationSec * params.normalizedPowerW * intensityFactor) / (params.ftpWatts * 36);
}

// Simple RPE-based fallback (session-RPE × duration, Foster 2001) — used
// when there's no HR or power stream at all, just an athlete-entered
// perceived exertion. Coarser but always available.
export function rpeLoad(durationMin: number, rpe0to10: number): number {
  return durationMin * rpe0to10;
}

export type DayLoad = { date: string; load: number }; // date = "YYYY-MM-DD", ascending

export type CtlAtlPoint = { date: string; ctl: number; atl: number; tsb: number };

// Exponentially-weighted moving average with time constant `tau` days —
// CTL uses tau=42 ("fitness" — slow to build, slow to fade), ATL uses
// tau=7 ("fatigue" — reacts fast to recent training).
function ewma(loads: DayLoad[], tauDays: number): number[] {
  const lambda = Math.exp(-1 / tauDays);
  const out: number[] = [];
  let prev = 0;
  for (const d of loads) {
    prev = prev * lambda + d.load * (1 - lambda);
    out.push(prev);
  }
  return out;
}

// Runs both EWMAs over a daily-load series (missing days should be passed
// in as {load: 0} by the caller so the exponential decay is continuous) and
// returns CTL/ATL/TSB (form = CTL - ATL) for every day.
export function computeCtlAtlTsb(loads: DayLoad[]): CtlAtlPoint[] {
  const ctl = ewma(loads, 42);
  const atl = ewma(loads, 7);
  return loads.map((d, i) => ({
    date: d.date,
    ctl: Math.round(ctl[i] * 10) / 10,
    atl: Math.round(atl[i] * 10) / 10,
    tsb: Math.round((ctl[i] - atl[i]) * 10) / 10,
  }));
}

export type AcwrResult = { acute: number; chronic: number; ratio: number | null; risk: "LOW" | "MODERATE" | "HIGH" | "UNDERTRAINED" };

// Acute:chronic workload ratio — acute = trailing 7-day average load,
// chronic = trailing 28-day average load. Gabbett (2016): ratio in the
// "sweet spot" 0.8-1.3 carries the lowest injury risk; >1.5 (ramping load
// too fast relative to what the body is adapted to) is the classic
// injury-risk red flag regardless of how fit the athlete otherwise is.
export function computeAcwr(loads: DayLoad[]): AcwrResult {
  const last7 = loads.slice(-7);
  const last28 = loads.slice(-28);
  const acute = last7.reduce((a, d) => a + d.load, 0) / Math.max(last7.length, 1);
  const chronic = last28.reduce((a, d) => a + d.load, 0) / Math.max(last28.length, 1);
  if (chronic < 1) return { acute, chronic, ratio: null, risk: "UNDERTRAINED" };
  const ratio = acute / chronic;
  const risk = ratio > 1.5 ? "HIGH" : ratio > 1.3 ? "MODERATE" : ratio < 0.8 ? "UNDERTRAINED" : "LOW";
  return { acute: Math.round(acute * 10) / 10, chronic: Math.round(chronic * 10) / 10, ratio: Math.round(ratio * 100) / 100, risk };
}

// Daily cumulative "strain" on a bounded 0-21 scale, in the spirit of
// Whoop's headline number — our own logarithmic compression (not a claim of
// reverse-engineering their proprietary formula): diminishing returns per
// extra unit of load, so one very long session doesn't blow the scale out,
// but every session still visibly adds up over the day.
export function computeDailyStrain(totalLoadToday: number): number {
  const k = 0.018;
  return Math.round(21 * (1 - Math.exp(-k * totalLoadToday)) * 10) / 10;
}
