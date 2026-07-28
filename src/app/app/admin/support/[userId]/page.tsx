import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { isAdminSession } from "@/lib/admin";
import { sendAdminReply, markAdminViewRead } from "@/lib/actions/support";
import { SupportChat } from "@/components/app/support-chat";
import { UserAvatar } from "@/components/app/user-avatar";

export default async function AdminSupportThreadPage({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  const session = await auth();
  if (!isAdminSession(session)) notFound();
  const { userId } = await params;

  const athlete = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, email: true, avatarKey: true, image: true },
  });
  if (!athlete) notFound();

  const [messages] = await Promise.all([
    prisma.supportMessage.findMany({
      where: { userId },
      orderBy: { createdAt: "asc" },
      select: { id: true, fromAdmin: true, body: true, createdAt: true },
    }),
    markAdminViewRead(userId),
  ]);

  return (
    <div className="mx-auto max-w-lg">
      <Link
        href="/app/admin/support"
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-(--color-ink-soft) hover:text-(--color-ink)"
      >
        <ArrowLeft className="h-4 w-4" /> Все обращения
      </Link>

      <div className="flex items-center gap-3">
        <UserAvatar avatarKey={athlete.avatarKey} image={athlete.image} name={athlete.name} className="h-11 w-11" />
        <div>
          <h1 className="font-display text-xl font-extrabold">{athlete.name || "Гость"}</h1>
          <p className="text-xs text-(--color-ink-soft)">{athlete.email || "без почты"}</p>
        </div>
      </div>

      <div className="mt-5">
        <SupportChat
          messages={messages.map((m) => ({ ...m, createdAt: m.createdAt.toISOString() }))}
          action={sendAdminReply}
          hiddenFields={{ userId: athlete.id }}
          placeholder="Ответить пользователю…"
          selfIsAdmin
        />
      </div>
    </div>
  );
}
