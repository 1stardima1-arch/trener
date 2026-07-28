"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { computeAndSaveThresholds, saveReportedThresholds, ensureActivePlan } from "@/lib/engine";
import { WEEKDAYS } from "@/lib/sports";
import type { Sex } from "@prisma/client";

export type OnboardingInput = {
  primarySport: string;
  sex: Sex | null;
  birthDate: string | null; // YYYY-MM-DD
  heightCm: number | null;
  weightKg: number | null;
  bodyFatPercent: number | null;
  restingHrManual: number | null;
  maxHrManual: number | null;
  bloodPressureSystolic: number | null;
  bloodPressureDiastolic: number | null;

  // "Already tested" thresholds, opt-in — seeds an initial ThresholdSnapshot
  // instead of waiting for enough device data to compute one (see
  // saveReportedThresholds in lib/engine.ts).
  knownLthrBpm: number | null;
  knownLt2PaceSecPerKm: number | null;
  knownLt2PowerW: number | null;
  knownLt2Mmol: number | null;
  knownVo2max: number | null;

  // Biochemistry — opt-in, per the brief ("биохимические данные по желанию").
  ferritinNgMl: number | null;
  vitaminDNgMl: number | null;
  testosteroneNgDl: number | null;
  restingGlucoseMgDl: number | null;
  biomarkerNotes: string | null;

  goalType: string | null;
  goalEventName: string | null;
  goalEventDate: string | null;
  experienceYears: number | null;
  weeklyAvailabilityMin: Partial<Record<(typeof WEEKDAYS)[number], number>>;

  sleepGoalHours: number;
  typicalBedtime: string | null;
  typicalWakeTime: string | null;

  dietType: string | null;
  allergies: string | null;
  dislikedFoods: string | null;
  sportsNutritionOk: boolean;
  mealsPerDay: number;
};

export async function completeOnboarding(input: OnboardingInput): Promise<{ ok: boolean; error?: string }> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "Нужно войти в аккаунт." };
  const userId = session.user.id;

  if (!input.primarySport) return { ok: false, error: "Выбери основной вид спорта." };
  const hasAnyAvailability = Object.values(input.weeklyAvailabilityMin).some((v) => (v ?? 0) > 0);
  if (!hasAnyAvailability) return { ok: false, error: "Отметь хотя бы один день, когда ты можешь тренироваться." };

  const profileData = {
    primarySport: input.primarySport, sex: input.sex ?? undefined,
    birthDate: input.birthDate ? new Date(input.birthDate) : null,
    heightCm: input.heightCm, weightKg: input.weightKg, bodyFatPercent: input.bodyFatPercent,
    restingHrManual: input.restingHrManual, maxHrManual: input.maxHrManual,
    bloodPressureSystolic: input.bloodPressureSystolic, bloodPressureDiastolic: input.bloodPressureDiastolic,
    lthrManual: input.knownLthrBpm, vo2maxManual: input.knownVo2max,
    ferritinNgMl: input.ferritinNgMl, vitaminDNgMl: input.vitaminDNgMl,
    testosteroneNgDl: input.testosteroneNgDl, restingGlucoseMgDl: input.restingGlucoseMgDl,
    biomarkerNotes: input.biomarkerNotes,
    goalType: input.goalType, goalEventName: input.goalEventName,
    goalEventDate: input.goalEventDate ? new Date(input.goalEventDate) : null,
    experienceYears: input.experienceYears, weeklyAvailabilityMin: input.weeklyAvailabilityMin,
    sleepGoalHours: input.sleepGoalHours, typicalBedtime: input.typicalBedtime, typicalWakeTime: input.typicalWakeTime,
    dietType: input.dietType, allergies: input.allergies, dislikedFoods: input.dislikedFoods,
    sportsNutritionOk: input.sportsNutritionOk, mealsPerDay: input.mealsPerDay,
    onboardingCompletedAt: new Date(),
  };

  await prisma.athleteProfile.upsert({
    where: { userId },
    update: profileData,
    create: { userId, ...profileData },
  });

  await prisma.nutritionProfile.upsert({ where: { userId }, update: {}, create: { userId } });

  // Best-effort initial computation so the dashboard isn't empty the moment
  // onboarding finishes — a manual max/resting HR is already enough for a
  // first (low-confidence) threshold snapshot and a starter plan. A
  // previously-tested threshold reported here takes priority over that
  // estimate (it's real data, just self-reported).
  try {
    const hasReportedThreshold = [input.knownLthrBpm, input.knownLt2PaceSecPerKm, input.knownLt2PowerW, input.knownVo2max].some((v) => v != null);
    if (hasReportedThreshold) {
      await saveReportedThresholds(userId, input.primarySport, {
        lthrBpm: input.knownLthrBpm, maxHrBpm: input.maxHrManual, restingHrBpm: input.restingHrManual,
        lt2PaceSecPerKm: input.knownLt2PaceSecPerKm, lt2PowerW: input.knownLt2PowerW,
        lt2Mmol: input.knownLt2Mmol, vo2max: input.knownVo2max,
      });
    } else {
      await computeAndSaveThresholds(userId, input.primarySport);
    }
    await ensureActivePlan(userId);
  } catch {
    // Non-fatal — the dashboard/cron will retry these on next load.
  }

  revalidatePath("/app", "layout");
  return { ok: true };
}
