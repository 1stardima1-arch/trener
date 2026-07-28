import Link from "next/link";
import { Sparkles } from "lucide-react";
import { ResetPasswordForm } from "@/components/app/reset-password-form";
import { AuthBackdrop } from "@/components/app/auth-backdrop";
import { PageTransition } from "@/components/motion/page-transition";

export const metadata = { title: "Новый пароль — Тренер" };

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;

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
            <h1 className="font-display text-center text-2xl font-extrabold">Новый пароль</h1>
            <p className="mt-2 text-center text-sm text-(--color-ink-soft)">Придумай новый пароль для входа.</p>
            <div className="mt-6">
              {token ? (
                <ResetPasswordForm token={token} />
              ) : (
                <p className="text-center text-sm font-semibold text-(--color-brand-pink)">
                  Ссылка недействительна.{" "}
                  <Link href="/login/forgot-password" className="underline">
                    Запросить новую
                  </Link>
                </p>
              )}
            </div>
          </div>
        </div>
      </PageTransition>
    </div>
  );
}
