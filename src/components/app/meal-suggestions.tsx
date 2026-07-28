"use client";

import { useState, useTransition } from "react";
import { Sparkles } from "lucide-react";
import { suggestMeals } from "@/lib/actions/nutrition";
import { Markdown } from "@/components/app/markdown";

export function MealSuggestions({ targets }: { targets: { kcal: number; proteinG: number; carbsG: number; fatG: number; carbLoad: string } }) {
  const [text, setText] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function generate() {
    setError(null);
    startTransition(async () => {
      const res = await suggestMeals(targets);
      if (res.ok) setText(res.text);
      else setError(res.error);
    });
  }

  return (
    <div className="card-surface p-5">
      <button onClick={generate} disabled={isPending} className="press-spring flex w-full items-center justify-center gap-2 rounded-full btn-gradient py-2.5 text-sm font-bold disabled:opacity-50">
        <Sparkles className="h-4 w-4" /> {isPending ? "Подбираю меню…" : "Предложить меню на сегодня"}
      </button>
      {error && <p className="mt-3 text-sm font-semibold text-(--color-brand-pink)">{error}</p>}
      {text && (
        <div className="mt-4">
          <Markdown>{text}</Markdown>
        </div>
      )}
    </div>
  );
}
