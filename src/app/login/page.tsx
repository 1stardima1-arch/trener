import Link from "next/link";
import { signIn } from "@/auth";
import { Activity, HeartPulse, Watch, TrendingUp } from "lucide-react";
import { AuthPanel } from "@/components/app/auth-panel";
import { AuthBackdrop } from "@/components/app/auth-backdrop";
import { PageTransition } from "@/components/motion/page-transition";

const PITCH = [
  { icon: HeartPulse, text: "Готовность, сон и восстановление каждый день" },
  { icon: Watch, text: "Garmin, Polar, Athyx — реальная синхронизация" },
  { icon: TrendingUp, text: "ИИ-тренер объясняет каждое решение плана" },
];

const providers = {
  email: !!process.env.RESEND_API_KEY,
};

const errorMessages: Record<string, string> = {
  Verification: "Ссылка для входа устарела или уже использована. Запроси новую.",
  CredentialsSignin: "Неверный ник или пароль.",
  Default: "Не получилось войти. Попробуй ещё раз.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string; error?: string }>;
}) {
  const { callbackUrl, error } = await searchParams;
  const redirectTo = callbackUrl || "/app";
  const errorMessage = error ? errorMessages[error] || errorMessages.Default : null;

  async function signinAction(formData: FormData) {
    "use server";
    const username = (formData.get("username") as string)?.trim();
    const password = formData.get("password") as string;
    await signIn("username-password", { username, password, redirectTo });
  }

  async function emailSignIn(formData: FormData) {
    "use server";
    const email = (formData.get("email") as string)?.trim();
    await signIn("resend", { email, redirectTo });
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center px-4 py-16">
      <AuthBackdrop />

      <PageTransition glow="never">
      <div className="relative w-full max-w-md">
        <Link
          href="/"
          className="mb-6 flex items-center justify-center gap-2 font-display text-xl font-bold text-white"
        >
          <span className="flex h-9 w-9 items-center justify-center rounded-full btn-gradient">
            <Activity className="h-4 w-4" strokeWidth={2.5} />
          </span>
          Тренер
        </Link>

        <div className="mb-6 text-center">
          <p className="font-display text-lg font-bold text-white">ИИ-тренер, который знает твоё тело</p>
          <div className="mt-3 flex flex-col items-center gap-1.5">
            {PITCH.map(({ icon: Icon, text }) => (
              <span key={text} className="flex items-center gap-2 text-sm text-white/70">
                <Icon className="h-4 w-4 shrink-0 text-(--color-brand-blue)" />
                {text}
              </span>
            ))}
          </div>
        </div>

        <div className="card-surface p-8">
          {errorMessage && (
            <div className="mb-5 rounded-2xl bg-(--color-brand-pink)/10 px-4 py-3 text-center text-sm font-semibold text-(--color-brand-pink)">
              {errorMessage}
            </div>
          )}

          <AuthPanel
            hasEmail={providers.email}
            redirectTo={redirectTo}
            signinAction={signinAction}
            emailAction={emailSignIn}
          />
        </div>
      </div>
      </PageTransition>
    </div>
  );
}
