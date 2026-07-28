"use client";

import { useState, useTransition } from "react";
import { Upload, PenLine } from "lucide-react";
import { logActivityManual } from "@/lib/actions/manual-entry";
import { uploadFitFile } from "@/lib/actions/devices";
import { SPORTS } from "@/lib/sports";
import { cn } from "@/lib/utils";

export function LogActivityPanel({ defaultSport }: { defaultSport: string }) {
  const [tab, setTab] = useState<"manual" | "fit">("manual");
  const [status, setStatus] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [isPending, startTransition] = useTransition();

  const [sport, setSport] = useState(defaultSport);
  const [durationMin, setDurationMin] = useState("");
  const [distanceKm, setDistanceKm] = useState("");
  const [avgHr, setAvgHr] = useState("");
  const [rpe, setRpe] = useState("5");

  function submitManual(e: React.FormEvent) {
    e.preventDefault();
    if (!durationMin) return setStatus({ kind: "error", text: "Укажи длительность." });
    startTransition(async () => {
      const res = await logActivityManual({
        sport, startedAt: new Date().toISOString(), durationSec: Number(durationMin) * 60,
        distanceM: distanceKm ? Number(distanceKm) * 1000 : null,
        avgHr: avgHr ? Number(avgHr) : null, perceivedExertion: Number(rpe),
      });
      setStatus(res.ok ? { kind: "ok", text: "Тренировка записана." } : { kind: "error", text: res.error });
      if (res.ok) { setDurationMin(""); setDistanceKm(""); setAvgHr(""); }
    });
  }

  function submitFit(formData: FormData) {
    startTransition(async () => {
      const res = await uploadFitFile(formData);
      setStatus(res.ok ? { kind: "ok", text: "Файл разобран и загружен." } : { kind: "error", text: res.error });
    });
  }

  return (
    <div className="card-surface p-5">
      <div className="flex gap-2">
        <button onClick={() => setTab("manual")} className={cn("flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-bold", tab === "manual" ? "btn-gradient" : "bg-black/5 text-(--color-ink-soft) dark:bg-white/10")}>
          <PenLine className="h-3.5 w-3.5" /> Вручную
        </button>
        <button onClick={() => setTab("fit")} className={cn("flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-bold", tab === "fit" ? "btn-gradient" : "bg-black/5 text-(--color-ink-soft) dark:bg-white/10")}>
          <Upload className="h-3.5 w-3.5" /> Загрузить .fit
        </button>
      </div>

      {tab === "manual" ? (
        <form onSubmit={submitManual} className="mt-4 space-y-3">
          <select value={sport} onChange={(e) => setSport(e.target.value)} className="w-full rounded-xl border border-black/10 bg-(--color-surface) px-3 py-2 text-sm dark:border-white/10">
            {SPORTS.map((s) => <option key={s.slug} value={s.slug}>{s.emoji} {s.label}</option>)}
          </select>
          <div className="grid grid-cols-3 gap-2">
            <input value={durationMin} onChange={(e) => setDurationMin(e.target.value)} type="number" placeholder="Мин" className="rounded-xl border border-black/10 bg-(--color-surface) px-3 py-2 text-sm dark:border-white/10" />
            <input value={distanceKm} onChange={(e) => setDistanceKm(e.target.value)} type="number" placeholder="Км" className="rounded-xl border border-black/10 bg-(--color-surface) px-3 py-2 text-sm dark:border-white/10" />
            <input value={avgHr} onChange={(e) => setAvgHr(e.target.value)} type="number" placeholder="Ср. пульс" className="rounded-xl border border-black/10 bg-(--color-surface) px-3 py-2 text-sm dark:border-white/10" />
          </div>
          <div>
            <label className="text-xs font-semibold text-(--color-ink-soft)">RPE (субъективная тяжесть, 1-10): {rpe}</label>
            <input value={rpe} onChange={(e) => setRpe(e.target.value)} type="range" min={1} max={10} className="w-full" />
          </div>
          <button disabled={isPending} className="press-spring w-full rounded-full btn-gradient py-2.5 text-sm font-bold disabled:opacity-50">
            {isPending ? "Сохраняю…" : "Записать"}
          </button>
        </form>
      ) : (
        <form action={submitFit} className="mt-4 space-y-3">
          <input type="file" name="file" accept=".fit" required className="w-full rounded-xl border border-dashed border-black/15 bg-(--color-surface) px-3 py-4 text-sm dark:border-white/15" />
          <label className="flex items-center gap-2 text-xs text-(--color-ink-soft)">
            <input type="checkbox" name="isStepTest" /> Это степ-тест на лактат (пороги пересчитаются)
          </label>
          <button disabled={isPending} className="press-spring w-full rounded-full btn-gradient py-2.5 text-sm font-bold disabled:opacity-50">
            {isPending ? "Разбираю файл…" : "Загрузить"}
          </button>
          <p className="text-xs text-(--color-ink-soft)">Экспортируй .fit из Garmin Connect («Export Original»), Polar Flow, или скопируй с устройства по USB.</p>
        </form>
      )}

      {status && <p className={cn("mt-3 text-sm font-semibold", status.kind === "ok" ? "text-(--color-brand-green)" : "text-(--color-brand-pink)")}>{status.text}</p>}
    </div>
  );
}
