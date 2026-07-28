import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";
import { prisma } from "@/lib/prisma";
import { runPolarSyncForUser } from "@/lib/actions/devices";

// Receives Polar's push notification when new training data becomes
// available for an athlete (registered once, manually, in the Polar
// AccessLink admin panel — see README). Polling via the "Sync now" button
// and the daily cron work without this; the webhook just makes sync near-
// instant instead of waiting for the next poll.
export async function POST(req: NextRequest) {
  const raw = await req.text();

  const secret = process.env.POLAR_WEBHOOK_SIGNATURE_SECRET;
  if (secret) {
    const signature = req.headers.get("polar-webhook-signature") ?? req.headers.get("signature");
    const expected = crypto.createHmac("sha256", secret).update(raw).digest("hex");
    if (!signature || signature !== expected) {
      return NextResponse.json({ error: "invalid signature" }, { status: 401 });
    }
  }

  let payload: { event?: string; user_id?: number };
  try {
    payload = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  if (payload.event === "EXERCISE" && payload.user_id != null) {
    const conn = await prisma.deviceConnection.findFirst({ where: { provider: "POLAR", externalUserId: String(payload.user_id) } });
    if (conn) await runPolarSyncForUser(conn.userId).catch((e) => console.error("Polar webhook sync failed", e));
  }

  return NextResponse.json({ ok: true });
}
