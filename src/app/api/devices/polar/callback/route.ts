import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { encryptSecret } from "@/lib/crypto";
import { exchangePolarCode, registerPolarUser } from "@/lib/integrations/polar";
import { runPolarSyncForUser } from "@/lib/actions/devices";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.redirect(new URL("/login", req.url));

  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const cookieState = req.cookies.get("polar_oauth_state")?.value;
  const denied = url.searchParams.get("error");

  const fail = (reason: string) => NextResponse.redirect(new URL(`/app/devices?error=${encodeURIComponent(reason)}`, req.url));

  if (denied) return fail("polar_denied");
  if (!code || !state || !cookieState || state !== cookieState) return fail("polar_invalid_state");

  try {
    const redirectUri = new URL("/api/devices/polar/callback", req.url).toString();
    const { accessToken, polarUserId } = await exchangePolarCode(code, redirectUri);
    await registerPolarUser(accessToken, polarUserId, session.user.id);

    await prisma.deviceConnection.upsert({
      where: { userId_provider: { userId: session.user.id, provider: "POLAR" } },
      update: { status: "CONNECTED", accessTokenEnc: encryptSecret(accessToken), externalUserId: polarUserId, lastSyncError: null },
      create: { userId: session.user.id, provider: "POLAR", status: "CONNECTED", accessTokenEnc: encryptSecret(accessToken), externalUserId: polarUserId },
    });

    await runPolarSyncForUser(session.user.id);
  } catch (e) {
    console.error("Polar OAuth callback error", e);
    return fail("polar_exchange_failed");
  }

  const res = NextResponse.redirect(new URL("/app/devices?connected=polar", req.url));
  res.cookies.delete("polar_oauth_state");
  return res;
}
