"use client";

import { useState, useTransition } from "react";
import { logSleepManual } from "@/lib/actions/manual-entry";
import { cn } from "@/lib/utils";

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

export function LogSleepForm() {
  const [date, setDate] = useState(todayStr());
  const [bedtime, setBedtime] = useState("23:00");
  const [waketime, setWaketime] = useState("07:00");
  const [status, setStatus] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [isPending, startTransition] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const sleepStart = new Date(`${date}T${bedtime}:00`);
    let sleepEnd = new Date(`${date}T${waketime}:00`);
    if (sleepEnd <= sleepStart) sleepEnd = new Date(sleepEnd.getTime() + 24 * 3600 * 1000);

    startTransition(async () => {
      const res = await logSleepManual({ date, sleepStart: sleepStart.toISOString(), sleepEnd: sleepEnd.toISOString() });
      setStatus(res.ok ? { kind: "ok", text: "Сон записан." } : { kind: "error", text: res.error });
    });
  }

  return (
    <form onSubmit={submit} className="card-surface space-y-3 p-5">
      <div className="grid grid-cols-3 gap-2">
        <label className="block">
          <span className="mb-1 block text-xs font-semibold text-(--color-ink-soft)">Ночь на</span>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-full rounded-xl border border-black/10 bg-(--color-surface) px-3 py-2 text-sm dark:border-white/10" />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-semibold text-(--color-ink-soft)">Отбой</span>
          <input type="time" value={bedtime} onChange={(e) => setBedtime(e.target.value)} className="w-full rounded-xl border border-black/10 bg-(--color-surface) px-3 py-2 text-sm dark:border-white/10" />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-semibold text-(--color-ink-soft)">Подъём</span>
          <input type="time" value={waketime} onChange={(e) => setWaketime(e.target.value)} className="w-full rounded-xl border border-black/10 bg-(--color-surface) px-3 py-2 text-sm dark:border-white/10" />
        </label>
      </div>
      <button disabled={isPending} className="press-spring w-full rounded-full btn-gradient py-2.5 text-sm font-bold disabled:opacity-50">
        {isPending ? "Сохраняю…" : "Записать сон"}
      </button>
      {status && <p className={cn("text-sm font-semibold", status.kind === "ok" ? "text-(--color-brand-green)" : "text-(--color-brand-pink)")}>{status.text}</p>}
    </form>
  );
}
