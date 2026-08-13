// Real Strava API v3 client. Endpoints per Strava's own developer docs
// (developers.strava.com/docs/reference/):
//   authorize: https://www.strava.com/oauth/authorize
//   token:     https://www.strava.com/oauth/token
//   API base:  https://www.strava.com/api/v3
// Free self-serve app registration at https://www.strava.com/settings/api
// (no company or hardware needed). Deliberately the preferred path for
// Garmin data over the unofficial Garmin login: most Garmin devices can
// auto-upload to Strava (a real, official Garmin↔Strava integration),
// so an athlete who already has that set up gets their Garmin activities
// here through a fully sanctioned OAuth2 flow — no scraping, no bot
// detection, no ToS risk.
//
// Access tokens expire after 6 hours, unlike Polar's — every call goes
// through ensureFreshToken so a stored refresh_token quietly renews it
// instead of failing.

const AUTHORIZE_URL = "https://www.strava.com/oauth/authorize";
const TOKEN_URL = "https://www.strava.com/oauth/token";
const API_BASE = "https://www.strava.com/api/v3";

function creds() {
  const clientId = process.env.STRAVA_CLIENT_ID;
  const clientSecret = process.env.STRAVA_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error("STRAVA_CLIENT_ID / STRAVA_CLIENT_SECRET не заданы — см. README (раздел Strava).");
  }
  return { clientId, clientSecret };
}

export function stravaAuthorizeUrl(redirectUri: string, state: string): string {
  const { clientId } = creds();
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    approval_prompt: "auto",
    scope: "activity:read_all",
    state,
  });
  return `${AUTHORIZE_URL}?${params.toString()}`;
}

export type StravaTokens = { accessToken: string; refreshToken: string; expiresAt: number; athleteId: string };

export async function exchangeStravaCode(code: string): Promise<StravaTokens> {
  const { clientId, clientSecret } = creds();
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ client_id: clientId, client_secret: clientSecret, code, grant_type: "authorization_code" }),
  });
  if (!res.ok) throw new Error(`Strava token exchange failed: ${res.status} ${await res.text()}`);
  const json = await res.json();
  return {
    accessToken: json.access_token,
    refreshToken: json.refresh_token,
    expiresAt: json.expires_at * 1000,
    athleteId: String(json.athlete?.id ?? ""),
  };
}

export async function refreshStravaToken(refreshToken: string): Promise<{ accessToken: string; refreshToken: string; expiresAt: number }> {
  const { clientId, clientSecret } = creds();
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ client_id: clientId, client_secret: clientSecret, refresh_token: refreshToken, grant_type: "refresh_token" }),
  });
  if (!res.ok) throw new Error(`Strava token refresh failed: ${res.status} ${await res.text()}`);
  const json = await res.json();
  return { accessToken: json.access_token, refreshToken: json.refresh_token, expiresAt: json.expires_at * 1000 };
}

export type StravaActivitySummary = {
  id: number;
  name: string;
  type: string;
  startDateLocal: string;
  durationSec: number;
  distanceM: number | null;
  avgHr: number | null;
  maxHr: number | null;
  calories: number | null;
  avgSpeedMps: number | null;
};

export async function listRecentStravaActivities(accessToken: string, sinceUnix?: number): Promise<StravaActivitySummary[]> {
  const params = new URLSearchParams({ per_page: "30" });
  if (sinceUnix) params.set("after", String(sinceUnix));
  const res = await fetch(`${API_BASE}/athlete/activities?${params.toString()}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error(`Strava list activities failed: ${res.status} ${await res.text()}`);
  const json = (await res.json()) as Record<string, unknown>[];
  return json.map((a) => ({
    id: a.id as number,
    name: (a.name as string) ?? "Тренировка",
    type: ((a.sport_type as string) ?? (a.type as string) ?? "Other"),
    startDateLocal: a.start_date_local as string,
    durationSec: Math.round((a.moving_time as number) ?? 0),
    distanceM: (a.distance as number) ?? null,
    avgHr: (a.average_heartrate as number) ?? null,
    maxHr: (a.max_heartrate as number) ?? null,
    calories: (a.calories as number) ?? null,
    avgSpeedMps: (a.average_speed as number) ?? null,
  }));
}

const STRAVA_SPORT_MAP: Record<string, string> = {
  Run: "running", TrailRun: "trail_running", Ride: "cycling", MountainBikeRide: "cycling",
  GravelRide: "cycling", Swim: "swimming", Rowing: "rowing", NordicSki: "cross_country_ski",
  WeightTraining: "strength", Workout: "strength",
};

export function mapStravaSport(type: string): string {
  return STRAVA_SPORT_MAP[type] ?? "other";
}
