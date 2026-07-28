import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { sendSupportMessage, markThreadRead } from "@/lib/actions/support";
import { SupportChat } from "@/components/app/support-chat";

const SUPPORT_EMAIL = process.env.SUPPORT_EMAIL || "bal.support.exam@gmail.com";

export default async function SupportPage() {
  const session = await auth();
  const userId = session!.user.id;

  const [messages] = await Promise.all([
    prisma.supportMessage.findMany({
      where: { userId },
      orderBy: { createdAt: "asc" },
      select: { id: true, fromAdmin: true, body: true, createdAt: true },
    }),
    markThreadRead(),
  ]);

  return (
    <div className="mx-auto max-w-lg">
      <Link
        href="/app/profile"
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-(--color-ink-soft) hover:text-(--color-ink)"
      >
        <ArrowLeft className="h-4 w-4" /> Профиль
      </Link>

      <h1 className="font-display text-2xl font-extrabold sm:text-3xl">Поддержка</h1>
      <p className="mt-1 text-(--color-ink-soft)">
        Нашёл(ла) баг, есть идея или вопрос — напиши, ответим прямо здесь.
      </p>

      <div className="mt-6">
        <SupportChat
          messages={messages.map((m) => ({ ...m, createdAt: m.createdAt.toISOString() }))}
          action={sendSupportMessage}
        />
      </div>

      <p className="mt-4 text-center text-sm text-(--color-ink-soft)">
        Или напрямую на{" "}
        <a href={`mailto:${SUPPORT_EMAIL}`} className="font-semibold text-(--color-brand-blue)">
          {SUPPORT_EMAIL}
        </a>
      </p>
    </div>
  );
}
