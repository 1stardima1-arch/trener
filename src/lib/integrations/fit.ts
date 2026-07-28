// Parses .FIT files (Garmin, Polar, Suunto, Wahoo, COROS, and any other
// ANT+/Garmin-format device all export this same binary format) using
// Garmin's own official, open FIT JavaScript SDK — unlike Garmin's Connect
// API, the FIT file format itself is publicly documented and the parser is
// MIT-licensed, so this path needs no partner approval and works today for
// any device, regardless of brand: export/AutoSync a .FIT file (Garmin
// Connect "Export Original", Polar Flow "Export as TCX/FIT", or copy
// straight off the device's USB mass-storage /GARMIN/ACTIVITY folder) and
// upload it here.

import { Decoder, Stream } from "@garmin/fitsdk";

export type FitSample = {
  t: number; // seconds from first record
  hr?: number;
  paceMps?: number;
  powerW?: number;
  altitudeM?: number;
  cadence?: number;
};

export type ParsedFitActivity = {
  sport: string;
  startedAt: Date;
  durationSec: number;
  distanceM: number | null;
  elevationGainM: number | null;
  avgHr: number | null;
  maxHr: number | null;
  avgPaceSecPerKm: number | null;
  avgPowerW: number | null;
  normalizedPowerW: number | null;
  avgCadence: number | null;
  calories: number | null;
  samples: FitSample[];
};

// The FIT SDK's decoded dictionary keys follow Garmin's FIT profile codegen
// convention (camelCase "<messageName>Mesgs", e.g. recordMesgs/sessionMesgs)
// consistently across their SDKs — read case-insensitively as a defensive
// fallback in case a future SDK version changes casing.
function pickMesgs(messages: Record<string, unknown>, name: string): Record<string, unknown>[] {
  const exact = messages[`${name}Mesgs`];
  if (Array.isArray(exact)) return exact as Record<string, unknown>[];
  const key = Object.keys(messages).find((k) => k.toLowerCase() === `${name}mesgs`);
  return key && Array.isArray(messages[key]) ? (messages[key] as Record<string, unknown>[]) : [];
}

function num(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

const SPORT_MAP: Record<string, string> = {
  running: "running", trail_running: "trail_running", cycling: "cycling",
  swimming: "swimming", rowing: "rowing", cross_country_skiing: "cross_country_ski",
  training: "strength", fitness_equipment: "strength",
};

export function parseFitFile(buffer: Buffer): ParsedFitActivity {
  const stream = Stream.fromBuffer(buffer);
  const decoder = new Decoder(stream);
  const { messages, errors } = decoder.read() as unknown as { messages: Record<string, unknown>; errors: unknown[] };

  if (errors?.length) {
    throw new Error(`Файл повреждён или не является .FIT (${errors.length} ошибок при разборе).`);
  }

  const sessions = pickMesgs(messages, "session");
  const records = pickMesgs(messages, "record");
  if (sessions.length === 0 && records.length === 0) {
    throw new Error("В файле не найдено ни одной тренировки (session/record сообщений).");
  }

  const session = sessions[0] ?? {};
  const firstRecordTime = records[0]?.timestamp instanceof Date ? (records[0].timestamp as Date) : null;
  const startedAt = (session.startTime instanceof Date ? (session.startTime as Date) : firstRecordTime) ?? new Date();

  const samples: FitSample[] = records.map((r) => {
    const ts = r.timestamp instanceof Date ? (r.timestamp as Date) : startedAt;
    const speed = num(r.enhancedSpeed) ?? num(r.speed);
    return {
      t: Math.round((ts.getTime() - startedAt.getTime()) / 1000),
      hr: num(r.heartRate) ?? undefined,
      paceMps: speed ?? undefined,
      powerW: num(r.power) ?? undefined,
      altitudeM: num(r.enhancedAltitude) ?? num(r.altitude) ?? undefined,
      cadence: num(r.cadence) ?? undefined,
    };
  });

  const rawSport = typeof session.sport === "string" ? session.sport.toLowerCase() : "other";
  const avgSpeed = num(session.avgSpeed) ?? (samples.length ? avg(samples.map((s) => s.paceMps ?? 0)) : null);

  return {
    sport: SPORT_MAP[rawSport] ?? "other",
    startedAt,
    durationSec: Math.round(num(session.totalElapsedTime) ?? (samples.length ? samples[samples.length - 1].t : 0)),
    distanceM: num(session.totalDistance),
    elevationGainM: num(session.totalAscent),
    avgHr: num(session.avgHeartRate),
    maxHr: num(session.maxHeartRate),
    avgPaceSecPerKm: avgSpeed && avgSpeed > 0 ? 1000 / avgSpeed : null,
    avgPowerW: num(session.avgPower),
    normalizedPowerW: num(session.normalizedPower),
    avgCadence: num(session.avgCadence),
    calories: num(session.totalCalories),
    // Downsample to at most ~1 sample every 2s worth of points (cap ~5000
    // rows) so a multi-hour ride doesn't blow up the JSON column.
    samples: downsample(samples, 5000),
  };
}

function avg(nums: number[]): number | null {
  const valid = nums.filter((n) => Number.isFinite(n) && n > 0);
  return valid.length ? valid.reduce((a, b) => a + b, 0) / valid.length : null;
}

function downsample<T>(arr: T[], maxLen: number): T[] {
  if (arr.length <= maxLen) return arr;
  const step = arr.length / maxLen;
  const out: T[] = [];
  for (let i = 0; i < maxLen; i++) out.push(arr[Math.floor(i * step)]);
  return out;
}
