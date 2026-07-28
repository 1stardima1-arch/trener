"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { avatarByKey, NAME_CHANGE_COOLDOWN_DAYS } from "@/lib/avatars";
import { computeAndSaveThresholds } from "@/lib/engine";
import type { Sex } from "@prisma/client";

export type ProfileUpdateResult = { ok: true } | { ok: false; error: string };

export async function updateAccountProfile(formData: FormData): Promise<ProfileUpdateResult> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "Нужно войти в аккаунт." };
  const userId = session.user.id;

  const rawName = (formData.get("name") as string | null)?.trim() ?? "";
  const rawAvatar = (formData.get("avatarKey") as string | null) ?? "";
  const bio = (formData.get("bio") as string | null)?.trim() ?? "";
  const isPublic = formData.get("isPublic") === "on";

  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { name: true, nameChangedAt: true } });
  const data: { name?: string; nameChangedAt?: Date; avatarKey?: string; bio?: string; isPublic?: boolean } = { bio: bio.slice(0, 280), isPublic };

  if (rawAvatar && avatarByKey(rawAvatar)) data.avatarKey = rawAvatar;

  if (rawName && rawName !== user.name) {
    if (rawName.length < 2 || rawName.length > 24) return { ok: false, error: "Имя должно быть от 2 до 24 символов." };
    if (user.nameChangedAt) {
      const daysSince = (Date.now() - user.nameChangedAt.getTime()) / 86_400_000;
      if (daysSince < NAME_CHANGE_COOLDOWN_DAYS) {
        const daysLeft = Math.ceil(NAME_CHANGE_COOLDOWN_DAYS - daysSince);
        return { ok: false, error: `Имя можно менять раз в ${NAME_CHANGE_COOLDOWN_DAYS} дней. Следующая смена через ${daysLeft} дн.` };
      }
    }
    data.name = rawName;
    data.nameChangedAt = new Date();
  }

  await prisma.user.update({ where: { id: userId }, data });
  revalidatePath("/app", "layout");
  return { ok: true };
}

export type AthleteProfileInput = {
  primarySport: string;
  secondarySports: string[];
  sex: Sex | null;
  birthDate: string | null;
  heightCm: number | null;
  weightKg: number | null;
  bodyFatPercent: number | null;
  restingHrManual: number | null;
  maxHrManual: number | null;
  lthrManual: number | null;
  bloodPressureSystolic: number | null;
  bloodPressureDiastolic: number | null;
  ferritinNgMl: number | null;
  vitaminDNgMl: number | null;
  testosteroneNgDl: number | null;
  restingGlucoseMgDl: number | null;
  biomarkerNotes: string | null;
  goalType: string | null;
  goalEventName: string | null;
  goalEventDate: string | null;
  goalNotes: string | null;
  experienceYears: number | null;
  weeklyAvailabilityMin: Record<string, number>;
  sleepGoalHours: number;
  typicalBedtime: string | null;
  typicalWakeTime: string | null;
  dietType: string | null;
  allergies: string | null;
  dislikedFoods: string | null;
  sportsNutritionOk: boolean;
  mealsPerDay: number;
  unitPreference: string;
};

export async function updateAthleteProfile(input: AthleteProfileInput): Promise<ProfileUpdateResult> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "Нужно войти в аккаунт." };
  const userId = session.user.id;

  await prisma.athleteProfile.update({
    where: { userId },
    data: {
      primarySport: input.primarySport, secondarySports: input.secondarySports,
      sex: input.sex ?? undefined, birthDate: input.birthDate ? new Date(input.birthDate) : null,
      heightCm: input.heightCm, weightKg: input.weightKg, bodyFatPercent: input.bodyFatPercent,
      restingHrManual: input.restingHrManual, maxHrManual: input.maxHrManual, lthrManual: input.lthrManual,
      bloodPressureSystolic: input.bloodPressureSystolic, bloodPressureDiastolic: input.bloodPressureDiastolic,
      ferritinNgMl: input.ferritinNgMl, vitaminDNgMl: input.vitaminDNgMl,
      testosteroneNgDl: input.testosteroneNgDl, restingGlucoseMgDl: input.restingGlucoseMgDl,
      biomarkerNotes: input.biomarkerNotes,
      goalType: input.goalType, goalEventName: input.goalEventName,
      goalEventDate: input.goalEventDate ? new Date(input.goalEventDate) : null, goalNotes: input.goalNotes,
      experienceYears: input.experienceYears, weeklyAvailabilityMin: input.weeklyAvailabilityMin,
      sleepGoalHours: input.sleepGoalHours, typicalBedtime: input.typicalBedtime, typicalWakeTime: input.typicalWakeTime,
      dietType: input.dietType, allergies: input.allergies, dislikedFoods: input.dislikedFoods,
      sportsNutritionOk: input.sportsNutritionOk, mealsPerDay: input.mealsPerDay, unitPreference: input.unitPreference,
    },
  });

  try {
    await computeAndSaveThresholds(userId, input.primarySport);
  } catch {
    // Non-fatal — profile save should never fail because recompute failed.
  }

  revalidatePath("/app", "layout");
  return { ok: true };
}
