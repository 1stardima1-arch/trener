"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { isAdminSession } from "@/lib/admin";

const SUPPORT_EMAIL = process.env.SUPPORT_EMAIL || "bal.support.exam@gmail.com";

export type SupportResult = { ok: true } | { ok: false; error: string };

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}

// Best-effort only — the message is already safely in the database by the
// time this runs, so a failed/unconfigured Resend send must never surface
// as an error to the student. This is just "so you find out sooner".
async function notifyByEmail(opts: { to: string; replyTo?: string | null; subject: string; body: string }) {
  if (!process.env.RESEND_API_KEY) return;
  try {
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: process.env.RESEND_FROM_EMAIL || "Тренер <onboarding@resend.dev>",
        to: opts.to,
        ...(opts.replyTo ? { reply_to: opts.replyTo } : {}),
        subject: opts.subject,
        text: opts.body,
        html: `<p style="white-space:pre-wrap">${escapeHtml(opts.body)}</p>`,
      }),
    });
  } catch {
    // Swallow — DB write already succeeded, that's the real guarantee.
  }
}

// Student sends a message into their own support thread.
export async function sendSupportMessage(formData: FormData): Promise<SupportResult> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "Нужно войти в аккаунт." };

  const body = (formData.get("message") as string | null)?.trim() ?? "";
  if (body.length < 2) return { ok: false, error: "Напиши сообщение." };
  if (body.length > 4000) return { ok: false, error: "Слишком длинное сообщение." };

  await prisma.supportMessage.create({
    data: { userId: session.user.id, fromAdmin: false, body },
  });

  const who = session.user.name || "Гость";
  await notifyByEmail({
    to: SUPPORT_EMAIL,
    replyTo: session.user.email,
    subject: `Поддержка «Тренер» — ${who}`,
    body: `${who} (${session.user.email ?? "без почты"}) написал(а) в поддержку:\n\n${body}\n\nОтветить можно прямо в приложении: /app/admin/support`,
  });

  revalidatePath("/app/support");
  return { ok: true };
}

// Admin replies into a specific student's thread.
export async function sendAdminReply(formData: FormData): Promise<SupportResult> {
  const session = await auth();
  if (!isAdminSession(session)) return { ok: false, error: "Нет доступа." };

  const targetUserId = (formData.get("userId") as string | null) ?? "";
  const body = (formData.get("message") as string | null)?.trim() ?? "";
  if (!targetUserId) return { ok: false, error: "Не указан пользователь." };
  if (body.length < 1) return { ok: false, error: "Напиши сообщение." };

  const student = await prisma.user.findUnique({
    where: { id: targetUserId },
    select: { email: true, name: true },
  });
  if (!student) return { ok: false, error: "Пользователь не найден." };

  await prisma.supportMessage.create({
    data: { userId: targetUserId, fromAdmin: true, body },
  });

  if (student.email) {
    await notifyByEmail({
      to: student.email,
      subject: "Ответ от поддержки «Тренер»",
      body,
    });
  }

  revalidatePath("/app/admin/support");
  revalidatePath("/app/support");
  return { ok: true };
}

// Called when a student opens their thread, so admin replies stop showing
// as unread once actually seen.
export async function markThreadRead() {
  const session = await auth();
  if (!session?.user?.id) return;
  await prisma.supportMessage.updateMany({
    where: { userId: session.user.id, fromAdmin: true, read: false },
    data: { read: true },
  });
}

// Called when admin opens a student's thread, so that student's messages
// stop showing as unread in the admin thread list.
export async function markAdminViewRead(userId: string) {
  const session = await auth();
  if (!isAdminSession(session)) return;
  await prisma.supportMessage.updateMany({
    where: { userId, fromAdmin: false, read: false },
    data: { read: true },
  });
}
