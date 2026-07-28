"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { ArrowRight, Mail, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { AVATARS } from "@/lib/avatars";
import { signUp } from "@/lib/actions/auth-signup";
import { AuthHeadline } from "@/components/app/auth-headline";
import { WebAuthnLoginButton } from "@/components/app/webauthn-login-button";

export function AuthPanel({
  hasEmail,
  redirectTo,
  signinAction,
  emailAction,
}: {
  hasEmail: boolean;
  redirectTo: string;
  signinAction: (formData: FormData) => Promise<void>;
  emailAction: (formData: FormData) => Promise<void>;
}) {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [avatarKey, setAvatarKey] = useState<string | null>(null);
  const [signupError, setSignupError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function submitSignup(formData: FormData) {
    setSignupError(null);
    if (avatarKey) formData.set("avatarKey", avatarKey);
    formData.set("redirectTo", redirectTo);
    startTransition(async () => {
      const result = await signUp(formData);
      if (!result.ok) setSignupError(result.error);
    });
  }

  return (
    <>
      <AuthHeadline mode={mode} />

      <div className="mt-6 flex rounded-full bg-(--color-paper-dim) p-1 text-sm font-bold">
        <button
          type="button"
          onClick={() => setMode("signin")}
          className={cn(
            "flex-1 rounded-full py-2 transition-colors",
            mode === "signin" ? "bg-(--color-surface) shadow-(--shadow-soft)" : "text-(--color-ink-soft)"
          )}
        >
          Войти
        </button>
        <button
          type="button"
          onClick={() => setMode("signup")}
          className={cn(
            "flex-1 rounded-full py-2 transition-colors",
            mode === "signup" ? "bg-(--color-surface) shadow-(--shadow-soft)" : "text-(--color-ink-soft)"
          )}
        >
          Регистрация
        </button>
      </div>

      {mode === "signin" ? (
        <div className="mt-6 space-y-3">
          <form action={signinAction} className="space-y-2.5">
            <input
              name="username"
              placeholder="Ник"
              required
              autoComplete="username"
              className="w-full rounded-full border border-black/10 dark:border-white/10 bg-(--color-surface) px-4 py-3 text-sm outline-none focus:border-(--color-brand-blue)"
            />
            <input
              name="password"
              type="password"
              placeholder="Пароль"
              required
              autoComplete="current-password"
              className="w-full rounded-full border border-black/10 dark:border-white/10 bg-(--color-surface) px-4 py-3 text-sm outline-none focus:border-(--color-brand-blue)"
            />
            <button
              type="submit"
              className="btn-gradient press-spring flex w-full items-center justify-center gap-2 rounded-full py-3 text-sm font-bold"
            >
              Войти <ArrowRight className="h-4 w-4" />
            </button>
          </form>
          <Link
            href="/login/forgot-password"
            className="block text-center text-xs font-semibold text-(--color-ink-soft) hover:text-(--color-brand-blue)"
          >
            Забыл(а) пароль?
          </Link>

          <WebAuthnLoginButton />

          {hasEmail && (
            <>
              <div className="my-5 flex items-center gap-3 text-xs font-semibold uppercase tracking-wide text-(--color-ink-soft)">
                <span className="h-px flex-1 bg-black/10 dark:bg-white/10" />
                или
                <span className="h-px flex-1 bg-black/10 dark:bg-white/10" />
              </div>
              <form action={emailAction} className="flex gap-2">
                <input
                  name="email"
                  type="email"
                  placeholder="Почта"
                  required
                  className="flex-1 rounded-full border border-black/10 dark:border-white/10 bg-(--color-surface) px-4 py-3 text-sm outline-none focus:border-(--color-brand-blue)"
                />
                <button
                  type="submit"
                  className="flex shrink-0 items-center justify-center gap-1.5 rounded-full border border-black/10 dark:border-white/10 bg-(--color-surface) px-4 py-3 text-sm font-semibold shadow-(--shadow-soft)"
                >
                  <Mail className="h-4 w-4" />
                  Ссылкой
                </button>
              </form>
            </>
          )}
        </div>
      ) : (
        <form action={submitSignup} className="mt-6 space-y-2.5">
          <div>
            <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-(--color-ink-soft)">
              Выбери аватар
            </label>
            <div className="flex flex-wrap gap-2">
              {AVATARS.map((a) => (
                <button
                  key={a.key}
                  type="button"
                  onClick={() => setAvatarKey(a.key)}
                  className={cn(
                    "relative flex h-10 w-10 items-center justify-center rounded-full text-lg transition-shadow",
                    avatarKey === a.key
                      ? "shadow-[0_0_0_3px_var(--color-brand-blue)]"
                      : "shadow-[0_0_0_1px_rgba(11,11,18,0.08)]"
                  )}
                  style={{ background: a.gradient }}
                  aria-label={a.key}
                >
                  {a.emoji}
                  {avatarKey === a.key && (
                    <span className="absolute -right-0.5 -top-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-(--color-brand-blue) text-white">
                      <Check className="h-2.5 w-2.5" strokeWidth={3} />
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>
          <input
            name="username"
            placeholder="Придумай ник"
            required
            autoComplete="username"
            className="w-full rounded-full border border-black/10 dark:border-white/10 bg-(--color-surface) px-4 py-3 text-sm outline-none focus:border-(--color-brand-blue)"
          />
          <input
            name="email"
            type="email"
            placeholder="Почта (для восстановления пароля)"
            required
            autoComplete="email"
            className="w-full rounded-full border border-black/10 dark:border-white/10 bg-(--color-surface) px-4 py-3 text-sm outline-none focus:border-(--color-brand-blue)"
          />
          <input
            name="password"
            type="password"
            placeholder="Придумай пароль"
            required
            autoComplete="new-password"
            className="w-full rounded-full border border-black/10 dark:border-white/10 bg-(--color-surface) px-4 py-3 text-sm outline-none focus:border-(--color-brand-blue)"
          />
          {signupError && (
            <p className="text-center text-xs font-semibold text-(--color-brand-pink)">{signupError}</p>
          )}
          <button
            type="submit"
            disabled={isPending}
            className="btn-gradient press-spring flex w-full items-center justify-center gap-2 rounded-full py-3 text-sm font-bold disabled:opacity-60"
          >
            {isPending ? "Создаю…" : "Создать аккаунт"} <ArrowRight className="h-4 w-4" />
          </button>
        </form>
      )}

      <p className="mt-6 text-center text-xs leading-relaxed text-(--color-ink-soft)">
        Продолжая, ты соглашаешься с{" "}
        <Link href="/terms" target="_blank" className="underline underline-offset-2">
          пользовательским соглашением
        </Link>{" "}
        и{" "}
        <Link href="/privacy" target="_blank" className="underline underline-offset-2">
          политикой конфиденциальности
        </Link>
        .
      </p>
    </>
  );
}
