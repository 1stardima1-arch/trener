"use client";

import { useState, useTransition } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { saveDailyCheckIn } from "@/lib/actions/check-in";

const SCALES: { key: "energy" | "soreness" | "stress"; label: string; low: string; high: string }[] = [
  { key: "energy", label: "Энергия", low: "На нуле", high: "Заряжен" },
  { key: "soreness", label: "Мышечная усталость", low: "Нет", high: "Сильная" },
  { key: "stress", label: "Стресс", low: "Спокоен", high: "На пределе" },
];

// The dashboard's daily self-report — same idea as WHOOP's Journal or
// Garmin's morning readiness questions. Shown once per day (dismissible),
// and submitting it immediately re-runs today's plan adjustment (see
// saveDailyCheckIn) so a "чувствую себя разбитым" actually changes what's
// prescribed today, not just gets logged for later.
export function DailyCheckIn({ date }: { date: string }) {
  const [dismissed, setDismissed] = useState(false);
  const [done, setDone] = useState(false);
  const [values, setValues] = useState<{ energy: number | null; soreness: number | null; stress: number | null }>({
    energy: null,
    soreness: null,
    stress: null,
  });
  const [note, setNote] = useState("");
  const [isPending, startTransition] = useTransition();

  if (dismissed || done) return null;

  const canSubmit = values.energy != null && values.soreness != null && values.stress != null;

  function submit() {
    if (!canSubmit) return;
    startTransition(async () => {
      const result = await saveDailyCheckIn({
        date,
        energy: values.energy!,
        soreness: values.soreness!,
        stress: values.stress!,
        note: note || undefined,
      });
      if (result.ok) setDone(true);
    });
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, height: 0 }}
        className="card-surface relative p-5"
      >
        <button
          type="button"
          onClick={() => setDismissed(true)}
          aria-label="Скрыть"
          className="absolute right-4 top-4 flex h-7 w-7 items-center justify-center rounded-full text-(--color-ink-soft) hover:bg-white/5"
        >
          <X className="h-3.5 w-3.5" />
        </button>
        <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-(--color-ink-soft)">
          <Sparkles className="h-3.5 w-3.5" /> Как ты сегодня?
        </div>
        <p className="mt-1 text-sm text-(--color-ink-soft)">Пара вопросов — учтём при выборе тренировки на сегодня.</p>

        <div className="mt-4 space-y-4">
          {SCALES.map((s) => (
            <div key={s.key}>
              <div className="mb-1.5 flex items-center justify-between text-xs font-semibold text-(--color-ink-soft)">
                <span>{s.label}</span>
              </div>
              <div className="flex gap-1.5">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setValues((v) => ({ ...v, [s.key]: n }))}
                    className={cn(
                      "press-spring flex h-9 flex-1 items-center justify-center rounded-full text-sm font-bold transition-colors",
                      values[s.key] === n ? "btn-gradient text-white" : "bg-(--color-paper-dim) text-(--color-ink-soft) hover:bg-white/8"
                    )}
                  >
                    {n}
                  </button>
                ))}
              </div>
              <div className="mt-1 flex justify-between text-[0.65rem] text-(--color-ink-soft)/70">
                <span>{s.low}</span>
                <span>{s.high}</span>
              </div>
            </div>
          ))}

          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Что-то ещё? (по желанию)"
            className="w-full rounded-full border border-black/10 bg-(--color-surface) px-4 py-2.5 text-sm outline-none focus:border-(--color-brand-blue) dark:border-white/10"
          />

          <button
            type="button"
            onClick={submit}
            disabled={!canSubmit || isPending}
            className="btn-gradient press-spring w-full rounded-full py-3 text-sm font-bold disabled:opacity-50"
          >
            {isPending ? "Сохраняю…" : "Готово"}
          </button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
