"use client";

import { useState, useTransition } from "react";
import { Heart } from "lucide-react";
import { toggleKudos, toggleFollow } from "@/lib/actions/social";
import { cn } from "@/lib/utils";

export function KudosButton({ activityId, initialCount, initialGiven }: { activityId: string; initialCount: number; initialGiven: boolean }) {
  const [count, setCount] = useState(initialCount);
  const [given, setGiven] = useState(initialGiven);
  const [isPending, startTransition] = useTransition();

  return (
    <button
      disabled={isPending}
      onClick={() => {
        setGiven((g) => !g);
        setCount((c) => (given ? c - 1 : c + 1));
        startTransition(() => { toggleKudos(activityId); });
      }}
      className={cn("press-spring flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold", given ? "bg-(--color-brand-pink)/15 text-(--color-brand-pink)" : "bg-black/5 text-(--color-ink-soft) dark:bg-white/10")}
    >
      <Heart className={cn("h-3.5 w-3.5", given && "fill-current")} /> {count}
    </button>
  );
}

export function FollowButton({ userId, initialFollowing }: { userId: string; initialFollowing: boolean }) {
  const [following, setFollowing] = useState(initialFollowing);
  const [isPending, startTransition] = useTransition();

  return (
    <button
      disabled={isPending}
      onClick={() => { setFollowing((f) => !f); startTransition(() => { toggleFollow(userId); }); }}
      className={cn("press-spring rounded-full px-4 py-1.5 text-xs font-bold", following ? "bg-black/5 text-(--color-ink-soft) dark:bg-white/10" : "btn-gradient")}
    >
      {following ? "Отписаться" : "Подписаться"}
    </button>
  );
}
