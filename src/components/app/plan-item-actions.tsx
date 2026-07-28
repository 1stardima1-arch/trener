"use client";

import { useTransition } from "react";
import { updatePlanItemStatus } from "@/lib/actions/manual-entry";

export function PlanItemActions({ planItemId }: { planItemId: string }) {
  const [isPending, startTransition] = useTransition();

  return (
    <div className="mt-3 flex gap-2">
      <button
        disabled={isPending}
        onClick={() => startTransition(() => { updatePlanItemStatus(planItemId, "COMPLETED"); })}
        className="press-spring rounded-full bg-(--color-brand-green)/15 px-4 py-1.5 text-xs font-bold text-(--color-brand-green) disabled:opacity-50"
      >
        Отметить выполненным
      </button>
      <button
        disabled={isPending}
        onClick={() => startTransition(() => { updatePlanItemStatus(planItemId, "SKIPPED"); })}
        className="press-spring rounded-full bg-black/5 px-4 py-1.5 text-xs font-bold text-(--color-ink-soft) disabled:opacity-50 dark:bg-white/10"
      >
        Пропустить
      </button>
    </div>
  );
}
