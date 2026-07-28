"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { KeyRound, CheckCircle2 } from "lucide-react";
import { resetPassword } from "@/lib/actions/password-reset";

export function ResetPasswordForm({ token }: { token: string }) {
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function submit(formData: FormData) {
    setError(null);
    formData.set("token", token);
    startTransition(async () => {
      const result = await resetPassword(formData);
      if (result.ok) {
        setDone(true);
        setTimeout(() => router.push("/login"), 1800);
      } else {
        setError(result.error);
      }
    });
  }

  if (done) {
    return (
      <div className="flex flex-col items-center gap-3 py-4 text-center">
        <span className="flex h-14 w-14 items-center justify-center rounded-full btn-gradient">
          <CheckCircle2 className="h-6 w-6" />
        </span>
        <p className="text-sm text-(--color-ink-soft)">Пароль обновлён — переходим ко входу…</p>
      </div>
    );
  }

  return (
    <form action={submit} className="space-y-2.5">
      <input
        name="password"
        type="password"
        placeholder="Новый пароль"
        required
        autoComplete="new-password"
        className="w-full rounded-full border border-black/10 dark:border-white/10 bg-(--color-surface) px-4 py-3 text-sm outline-none focus:border-(--color-brand-blue)"
      />
      {error && <p className="text-center text-xs font-semibold text-(--color-brand-pink)">{error}</p>}
      <button
        type="submit"
        disabled={isPending}
        className="btn-gradient press-spring flex w-full items-center justify-center gap-2 rounded-full py-3 text-sm font-bold disabled:opacity-60"
      >
        <KeyRound className="h-4 w-4" />
        {isPending ? "Сохраняю…" : "Сохранить пароль"}
      </button>
    </form>
  );
}
