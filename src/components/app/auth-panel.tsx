"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { ArrowRight, Mail } from "lucide-react";
import { cn } from "@/lib/utils";
import { signUp } from "@/lib/actions/auth-signup";
import { AuthHeadline } from "@/components/app/auth-headline";
import { WebAuthnLoginButton } from "@/components/app/webauthn-login-button";
import { GoogleGlyph } from "@/components/app/google-glyph";

const fieldClass =
  "w-full rounded-full border border-white/15 bg-white/[0.03] px-4 py-3.5 text-sm text-white placeholder:text-white/35 outline-none transition-colors focus:border-white/40";

export function AuthPanel({
  hasEmail,
  hasGoogle,
  redirectTo,
  signinAction,
  emailAction,
  googleAction,
}: {
  hasEmail: boolean;
  hasGoogle: boolean;
  redirectTo: string;
  signinAction: (formData: FormData) => Promise<void>;
  emailAction: (formData: FormData) => Promise<void>;
  googleAction: () => Promise<void>;
}) {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [signupError, setSignupError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function submitSignup(formData: FormData) {
    setSignupError(null);
    formData.set("redirectTo", redirectTo);
    startTransition(async () => {
      const result = await signUp(formData);
      if (!result.ok) setSignupError(result.error);
    });
  }

  return (
    <>
      <AuthHeadline mode={mode} />

      <div className="mt-7 flex gap-6 border-b border-white/10 text-sm font-bold">
        <button
          type="button"
          onClick={() => setMode("signin")}
          className={cn(
            "relative pb-3 transition-colors",
            mode === "signin" ? "text-white" : "text-white/40 hover:text-white/60"
          )}
        >
          Войти
          {mode === "signin" && <span className="absolute inset-x-0 -bottom-px h-0.5 rounded-full bg-white" />}
        </button>
        <button
          type="button"
          onClick={() => setMode("signup")}
          className={cn(
            "relative pb-3 transition-colors",
            mode === "signup" ? "text-white" : "text-white/40 hover:text-white/60"
          )}
        >
          Регистрация
          {mode === "signup" && <span className="absolute inset-x-0 -bottom-px h-0.5 rounded-full bg-white" />}
        </button>
      </div>

      {hasGoogle && (
        <form action={googleAction} className="mt-7">
          <button
            type="submit"
            className="flex w-full items-center justify-center gap-2.5 rounded-full border border-white/15 bg-white px-5 py-3.5 text-sm font-bold text-black transition-opacity hover:opacity-90"
          >
            <GoogleGlyph className="h-4.5 w-4.5" />
            {mode === "signup" ? "Регистрация через Google" : "Войти через Google"}
          </button>
        </form>
      )}

      {hasGoogle && (
        <div className="my-6 flex items-center gap-3 text-xs font-semibold uppercase tracking-wide text-white/30">
          <span className="h-px flex-1 bg-white/10" />
          или
          <span className="h-px flex-1 bg-white/10" />
        </div>
      )}

      {mode === "signin" ? (
        <div className={cn("space-y-3", !hasGoogle && "mt-7")}>
          <form action={signinAction} className="space-y-2.5">
            <input name="username" placeholder="Ник" required autoComplete="username" className={fieldClass} />
            <input name="password" type="password" placeholder="Пароль" required autoComplete="current-password" className={fieldClass} />
            <button
              type="submit"
              className="btn-gradient press-spring flex w-full items-center justify-center gap-2 rounded-full py-3.5 text-sm font-bold"
            >
              Войти <ArrowRight className="h-4 w-4" />
            </button>
          </form>
          <Link href="/login/forgot-password" className="block text-center text-xs font-semibold text-white/40 hover:text-white/70">
            Забыл(а) пароль?
          </Link>

          <WebAuthnLoginButton />

          {hasEmail && (
            <>
              <div className="my-5 flex items-center gap-3 text-xs font-semibold uppercase tracking-wide text-white/30">
                <span className="h-px flex-1 bg-white/10" />
                или
                <span className="h-px flex-1 bg-white/10" />
              </div>
              <form action={emailAction} className="flex gap-2">
                <input name="email" type="email" placeholder="Почта" required className={cn(fieldClass, "flex-1")} />
                <button
                  type="submit"
                  className="flex shrink-0 items-center justify-center gap-1.5 rounded-full border border-white/15 bg-transparent px-4 py-3.5 text-sm font-semibold text-white transition-colors hover:border-white/30"
                >
                  <Mail className="h-4 w-4" />
                  Ссылкой
                </button>
              </form>
            </>
          )}
        </div>
      ) : (
        <form action={submitSignup} className={cn("space-y-2.5", !hasGoogle && "mt-7")}>
          <input name="username" placeholder="Придумай ник" required autoComplete="username" className={fieldClass} />
          <input name="email" type="email" placeholder="Почта (для восстановления пароля)" required autoComplete="email" className={fieldClass} />
          <input name="password" type="password" placeholder="Придумай пароль" required autoComplete="new-password" className={fieldClass} />
          {signupError && <p className="text-center text-xs font-semibold text-(--color-brand-pink)">{signupError}</p>}
          <button
            type="submit"
            disabled={isPending}
            className="btn-gradient press-spring flex w-full items-center justify-center gap-2 rounded-full py-3.5 text-sm font-bold disabled:opacity-60"
          >
            {isPending ? "Создаю…" : "Создать аккаунт"} <ArrowRight className="h-4 w-4" />
          </button>
        </form>
      )}

      <p className="mt-7 text-center text-xs leading-relaxed text-white/35">
        Продолжая, ты соглашаешься с{" "}
        <Link href="/terms" target="_blank" className="underline underline-offset-2 hover:text-white/60">
          пользовательским соглашением
        </Link>{" "}
        и{" "}
        <Link href="/privacy" target="_blank" className="underline underline-offset-2 hover:text-white/60">
          политикой конфиденциальности
        </Link>
        .
      </p>
    </>
  );
}
