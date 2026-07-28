import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { CoachChat } from "@/components/app/coach-chat";

export default async function CoachPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const session = await auth();
  const userId = session!.user.id;
  const { q } = await searchParams;
  const recent = await prisma.coachMessage.findMany({ where: { userId }, orderBy: { createdAt: "asc" }, take: 30 });

  return (
    <div>
      <h1 className="font-display text-2xl font-extrabold sm:text-3xl">ИИ-тренер</h1>
      <p className="mt-1 text-(--color-ink-soft)">Спрашивай — ответы опираются на твои реальные данные: восстановление, пороги, план, сон.</p>
      <div className="mt-6">
        <CoachChat
          initialMessages={recent.map((m) => ({ role: m.role === "assistant" ? "assistant" : "user", content: m.content }))}
          autoStartMessage={recent.length === 0 && q ? q : undefined}
        />
      </div>
    </div>
  );
}
