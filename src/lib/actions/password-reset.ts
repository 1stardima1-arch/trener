"use server";

import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { hashPassword, validatePasswordStrength } from "@/lib/password";

export type PasswordResetResult = { ok: true } | { ok: false; error: string };

const RESET_TTL_MS = 60 * 60 * 1000; // 1 hour

async function sendResetEmail(to: string, url: string) {
  if (!process.env.RESEND_API_KEY) return; // best-effort — see requestPasswordReset
  try {
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: process.env.RESEND_FROM_EMAIL || "Тренер <onboarding@resend.dev>",
        to,
        subject: "Восстановление пароля — Тренер",
        text: `Сброс пароля: ${url}\n\nСсылка действует час. Если это не ты — просто проигнорируй письмо.`,
        html: `<p>Нажми, чтобы задать новый пароль: <a href="${url}">${url}</a></p><p style="color:#888;font-size:13px">Ссылка действует час. Если это не ты — просто проигнорируй письмо.</p>`,
      }),
    });
  } catch {
    // Swallow — see requestPasswordReset for why this must never surface as an error.
  }
}

// Always resolves to { ok: true } regardless of whether a matching account
// exists — returning an error for "no such user" would let this endpoint
// be used to enumerate registered usernames/emails.
export async function requestPasswordReset(formData: FormData): Promise<PasswordResetResult> {
  const identifier = (formData.get("identifier") as string | null)?.trim() ?? "";
  if (!identifier) return { ok: false, error: "Введи ник или почту." };

  const user = await prisma.user.findFirst({
    where: { OR: [{ username: identifier }, { email: identifier.toLowerCase() }] },
    select: { id: true, email: true },
  });

  if (user?.email) {
    const token = crypto.randomBytes(32).toString("base64url");
    await prisma.passwordResetToken.create({
      data: { userId: user.id, token, expires: new Date(Date.now() + RESET_TTL_MS) },
    });
    const base = process.env.NEXTAUTH_URL || "http://localhost:3000";
    await sendResetEmail(user.email, `${base}/login/reset-password?token=${token}`);
  }

  return { ok: true };
}

export async function resetPassword(formData: FormData): Promise<PasswordResetResult> {
  const token = (formData.get("token") as string | null) ?? "";
  const password = (formData.get("password") as string | null) ?? "";
  if (!token) return { ok: false, error: "Ссылка недействительна." };

  const pwError = validatePasswordStrength(password);
  if (pwError) return { ok: false, error: pwError };

  const record = await prisma.passwordResetToken.findUnique({ where: { token } });
  if (!record || record.expires < new Date()) {
    return { ok: false, error: "Ссылка недействительна или устарела — запроси новую." };
  }

  const passwordHash = await hashPassword(password);
  await prisma.$transaction([
    prisma.user.update({ where: { id: record.userId }, data: { passwordHash } }),
    prisma.passwordResetToken.deleteMany({ where: { userId: record.userId } }),
  ]);

  return { ok: true };
}
