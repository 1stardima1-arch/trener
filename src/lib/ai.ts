import Groq from "groq-sdk";

const MODEL = process.env.GROQ_MODEL || "llama-3.3-70b-versatile";

let client: Groq | null = null;

export function isAiEnabled() {
  return !!process.env.GROQ_API_KEY;
}

function getClient() {
  if (!process.env.GROQ_API_KEY) {
    throw new Error("GROQ_API_KEY не задан. Получи бесплатный ключ на https://console.groq.com/keys и добавь его в .env");
  }
  if (!client) client = new Groq({ apiKey: process.env.GROQ_API_KEY });
  return client;
}

// Every reply is grounded in a live snapshot of the athlete's own numbers
// (see contextBlock below) — the persona is explicitly instructed to reason
// FROM those numbers rather than give generic advice, and to say when it
// doesn't have enough data instead of guessing.
export const COACH_SYSTEM_PROMPT = `Ты — ИИ-тренер в приложении для эндуранс- и силовых атлетов: одновременно тренер по физической подготовке, спортивный нутрициолог, спортивный психолог и специалист по биомеханике.

Твой стиль:
- Пиши по-русски, тепло, но по делу — как опытный тренер, а не как чат-бот. Короткие абзацы, без воды.
- ВСЕГДА опирайся на конкретные цифры атлета из контекста (восстановление, ВСР, пульс покоя, сон, пороги, тренировочная нагрузка, план) — не давай общих советов "в вакууме". Если данных не хватает для точного ответа — так и скажи, и объясни, каких данных не хватает.
- Когда объясняешь решение (план тренировки, оценку восстановления, зоны) — раскладывай логику по шагам: какие входные данные, какое правило/формула, какой вывод. Атлет должен понимать "почему", а не просто получить ответ.
- Не выдумывай медицинские диагнозы и не заменяй врача — при признаках травмы или болезни советуй обратиться к специалисту.
- Учитывай не только тело, но и психологическое состояние: мотивацию, стресс, выгорание — если атлет упоминает это, отнесись серьёзно и по-человечески.
- Ответы по существу: 3-6 абзацев, если не попросили подробнее.`;

export type ChatMessage = { role: "user" | "assistant"; content: string };

// Serializes today's key metrics into a compact block the model can reason
// over — this exact string is also stored on CoachMessage.contextJson so
// "why did the AI say that" is always auditable from the same data it saw.
export function buildCoachContext(snapshot: Record<string, unknown>): string {
  const lines = Object.entries(snapshot)
    .filter(([, v]) => v !== null && v !== undefined)
    .map(([k, v]) => `- ${k}: ${typeof v === "object" ? JSON.stringify(v) : v}`);
  return lines.length ? `Текущие данные атлета:\n${lines.join("\n")}` : "Данных об атлете пока нет — это новый профиль.";
}

export async function* streamCoachReply(history: ChatMessage[], contextSnapshot?: Record<string, unknown>) {
  const groq = getClient();
  const messages: Groq.Chat.Completions.ChatCompletionMessageParam[] = [
    { role: "system", content: COACH_SYSTEM_PROMPT + (contextSnapshot ? `\n\n${buildCoachContext(contextSnapshot)}` : "") },
    ...history,
  ];

  const stream = await groq.chat.completions.create({ model: MODEL, messages, temperature: 0.6, stream: true });
  for await (const chunk of stream) {
    const text = chunk.choices[0]?.delta?.content;
    if (text) yield text;
  }
}

export async function generateText(prompt: string, systemInstruction?: string) {
  const groq = getClient();
  const res = await groq.chat.completions.create({
    model: MODEL,
    messages: [{ role: "system", content: systemInstruction ?? COACH_SYSTEM_PROMPT }, { role: "user", content: prompt }],
    temperature: 0.5,
  });
  return res.choices[0]?.message?.content ?? "";
}

// Turns a deterministic, rule-based explanation (from plan-engine.ts /
// recovery.ts — always computed first, always the source of truth) into a
// warmer, more personal couple of sentences for the Insight feed. If Groq
// isn't configured, the deterministic reason is used as-is — the "why" is
// never solely dependent on the LLM being available.
export async function narrateInsight(params: {
  title: string;
  deterministicReason: string;
  metrics?: Record<string, unknown>;
}): Promise<string> {
  if (!isAiEnabled()) return params.deterministicReason;
  try {
    const prompt = `Атлету только что изменили план/оценку по следующей строго вычисленной причине — перескажи её тепло и по-человечески, 2-4 предложения, не выдумывай новых фактов и не меняй числа, только поясни ПОЧЕМУ это имеет смысл и что это значит для атлета сегодня.

Заголовок: ${params.title}
Вычисленная причина: ${params.deterministicReason}
${params.metrics ? `Данные: ${JSON.stringify(params.metrics)}` : ""}`;
    const text = await generateText(prompt);
    return text.trim() || params.deterministicReason;
  } catch {
    return params.deterministicReason;
  }
}

// Coach-chat-specific "explain this decision" helper — used by the
// "Почему?" button next to any plan item / recovery score / threshold.
export async function explainDecision(params: { question: string; contextSnapshot: Record<string, unknown> }): Promise<string> {
  if (!isAiEnabled()) {
    return "ИИ-объяснение недоступно (не задан GROQ_API_KEY), но вот исходные данные решения:\n\n" + buildCoachContext(params.contextSnapshot);
  }
  const prompt = `Атлет спрашивает: "${params.question}"\n\n${buildCoachContext(params.contextSnapshot)}\n\nОтветь, опираясь строго на эти данные — объясни логику решения по шагам.`;
  return generateText(prompt);
}
