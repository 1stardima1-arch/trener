import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";
import { auth } from "@/auth";
import { stravaAuthorizeUrl } from "@/lib/integrations/strava";

// Kicks off the real Strava OAuth2 flow. See README for how to get
// STRAVA_CLIENT_ID/STRAVA_CLIENT_SECRET (free self-serve app registration
// at strava.com/settings/api, no company or hardware needed).
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.redirect(new URL("/login", req.url));

  const redirectUri = new URL("/api/devices/strava/callback", req.url).toString();
  const state = crypto.randomBytes(16).toString("hex");

  const res = NextResponse.redirect(
    (() => {
      try {
        return stravaAuthorizeUrl(redirectUri, state);
      } catch {
        return new URL("/app/devices?error=strava_not_configured", req.url).toString();
      }
    })()
  );
  res.cookies.set("strava_oauth_state", state, { httpOnly: true, secure: true, sameSite: "lax", maxAge: 600, path: "/" });
  return res;
}
