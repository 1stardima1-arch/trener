// TDEE/macro calculation with carbohydrate periodization — real, citable
// sports-nutrition formulas (Mifflin-St Jeor / Katch-McArdle for BMR, Burke
// et al. 2011 for carb-periodization ranges), not a generic diet-app
// calorie count. Carbs are periodized by *today's* training load, not a
// single flat daily target — that's what actually distinguishes
// sports-nutrition planning from general nutrition apps.

export type BmrInputs = { weightKg: number; heightCm: number; age: number; sex: "MALE" | "FEMALE" | "OTHER"; bodyFatPercent?: number | null };

export function computeBmr(i: BmrInputs): number {
  // Katch-McArdle is more accurate for athletes when body-fat% is known
  // (it's driven by lean mass, not a sex-average constant).
  if (i.bodyFatPercent != null) {
    const leanMassKg = i.weightKg * (1 - i.bodyFatPercent / 100);
    return 370 + 21.6 * leanMassKg;
  }
  const sexTerm = i.sex === "FEMALE" ? -161 : i.sex === "MALE" ? 5 : -78; // "OTHER" splits the male/female constant
  return 10 * i.weightKg + 6.25 * i.heightCm - 5 * i.age + sexTerm;
}

export type TdeeInputs = BmrInputs & {
  // Non-training daily activity (job, chores, walking) — NOT including the
  // training session itself, which is added separately from actual load.
  dailyActivityFactor?: number; // 1.2 sedentary job .. 1.55 very active job
  todaysTrainingLoad?: number | null; // TRIMP-ish units from training-load.ts
  todaysTrainingDurationMin?: number | null;
};

export function computeTdee(i: TdeeInputs): { bmr: number; nonTrainingKcal: number; trainingKcal: number; tdeeKcal: number } {
  const bmr = computeBmr(i);
  const activityFactor = i.dailyActivityFactor ?? 1.35;
  const nonTrainingKcal = bmr * activityFactor;

  // ~1 kcal/kg/min at moderate endurance intensity is a standard rough
  // energy-cost approximation; refined per-session estimates come from
  // actual `calories` on the Activity record when a device reports them —
  // this is only the fallback when it doesn't.
  const trainingKcal = i.todaysTrainingDurationMin ? i.todaysTrainingDurationMin * i.weightKg * 0.09 : 0;

  return {
    bmr: Math.round(bmr),
    nonTrainingKcal: Math.round(nonTrainingKcal),
    trainingKcal: Math.round(trainingKcal),
    tdeeKcal: Math.round(nonTrainingKcal + trainingKcal),
  };
}

export type MacroTargets = { kcal: number; proteinG: number; carbsG: number; fatG: number; carbLoad: "LOW" | "MODERATE" | "HIGH" };

// Carb periodization bands (g/kg bodyweight/day), Burke et al. 2011:
//  - rest/very light day: 3-5 g/kg
//  - moderate day (~1h/day): 5-7 g/kg
//  - endurance day (1-3h/day mod-high intensity): 6-10 g/kg
//  - extreme (>4-5h/day): 8-12 g/kg
// Protein 1.2-2.0 g/kg depending on goal (endurance vs strength/loss), fat
// fills the remainder with a 20% floor of total kcal for hormonal health.
export function computeMacroTargets(params: {
  weightKg: number;
  tdeeKcal: number;
  goalType?: string | null;
  todaysTrainingLoadMinutes: number; // planned/actual session duration today, 0 on rest days
  weightLossDeficitKcal?: number; // subtract from tdee if goal is WEIGHT_LOSS
}): MacroTargets {
  const kcal = Math.max(1200, params.tdeeKcal - (params.goalType === "WEIGHT_LOSS" ? (params.weightLossDeficitKcal ?? 400) : 0));

  const proteinPerKg = params.goalType === "WEIGHT_LOSS" || params.goalType === "PERFORMANCE" ? 1.8 : 1.5;
  const proteinG = Math.round(params.weightKg * proteinPerKg);

  let carbPerKg: number;
  let carbLoad: MacroTargets["carbLoad"];
  if (params.todaysTrainingLoadMinutes <= 20) {
    carbPerKg = 3.5;
    carbLoad = "LOW";
  } else if (params.todaysTrainingLoadMinutes <= 75) {
    carbPerKg = 5.5;
    carbLoad = "MODERATE";
  } else {
    carbPerKg = 8;
    carbLoad = "HIGH";
  }
  const carbsG = Math.round(params.weightKg * carbPerKg);

  const proteinKcal = proteinG * 4;
  const carbsKcal = carbsG * 4;
  const remainingKcal = Math.max(kcal * 0.2, kcal - proteinKcal - carbsKcal);
  const fatG = Math.round(remainingKcal / 9);

  return { kcal: Math.round(kcal), proteinG, carbsG, fatG, carbLoad };
}

// Simple hydration guideline (mL) — 35 mL/kg baseline + ~500-750 mL per
// hour of training beyond that (ACSM), used as a rounded daily suggestion.
export function computeHydrationTargetMl(weightKg: number, trainingDurationMin: number): number {
  const baseline = weightKg * 35;
  const trainingAdd = (trainingDurationMin / 60) * 600;
  return Math.round((baseline + trainingAdd) / 50) * 50;
}
