"use client";

import { useState, useTransition } from "react";
import { logLactateReading } from "@/lib/actions/manual-entry";
import { cn } from "@/lib/utils";

// Manual single-point entry — for any lactate meter that isn't Athyx
// (finger-prick analyzers, other brands), exactly as the product spec asks:
// "other lactate meters, via manual entry."
export function LogLactateForm() {
  const [lactate, setLactate] = useState("");
  const [hr, setHr] = useState("");
  const [status, setStatus] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [isPending, startTransition] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const res = await logLactateReading({ recordedAt: new Date().toISOString(), lactateMmol: Number(lactate), hr: hr ? Number(hr) : null, paceSecPerKm: null, powerW: null });
      setStatus(res.ok ? { kind: "ok", text: "Записано." } : { kind: "error", text: res.error });
      if (res.ok) { setLactate(""); setHr(""); }
    });
  }

  return (
    <form onSubmit={submit} className="card-surface p-5">
      <div className="font-bold">Другой лактометр</div>
      <p className="mt-1 text-xs text-(--color-ink-soft)">Разовое измерение вручную — с любого анализатора.</p>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <input value={lactate} onChange={(e) => setLactate(e.target.value)} type="number" step="0.1" placeholder="Лактат, ммоль/л" required className="rounded-xl border border-black/10 bg-(--color-surface) px-3 py-2 text-sm dark:border-white/10" />
        <input value={hr} onChange={(e) => setHr(e.target.value)} type="number" placeholder="Пульс (необязательно)" className="rounded-xl border border-black/10 bg-(--color-surface) px-3 py-2 text-sm dark:border-white/10" />
      </div>
      <button disabled={isPending || !lactate} className="press-spring mt-3 w-full rounded-full btn-gradient py-2 text-xs font-bold disabled:opacity-50">
        {isPending ? "Сохраняю…" : "Записать"}
      </button>
      {status && <p className={cn("mt-2 text-xs font-semibold", status.kind === "ok" ? "text-(--color-brand-green)" : "text-(--color-brand-pink)")}>{status.text}</p>}
    </form>
  );
}
