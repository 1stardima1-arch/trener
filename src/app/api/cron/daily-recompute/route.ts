import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ensureDailyMetricRow, computeAndSaveDailyMetric, ensureTodayPlanItem, ensureDailyBriefing } from "@/lib/engine";
import { runPolarSyncForUser, runAthyxSyncForUser, runGarminSyncForUser, runStravaSyncForUser } from "@/lib/actions/devices";

function today() {
  return new Date().toISOString().slice(0, 10);
}

// Called once a day by Vercel Cron (see vercel.json) for every athlete:
// pulls fresh device data, recomputes today's recovery/strain, and adapts
// today's plan item to it — the same pipeline a manual "sync now" button
// runs, just scheduled. Protected by CRON_SECRET so this can't be hit by
// randoms to burn Groq/API quota.
export async function GET(req: NextRequest) {
  const expected = process.env.CRON_SECRET;
  if (expected) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${expected}`) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const date = today();
  const connections = await prisma.deviceConnection.findMany({ where: { status: { not: "DISCONNECTED" } } });
  const byUser = new Map<string, typeof connections>();
  for (const c of connections) byUser.set(c.userId, [...(byUser.get(c.userId) ?? []), c]);

  let synced = 0;
  for (const [userId, conns] of byUser) {
    for (const c of conns) {
      try {
        if (c.provider === "POLAR") await runPolarSyncForUser(userId);
        if (c.provider === "ATHYX") await runAthyxSyncForUser(userId);
        if (c.provider === "GARMIN_CONNECT") await runGarminSyncForUser(userId);
        if (c.provider === "STRAVA") await runStravaSyncForUser(userId);
      } catch (e) {
        console.error(`cron sync failed for ${userId}/${c.provider}`, e);
      }
    }
    synced++;
  }

  const profiles = await prisma.athleteProfile.findMany({ select: { userId: true } });
  let recomputed = 0;
  for (const { userId } of profiles) {
    try {
      await ensureDailyMetricRow(userId, date);
      await computeAndSaveDailyMetric(userId, date);
      await ensureTodayPlanItem(userId);
      await ensureDailyBriefing(userId, date);
      recomputed++;
    } catch (e) {
      console.error(`cron recompute failed for ${userId}`, e);
    }
  }

  return NextResponse.json({ ok: true, athletes: profiles.length, devicesSynced: synced, recomputed });
}
