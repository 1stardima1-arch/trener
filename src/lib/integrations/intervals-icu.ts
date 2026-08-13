// intervals.icu client — the recommended bridge for full Garmin data
// (sleep + HRV/recovery + training in one place), because intervals.icu
// is itself an official Garmin integration partner: the athlete connects
// Garmin to intervals.icu through intervals.icu's own proper OAuth consent
// screen (not the reverse-engineered login this project's Garmin card
// uses), and intervals.icu syncs the full wellness picture — RHR,
// overnight HRV, sleep stages, Body Battery — alongside activities. This
// client then reads that already-synced data back out through
// intervals.icu's own self-serve API (personal API key, no partner
// approval needed), so Тренер never touches Garmin directly for users on
// this path.
//
// Confidence note: the base URL, wellness endpoint path, and the
// restingHR field name are corroborated by multiple independent sources
// (intervals.icu's own feature/API pages, forum posts, and real example
// code from the maintained py-intervalsicu client). The exact date-range
// query parameter names and the full wellness field list (hrv/sleep field
// names specifically) could NOT be verified against live docs — this
// sandbox can't reach intervals.icu at all. Parsing below tries several
// plausible field-name candidates per metric and keeps the raw response
// so a wrong guess is fixable from real data instead of silently dropping
// it. If wellness fields come back empty despite a successful connection,
// that's the first thing to check.

const API_BASE = "https://intervals.icu/api/v1";

function authHeader(apiKey: string): string {
  // intervals.icu's personal-API-key auth is HTTP Basic with the literal
  // string "API_KEY" as the username and the athlete's key as the password
  // — not a real username, just how they've documented the scheme.
  return "Basic " + Buffer.from(`API_KEY:${apiKey}`).toString("base64");
}

export async function verifyIntervalsIcuKey(athleteId: string, apiKey: string): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const res = await fetch(`${API_BASE}/athlete/${encodeURIComponent(athleteId)}`, {
      headers: { Authorization: authHeader(apiKey) },
    });
    if (res.status === 401 || res.status === 403) return { ok: false, error: "intervals.icu: неверный Athlete ID или API-ключ." };
    if (!res.ok) return { ok: false, error: `intervals.icu: ошибка проверки ключа (${res.status}).` };
    return { ok: true };
  } catch (e) {
    // A thrown network error here (DNS, timeout, TLS) would otherwise
    // propagate uncaught out of the server action and crash the whole
    // page with a generic Next.js error screen instead of showing the
    // athlete an inline message on the Devices card.
    return { ok: false, error: e instanceof Error ? `intervals.icu: сеть недоступна (${e.message}).` : "intervals.icu: сеть недоступна." };
  }
}

export type IntervalsWellnessDay = {
  date: string;
  hrv: number | null;
  restingHR: number | null;
  sleepSecs: number | null;
  spO2: number | null;
  respiration: number | null;
  bodyBattery: number | null;
  raw: Record<string, unknown>;
};

function pickNumber(obj: Record<string, unknown>, keys: string[]): number | null {
  for (const k of keys) {
    const v = obj[k];
    if (typeof v === "number" && Number.isFinite(v)) return v;
  }
  return null;
}

export async function fetchIntervalsWellness(athleteId: string, apiKey: string, oldest: string, newest: string): Promise<IntervalsWellnessDay[]> {
  const params = new URLSearchParams({ oldest, newest });
  const res = await fetch(`${API_BASE}/athlete/${encodeURIComponent(athleteId)}/wellness?${params.toString()}`, {
    headers: { Authorization: authHeader(apiKey) },
  });
  if (!res.ok) throw new Error(`intervals.icu: не удалось получить данные самочувствия (${res.status}).`);
  const json = (await res.json()) as Record<string, unknown>[];
  return (Array.isArray(json) ? json : []).map((d) => ({
    date: String(d.id ?? d.date ?? ""),
    hrv: pickNumber(d, ["hrv", "hrvSDNN", "heartRateVariability"]),
    restingHR: pickNumber(d, ["restingHR", "restingHr", "rhr"]),
    sleepSecs: pickNumber(d, ["sleepSecs", "sleepSeconds", "sleepTime", "sleepDuration"]),
    spO2: pickNumber(d, ["spO2", "spo2", "avgSpO2"]),
    respiration: pickNumber(d, ["respiration", "respirationRate", "avgRespirationRate"]),
    bodyBattery: pickNumber(d, ["bodyBattery", "bodyBatteryStart"]),
    raw: d,
  }));
}

export type IntervalsActivity = {
  id: string;
  name: string;
  type: string;
  startDateLocal: string;
  durationSec: number;
  distanceM: number | null;
  avgHr: number | null;
  maxHr: number | null;
  calories: number | null;
  avgPaceSecPerKm: number | null;
};

const INTERVALS_SPORT_MAP: Record<string, string> = {
  Run: "running", TrailRun: "trail_running", Ride: "cycling", MountainBikeRide: "cycling",
  GravelRide: "cycling", Swim: "swimming", Rowing: "rowing", NordicSki: "cross_country_ski",
  WeightTraining: "strength", Workout: "strength",
};

export function mapIntervalsSport(type: string): string {
  return INTERVALS_SPORT_MAP[type] ?? "other";
}

export async function fetchIntervalsActivities(athleteId: string, apiKey: string, oldest: string, newest: string): Promise<IntervalsActivity[]> {
  const params = new URLSearchParams({ oldest, newest });
  const res = await fetch(`${API_BASE}/athlete/${encodeURIComponent(athleteId)}/activities?${params.toString()}`, {
    headers: { Authorization: authHeader(apiKey) },
  });
  if (!res.ok) throw new Error(`intervals.icu: не удалось получить тренировки (${res.status}).`);
  const json = (await res.json()) as Record<string, unknown>[];
  return (Array.isArray(json) ? json : []).map((a) => {
    const movingTime = (a.moving_time as number) ?? (a.movingTime as number) ?? 0;
    const distance = (a.distance as number) ?? null;
    const avgSpeed = movingTime && distance ? distance / movingTime : null;
    return {
      id: String(a.id),
      name: (a.name as string) ?? "Тренировка",
      type: (a.type as string) ?? "Workout",
      startDateLocal: (a.start_date_local as string) ?? (a.startDateLocal as string),
      durationSec: Math.round(movingTime),
      distanceM: distance,
      avgHr: pickNumber(a, ["icu_average_hr", "average_heartrate", "averageHr"]),
      maxHr: pickNumber(a, ["max_heartrate", "maxHr"]),
      calories: pickNumber(a, ["calories", "icu_joules"]),
      avgPaceSecPerKm: avgSpeed ? 1000 / avgSpeed : null,
    };
  });
}
