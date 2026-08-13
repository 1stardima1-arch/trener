"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { encryptSecret, decryptSecret } from "@/lib/crypto";
import { verifyAthyxKey, listAthyxSessions, type AthyxSession } from "@/lib/integrations/athyx";
import { parseFitFile } from "@/lib/integrations/fit";
import { garminSsoLogin, garminExchangeOAuth2, listRecentGarminActivities, mapGarminSport } from "@/lib/integrations/garmin-unofficial";
import { syncNewExercises, isoDurationToSec } from "@/lib/integrations/polar";
import { listRecentStravaActivities, mapStravaSport, refreshStravaToken } from "@/lib/integrations/strava";
import { verifyIntervalsIcuKey, fetchIntervalsWellness, fetchIntervalsActivities, mapIntervalsSport } from "@/lib/integrations/intervals-icu";
import { ingestActivity, ensureDailyMetricRow } from "@/lib/engine";
import type { DataSource } from "@prisma/client";

export type ActionResult = { ok: true } | { ok: false; error: string };

// ---------------- Athyx (real API-key REST) ----------------

export async function connectAthyx(apiKey: string): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "Нужно войти в аккаунт." };
  const key = apiKey.trim();
  if (!key.startsWith("ath_")) return { ok: false, error: "Похоже, это не похоже на API-ключ Athyx (должен начинаться с ath_). Создай его в athyx.com → Developers." };

  const valid = await verifyAthyxKey(key);
  if (!valid) return { ok: false, error: "Athyx отклонил ключ — проверь, что он скопирован полностью и не отозван." };

  await prisma.deviceConnection.upsert({
    where: { userId_provider: { userId: session.user.id, provider: "ATHYX" } },
    update: { status: "CONNECTED", secretEnc: encryptSecret(key), lastSyncError: null },
    create: { userId: session.user.id, provider: "ATHYX", status: "CONNECTED", secretEnc: encryptSecret(key) },
  });

  await runAthyxSyncForUser(session.user.id);
  revalidatePath("/app/devices");
  return { ok: true };
}

function athyxSessionToActivity(s: AthyxSession) {
  const zones = s.lactateZones;
  const dominantZoneMinutes = zones ? Math.max(...Object.values(zones).filter((v): v is number => typeof v === "number")) : null;
  return {
    externalId: s.id,
    sport: (typeof s.sport === "string" ? s.sport : "other").toLowerCase(),
    startedAt: new Date(s.startedAt),
    durationSec: s.durationSec ?? 0,
    isStepTest: false,
    notes: dominantZoneMinutes != null ? `Метаболическая нагрузка (Athyx): ${s.metabolicLoad ?? "—"}` : undefined,
  };
}

// Not session-gated — shared by the connectAthyx/syncAthyx actions and the
// daily cron route, same reasoning as runPolarSyncForUser above.
export async function runAthyxSyncForUser(userId: string): Promise<ActionResult> {
  const conn = await prisma.deviceConnection.findUnique({ where: { userId_provider: { userId, provider: "ATHYX" } } });
  if (!conn?.secretEnc) return { ok: false, error: "Athyx не подключён." };

  try {
    const apiKey = decryptSecret(conn.secretEnc);
    const sessions = await listAthyxSessions(apiKey, conn.lastSyncedAt?.toISOString());
    for (const s of sessions) {
      const activity = await ingestActivity(userId, "ATHYX" as DataSource, athyxSessionToActivity(s));
      if (s.avgLactateMmol) {
        await prisma.lactateReading.create({
          data: { userId, activityId: activity.id, recordedAt: new Date(s.startedAt), lactateMmol: s.avgLactateMmol, source: "ATHYX" },
        });
      }
    }
    await prisma.deviceConnection.update({ where: { id: conn.id }, data: { lastSyncedAt: new Date(), lastSyncStatus: `Загружено сессий: ${sessions.length}`, lastSyncError: null } });
  } catch (e) {
    const error = e instanceof Error ? e.message : "Неизвестная ошибка синхронизации.";
    await prisma.deviceConnection.update({ where: { id: conn.id }, data: { lastSyncError: error, status: "ERROR" } });
    return { ok: false, error };
  }

  return { ok: true };
}

export async function syncAthyx(): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "Нужно войти в аккаунт." };
  const result = await runAthyxSyncForUser(session.user.id);
  revalidatePath("/app/devices");
  revalidatePath("/app");
  return result;
}

// ---------------- Polar (real AccessLink OAuth2) ----------------

// Not session-gated — also called directly from the OAuth callback and
// webhook route handlers (src/app/api/devices/polar/*), which don't run
// inside a browser session the way a form action does.
export async function runPolarSyncForUser(userId: string): Promise<ActionResult> {
  const conn = await prisma.deviceConnection.findUnique({ where: { userId_provider: { userId, provider: "POLAR" } } });
  if (!conn?.accessTokenEnc || !conn.externalUserId) return { ok: false, error: "Polar не подключён." };

  try {
    const accessToken = decryptSecret(conn.accessTokenEnc);
    const exercises = await syncNewExercises(accessToken, conn.externalUserId);
    for (const ex of exercises) {
      await ingestActivity(userId, "POLAR" as DataSource, {
        externalId: ex.uri, sport: ex.sport.toLowerCase(), startedAt: new Date(ex.startTime),
        durationSec: isoDurationToSec(ex.durationIso), distanceM: ex.distanceM, avgHr: ex.avgHr, maxHr: ex.maxHr, calories: ex.calories,
      });
    }
    await prisma.deviceConnection.update({ where: { id: conn.id }, data: { lastSyncedAt: new Date(), lastSyncStatus: `Загружено тренировок: ${exercises.length}`, lastSyncError: null, status: "CONNECTED" } });
  } catch (e) {
    const error = e instanceof Error ? e.message : "Неизвестная ошибка синхронизации Polar.";
    await prisma.deviceConnection.update({ where: { id: conn.id }, data: { lastSyncError: error, status: "ERROR" } });
    return { ok: false, error };
  }

  return { ok: true };
}

export async function syncPolarNow(): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "Нужно войти в аккаунт." };
  const result = await runPolarSyncForUser(session.user.id);
  revalidatePath("/app/devices");
  revalidatePath("/app");
  return result;
}

// Note: lib/integrations/polar.ts also exposes getExerciseSamples for
// future use (e.g. a per-second HR graph for a Polar-sourced activity) —
// intentionally not wired into ingestion yet, since Polar's documented
// sample payload shape isn't pinned down precisely enough here to trust an
// unverified field mapping over simply not doing it.

// ---------------- Strava (real OAuth2) ----------------
//
// The recommended path for Garmin data over the unofficial Garmin login
// below: most Garmin devices can auto-upload to Strava (a real, official
// Garmin↔Strava integration Garmin itself maintains), so an athlete who
// already has that turned on gets their Garmin activities here through a
// fully sanctioned OAuth2 flow — no scraping, no bot detection, no ToS risk.

export async function runStravaSyncForUser(userId: string): Promise<ActionResult> {
  const conn = await prisma.deviceConnection.findUnique({ where: { userId_provider: { userId, provider: "STRAVA" } } });
  if (!conn?.accessTokenEnc || !conn.refreshTokenEnc) return { ok: false, error: "Strava не подключён." };

  try {
    let accessToken = decryptSecret(conn.accessTokenEnc);
    // Strava access tokens expire after 6 hours — refresh proactively
    // whenever we're within 5 minutes of that instead of waiting for a 401.
    if (!conn.tokenExpiresAt || conn.tokenExpiresAt.getTime() < Date.now() + 5 * 60 * 1000) {
      const refreshed = await refreshStravaToken(decryptSecret(conn.refreshTokenEnc));
      accessToken = refreshed.accessToken;
      await prisma.deviceConnection.update({
        where: { id: conn.id },
        data: { accessTokenEnc: encryptSecret(refreshed.accessToken), refreshTokenEnc: encryptSecret(refreshed.refreshToken), tokenExpiresAt: new Date(refreshed.expiresAt) },
      });
    }

    const sinceUnix = conn.lastSyncedAt ? Math.floor(conn.lastSyncedAt.getTime() / 1000) - 86400 : undefined; // 1-day overlap, dedup is by externalId
    const activities = await listRecentStravaActivities(accessToken, sinceUnix);
    for (const a of activities) {
      await ingestActivity(userId, "STRAVA" as DataSource, {
        externalId: String(a.id), sport: mapStravaSport(a.type), startedAt: new Date(a.startDateLocal),
        durationSec: a.durationSec, distanceM: a.distanceM, avgHr: a.avgHr, maxHr: a.maxHr, calories: a.calories,
        avgPaceSecPerKm: a.avgSpeedMps ? 1000 / a.avgSpeedMps : null,
      });
    }
    await prisma.deviceConnection.update({ where: { id: conn.id }, data: { lastSyncedAt: new Date(), lastSyncStatus: `Загружено тренировок: ${activities.length}`, lastSyncError: null, status: "CONNECTED" } });
  } catch (e) {
    const error = e instanceof Error ? e.message : "Неизвестная ошибка синхронизации Strava.";
    await prisma.deviceConnection.update({ where: { id: conn.id }, data: { lastSyncError: error, status: "ERROR" } });
    return { ok: false, error };
  }

  return { ok: true };
}

export async function syncStravaNow(): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "Нужно войти в аккаунт." };
  const result = await runStravaSyncForUser(session.user.id);
  revalidatePath("/app/devices");
  revalidatePath("/app");
  return result;
}

// ---------------- intervals.icu (real API key, full wellness bridge) ----------------
//
// The recommended full picture for Garmin users specifically: intervals.icu
// is itself an official Garmin integration partner, so the athlete connects
// Garmin to intervals.icu through intervals.icu's own proper OAuth screen —
// then we read the already-synced sleep/HRV/recovery *and* activities back
// out through intervals.icu's self-serve API. Same "paste your own key"
// shape as Athyx, just carrying more than activities.

export async function connectIntervalsIcu(athleteId: string, apiKey: string): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "Нужно войти в аккаунт." };
  if (!athleteId.trim() || !apiKey.trim()) return { ok: false, error: "Укажи Athlete ID и API-ключ." };

  const check = await verifyIntervalsIcuKey(athleteId.trim(), apiKey.trim());
  if (!check.ok) return check;

  // Wrapped end-to-end so a failure the athlete can't do anything about
  // (schema not migrated yet on a stale deploy, a transient DB hiccup)
  // shows up as a card error instead of crashing the whole page — the
  // one thing this action must never do to the athlete.
  try {
    await prisma.deviceConnection.upsert({
      where: { userId_provider: { userId: session.user.id, provider: "INTERVALS_ICU" } },
      update: { status: "CONNECTED", externalUserId: athleteId.trim(), secretEnc: encryptSecret(apiKey.trim()), lastSyncError: null },
      create: { userId: session.user.id, provider: "INTERVALS_ICU", status: "CONNECTED", externalUserId: athleteId.trim(), secretEnc: encryptSecret(apiKey.trim()) },
    });

    const result = await runIntervalsIcuSyncForUser(session.user.id);
    revalidatePath("/app/devices");
    revalidatePath("/app");
    return result;
  } catch (e) {
    console.error("connectIntervalsIcu failed", e);
    return { ok: false, error: e instanceof Error ? e.message : "Не удалось сохранить подключение intervals.icu." };
  }
}

export async function runIntervalsIcuSyncForUser(userId: string): Promise<ActionResult> {
  const conn = await prisma.deviceConnection.findUnique({ where: { userId_provider: { userId, provider: "INTERVALS_ICU" } } });
  if (!conn?.secretEnc || !conn.externalUserId) return { ok: false, error: "intervals.icu не подключён." };

  try {
    const apiKey = decryptSecret(conn.secretEnc);
    const athleteId = conn.externalUserId;
    const newest = new Date().toISOString().slice(0, 10);
    const oldest = new Date(Date.now() - 14 * 86400000).toISOString().slice(0, 10);

    const [wellness, activities] = await Promise.all([
      fetchIntervalsWellness(athleteId, apiKey, oldest, newest),
      fetchIntervalsActivities(athleteId, apiKey, oldest, newest),
    ]);

    for (const day of wellness) {
      if (!day.date) continue;
      await ensureDailyMetricRow(userId, day.date);
      await prisma.dailyMetric.update({
        where: { userId_date: { userId, date: new Date(day.date) } },
        data: {
          hrvMs: day.hrv ?? undefined,
          restingHr: day.restingHR ?? undefined,
          sleepDurationSec: day.sleepSecs ?? undefined,
          spo2: day.spO2 ?? undefined,
          respiratoryRate: day.respiration ?? undefined,
          bodyBattery: day.bodyBattery ?? undefined,
          source: "INTERVALS_ICU" as DataSource,
        },
      });
    }

    for (const a of activities) {
      await ingestActivity(userId, "INTERVALS_ICU" as DataSource, {
        externalId: a.id, sport: mapIntervalsSport(a.type), startedAt: new Date(a.startDateLocal),
        durationSec: a.durationSec, distanceM: a.distanceM, avgHr: a.avgHr, maxHr: a.maxHr, calories: a.calories,
        avgPaceSecPerKm: a.avgPaceSecPerKm,
      });
    }

    await prisma.deviceConnection.update({
      where: { id: conn.id },
      data: { lastSyncedAt: new Date(), lastSyncStatus: `Дней самочувствия: ${wellness.length}, тренировок: ${activities.length}`, lastSyncError: null, status: "CONNECTED" },
    });
  } catch (e) {
    const error = e instanceof Error ? e.message : "Неизвестная ошибка синхронизации intervals.icu.";
    await prisma.deviceConnection.update({ where: { id: conn.id }, data: { lastSyncError: error, status: "ERROR" } });
    return { ok: false, error };
  }

  return { ok: true };
}

export async function syncIntervalsIcuNow(): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "Нужно войти в аккаунт." };
  const result = await runIntervalsIcuSyncForUser(session.user.id);
  revalidatePath("/app/devices");
  revalidatePath("/app");
  return result;
}

// ---------------- Garmin (unofficial, opt-in) ----------------

export async function connectGarminUnofficial(email: string, password: string): Promise<ActionResult> {
  if (process.env.ENABLE_GARMIN_UNOFFICIAL_SYNC !== "true") {
    return { ok: false, error: "Неофициальная синхронизация с Garmin выключена на этом сервере (ENABLE_GARMIN_UNOFFICIAL_SYNC)." };
  }
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "Нужно войти в аккаунт." };

  try {
    const oauth1 = await garminSsoLogin(email, password);
    await prisma.deviceConnection.upsert({
      where: { userId_provider: { userId: session.user.id, provider: "GARMIN_CONNECT" } },
      update: { status: "CONNECTED", secretEnc: encryptSecret(JSON.stringify(oauth1)), lastSyncError: null },
      create: { userId: session.user.id, provider: "GARMIN_CONNECT", status: "CONNECTED", secretEnc: encryptSecret(JSON.stringify(oauth1)) },
    });
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Не удалось войти в Garmin." };
  }

  await syncGarminUnofficial();
  revalidatePath("/app/devices");
  return { ok: true };
}

export async function runGarminSyncForUser(userId: string): Promise<ActionResult> {
  const conn = await prisma.deviceConnection.findUnique({ where: { userId_provider: { userId, provider: "GARMIN_CONNECT" } } });
  if (!conn?.secretEnc) return { ok: false, error: "Garmin не подключён." };

  try {
    const oauth1 = JSON.parse(decryptSecret(conn.secretEnc)) as { key: string; secret: string };
    const oauth2 = await garminExchangeOAuth2(oauth1);
    const activities = await listRecentGarminActivities(oauth2.accessToken, 20);
    for (const a of activities) {
      await ingestActivity(userId, "GARMIN_CONNECT" as DataSource, {
        externalId: String(a.activityId), sport: mapGarminSport(a.activityType), startedAt: new Date(a.startTimeLocal),
        durationSec: a.durationSec, distanceM: a.distanceM, avgHr: a.averageHR, maxHr: a.maxHR, calories: a.calories,
        avgPaceSecPerKm: a.averageSpeedMps ? 1000 / a.averageSpeedMps : null,
      });
    }
    await prisma.deviceConnection.update({ where: { id: conn.id }, data: { lastSyncedAt: new Date(), lastSyncStatus: `Загружено тренировок: ${activities.length}`, lastSyncError: null, status: "CONNECTED" } });
  } catch (e) {
    const error = e instanceof Error ? e.message : "Неизвестная ошибка синхронизации Garmin.";
    await prisma.deviceConnection.update({ where: { id: conn.id }, data: { lastSyncError: error, status: "ERROR" } });
    return { ok: false, error };
  }

  return { ok: true };
}

export async function syncGarminUnofficial(): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "Нужно войти в аккаунт." };
  const result = await runGarminSyncForUser(session.user.id);
  revalidatePath("/app/devices");
  revalidatePath("/app");
  return result;
}

// ---------------- Shared ----------------

export async function disconnectDevice(provider: DataSource): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "Нужно войти в аккаунт." };
  await prisma.deviceConnection.deleteMany({ where: { userId: session.user.id, provider } });
  revalidatePath("/app/devices");
  return { ok: true };
}

// FIT files (Garmin/Polar/Suunto/Wahoo/COROS export) — works for every
// brand with zero API keys, since the format itself (not Garmin's Connect
// API) is what's open.
export async function uploadFitFile(formData: FormData): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "Нужно войти в аккаунт." };

  const file = formData.get("file");
  if (!(file instanceof File)) return { ok: false, error: "Файл не выбран." };
  if (!file.name.toLowerCase().endsWith(".fit")) return { ok: false, error: "Нужен файл с расширением .fit." };
  if (file.size > 20 * 1024 * 1024) return { ok: false, error: "Файл слишком большой (максимум 20 МБ)." };

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const parsed = parseFitFile(buffer);
    const isStepTest = formData.get("isStepTest") === "on";
    await ingestActivity(session.user.id, "FIT_FILE" as DataSource, {
      externalId: `${file.name}-${parsed.startedAt.getTime()}-${parsed.durationSec}`,
      sport: parsed.sport, startedAt: parsed.startedAt, durationSec: parsed.durationSec,
      distanceM: parsed.distanceM, elevationGainM: parsed.elevationGainM, avgHr: parsed.avgHr, maxHr: parsed.maxHr,
      avgPaceSecPerKm: parsed.avgPaceSecPerKm, avgPowerW: parsed.avgPowerW, normalizedPowerW: parsed.normalizedPowerW,
      avgCadence: parsed.avgCadence, calories: parsed.calories, samples: parsed.samples,
      sourceFileName: file.name, isStepTest,
    });
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Не удалось разобрать .fit файл." };
  }

  revalidatePath("/app/devices");
  revalidatePath("/app/training");
  revalidatePath("/app");
  return { ok: true };
}
