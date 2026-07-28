"use client";

import { useState, useTransition } from "react";
import { Plus, Trash2 } from "lucide-react";
import { logStepTest } from "@/lib/actions/manual-entry";
import { cn } from "@/lib/utils";

type StepRow = { hr: string; lactate: string };

// Manual step-test entry for Athyx or any other lactate meter — HR is the
// intensity axis here since it's what every athlete can report without a
// power meter or GPS pace, and it's enough for deriveThresholds() to run.
export function StepTestForm({ defaultSport }: { defaultSport: string }) {
  const [rows, setRows] = useState<StepRow[]>([{ hr: "", lactate: "" }, { hr: "", lactate: "" }, { hr: "", lactate: "" }, { hr: "", lactate: "" }]);
  const [status, setStatus] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [isPending, startTransition] = useTransition();

  function update(i: number, field: keyof StepRow, value: string) {
    setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, [field]: value } : r)));
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const steps = rows
      .filter((r) => r.hr && r.lactate)
      .map((r) => ({ intensityHr: Number(r.hr), lactateMmol: Number(r.lactate) }));
    if (steps.length < 3) return setStatus({ kind: "error", text: "Заполни минимум 3 ступени (пульс + лактат)." });

    startTransition(async () => {
      const res = await logStepTest({ sport: defaultSport, testedAt: new Date().toISOString(), steps });
      setStatus(res.ok ? { kind: "ok", text: "Пороги пересчитаны — смотри выше." } : { kind: "error", text: res.error });
    });
  }

  return (
    <form onSubmit={submit} className="card-surface space-y-3 p-5">
      <p className="text-xs text-(--color-ink-soft)">Введи пульс и лактат (ммоль/л) на каждой ступени теста — от лёгкой к тяжёлой. Определим LT1/LT2 методом Dmax.</p>
      {rows.map((r, i) => (
        <div key={i} className="flex items-center gap-2">
          <span className="w-5 shrink-0 text-xs font-bold text-(--color-ink-soft)">{i + 1}</span>
          <input value={r.hr} onChange={(e) => update(i, "hr", e.target.value)} type="number" placeholder="Пульс" className="w-full rounded-xl border border-black/10 bg-(--color-surface) px-3 py-2 text-sm dark:border-white/10" />
          <input value={r.lactate} onChange={(e) => update(i, "lactate", e.target.value)} type="number" step="0.1" placeholder="Лактат" className="w-full rounded-xl border border-black/10 bg-(--color-surface) px-3 py-2 text-sm dark:border-white/10" />
          {rows.length > 3 && (
            <button type="button" onClick={() => setRows((prev) => prev.filter((_, idx) => idx !== i))} className="shrink-0 text-(--color-ink-soft) hover:text-(--color-brand-pink)">
              <Trash2 className="h-4 w-4" />
            </button>
          )}
        </div>
      ))}
      <button type="button" onClick={() => setRows((prev) => [...prev, { hr: "", lactate: "" }])} className="flex items-center gap-1.5 text-xs font-bold text-(--color-brand-blue)">
        <Plus className="h-3.5 w-3.5" /> Добавить ступень
      </button>
      <button disabled={isPending} className="press-spring w-full rounded-full btn-gradient py-2.5 text-sm font-bold disabled:opacity-50">
        {isPending ? "Считаю…" : "Рассчитать пороги"}
      </button>
      {status && <p className={cn("text-sm font-semibold", status.kind === "ok" ? "text-(--color-brand-green)" : "text-(--color-brand-pink)")}>{status.text}</p>}
    </form>
  );
}
