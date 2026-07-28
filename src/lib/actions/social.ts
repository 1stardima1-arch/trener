"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export type ActionResult = { ok: true } | { ok: false; error: string };

export async function toggleFollow(targetUserId: string): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "Нужно войти в аккаунт." };
  if (session.user.id === targetUserId) return { ok: false, error: "Нельзя подписаться на себя." };

  const existing = await prisma.follow.findUnique({
    where: { followerId_followingId: { followerId: session.user.id, followingId: targetUserId } },
  });
  if (existing) {
    await prisma.follow.delete({ where: { id: existing.id } });
  } else {
    await prisma.follow.create({ data: { followerId: session.user.id, followingId: targetUserId } });
  }

  revalidatePath("/app/feed");
  revalidatePath(`/app/athletes/${targetUserId}`);
  return { ok: true };
}

export async function toggleKudos(activityId: string): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "Нужно войти в аккаунт." };

  const existing = await prisma.kudos.findUnique({
    where: { userId_activityId: { userId: session.user.id, activityId } },
  });
  if (existing) {
    await prisma.kudos.delete({ where: { id: existing.id } });
  } else {
    await prisma.kudos.create({ data: { userId: session.user.id, activityId } });
  }

  revalidatePath("/app/feed");
  return { ok: true };
}

export async function setActivityVisibility(activityId: string, visibility: "PRIVATE" | "FOLLOWERS" | "PUBLIC"): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "Нужно войти в аккаунт." };

  const activity = await prisma.activity.findUnique({ where: { id: activityId } });
  if (!activity || activity.userId !== session.user.id) return { ok: false, error: "Тренировка не найдена." };

  await prisma.activity.update({ where: { id: activityId }, data: { visibility } });
  revalidatePath("/app/feed");
  revalidatePath("/app/training");
  return { ok: true };
}
