"use client";

import { useState, useTransition } from "react";
import { CheckCircle2, XCircle, RefreshCw, Unlink } from "lucide-react";
import { connectAthyx, syncAthyx, syncStravaNow, connectGarminUnofficial, syncGarminUnofficial, disconnectDevice } from "@/lib/actions/devices";
import { cn } from "@/lib/utils";
import type { DataSource } from "@prisma/client";

type ConnState = { status: string; lastSyncedAt: string | null; lastSyncStatus: string | null; lastSyncError: string | null } | null;

function StatusLine({ conn }: { conn: ConnState }) {
  if (!conn) return <p className="text-sm text-(--color-ink-soft)">Не подключено.</p>;
  return (
    <div className="mt-2 flex items-center gap-1.5 text-xs">
      {conn.status === "CONNECTED" ? <CheckCircle2 className="h-3.5 w-3.5 text-(--color-brand-green)" /> : <XCircle className="h-3.5 w-3.5 text-(--color-brand-pink)" />}
      <span className="text-(--color-ink-soft)">
        {conn.lastSyncError ? conn.lastSyncError : conn.lastSyncedAt ? `Синхронизировано: ${new Date(conn.lastSyncedAt).toLocaleString("ru-RU")} — ${conn.lastSyncStatus ?? ""}` : "Подключено, синхронизация ещё не запускалась."}
      </span>
    </div>
  );
}

export function AthyxCard({ conn }: { conn: ConnState }) {
  const [key, setKey] = useState("");
  const [status, setStatus] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [isPending, startTransition] = useTransition();

  return (
    <div className="card-surface p-5">
      <div className="flex items-center justify-between">
        <div className="font-bold">Athyx</div>
        <span className="rounded-full bg-(--color-brand-green)/15 px-2 py-0.5 text-[0.65rem] font-bold text-(--color-brand-green)">Официальный API</span>
      </div>
      <p className="mt-1 text-xs text-(--color-ink-soft)">Реальный лактат в реальном времени — сессии, зоны, метаболическая нагрузка.</p>
      <StatusLine conn={conn} />
      <div className="mt-3 flex gap-2">
        <input value={key} onChange={(e) => setKey(e.target.value)} placeholder="ath_live_…" className="flex-1 rounded-xl border border-black/10 bg-(--color-surface) px-3 py-2 text-sm dark:border-white/10" />
        <button
          disabled={isPending || !key}
          onClick={() => startTransition(async () => { const res = await connectAthyx(key); setStatus(res.ok ? { kind: "ok", text: "Подключено!" } : { kind: "error", text: res.error }); if (res.ok) setKey(""); })}
          className="press-spring shrink-0 rounded-full btn-gradient px-4 py-2 text-xs font-bold disabled:opacity-50"
        >
          Подключить
        </button>
      </div>
      {conn && (
        <div className="mt-2 flex gap-2">
          <button disabled={isPending} onClick={() => startTransition(() => { syncAthyx(); })} className="press-spring flex items-center gap-1 rounded-full bg-black/5 px-3 py-1.5 text-xs font-bold dark:bg-white/10"><RefreshCw className="h-3 w-3" /> Синхронизировать</button>
          <button disabled={isPending} onClick={() => startTransition(() => { disconnectDevice("ATHYX" as DataSource); })} className="press-spring flex items-center gap-1 rounded-full bg-black/5 px-3 py-1.5 text-xs font-bold text-(--color-brand-pink) dark:bg-white/10"><Unlink className="h-3 w-3" /> Отключить</button>
        </div>
      )}
      {status && <p className={cn("mt-2 text-xs font-semibold", status.kind === "ok" ? "text-(--color-brand-green)" : "text-(--color-brand-pink)")}>{status.text}</p>}
      <p className="mt-2 text-[0.7rem] text-(--color-ink-soft)">Ключ создаётся в аккаунте на athyx.com → Developers.</p>
    </div>
  );
}

export function PolarCard({ conn }: { conn: ConnState }) {
  const [isPending, startTransition] = useTransition();
  return (
    <div className="card-surface p-5">
      <div className="flex items-center justify-between">
        <div className="font-bold">Polar</div>
        <span className="rounded-full bg-(--color-brand-green)/15 px-2 py-0.5 text-[0.65rem] font-bold text-(--color-brand-green)">Официальный OAuth2</span>
      </div>
      <p className="mt-1 text-xs text-(--color-ink-soft)">Тренировки, сон, Nightly Recharge через AccessLink API.</p>
      <StatusLine conn={conn} />
      <div className="mt-3 flex gap-2">
        {!conn ? (
          <a href="/api/devices/polar/authorize" className="press-spring rounded-full btn-gradient px-4 py-2 text-xs font-bold">Подключить через Polar Flow</a>
        ) : (
          <>
            <a href="/api/devices/polar/authorize" className="press-spring flex items-center gap-1 rounded-full bg-black/5 px-3 py-1.5 text-xs font-bold dark:bg-white/10"><RefreshCw className="h-3 w-3" /> Переподключить</a>
            <button
              disabled={isPending}
              onClick={() => startTransition(() => { disconnectDevice("POLAR" as DataSource); })}
              className="press-spring flex items-center gap-1 rounded-full bg-black/5 px-3 py-1.5 text-xs font-bold text-(--color-brand-pink) dark:bg-white/10"
            >
              <Unlink className="h-3 w-3" /> Отключить
            </button>
          </>
        )}
      </div>
    </div>
  );
}

export function StravaCard({ conn }: { conn: ConnState }) {
  const [isPending, startTransition] = useTransition();
  return (
    <div className="card-surface p-5">
      <div className="flex items-center justify-between">
        <div className="font-bold">Strava</div>
        <span className="rounded-full bg-(--color-brand-green)/15 px-2 py-0.5 text-[0.65rem] font-bold text-(--color-brand-green)">Официальный OAuth2</span>
      </div>
      <p className="mt-1 text-xs text-(--color-ink-soft)">
        Рекомендуем для Garmin: если в твоих часах включена автозагрузка в Strava, тренировки попадут сюда официальным путём — без входа в сам Garmin.
      </p>
      <StatusLine conn={conn} />
      <div className="mt-3 flex gap-2">
        {!conn ? (
          <a href="/api/devices/strava/authorize" className="press-spring rounded-full btn-gradient px-4 py-2 text-xs font-bold">Подключить через Strava</a>
        ) : (
          <>
            <button disabled={isPending} onClick={() => startTransition(() => { syncStravaNow(); })} className="press-spring flex items-center gap-1 rounded-full bg-black/5 px-3 py-1.5 text-xs font-bold dark:bg-white/10"><RefreshCw className="h-3 w-3" /> Синхронизировать</button>
            <button
              disabled={isPending}
              onClick={() => startTransition(() => { disconnectDevice("STRAVA" as DataSource); })}
              className="press-spring flex items-center gap-1 rounded-full bg-black/5 px-3 py-1.5 text-xs font-bold text-(--color-brand-pink) dark:bg-white/10"
            >
              <Unlink className="h-3 w-3" /> Отключить
            </button>
          </>
        )}
      </div>
    </div>
  );
}

export function GarminCard({ conn, enabled }: { conn: ConnState; enabled: boolean }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [accepted, setAccepted] = useState(false);
  const [status, setStatus] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [isPending, startTransition] = useTransition();

  return (
    <div className="card-surface p-5">
      <div className="flex items-center justify-between">
        <div className="font-bold">Garmin</div>
        <span className="rounded-full bg-(--color-brand-amber)/15 px-2 py-0.5 text-[0.65rem] font-bold text-(--color-brand-amber)">Неофициально</span>
      </div>
      <p className="mt-1 text-xs text-(--color-ink-soft)">
        Официальный Garmin Connect API сейчас закрыт для новых партнёров — используем тот же способ входа, что и открытые проекты вроде python-garminconnect. Пароль нигде не сохраняется, только временный токен.
      </p>
      <StatusLine conn={conn} />
      {!enabled ? (
        <p className="mt-3 text-xs text-(--color-brand-pink)">Отключено на сервере (ENABLE_GARMIN_UNOFFICIAL_SYNC). Пока используй загрузку .fit-файлов на странице «Тренировки» — она работает для Garmin без ограничений.</p>
      ) : !conn ? (
        <div className="mt-3 space-y-2">
          <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email Garmin Connect" className="w-full rounded-xl border border-black/10 bg-(--color-surface) px-3 py-2 text-sm dark:border-white/10" />
          <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" placeholder="Пароль" className="w-full rounded-xl border border-black/10 bg-(--color-surface) px-3 py-2 text-sm dark:border-white/10" />
          <label className="flex items-start gap-2 text-[0.7rem] text-(--color-ink-soft)">
            <input type="checkbox" checked={accepted} onChange={(e) => setAccepted(e.target.checked)} className="mt-0.5" />
            Понимаю, что это неофициальный способ синхронизации и формально не соответствует условиям использования Garmin Connect.
          </label>
          <button
            disabled={isPending || !accepted || !email || !password}
            onClick={() => startTransition(async () => { const res = await connectGarminUnofficial(email, password); setStatus(res.ok ? { kind: "ok", text: "Подключено!" } : { kind: "error", text: res.error }); if (res.ok) setPassword(""); })}
            className="press-spring w-full rounded-full btn-gradient py-2 text-xs font-bold disabled:opacity-50"
          >
            Войти и синхронизировать
          </button>
        </div>
      ) : (
        <div className="mt-2 flex gap-2">
          <button disabled={isPending} onClick={() => startTransition(() => { syncGarminUnofficial(); })} className="press-spring flex items-center gap-1 rounded-full bg-black/5 px-3 py-1.5 text-xs font-bold dark:bg-white/10"><RefreshCw className="h-3 w-3" /> Синхронизировать</button>
          <button disabled={isPending} onClick={() => startTransition(() => { disconnectDevice("GARMIN_CONNECT" as DataSource); })} className="press-spring flex items-center gap-1 rounded-full bg-black/5 px-3 py-1.5 text-xs font-bold text-(--color-brand-pink) dark:bg-white/10"><Unlink className="h-3 w-3" /> Отключить</button>
        </div>
      )}
      {status && <p className={cn("mt-2 text-xs font-semibold", status.kind === "ok" ? "text-(--color-brand-green)" : "text-(--color-brand-pink)")}>{status.text}</p>}
    </div>
  );
}
