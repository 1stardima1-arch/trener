import Link from "next/link";
import { Mail, Sparkles } from "lucide-react";
import { AuthBackdrop } from "@/components/app/auth-backdrop";
import { PageTransition } from "@/components/motion/page-transition";

export const metadata = { title: "Проверь почту — Тренер" };

export default function CheckEmailPage() {
  return (
    <div className="relative flex min-h-screen items-center justify-center px-4 py-16">
      <AuthBackdrop />

      <PageTransition glow="never">
        <div className="relative w-full max-w-md">
          <Link
            href="/"
            className="mb-8 flex items-center justify-center gap-2 font-display text-xl font-bold"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-full btn-gradient">
              <Sparkles className="h-4 w-4" strokeWidth={2.5} />
            </span>
            Тренер
          </Link>

          <div className="card-surface p-8 text-center">
            <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full btn-gradient">
              <Mail className="h-6 w-6" strokeWidth={2} />
            </span>
            <h1 className="font-display mt-5 text-2xl font-extrabold">Проверь почту</h1>
            <p className="mt-2 text-sm text-(--color-ink-soft)">
              Мы отправили ссылку для входа. Открой письмо и нажми «Войти в Тренер» — она
              действует 24 часа.
            </p>
            <Link
              href="/login"
              className="mt-6 inline-block text-sm font-semibold text-(--color-brand-blue)"
            >
              Назад ко входу
            </Link>
          </div>
        </div>
      </PageTransition>
    </div>
  );
}
