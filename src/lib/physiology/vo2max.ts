// VO2max estimation ensemble. Every estimator here is a published,
// citable formula — nothing is a proprietary black box — combined by
// weighting the more individualized/measured inputs over generic ones.
// Device-agnostic by construction: none of these look at brand/model, only
// at normalized numbers (pace, power, HR, a race result).

export type Vo2Estimate = { value: number; method: string; weight: number };

// Daniels & Gilbert (1979) — the VDOT formula. Given a real race/time-trial
// result, this is the single most reliable non-lab VO2max estimator that
// exists, because it's anchored to an actual maximal performance rather
// than a submaximal proxy.
export function vo2maxFromRacePerformance(distanceMeters: number, durationSec: number): number {
  const v = distanceMeters / (durationSec / 60); // m/min
  const t = durationSec / 60; // minutes
  const vo2 = -4.6 + 0.182258 * v + 0.000104 * v * v;
  const pctMax = 0.8 + 0.1894393 * Math.exp(-0.012778 * t) + 0.2989558 * Math.exp(-0.1932605 * t);
  return vo2 / pctMax;
}

// ACSM running/cycling energy-cost equations, evaluated at LT2 intensity,
// then scaled up from "%VO2max at LT2" — trained endurance athletes
// typically sit LT2 at ~88-92% VO2max, recreational athletes lower
// (~75-85%); we use experience-adjusted midpoints (Sjödin & Svedenhag 1985).
export function vo2AtLt2FromRunningPace(lt2PaceSecPerKm: number): number {
  const speedMPerMin = (1000 / lt2PaceSecPerKm) * 60;
  return 0.2 * speedMPerMin + 3.5; // flat ground, ACSM metabolic equation for running
}

export function vo2maxFromRunningLt2(lt2PaceSecPerKm: number, experienceYears: number | null): number {
  const vo2AtLt2 = vo2AtLt2FromRunningPace(lt2PaceSecPerKm);
  const pctAtLt2 = experienceYears != null && experienceYears >= 3 ? 0.9 : experienceYears != null && experienceYears >= 1 ? 0.85 : 0.8;
  return vo2AtLt2 / pctAtLt2;
}

// Cycling: watts-per-kg FTP (≈LT2 power) to VO2max, ACSM cycle ergometer
// equation rearranged, again scaled by %VO2max typically sustained at FTP.
export function vo2maxFromCyclingLt2(lt2PowerW: number, weightKg: number, experienceYears: number | null): number {
  const vo2AtLt2 = (10.8 * lt2PowerW) / weightKg + 7;
  const pctAtLt2 = experienceYears != null && experienceYears >= 3 ? 0.85 : 0.75;
  return vo2AtLt2 / pctAtLt2;
}

// Uth–Sørensen–Overgaard–Pedersen (2004): VO2max ≈ 15.3 × (HRmax / HRrest).
// Crude compared to the above (R²≈0.56 in the original study) but useful
// when all we have is resting + max HR and nothing else.
export function vo2maxFromHrRatio(maxHr: number, restingHr: number): number {
  return 15.3 * (maxHr / Math.max(restingHr, 30));
}

// Jackson et al. 1990 non-exercise regression — the fallback of last
// resort for a brand-new user with zero training data: age, sex, BMI and a
// 0-7 self-rated activity level only.
export function vo2maxNonExerciseRegression(params: {
  age: number;
  sex: "MALE" | "FEMALE" | "OTHER";
  bmi: number;
  activityRating0to7: number;
}): number {
  const sexTerm = params.sex === "FEMALE" ? 0 : 1;
  return (
    56.363 +
    1.921 * params.activityRating0to7 -
    0.381 * params.age -
    0.754 * params.bmi +
    10.987 * sexTerm
  );
}

export type Vo2Inputs = {
  age?: number | null;
  sex?: "MALE" | "FEMALE" | "OTHER" | null;
  weightKg?: number | null;
  heightCm?: number | null;
  experienceYears?: number | null;
  maxHr?: number | null;
  restingHr?: number | null;
  sport?: string | null;
  lt2PaceSecPerKm?: number | null; // running/trail
  lt2PowerW?: number | null; // cycling/rowing
  bestRecentRace?: { distanceMeters: number; durationSec: number } | null;
  activityRating0to7?: number | null;
};

export type Vo2Result = { vo2max: number; method: string; confidence: number; components: Vo2Estimate[] };

// Combines whichever estimators have enough inputs, weighted toward the
// most individualized evidence, and reports every component so the "why"
// panel can show exactly what fed the final number.
export function estimateVo2max(inputs: Vo2Inputs): Vo2Result | null {
  const estimates: Vo2Estimate[] = [];

  if (inputs.bestRecentRace && inputs.bestRecentRace.durationSec >= 480) {
    estimates.push({
      value: vo2maxFromRacePerformance(inputs.bestRecentRace.distanceMeters, inputs.bestRecentRace.durationSec),
      method: "Формула Дэниелса-Гилберта по результату старта",
      weight: 3,
    });
  }

  if (inputs.lt2PaceSecPerKm && (inputs.sport === "running" || inputs.sport === "trail_running")) {
    estimates.push({
      value: vo2maxFromRunningLt2(inputs.lt2PaceSecPerKm, inputs.experienceYears ?? null),
      method: "По темпу LT2 (уравнение ACSM)",
      weight: 2.5,
    });
  }

  if (inputs.lt2PowerW && inputs.weightKg) {
    estimates.push({
      value: vo2maxFromCyclingLt2(inputs.lt2PowerW, inputs.weightKg, inputs.experienceYears ?? null),
      method: "По мощности LT2/FTP (уравнение ACSM)",
      weight: 2.5,
    });
  }

  if (inputs.maxHr && inputs.restingHr) {
    estimates.push({
      value: vo2maxFromHrRatio(inputs.maxHr, inputs.restingHr),
      method: "По отношению ЧСС макс/покоя (Uth et al.)",
      weight: 1,
    });
  }

  if (
    estimates.length === 0 &&
    inputs.age != null &&
    inputs.sex &&
    inputs.weightKg &&
    inputs.heightCm
  ) {
    const bmi = inputs.weightKg / (inputs.heightCm / 100) ** 2;
    estimates.push({
      value: vo2maxNonExerciseRegression({
        age: inputs.age,
        sex: inputs.sex,
        bmi,
        activityRating0to7: inputs.activityRating0to7 ?? 3,
      }),
      method: "Регрессия без нагрузочного теста (Jackson et al.) — временная оценка до первых тренировок",
      weight: 1,
    });
  }

  if (estimates.length === 0) return null;

  const totalWeight = estimates.reduce((a, e) => a + e.weight, 0);
  const vo2max = estimates.reduce((a, e) => a + e.value * e.weight, 0) / totalWeight;
  const confidence = Math.min(0.95, 0.35 + 0.2 * estimates.length);
  const primary = estimates.reduce((a, b) => (b.weight > a.weight ? b : a));

  return {
    vo2max: Math.round(vo2max * 10) / 10,
    method: primary.method,
    confidence,
    components: estimates,
  };
}
