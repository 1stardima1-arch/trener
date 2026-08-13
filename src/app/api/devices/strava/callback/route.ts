import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { encryptSecret } from "@/lib/crypto";
import { exchangeStravaCode } from "@/lib/integrations/strava";
import { runStravaSyncForUser } from "@/lib/actions/devices";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.redirect(new URL("/login", req.url));

  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const cookieState = req.cookies.get("strava_oauth_state")?.value;
  const denied = url.searchParams.get("error");

  const fail = (reason: string) => NextResponse.redirect(new URL(`/app/devices?error=${encodeURIComponent(reason)}`, req.url));

  if (denied) return fail("strava_denied");
  if (!code || !state || !cookieState || state !== cookieState) return fail("strava_invalid_state");

  try {
    const { accessToken, refreshToken, expiresAt, athleteId } = await exchangeStravaCode(code);

    await prisma.deviceConnection.upsert({
      where: { userId_provider: { userId: session.user.id, provider: "STRAVA" } },
      update: {
        status: "CONNECTED", accessTokenEnc: encryptSecret(accessToken), refreshTokenEnc: encryptSecret(refreshToken),
        tokenExpiresAt: new Date(expiresAt), externalUserId: athleteId, lastSyncError: null,
      },
      create: {
        userId: session.user.id, provider: "STRAVA", status: "CONNECTED", accessTokenEnc: encryptSecret(accessToken),
        refreshTokenEnc: encryptSecret(refreshToken), tokenExpiresAt: new Date(expiresAt), externalUserId: athleteId,
      },
    });

    await runStravaSyncForUser(session.user.id);
  } catch (e) {
    console.error("Strava OAuth callback error", e);
    return fail("strava_exchange_failed");
  }

  const res = NextResponse.redirect(new URL("/app/devices?connected=strava", req.url));
  res.cookies.delete("strava_oauth_state");
  return res;
}
