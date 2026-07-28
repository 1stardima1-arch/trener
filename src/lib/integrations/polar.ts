// Real Polar AccessLink v3 client. Endpoints verified against Polar's own
// official example client (github.com/polarofficial/accesslink-example-python):
//   authorize: https://flow.polar.com/oauth2/authorization
//   token:     https://polarremote.com/v2/oauth2/token
//   API base:  https://www.polaraccesslink.com/v3
// Requires POLAR_CLIENT_ID/POLAR_CLIENT_SECRET from a free self-serve
// registration at https://admin.polaraccesslink.com — no company or
// hardware required, unlike Garmin's gated partner program (see README).

const AUTHORIZE_URL = "https://flow.polar.com/oauth2/authorization";
const TOKEN_URL = "https://polarremote.com/v2/oauth2/token";
const API_BASE = "https://www.polaraccesslink.com/v3";

function creds() {
  const clientId = process.env.POLAR_CLIENT_ID;
  const clientSecret = process.env.POLAR_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error("POLAR_CLIENT_ID / POLAR_CLIENT_SECRET не заданы — см. README (раздел Polar).");
  }
  return { clientId, clientSecret };
}

export function polarAuthorizeUrl(redirectUri: string, state: string): string {
  const { clientId } = creds();
  const params = new URLSearchParams({
    response_type: "code",
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: "accesslink.read_all",
    state,
  });
  return `${AUTHORIZE_URL}?${params.toString()}`;
}

export type PolarTokens = { accessToken: string; polarUserId: string };

export async function exchangePolarCode(code: string, redirectUri: string): Promise<PolarTokens> {
  const { clientId, clientSecret } = creds();
  const basic = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: {
      Authorization: `Basic ${basic}`,
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body: new URLSearchParams({ grant_type: "authorization_code", code, redirect_uri: redirectUri }),
  });
  if (!res.ok) throw new Error(`Polar token exchange failed: ${res.status} ${await res.text()}`);
  const json = await res.json();
  // Polar returns the athlete's Polar user id as "x_user_id" alongside the token.
  return { accessToken: json.access_token, polarUserId: String(json.x_user_id) };
}

function authHeaders(accessToken: string) {
  return { Authorization: `Bearer ${accessToken}`, Accept: "application/json" };
}

// Registration is required once per athlete before any data endpoint will
// return anything — Polar's API 409s harmlessly if already registered,
// which we treat as success.
export async function registerPolarUser(accessToken: string, polarUserId: string, memberId: string) {
  const res = await fetch(`${API_BASE}/users`, {
    method: "POST",
    headers: { ...authHeaders(accessToken), "Content-Type": "application/json" },
    body: JSON.stringify({ "member-id": memberId }),
  });
  if (!res.ok && res.status !== 409) {
    throw new Error(`Polar user registration failed: ${res.status} ${await res.text()}`);
  }
}

export async function unregisterPolarUser(accessToken: string, polarUserId: string) {
  await fetch(`${API_BASE}/users/${polarUserId}`, { method: "DELETE", headers: authHeaders(accessToken) });
}

export type PolarExerciseSummary = {
  uri: string;
  startTime: string;
  sport: string;
  durationIso: string;
  distanceM: number | null;
  calories: number | null;
  avgHr: number | null;
  maxHr: number | null;
  samplesUri: string;
};

// The AccessLink sync model is transaction-based, not a simple GET-list:
// open a transaction (Polar snapshots "what's new since last commit"),
// read every exercise the transaction exposes, then commit to acknowledge
// receipt so the same exercises aren't re-offered next time.
export async function syncNewExercises(accessToken: string, polarUserId: string): Promise<PolarExerciseSummary[]> {
  const createRes = await fetch(`${API_BASE}/users/${polarUserId}/exercise-transactions`, {
    method: "POST",
    headers: authHeaders(accessToken),
  });
  if (createRes.status === 204) return []; // nothing new
  if (!createRes.ok) throw new Error(`Polar create transaction failed: ${createRes.status} ${await createRes.text()}`);
  const { "resource-uri": transactionUri } = await createRes.json();

  const listRes = await fetch(transactionUri, { headers: authHeaders(accessToken) });
  if (!listRes.ok) throw new Error(`Polar list exercises failed: ${listRes.status}`);
  const { exercises = [] as string[] } = await listRes.json();

  const summaries: PolarExerciseSummary[] = [];
  for (const uri of exercises) {
    const res = await fetch(uri, { headers: authHeaders(accessToken) });
    if (!res.ok) continue;
    const j = await res.json();
    summaries.push({
      uri,
      startTime: j["start-time"],
      sport: (j.sport ?? "OTHER").toString(),
      durationIso: j.duration ?? "PT0S",
      distanceM: j.distance ?? null,
      calories: j.calories ?? null,
      avgHr: j["heart-rate"]?.average ?? null,
      maxHr: j["heart-rate"]?.maximum ?? null,
      samplesUri: `${uri}/samples`,
    });
  }

  // Acknowledge receipt so this batch isn't re-offered on the next sync.
  await fetch(transactionUri, { method: "PUT", headers: authHeaders(accessToken) });

  return summaries;
}

export type PolarSamplePoint = { recordingRate: number; sampleType: string; data: number[] };

export async function getExerciseSamples(accessToken: string, samplesUri: string): Promise<PolarSamplePoint[]> {
  const res = await fetch(samplesUri, { headers: authHeaders(accessToken) });
  if (!res.ok) return [];
  const j = await res.json();
  return Array.isArray(j.samples) ? j.samples : [];
}

// ISO-8601 duration ("PT1H23M45S") → seconds, as returned by every AccessLink duration field.
export function isoDurationToSec(iso: string): number {
  const m = /^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?$/.exec(iso);
  if (!m) return 0;
  const [, h, mnt, s] = m;
  return (Number(h) || 0) * 3600 + (Number(mnt) || 0) * 60 + (Number(s) || 0);
}

// Sleep / Nightly Recharge — plain date-range GETs, no transaction dance.
export async function getSleep(accessToken: string, date: string) {
  const res = await fetch(`${API_BASE}/users/sleep/${date}`, { headers: authHeaders(accessToken) });
  if (!res.ok) return null;
  return res.json();
}

export async function getNightlyRecharge(accessToken: string, date: string) {
  const res = await fetch(`${API_BASE}/users/nightly-recharge/${date}`, { headers: authHeaders(accessToken) });
  if (!res.ok) return null;
  return res.json();
}
