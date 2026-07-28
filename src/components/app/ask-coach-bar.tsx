"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Sparkles, ArrowRight } from "lucide-react";

export function AskCoachBar() {
  const router = useRouter();
  const [value, setValue] = useState("");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const q = value.trim();
    router.push(q ? `/app/coach?q=${encodeURIComponent(q)}` : "/app/coach");
  }

  return (
    <form onSubmit={submit} className="flex items-center gap-2 rounded-full border border-white/8 bg-(--color-surface) py-1 pl-4 pr-1.5">
      <Sparkles className="h-4 w-4 shrink-0 text-(--color-brand-violet)" />
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Спроси Тренера о чём угодно…"
        className="flex-1 bg-transparent py-2 text-sm outline-none placeholder:text-(--color-ink-soft)"
      />
      <button type="submit" className="press-spring flex h-8 w-8 shrink-0 items-center justify-center rounded-full btn-gradient">
        <ArrowRight className="h-4 w-4" />
      </button>
    </form>
  );
}
