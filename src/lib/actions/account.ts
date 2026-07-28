"use server";

import { auth, signOut } from "@/auth";
import { prisma } from "@/lib/prisma";

export type DeleteAccountResult = { ok: true } | { ok: false; error: string };

// Every user-owned relation in the schema cascades on User deletion (see
// prisma/schema.prisma), so a single delete is enough to remove all of a
// student's data — attempts, achievements, mock exam history, passkeys,
// support messages, everything.
export async function deleteOwnAccount(confirmUsername: string): Promise<DeleteAccountResult> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "Не авторизован" };

  const user = await prisma.user.findUniqueOrThrow({ where: { id: session.user.id } });
  // Username is optional (a student can sign in by email-magic-link only),
  // so fall back to email as the thing they type to confirm.
  const confirmTarget = user.username ?? user.email ?? "";
  if (!confirmTarget || confirmUsername.trim() !== confirmTarget) {
    return { ok: false, error: "Введено неверно — проверь и попробуй снова." };
  }

  await prisma.user.delete({ where: { id: session.user.id } });

  // signOut() redirects internally — nothing after this line runs on success.
  await signOut({ redirectTo: "/" });
  return { ok: true };
}
