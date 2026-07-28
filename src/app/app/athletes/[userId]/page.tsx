import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { UserAvatar } from "@/components/app/user-avatar";
import { FollowButton } from "@/components/app/social-buttons";
import { sportLabel, formatDuration, kmFromMeters } from "@/lib/sports";
import { ArrowLeft, Lock } from "lucide-react";

export default async function AthleteProfilePage({ params }: { params: Promise<{ userId: string }> }) {
  const { userId: targetId } = await params;
  const session = await auth();
  const viewerId = session!.user.id;

  const target = await prisma.user.findUnique({
    where: { id: targetId },
    select: { id: true, name: true, image: true, avatarKey: true, bio: true, isPublic: true, createdAt: true },
  });
  if (!target) notFound();

  const [isFollowing, followerCount, athleteProfile] = await Promise.all([
    prisma.follow.findUnique({ where: { followerId_followingId: { followerId: viewerId, followingId: targetId } } }),
    prisma.follow.count({ where: { followingId: targetId } }),
    prisma.athleteProfile.findUnique({ where: { userId: targetId }, select: { primarySport: true } }),
  ]);

  const canSeeActivities = target.isPublic || viewerId === targetId || !!isFollowing;

  const [activities, snapshot] = canSeeActivities
    ? await Promise.all([
        prisma.activity.findMany({ where: { userId: targetId, OR: [{ visibility: "PUBLIC" }, { visibility: "FOLLOWERS" }] }, orderBy: { startedAt: "desc" }, take: 15 }),
        athleteProfile ? prisma.thresholdSnapshot.findMany({ where: { userId: targetId, sport: athleteProfile.primarySport }, orderBy: { computedAt: "desc" }, take: 5 }) : Promise.resolve([]),
      ])
    : [[], []];

  return (
    <div>
      <Link href="/app/feed" className="mb-4 flex items-center gap-1.5 text-sm font-semibold text-(--color-ink-soft)"><ArrowLeft className="h-4 w-4" /> Лента</Link>

      <div className="card-surface flex items-center gap-4 p-6">
        <UserAvatar image={target.image} avatarKey={target.avatarKey} name={target.name} className="h-16 w-16 text-xl" />
        <div className="min-w-0 flex-1">
          <div className="font-display text-xl font-bold">{target.name}</div>
          {athleteProfile && <div className="text-sm text-(--color-ink-soft)">{sportLabel(athleteProfile.primarySport)}</div>}
          {target.bio && <p className="mt-1 text-sm text-(--color-ink-soft)">{target.bio}</p>}
          <div className="mt-1 text-xs text-(--color-ink-soft)">{followerCount} подписчиков</div>
        </div>
        {viewerId !== targetId && <FollowButton userId={targetId} initialFollowing={!!isFollowing} />}
      </div>

      {!canSeeActivities ? (
        <div className="card-surface mt-6 flex flex-col items-center gap-2 p-10 text-center text-(--color-ink-soft)">
          <Lock className="h-6 w-6" />
          Профиль закрыт — тренировки видны только подписчикам.
        </div>
      ) : (
        <>
          {snapshot.length > 0 && (
            <div className="mt-6 card-surface p-5">
              <div className="text-xs font-bold uppercase tracking-wide text-(--color-ink-soft)">Прогресс VO2max</div>
              <div className="mt-2 flex flex-wrap gap-3">
                {snapshot.slice().reverse().map((s) => (
                  <div key={s.id} className="rounded-xl bg-(--color-paper-dim) px-3 py-2 text-center">
                    <div className="text-xs text-(--color-ink-soft)">{s.computedAt.toLocaleDateString("ru-RU", { day: "numeric", month: "short" })}</div>
                    <div className="font-bold">{s.vo2max ?? "—"}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="mt-6 space-y-2.5">
            {activities.map((a) => (
              <div key={a.id} className="card-surface p-4">
                <div className="font-bold">{sportLabel(a.sport)}</div>
                <div className="mt-1 flex flex-wrap gap-3 text-sm text-(--color-ink-soft)">
                  <span>{a.startedAt.toLocaleDateString("ru-RU")}</span>
                  <span>{formatDuration(a.durationSec)}</span>
                  {a.distanceM && <span>{kmFromMeters(a.distanceM)} км</span>}
                </div>
              </div>
            ))}
            {activities.length === 0 && <div className="card-surface p-8 text-center text-(--color-ink-soft)">Нет публичных тренировок.</div>}
          </div>
        </>
      )}
    </div>
  );
}
