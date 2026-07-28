import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";
import { auth } from "@/auth";
import { polarAuthorizeUrl } from "@/lib/integrations/polar";

// Kicks off the real Polar AccessLink OAuth2 flow — redirects the athlete
// to Polar's own login/consent screen. See README for how to get
// POLAR_CLIENT_ID/POLAR_CLIENT_SECRET (free self-serve registration, no
// company or hardware needed, unlike Garmin's gated program).
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.redirect(new URL("/login", req.url));

  const redirectUri = new URL("/api/devices/polar/callback", req.url).toString();
  const state = crypto.randomBytes(16).toString("hex");

  const res = NextResponse.redirect(
    (() => {
      try {
        return polarAuthorizeUrl(redirectUri, state);
      } catch {
        return new URL("/app/devices?error=polar_not_configured", req.url).toString();
      }
    })()
  );
  res.cookies.set("polar_oauth_state", state, { httpOnly: true, secure: true, sameSite: "lax", maxAge: 600, path: "/" });
  return res;
}
