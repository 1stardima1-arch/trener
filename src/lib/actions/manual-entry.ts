"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { computeAndSaveThresholds, ensureDailyMetricRow, computeAndSaveDailyMetric, ingestActivity } from "@/lib/engine";
import { asJson } from "@/lib/utils";
import type { DataSource } from "@prisma/client";

export type ActionResult = { ok: true } | { ok: false; error: string };

function dstr(d: Date) {
  return d.toISOString().slice(0, 10);
}

// Any lactate meter that isn't Athyx — one reading at a time, by hand.
export async function logLactateReading(input: {
  recordedAt: string; lactateMmol: number; hr: number | null; paceSecPerKm: number | null; powerW: number | null;
}): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "Нужно войти в аккаунт." };
  if (!Number.isFinite(input.lactateMmol) || input.lactateMmol < 0 || input.lactateMmol > 30) {
    return { ok: false, error: "Значение лактата выглядит некорректным (0-30 ммоль/л)." };
  }

  await prisma.lactateReading.create({
    data: {
      userId: session.user.id, recordedAt: new Date(input.recordedAt), lactateMmol: input.lactateMmol,
      hr: input.hr, paceSecPerKm: input.paceSecPerKm, powerW: input.powerW, source: "MANUAL",
    },
  });

  revalidatePath("/app/training");
  return { ok: true };
}

// A full manual step test: several {intensity, lactate} pairs entered by
// hand from any meter (Athyx or otherwise) — feeds directly into
// deriveThresholds via computeAndSaveThresholds.
export async function logStepTest(input: {
  sport: string;
  testedAt: string;
  steps: { intensityHr?: number; intensityPaceSecPerKm?: number; intensityPowerW?: number; lactateMmol: number; rpe?: number }[];
  notes?: string;
}): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "Нужно войти в аккаунт." };
  if (input.steps.length < 3) return { ok: false, error: "Нужно минимум 3 ступени теста." };

  await prisma.lactateTest.create({
    data: {
      userId: session.user.id, sport: input.sport, testedAt: new Date(input.testedAt),
      source: "MANUAL", steps: asJson(input.steps)!, notes: input.notes,
    },
  });

  try {
    await computeAndSaveThresholds(session.user.id, input.sport);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Не удалось рассчитать пороги." };
  }

  revalidatePath("/app/training");
  revalidatePath("/app/profile");
  return { ok: true };
}

export async function logSleepManual(input: {
  date: string; sleepStart: string; sleepEnd: string; deepMin?: number; remMin?: number; awakeMin?: number;
}): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "Нужно войти в аккаунт." };
  const userId = session.user.id;

  const start = new Date(input.sleepStart);
  const end = new Date(input.sleepEnd);
  const durationSec = Math.round((end.getTime() - start.getTime()) / 1000);
  if (durationSec <= 0 || durationSec > 20 * 3600) return { ok: false, error: "Проверь время отбоя и подъёма." };

  await prisma.dailyMetric.upsert({
    where: { userId_date: { userId, date: new Date(input.date) } },
    update: {
      sleepStart: start, sleepEnd: end, sleepDurationSec: durationSec, manualEntry: true, source: "MANUAL",
      sleepStages: asJson(input.deepMin || input.remMin || input.awakeMin ? { deepSec: (input.deepMin ?? 0) * 60, remSec: (input.remMin ?? 0) * 60, awakeSec: (input.awakeMin ?? 0) * 60 } : undefined),
    },
    create: {
      userId, date: new Date(input.date), sleepStart: start, sleepEnd: end, sleepDurationSec: durationSec,
      manualEntry: true, source: "MANUAL",
      sleepStages: asJson(input.deepMin || input.remMin || input.awakeMin ? { deepSec: (input.deepMin ?? 0) * 60, remSec: (input.remMin ?? 0) * 60, awakeSec: (input.awakeMin ?? 0) * 60 } : undefined),
    },
  });

  await computeAndSaveDailyMetric(userId, input.date);
  revalidatePath("/app");
  revalidatePath("/app/sleep");
  return { ok: true };
}

export async function logHrvManual(input: { date: string; hrvMs: number; restingHr: number | null }): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "Нужно войти в аккаунт." };
  const userId = session.user.id;

  await ensureDailyMetricRow(userId, input.date);
  await prisma.dailyMetric.update({
    where: { userId_date: { userId, date: new Date(input.date) } },
    data: { hrvMs: input.hrvMs, restingHr: input.restingHr ?? undefined, manualEntry: true, source: "MANUAL" },
  });
  await computeAndSaveDailyMetric(userId, input.date);

  revalidatePath("/app");
  return { ok: true };
}

// A workout with no device at all — duration + optional HR/RPE, still
// contributes to training load / strain / plan matching.
export async function logActivityManual(input: {
  sport: string; startedAt: string; durationSec: number; distanceM?: number | null;
  avgHr?: number | null; perceivedExertion?: number | null; notes?: string | null;
}): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "Нужно войти в аккаунт." };
  if (input.durationSec <= 0) return { ok: false, error: "Укажи длительность тренировки." };

  await ingestActivity(session.user.id, "MANUAL" as DataSource, {
    sport: input.sport, startedAt: new Date(input.startedAt), durationSec: input.durationSec,
    distanceM: input.distanceM ?? null, avgHr: input.avgHr ?? null,
    perceivedExertion: input.perceivedExertion ?? null,
  });

  revalidatePath("/app");
  revalidatePath("/app/training");
  return { ok: true };
}

export async function updatePlanItemStatus(planItemId: string, status: "SKIPPED" | "COMPLETED"): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "Нужно войти в аккаунт." };
  const item = await prisma.planItem.findUnique({ where: { id: planItemId } });
  if (!item || item.userId !== session.user.id) return { ok: false, error: "Тренировка не найдена." };

  await prisma.planItem.update({ where: { id: planItemId }, data: { status } });
  if (status === "SKIPPED") {
    await computeAndSaveDailyMetric(session.user.id, dstr(item.date));
  }
  revalidatePath("/app/training");
  revalidatePath("/app");
  return { ok: true };
}
