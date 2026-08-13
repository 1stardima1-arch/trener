"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { ensureDailyMetricRow, ensureTodayPlanItem } from "@/lib/engine";

export type ActionResult = { ok: true } | { ok: false; error: string };

// The subjective half of readiness (WHOOP Journal / Garmin-style self-
// report) — energy, soreness, stress on a 1-5 scale, plus a free-text
// note. Kept deliberately separate from recoveryScore (see the schema
// comment on DailyMetric.subjectiveEnergy): this never rewrites the
// physiological score, it's a second input the plan adaptation and AI
// coach reason about alongside it. Re-running ensureTodayPlanItem here is
// what lets a same-day check-in actually change today's prescribed
// session, not just get logged for later.
export async function saveDailyCheckIn(input: {
  date: string;
  energy: number;
  soreness: number;
  stress: number;
  note?: string;
}): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "Нужно войти в аккаунт." };
  const userId = session.user.id;

  for (const [label, v] of [["energy", input.energy], ["soreness", input.soreness], ["stress", input.stress]] as const) {
    if (!Number.isInteger(v) || v < 1 || v > 5) return { ok: false, error: `Некорректное значение: ${label}.` };
  }

  await ensureDailyMetricRow(userId, input.date);
  await prisma.dailyMetric.update({
    where: { userId_date: { userId, date: new Date(input.date) } },
    data: {
      subjectiveEnergy: input.energy,
      subjectiveSoreness: input.soreness,
      subjectiveStress: input.stress,
      subjectiveNote: input.note?.trim() || null,
    },
  });

  // Re-adjust today's plan against the new subjective input immediately,
  // rather than waiting for the next cron/page-load cycle — the athlete
  // just told the app "I'm sore", the plan should react now.
  try {
    await ensureTodayPlanItem(userId, { force: true });
  } catch (e) {
    console.error("re-adjust plan after check-in failed", e);
  }

  revalidatePath("/app");
  return { ok: true };
}
