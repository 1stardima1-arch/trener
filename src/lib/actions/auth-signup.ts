"use server";

import { prisma } from "@/lib/prisma";
import { signIn } from "@/auth";
import { hashPassword, validatePasswordStrength } from "@/lib/password";
import { isReservedUsername } from "@/lib/admin";
import { avatarByKey } from "@/lib/avatars";

export type SignupResult = { ok: true } | { ok: false; error: string };

const USERNAME_RE = /^[a-zA-Zа-яА-Я0-9_]{3,20}$/;

export async function signUp(formData: FormData): Promise<SignupResult> {
  const username = (formData.get("username") as string | null)?.trim() ?? "";
  const email = (formData.get("email") as string | null)?.trim().toLowerCase() ?? "";
  const password = (formData.get("password") as string | null) ?? "";
  const avatarKey = (formData.get("avatarKey") as string | null) ?? null;
  const redirectTo = (formData.get("redirectTo") as string | null) || "/app";

  if (!USERNAME_RE.test(username)) {
    return { ok: false, error: "Ник — 3–20 символов: буквы, цифры, подчёркивание." };
  }
  if (isReservedUsername(username)) {
    return { ok: false, error: "Этот ник занят." };
  }
  if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
    return { ok: false, error: "Укажи настоящую почту — она понадобится, если забудешь пароль." };
  }
  const pwError = validatePasswordStrength(password);
  if (pwError) return { ok: false, error: pwError };
  if (avatarKey && !avatarByKey(avatarKey)) {
    return { ok: false, error: "Неизвестный аватар." };
  }

  const [existingUsername, existingEmail] = await Promise.all([
    prisma.user.findUnique({ where: { username } }),
    prisma.user.findUnique({ where: { email } }),
  ]);
  if (existingUsername) return { ok: false, error: "Этот ник уже занят." };
  if (existingEmail) return { ok: false, error: "Эта почта уже используется." };

  const passwordHash = await hashPassword(password);
  await prisma.user.create({
    data: { username, email, name: username, passwordHash, avatarKey },
  });

  await signIn("username-password", { username, password, redirectTo });
  return { ok: true };
}
