import Link from "next/link";
import { ArrowLeft, Sparkles } from "lucide-react";
import { ForgotPasswordForm } from "@/components/app/forgot-password-form";
import { AuthBackdrop } from "@/components/app/auth-backdrop";
import { PageTransition } from "@/components/motion/page-transition";

export const metadata = { title: "Восстановление пароля — Тренер" };

export default function ForgotPasswordPage() {
  return (
    <div className="relative flex min-h-screen items-center justify-center px-4 py-16">
      <AuthBackdrop />

      <PageTransition glow="never">
        <div className="relative w-full max-w-md">
          <Link href="/" className="mb-8 flex items-center justify-center gap-2 font-display text-xl font-bold">
            <span className="flex h-9 w-9 items-center justify-center rounded-full btn-gradient">
              <Sparkles className="h-4 w-4" strokeWidth={2.5} />
            </span>
            Тренер
          </Link>

          <div className="card-surface p-8">
            <Link
              href="/login"
              className="mb-4 inline-flex items-center gap-1.5 text-xs font-semibold text-(--color-ink-soft) hover:text-(--color-ink)"
            >
              <ArrowLeft className="h-3.5 w-3.5" /> Ко входу
            </Link>
            <h1 className="font-display text-center text-2xl font-extrabold">Забыл(а) пароль?</h1>
            <p className="mt-2 text-center text-sm text-(--color-ink-soft)">
              Укажи ник или почту — пришлём ссылку для сброса пароля.
            </p>
            <div className="mt-6">
              <ForgotPasswordForm />
            </div>
          </div>
        </div>
      </PageTransition>
    </div>
  );
}
