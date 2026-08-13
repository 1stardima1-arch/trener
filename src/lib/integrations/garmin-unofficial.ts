// Best-effort Garmin Connect sync via the same reverse-engineered SSO login
// flow used by the popular open-source clients (python-garminconnect,
// garth, the various "garmin-connect" npm packages) — this exists because
// Garmin's *official* Health/Activity API requires partner-program approval
// that, as of 2026, isn't open to new applicants (see README). It is NOT
// the official API, technically against Garmin's connect.garmin.com Terms
// of Use, and can break without notice whenever Garmin changes their login
// page — exactly the trade-off every open-source Garmin integration carries.
// Off by default (ENABLE_GARMIN_UNOFFICIAL_SYNC), and the athlete has to
// explicitly opt in and accept that risk on the devices page.
//
// Flow: SSO username/password login → short-lived login "ticket" →
// exchange the ticket for a long-lived OAuth1 token/secret (~1 year) →
// exchange THAT for a short-lived OAuth2 bearer token (~1 hour, refreshable)
// used against connectapi.garmin.com. Garmin's own mobile app authenticates
// the exact same way; we're just doing what the app does.
//
// The OAuth1 consumer credentials Garmin Connect Mobile itself uses aren't
// meant to be hand-copied into an env var: every open-source client in this
// space (garth, python-garminconnect, ...) fetches them live from a public
// endpoint Garmin's own ecosystem tooling publishes them at, specifically
// so a rotation doesn't silently break every downstream project at once.
// GARMIN_CONSUMER_KEY / GARMIN_CONSUMER_SECRET still work as an optional
// override (e.g. to pin a known-good pair, or if this endpoint ever goes
// away), but requiring them was a mistake — that's the literal error this
// comment used to cause. Cached in-memory for the life of the server
// process; a bad cached value just means "reconnect Garmin" clears it via
// a fresh cold start, not a stuck app.
import crypto from "node:crypto";

const SSO_BASE = "https://sso.garmin.com/sso";
const CONNECT_API = "https://connectapi.garmin.com";
const CONSUMER_CREDS_URL = "https://thegarth.s3.amazonaws.com/oauth_consumer.json";

let cachedConsumerCreds: { key: string; secret: string } | null = null;

async function consumerCreds(): Promise<{ key: string; secret: string }> {
  if (process.env.GARMIN_CONSUMER_KEY && process.env.GARMIN_CONSUMER_SECRET) {
    return { key: process.env.GARMIN_CONSUMER_KEY, secret: process.env.GARMIN_CONSUMER_SECRET };
  }
  if (cachedConsumerCreds) return cachedConsumerCreds;

  const res = await fetch(CONSUMER_CREDS_URL);
  if (!res.ok) throw new Error(`Garmin: не удалось получить OAuth1-ключи (${CONSUMER_CREDS_URL} → ${res.status}).`);
  const json = (await res.json()) as { consumer_key?: string; consumer_secret?: string };
  if (!json.consumer_key || !json.consumer_secret) {
    throw new Error("Garmin: ответ с OAuth1-ключами пуст или изменил формат.");
  }
  cachedConsumerCreds = { key: json.consumer_key, secret: json.consumer_secret };
  return cachedConsumerCreds;
}

function oauth1Header(
  method: string,
  url: string,
  consumer: { key: string; secret: string },
  token?: { key: string; secret: string },
  extraParams: Record<string, string> = {}
): string {
  const oauthParams: Record<string, string> = {
    oauth_consumer_key: consumer.key,
    oauth_nonce: crypto.randomBytes(16).toString("hex"),
    oauth_signature_method: "HMAC-SHA1",
    oauth_timestamp: String(Math.floor(Date.now() / 1000)),
    oauth_version: "1.0",
    ...(token ? { oauth_token: token.key } : {}),
  };

  const u = new URL(url);
  const allParams: Record<string, string> = { ...oauthParams, ...extraParams };
  u.searchParams.forEach((v, k) => (allParams[k] = v));

  const baseParams = Object.keys(allParams)
    .sort()
    .map((k) => `${encodeURIComponent(k)}=${encodeURIComponent(allParams[k])}`)
    .join("&");
  const baseString = [method.toUpperCase(), encodeURIComponent(`${u.origin}${u.pathname}`), encodeURIComponent(baseParams)].join("&");
  const signingKey = `${encodeURIComponent(consumer.secret)}&${encodeURIComponent(token?.secret ?? "")}`;
  const signature = crypto.createHmac("sha1", signingKey).update(baseString).digest("base64");

  const headerParams = { ...oauthParams, oauth_signature: signature };
  return "OAuth " + Object.entries(headerParams).map(([k, v]) => `${encodeURIComponent(k)}="${encodeURIComponent(v)}"`).join(", ");
}

type CookieJar = Map<string, string>;

function applyCookies(jar: CookieJar, res: Response) {
  const raw = (res.headers as unknown as { getSetCookie?: () => string[] }).getSetCookie?.() ?? [];
  for (const c of raw) {
    const [pair] = c.split(";");
    const idx = pair.indexOf("=");
    if (idx > 0) jar.set(pair.slice(0, idx).trim(), pair.slice(idx + 1).trim());
  }
}
function cookieHeader(jar: CookieJar) {
  return [...jar.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
}

export type GarminOAuth1Token = { key: string; secret: string };

// Step 1+2: SSO login → OAuth1 token. Only the resulting token/secret is
// ever persisted (encrypted) — the password is used once in-memory here and
// never written to the database or logs.
export async function garminSsoLogin(email: string, password: string): Promise<GarminOAuth1Token> {
  const consumer = await consumerCreds();
  const jar: CookieJar = new Map();

  const qs = new URLSearchParams({
    service: "https://connect.garmin.com/modern",
    webhost: "https://connect.garmin.com/modern",
    source: "https://connect.garmin.com/signin",
    redirectAfterAccountLoginUrl: "https://connect.garmin.com/modern",
    redirectAfterAccountCreationUrl: "https://connect.garmin.com/modern",
    gauthHost: SSO_BASE,
    locale: "ru_RU",
    id: "gauth-widget",
    cssUrl: "https://static.garmincdn.com/com.garmin.connect/ui/css/gauth-custom-v1.2-min.css",
    clientId: "GarminConnect",
    rememberMeShown: "true",
    rememberMeChecked: "false",
    createAccountShown: "true",
    openCreateAccount: "false",
    displayNameShown: "false",
    consumeServiceTicket: "false",
    initialFocus: "true",
    embedWidget: "false",
    generateExtraServiceTicket: "true",
    generateTwoExtraServiceTickets: "false",
    generateNoServiceTicket: "false",
    globalOptInShown: "true",
    globalOptInChecked: "false",
    mobile: "false",
    connectLegalTerms: "true",
    locationPromptShown: "true",
    showPassword: "true",
  });

  const signinUrl = `${SSO_BASE}/signin?${qs.toString()}`;
  const getRes = await fetch(signinUrl, { headers: { "User-Agent": "Mozilla/5.0" } });
  applyCookies(jar, getRes);
  const html = await getRes.text();
  const csrfMatch = html.match(/name="_csrf"\s+value="([^"]+)"/);
  if (!csrfMatch) throw new Error("Garmin: не удалось получить страницу входа (изменился формат страницы Garmin SSO).");

  const postRes = await fetch(signinUrl, {
    method: "POST",
    redirect: "manual",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Cookie: cookieHeader(jar),
      "User-Agent": "Mozilla/5.0",
    },
    body: new URLSearchParams({ username: email, password, embed: "false", _csrf: csrfMatch[1] }),
  });
  applyCookies(jar, postRes);
  const postHtml = await postRes.text();
  const ticketMatch = postHtml.match(/ticket=([\w-]+)/);
  if (!ticketMatch) {
    // Distinguish the known failure modes instead of guessing "wrong
    // password" for all of them — each needs a genuinely different fix
    // (nothing to do here for MFA vs. a real regex update for a changed
    // page), and this is the one path in the whole flow this project has
    // no way to test without a real Garmin account, so the error itself
    // has to carry enough of the actual response to diagnose from.
    const lower = postHtml.toLowerCase();
    if (lower.includes("mfa") || lower.includes("verification code") || lower.includes("двухфактор")) {
      throw new Error("Garmin: аккаунт запросил код двухфакторной аутентификации — это пока не поддерживается неофициальной синхронизацией. Временно отключи двухфакторную защиту в настройках Garmin Connect, если хочешь использовать эту синхронизацию, либо используй выгрузку .fit-файлов вместо неё.");
    }
    if (lower.includes("invalid") || lower.includes("incorrect") || lower.includes("неверн")) {
      throw new Error("Garmin: неверный логин или пароль (это подтверждённый ответ от Garmin, не догадка).");
    }
    const snippet = postHtml.replace(new RegExp(email.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi"), "[email]").slice(0, 220).replace(/\s+/g, " ").trim();
    throw new Error(
      `Garmin: не нашли билет входа в ответе (HTTP ${postRes.status}, Content-Type: ${postRes.headers.get("content-type") ?? "?"}). Похоже, Garmin изменил страницу входа — вот начало ответа для диагностики: "${snippet}"`
    );
  }
  const ticket = ticketMatch[1];

  const preauthUrl = `${CONNECT_API}/oauth-service/oauth/preauthorized?ticket=${ticket}&login-url=https://sso.garmin.com/sso/embed&accepts-mfa-tokens=true`;
  const authHeader = oauth1Header("GET", preauthUrl, consumer);
  const tokenRes = await fetch(preauthUrl, { headers: { Authorization: authHeader, "User-Agent": "Mozilla/5.0" } });
  if (!tokenRes.ok) throw new Error(`Garmin: обмен билета на токен не удался (${tokenRes.status}).`);
  const body = await tokenRes.text();
  const params = new URLSearchParams(body);
  const oauthToken = params.get("oauth_token");
  const oauthTokenSecret = params.get("oauth_token_secret");
  if (!oauthToken || !oauthTokenSecret) throw new Error("Garmin: ответ на обмен токена не содержит oauth_token.");

  return { key: oauthToken, secret: oauthTokenSecret };
}

export type GarminOAuth2Token = { accessToken: string; refreshToken: string; expiresAt: number };

// Step 3: long-lived OAuth1 token → short-lived OAuth2 bearer token, used
// for every actual data call against connectapi.garmin.com.
export async function garminExchangeOAuth2(oauth1: GarminOAuth1Token): Promise<GarminOAuth2Token> {
  const consumer = await consumerCreds();
  const url = `${CONNECT_API}/oauth-service/oauth/exchange/user/2.0`;
  const authHeader = oauth1Header("POST", url, consumer, oauth1);
  const res = await fetch(url, { method: "POST", headers: { Authorization: authHeader, "User-Agent": "Mozilla/5.0" } });
  if (!res.ok) throw new Error(`Garmin: обмен на OAuth2-токен не удался (${res.status}). Возможно, срок действия входа истёк — переподключи Garmin.`);
  const json = await res.json();
  return {
    accessToken: json.access_token,
    refreshToken: json.refresh_token,
    expiresAt: Date.now() + (json.expires_in ?? 3600) * 1000,
  };
}

export type GarminActivitySummary = {
  activityId: number;
  activityName: string;
  activityType: string;
  startTimeLocal: string;
  durationSec: number;
  distanceM: number | null;
  averageHR: number | null;
  maxHR: number | null;
  calories: number | null;
  averageSpeedMps: number | null;
};

async function connectApiGet(path: string, accessToken: string) {
  const res = await fetch(`${CONNECT_API}${path}`, {
    headers: { Authorization: `Bearer ${accessToken}`, "di-backend": "connectapi.garmin.com", "User-Agent": "Mozilla/5.0" },
  });
  if (!res.ok) throw new Error(`Garmin Connect API ${path} → ${res.status}`);
  return res.json();
}

export async function listRecentGarminActivities(accessToken: string, limit = 20): Promise<GarminActivitySummary[]> {
  const json = await connectApiGet(`/activitylist-service/activities/search/activities?limit=${limit}&start=0`, accessToken);
  return (Array.isArray(json) ? json : []).map((a: Record<string, unknown>) => ({
    activityId: a.activityId as number,
    activityName: (a.activityName as string) ?? "Тренировка",
    activityType: ((a.activityType as { typeKey?: string } | undefined)?.typeKey) ?? "other",
    startTimeLocal: a.startTimeLocal as string,
    durationSec: Math.round((a.duration as number) ?? 0),
    distanceM: (a.distance as number) ?? null,
    averageHR: (a.averageHR as number) ?? null,
    maxHR: (a.maxHR as number) ?? null,
    calories: (a.calories as number) ?? null,
    averageSpeedMps: (a.averageSpeed as number) ?? null,
  }));
}

const GARMIN_SPORT_MAP: Record<string, string> = {
  running: "running", trail_running: "trail_running", cycling: "cycling", road_biking: "cycling",
  mountain_biking: "cycling", lap_swimming: "swimming", open_water_swimming: "swimming",
  rowing: "rowing", cross_country_skiing_ws: "cross_country_ski", strength_training: "strength",
};

export function mapGarminSport(typeKey: string): string {
  return GARMIN_SPORT_MAP[typeKey] ?? "other";
}
