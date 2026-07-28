import Link from "next/link";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { UserAvatar } from "@/components/app/user-avatar";
import { KudosButton, FollowButton } from "@/components/app/social-buttons";
import { sportLabel, formatDuration, kmFromMeters } from "@/lib/sports";
import { Users } from "lucide-react";

export default async function FeedPage() {
  const session = await auth();
  const userId = session!.user.id;

  const following = await prisma.follow.findMany({ where: { followerId: userId }, select: { followingId: true } });
  const followingIds = following.map((f) => f.followingId);

  const [activities, suggestions] = await Promise.all([
    prisma.activity.findMany({
      where: { OR: [{ visibility: "PUBLIC" }, { visibility: "FOLLOWERS", userId: { in: followingIds } }, { userId }] },
      orderBy: { startedAt: "desc" },
      take: 30,
      include: { user: { select: { id: true, name: true, avatarKey: true, image: true } }, kudos: { select: { userId: true } } },
    }),
    prisma.user.findMany({
      where: { isPublic: true, id: { notIn: [userId, ...followingIds] } },
      select: { id: true, name: true, avatarKey: true, image: true, bio: true },
      take: 6,
    }),
  ]);

  return (
    <div>
      <h1 className="font-display flex items-center gap-2 text-2xl font-extrabold sm:text-3xl"><Users className="h-6 w-6 text-(--color-brand-violet)" /> Лента</h1>
      <p className="mt-1 text-(--color-ink-soft)">Тренировки и прогресс других атлетов.</p>

      {suggestions.length > 0 && (
        <div className="mt-6">
          <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-(--color-ink-soft)">Возможно, знакомы</h2>
          <div className="flex gap-3 overflow-x-auto pb-2">
            {suggestions.map((u) => (
              <div key={u.id} className="card-surface flex w-44 shrink-0 flex-col items-center gap-2 p-4 text-center">
                <Link href={`/app/athletes/${u.id}`}><UserAvatar image={u.image} avatarKey={u.avatarKey} name={u.name} className="h-12 w-12" /></Link>
                <Link href={`/app/athletes/${u.id}`} className="truncate text-sm font-bold">{u.name}</Link>
                <FollowButton userId={u.id} initialFollowing={false} />
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="mt-6 space-y-2.5">
        {activities.map((a) => {
          const given = a.kudos.some((k) => k.userId === userId);
          return (
            <div key={a.id} className="card-surface p-5">
              <div className="flex items-center gap-3">
                <Link href={`/app/athletes/${a.user.id}`}><UserAvatar image={a.user.image} avatarKey={a.user.avatarKey} name={a.user.name} className="h-9 w-9" /></Link>
                <div className="min-w-0 flex-1">
                  <Link href={`/app/athletes/${a.user.id}`} className="truncate text-sm font-bold">{a.user.name}</Link>
                  <div className="text-xs text-(--color-ink-soft)">{a.startedAt.toLocaleDateString("ru-RU")}</div>
                </div>
              </div>
              <div className="mt-3 font-display text-lg font-bold">{sportLabel(a.sport)}</div>
              <div className="mt-1 flex flex-wrap gap-3 text-sm text-(--color-ink-soft)">
                <span>{formatDuration(a.durationSec)}</span>
                {a.distanceM && <span>{kmFromMeters(a.distanceM)} км</span>}
                {a.avgHr && <span>{a.avgHr} уд/мин ср.</span>}
              </div>
              <div className="mt-3">
                <KudosButton activityId={a.id} initialCount={a.kudos.length} initialGiven={given} />
              </div>
            </div>
          );
        })}
        {activities.length === 0 && <div className="card-surface p-8 text-center text-(--color-ink-soft)">Пока пусто — подпишись на других атлетов или сделай свою тренировку публичной.</div>}
      </div>
    </div>
  );
}
