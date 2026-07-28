import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { isAdminSession } from "@/lib/admin";
import { UserAvatar } from "@/components/app/user-avatar";
import { MessageCircle } from "lucide-react";

export default async function AdminSupportListPage() {
  const session = await auth();
  if (!isAdminSession(session)) notFound();

  const messages = await prisma.supportMessage.findMany({
    orderBy: { createdAt: "desc" },
    include: { user: { select: { id: true, name: true, email: true, avatarKey: true, image: true } } },
  });

  const threads = new Map<
    string,
    { user: (typeof messages)[number]["user"]; last: (typeof messages)[number]; unread: number }
  >();
  for (const m of messages) {
    const existing = threads.get(m.userId);
    if (!existing) {
      threads.set(m.userId, { user: m.user, last: m, unread: !m.fromAdmin && !m.read ? 1 : 0 });
    } else if (!m.fromAdmin && !m.read) {
      existing.unread += 1;
    }
  }
  const list = [...threads.values()];

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="font-display text-2xl font-extrabold sm:text-3xl">Сообщения поддержки</h1>
      <p className="mt-1 text-(--color-ink-soft)">Все обращения пользователей, свежие сверху.</p>

      {list.length === 0 ? (
        <div className="card-surface mt-6 p-8 text-center text-sm text-(--color-ink-soft)">
          Пока пусто.
        </div>
      ) : (
        <div className="mt-6 space-y-2.5">
          {list.map(({ user, last, unread }) => (
            <Link
              key={user.id}
              href={`/app/admin/support/${user.id}`}
              className="card-surface press-spring flex items-center gap-3 p-4"
            >
              <UserAvatar avatarKey={user.avatarKey} image={user.image} name={user.name} className="h-10 w-10 shrink-0" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate text-sm font-bold">{user.name || "Гость"}</span>
                  {unread > 0 && (
                    <span className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-(--color-brand-pink) px-1.5 text-[0.65rem] font-bold text-white">
                      {unread}
                    </span>
                  )}
                </div>
                <div className="truncate text-xs text-(--color-ink-soft)">
                  {last.fromAdmin ? "Вы: " : ""}
                  {last.body}
                </div>
              </div>
              <MessageCircle className="h-4 w-4 shrink-0 text-(--color-ink-soft)" />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
