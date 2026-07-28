// Daily readiness/recovery score — the single most important number on the
// dashboard. Modeled on published HRV-guided-training methodology (Plews et
// al. 2013, Buchheit 2014): today's HRV and resting HR are compared to the
// athlete's own rolling baseline (z-score), not to a fixed universal
// number, because "good" HRV is entirely individual. Sleep and accumulated
// training stress (TSB) round it out. Every contribution is returned
// alongside the score so the UI can show precisely why it landed where it
// did — never a bare number with no explanation.

export type RecoveryFactor = { factor: string; weight: number; contribution: number; note: string };

export type RecoveryInput = {
  hrvMs: number | null;
  hrvBaselineMean: number | null;
  hrvBaselineStdDev: number | null;
  restingHr: number | null;
  rhrBaselineMean: number | null;
  rhrBaselineStdDev: number | null;
  sleepScore: number | null; // 0-100, from sleep.ts
  tsb: number | null; // training stress balance (form) from training-load.ts
  yesterdayStrain: number | null; // 0-21
};

export type RecoveryResult = { score: number; breakdown: RecoveryFactor[]; band: "LOW" | "MEDIUM" | "HIGH" };

// Maps a z-score to 0-100 with a logistic curve centered on 0 — +1 SD above
// baseline (better than usual) lands around 73/100, -1 SD lands around
// 27/100, so the score is sensitive near "normal" and saturates gently at
// the extremes rather than swinging wildly on a single noisy reading.
function zToScore(z: number): number {
  return 100 / (1 + Math.exp(-1.1 * z));
}

export function computeRecoveryScore(input: RecoveryInput): RecoveryResult {
  const factors: RecoveryFactor[] = [];

  // HRV z-score — weighted heaviest (0.40): the earliest, most sensitive
  // signal of accumulated autonomic fatigue in the literature.
  if (input.hrvMs != null && input.hrvBaselineMean != null && input.hrvBaselineStdDev) {
    const z = (input.hrvMs - input.hrvBaselineMean) / Math.max(input.hrvBaselineStdDev, 1);
    const sub = zToScore(z);
    factors.push({
      factor: "ВСР (HRV) относительно твоей нормы",
      weight: 0.4,
      contribution: sub,
      note:
        z >= 0.3
          ? `ВСР выше обычного (${input.hrvMs.toFixed(0)} мс против среднего ${input.hrvBaselineMean.toFixed(0)} мс) — хороший знак восстановления.`
          : z <= -0.3
            ? `ВСР ниже обычного (${input.hrvMs.toFixed(0)} мс против среднего ${input.hrvBaselineMean.toFixed(0)} мс) — признак накопленной усталости или недовосстановления.`
            : `ВСР примерно на уровне твоей обычной нормы.`,
    });
  }

  // Resting HR z-score, INVERTED (higher RHR = worse) — weight 0.20.
  if (input.restingHr != null && input.rhrBaselineMean != null && input.rhrBaselineStdDev) {
    const z = -(input.restingHr - input.rhrBaselineMean) / Math.max(input.rhrBaselineStdDev, 1);
    const sub = zToScore(z);
    factors.push({
      factor: "Пульс покоя относительно твоей нормы",
      weight: 0.2,
      contribution: sub,
      note:
        z <= -0.3
          ? `Пульс покоя выше обычного (${input.restingHr} против ${input.rhrBaselineMean.toFixed(0)} уд/мин) — типичный признак стресса, недосыпа или начинающейся болезни.`
          : `Пульс покоя в норме.`,
    });
  }

  // Sleep — weight 0.25.
  if (input.sleepScore != null) {
    factors.push({
      factor: "Качество и длительность сна",
      weight: 0.25,
      contribution: input.sleepScore,
      note: input.sleepScore >= 80 ? "Сон был качественным и достаточным." : input.sleepScore >= 55 ? "Сон был неполным — есть влияние на восстановление." : "Сон был заметно недостаточным.",
    });
  }

  // Training form (TSB) — weight 0.15. TSB well below zero = accumulated
  // fatigue exceeding fitness; strongly negative recent strain lowers score.
  if (input.tsb != null) {
    const sub = Math.max(0, Math.min(100, 50 + input.tsb * 2.5));
    factors.push({
      factor: "Баланс тренировочной нагрузки (форма)",
      weight: 0.15,
      contribution: sub,
      note: input.tsb < -15 ? "Накопленная нагрузка сейчас заметно превышает текущую подготовленность." : input.tsb > 10 ? "Свежести много — накопленной усталости почти нет." : "Нагрузка и подготовленность сейчас сбалансированы.",
    });
  }

  if (factors.length === 0) {
    return {
      score: 60,
      band: "MEDIUM",
      breakdown: [{ factor: "Недостаточно данных", weight: 1, contribution: 60, note: "Пока мало данных (ВСР/пульс/сон) — используется нейтральная оценка по умолчанию." }],
    };
  }

  const totalWeight = factors.reduce((a, f) => a + f.weight, 0);
  const score = Math.round(factors.reduce((a, f) => a + (f.contribution * f.weight) / totalWeight, 0));
  const band = score >= 67 ? "HIGH" : score >= 34 ? "MEDIUM" : "LOW";
  return { score: Math.max(0, Math.min(100, score)), band, breakdown: factors };
}

// Rolling baseline (mean + SD) over the trailing N days, excluding the day
// being scored itself — standard practice so a bad night doesn't dilute the
// very baseline it's being compared against.
export function rollingBaseline(values: number[], windowDays = 14): { mean: number; stdDev: number } | null {
  const sample = values.slice(-windowDays);
  if (sample.length < 5) return null;
  const mean = sample.reduce((a, b) => a + b, 0) / sample.length;
  const variance = sample.reduce((a, b) => a + (b - mean) ** 2, 0) / sample.length;
  return { mean, stdDev: Math.sqrt(variance) };
}

// Sleep score 0-100 from duration-vs-goal + stage composition — used as an
// input to computeRecoveryScore above and shown standalone on the sleep page.
export function computeSleepScore(params: {
  durationSec: number;
  goalHours: number;
  deepSec?: number | null;
  remSec?: number | null;
  awakeSec?: number | null;
}): number {
  const goalSec = params.goalHours * 3600;
  const durationRatio = Math.min(1, params.durationSec / goalSec);
  let score = durationRatio * 70; // duration is the dominant factor

  if (params.deepSec != null && params.remSec != null) {
    const restorativeRatio = (params.deepSec + params.remSec) / Math.max(params.durationSec, 1);
    // ~35-45% combined deep+REM is a healthy target share of total sleep.
    score += Math.max(0, Math.min(1, restorativeRatio / 0.4)) * 20;
  } else {
    score += 15; // no stage data — assume roughly average composition
  }

  if (params.awakeSec != null && params.durationSec > 0) {
    const awakeRatio = params.awakeSec / params.durationSec;
    score += Math.max(0, 10 - awakeRatio * 100);
  } else {
    score += 5;
  }

  return Math.round(Math.max(0, Math.min(100, score)));
}
