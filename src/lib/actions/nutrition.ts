"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { generateText, isAiEnabled } from "@/lib/ai";
import { sportLabel } from "@/lib/sports";

export type ActionResult = { ok: true } | { ok: false; error: string };

export async function logNutritionEntry(input: { mealName: string; description: string; kcal: number | null; proteinG: number | null; carbsG: number | null; fatG: number | null }): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "Нужно войти в аккаунт." };
  if (!input.description.trim()) return { ok: false, error: "Опиши, что съел." };

  await prisma.nutritionLog.create({
    data: { userId: session.user.id, mealName: input.mealName || "Приём пищи", description: input.description, kcal: input.kcal, proteinG: input.proteinG, carbsG: input.carbsG, fatG: input.fatG },
  });

  revalidatePath("/app/nutrition");
  return { ok: true };
}

// One-off AI meal suggestion grounded in today's macro targets — not a
// persisted meal plan, just a quick "what should I eat" answer computed
// from the same TDEE/macro numbers shown on the page.
export async function suggestMeals(targets: { kcal: number; proteinG: number; carbsG: number; fatG: number; carbLoad: string }): Promise<{ ok: true; text: string } | { ok: false; error: string }> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "Нужно войти в аккаунт." };
  if (!isAiEnabled()) return { ok: false, error: "ИИ не настроен (нужен GROQ_API_KEY)." };

  const profile = await prisma.athleteProfile.findUnique({ where: { userId: session.user.id } });
  const prompt = `Составь пример меню на сегодня (3-4 приёма пищи) для спортсмена (${profile ? sportLabel(profile.primarySport) : "выносливость"}) под цели: ${targets.kcal} ккал, белки ${targets.proteinG} г, углеводы ${targets.carbsG} г (уровень нагрузки углеводами: ${targets.carbLoad}), жиры ${targets.fatG} г.
Диета: ${profile?.dietType ?? "обычная"}. Аллергии/ограничения: ${profile?.allergies || "нет"}.
Дай конкретные продукты и примерные граммовки по приёмам пищи, коротко объясни таймингом относительно тренировки. Формат: список по приёмам пищи, без вступления.`;

  try {
    const text = await generateText(prompt);
    return { ok: true, text };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Не удалось получить ответ от ИИ." };
  }
}
