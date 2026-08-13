import { NextRequest } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { isAiEnabled, streamCoachReply, describeAiError, type ChatMessage } from "@/lib/ai";
import { sportLabel } from "@/lib/sports";

// Builds the "current data" context every coach reply is grounded in —
// today's recovery/sleep/strain, current thresholds, and today's plan item
// — so the model reasons from the athlete's own numbers, not generically.
async function buildContextSnapshot(userId: string) {
  const today = new Date().toISOString().slice(0, 10);
  const [profile, metric, snapshot, planItem] = await Promise.all([
    prisma.athleteProfile.findUnique({ where: { userId } }),
    prisma.dailyMetric.findUnique({ where: { userId_date: { userId, date: new Date(today) } } }),
    prisma.thresholdSnapshot.findFirst({ where: { userId }, orderBy: { computedAt: "desc" } }),
    prisma.planItem.findFirst({ where: { userId, date: new Date(today) } }),
  ]);

  const biomarkers = profile
    ? {
        ферритин: profile.ferritinNgMl, витамин_D: profile.vitaminDNgMl,
        тестостерон: profile.testosteroneNgDl, глюкоза_натощак: profile.restingGlucoseMgDl,
        давление: profile.bloodPressureSystolic && profile.bloodPressureDiastolic ? `${profile.bloodPressureSystolic}/${profile.bloodPressureDiastolic}` : null,
        заметки: profile.biomarkerNotes,
      }
    : null;
  const hasBiomarkers = biomarkers && Object.values(biomarkers).some((v) => v != null);

  return {
    вид_спорта: profile ? sportLabel(profile.primarySport) : null,
    цель: profile?.goalType,
    готовность_сегодня: metric?.recoveryScore != null ? `${metric.recoveryScore}/100` : "нет данных",
    нагрузка_вчера_сегодня: metric?.strain,
    сон_часов: metric?.sleepDurationSec ? Math.round((metric.sleepDurationSec / 3600) * 10) / 10 : null,
    самочувствие_энергия: metric?.subjectiveEnergy != null ? `${metric.subjectiveEnergy}/5` : null,
    самочувствие_мышечная_усталость: metric?.subjectiveSoreness != null ? `${metric.subjectiveSoreness}/5` : null,
    самочувствие_стресс: metric?.subjectiveStress != null ? `${metric.subjectiveStress}/5` : null,
    самочувствие_заметка: metric?.subjectiveNote ?? null,
    порог_ЧСС: snapshot?.lthrBpm,
    vo2max: snapshot?.vo2max,
    биохимия: hasBiomarkers ? biomarkers : undefined,
    план_на_сегодня: planItem ? { название: planItem.title, тип: planItem.targetType, причина: planItem.adjustReason ?? planItem.explanation } : null,
  };
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return new Response("Unauthorized", { status: 401 });
  const userId = session.user.id;

  const { message } = (await req.json()) as { message: string };
  if (!message?.trim()) return new Response("Message is required", { status: 400 });

  const contextSnapshot = await buildContextSnapshot(userId);

  await prisma.coachMessage.create({ data: { userId, role: "user", content: message } });

  const recent = await prisma.coachMessage.findMany({ where: { userId }, orderBy: { createdAt: "asc" }, take: 20 });
  const history: ChatMessage[] = recent.map((m) => ({ role: m.role === "assistant" ? "assistant" : "user", content: m.content }));

  const encoder = new TextEncoder();

  if (!isAiEnabled()) {
    const fallback = "ИИ-тренер пока не настроен: добавь GEMINI_API_KEY (aistudio.google.com/app/apikey) или GROQ_API_KEY (console.groq.com/keys) в .env — см. README.";
    await prisma.coachMessage.create({ data: { userId, role: "assistant", content: fallback, contextJson: contextSnapshot } });
    return new Response(fallback, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
  }

  const stream = new ReadableStream({
    async start(controller) {
      let full = "";
      try {
        for await (const chunk of streamCoachReply(history, contextSnapshot)) {
          full += chunk;
          controller.enqueue(encoder.encode(chunk));
        }
      } catch (err) {
        const msg = describeAiError(err);
        controller.enqueue(encoder.encode(msg));
        full = msg;
        console.error("AI stream error", err);
      } finally {
        await prisma.coachMessage.create({ data: { userId, role: "assistant", content: full, contextJson: contextSnapshot } });
        controller.close();
      }
    },
  });

  return new Response(stream, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
}
