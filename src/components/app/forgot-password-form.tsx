"use client";

import { useState, useTransition } from "react";
import { Mail, CheckCircle2 } from "lucide-react";
import { requestPasswordReset } from "@/lib/actions/password-reset";

export function ForgotPasswordForm() {
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function submit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await requestPasswordReset(formData);
      if (result.ok) setSent(true);
      else setError(result.error);
    });
  }

  if (sent) {
    return (
      <div className="flex flex-col items-center gap-3 py-4 text-center">
        <span className="flex h-14 w-14 items-center justify-center rounded-full btn-gradient">
          <CheckCircle2 className="h-6 w-6" />
        </span>
        <p className="text-sm text-(--color-ink-soft)">
          Если аккаунт с таким ником или почтой существует — письмо со ссылкой уже в пути.
        </p>
      </div>
    );
  }

  return (
    <form action={submit} className="space-y-2.5">
      <input
        name="identifier"
        placeholder="Ник или почта"
        required
        className="w-full rounded-full border border-black/10 dark:border-white/10 bg-(--color-surface) px-4 py-3 text-sm outline-none focus:border-(--color-brand-blue)"
      />
      {error && <p className="text-center text-xs font-semibold text-(--color-brand-pink)">{error}</p>}
      <button
        type="submit"
        disabled={isPending}
        className="btn-gradient press-spring flex w-full items-center justify-center gap-2 rounded-full py-3 text-sm font-bold disabled:opacity-60"
      >
        <Mail className="h-4 w-4" />
        {isPending ? "Отправляю…" : "Прислать ссылку"}
      </button>
    </form>
  );
}
