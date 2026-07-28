"use client";

import { useState, useTransition } from "react";
import { logNutritionEntry } from "@/lib/actions/nutrition";
import { cn } from "@/lib/utils";

export function NutritionLogForm() {
  const [description, setDescription] = useState("");
  const [mealName, setMealName] = useState("Приём пищи");
  const [status, setStatus] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [isPending, startTransition] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const res = await logNutritionEntry({ mealName, description, kcal: null, proteinG: null, carbsG: null, fatG: null });
      setStatus(res.ok ? { kind: "ok", text: "Записано." } : { kind: "error", text: res.error });
      if (res.ok) setDescription("");
    });
  }

  return (
    <form onSubmit={submit} className="card-surface space-y-3 p-5">
      <select value={mealName} onChange={(e) => setMealName(e.target.value)} className="w-full rounded-xl border border-black/10 bg-(--color-surface) px-3 py-2 text-sm dark:border-white/10">
        {["Завтрак", "Обед", "Ужин", "Перекус", "Во время тренировки"].map((m) => <option key={m}>{m}</option>)}
      </select>
      <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Что съел/выпил…" rows={2} className="w-full rounded-xl border border-black/10 bg-(--color-surface) px-3 py-2 text-sm dark:border-white/10" />
      <button disabled={isPending} className="press-spring w-full rounded-full btn-gradient py-2.5 text-sm font-bold disabled:opacity-50">
        {isPending ? "Сохраняю…" : "Записать"}
      </button>
      {status && <p className={cn("text-sm font-semibold", status.kind === "ok" ? "text-(--color-brand-green)" : "text-(--color-brand-pink)")}>{status.text}</p>}
    </form>
  );
}
