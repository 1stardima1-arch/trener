"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Info, X } from "lucide-react";
import { recoveryColor } from "@/lib/recovery-color";

type Factor = { factor: string; weight: number; contribution: number; note: string };

// Every recovery score is computed from named, weighted factors (see
// physiology/recovery.ts) — this was already stored on every DailyMetric
// row and never shown anywhere. Tapping the ⓘ opens exactly that
// breakdown instead of leaving the score a bare number the athlete has to
// take on faith or go ask the chat to explain.
export function RecoveryInfoButton({ breakdown, score }: { breakdown: Factor[] | null; score: number | null }) {
  const [open, setOpen] = useState(false);
  if (!breakdown || !breakdown.length || score == null) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Почему такая готовность"
        className="press-spring absolute -right-1 -top-1 flex h-7 w-7 items-center justify-center rounded-full bg-(--color-surface) text-(--color-ink-soft) shadow-(--shadow-soft)"
      >
        <Info className="h-3.5 w-3.5" />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 sm:items-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setOpen(false)}
          >
            <motion.div
              className="card-surface max-h-[80vh] w-full max-w-md overflow-y-auto rounded-b-none p-6 sm:rounded-b-[1.5rem]"
              initial={{ y: 40, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 40, opacity: 0 }}
              transition={{ type: "spring", stiffness: 340, damping: 32 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between">
                <div className="font-display text-lg font-extrabold">Почему {score}/100</div>
                <button type="button" onClick={() => setOpen(false)} className="press-spring flex h-8 w-8 items-center justify-center rounded-full bg-(--color-paper-dim)">
                  <X className="h-4 w-4" />
                </button>
              </div>
              <p className="mt-1 text-sm text-(--color-ink-soft)">
                Готовность — взвешенная сумма факторов ниже, каждый посчитан относительно твоей собственной нормы, а не общего эталона.
              </p>
              <div className="mt-4 space-y-4">
                {breakdown.map((f, i) => (
                  <div key={i}>
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-semibold">{f.factor}</span>
                      <span className="text-xs font-bold text-(--color-ink-soft)">вес {Math.round(f.weight * 100)}%</span>
                    </div>
                    <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-(--color-paper-dim)">
                      <div className="h-full rounded-full" style={{ width: `${Math.round(f.contribution)}%`, background: recoveryColor(f.contribution) }} />
                    </div>
                    <p className="mt-1.5 text-xs text-(--color-ink-soft)">{f.note}</p>
                  </div>
                ))}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
