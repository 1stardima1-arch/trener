"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { encryptSecret, decryptSecret } from "@/lib/crypto";
import { verifyAthyxKey, listAthyxSessions, type AthyxSession } from "@/lib/integrations/athyx";
import { parseFitFile } from "@/lib/integrations/fit";
import { garminSsoLogin, garminExchangeOAuth2, listRecentGarminActivities, mapGarminSport } from "@/lib/integrations/garmin-unofficial";
import { syncNewExercises, isoDurationToSec } from "@/lib/integrations/polar";
import { ingestActivity } from "@/lib/engine";
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

export async function syncGarminUnofficial(): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "Нужно войти в аккаунт." };
  const conn = await prisma.deviceConnection.findUnique({ where: { userId_provider: { userId: session.user.id, provider: "GARMIN_CONNECT" } } });
  if (!conn?.secretEnc) return { ok: false, error: "Garmin не подключён." };

  try {
    const oauth1 = JSON.parse(decryptSecret(conn.secretEnc)) as { key: string; secret: string };
    const oauth2 = await garminExchangeOAuth2(oauth1);
    const activities = await listRecentGarminActivities(oauth2.accessToken, 20);
    for (const a of activities) {
      await ingestActivity(session.user.id, "GARMIN_CONNECT" as DataSource, {
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

  revalidatePath("/app/devices");
  revalidatePath("/app");
  return { ok: true };
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
