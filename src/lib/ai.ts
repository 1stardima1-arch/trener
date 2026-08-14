import Groq from "groq-sdk";
import { GoogleGenerativeAI } from "@google/generative-ai";

const GROQ_MODEL = process.env.GROQ_MODEL || "llama-3.3-70b-versatile";
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.0-flash";

// Groq is primary — that's the key actually configured and working.
// Gemini stays available as a fallback if GROQ_API_KEY isn't set. Never
// both at once: one provider serves any given request, chosen once per
// call from whichever key is present.
type Provider = "gemini" | "groq";

function activeProvider(): Provider | null {
  if (process.env.GROQ_API_KEY) return "groq";
  if (process.env.GEMINI_API_KEY) return "gemini";
  return null;
}

export function isAiEnabled() {
  return activeProvider() !== null;
}

// Surfaced in the UI (see "Слово тренера" on the dashboard) so it's never
// ambiguous whether a real model produced the text on screen or it's the
// deterministic fallback sentence — "is the AI actually running" shouldn't
// require reading server logs to answer.
export function activeAiProviderLabel(): string | null {
  const provider = activeProvider();
  if (provider === "gemini") return "Gemini";
  if (provider === "groq") return "Groq";
  return null;
}

let groqClient: Groq | null = null;
function getGroqClient() {
  if (!process.env.GROQ_API_KEY) throw new Error("GROQ_API_KEY не задан.");
  if (!groqClient) groqClient = new Groq({ apiKey: process.env.GROQ_API_KEY });
  return groqClient;
}

let geminiClient: GoogleGenerativeAI | null = null;
function getGeminiClient() {
  if (!process.env.GEMINI_API_KEY) throw new Error("GEMINI_API_KEY не задан.");
  if (!geminiClient) geminiClient = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  return geminiClient;
}

// Every reply is grounded in a live snapshot of the athlete's own numbers
// (see contextBlock below) — the persona is explicitly instructed to reason
// FROM those numbers rather than give generic advice, and to say when it
// doesn't have enough data instead of guessing.
export const COACH_SYSTEM_PROMPT = `Ты — ИИ-тренер в приложении для эндуранс- и силовых атлетов: одновременно тренер по физической подготовке, спортивный нутрициолог, спортивный психолог и специалист по биомеханике.

Область твоей экспертизы — вся спортивная наука, а не только цифры из дашборда:
- Физиология нагрузки: аэробный и анаэробный пороги, лактатная кривая, VO2max, зоны по ЧСС/темпу/мощности (Friel, Coggan), TRIMP, CTL/ATL/TSB, ACWR — умеешь объяснить, что это, как считается и что значит именно для этого атлета.
- Периодизация: базовый/специальный/соревновательный периоды, поляризованная 80/20 модель, разгрузочные недели, тейпер перед стартом.
- Питание: углеводная периодизация под объём нагрузки, белок для восстановления, гидратация и электролиты, питание до/во время/после длинных тренировок и гонок, спортивное питание (гели, изотоники) и обычный рацион.
- Экипировка и техника под вид спорта — от выбора кроссовок под тип старта (шоссе/трейл/скорость против амортизации) и ротации обуви, до базовых принципов техники бега/плавания/велоезды, когда атлет спрашивает.
- Не знаешь ответа — так и скажи, не выдумывай цифры и факты.

Твой стиль:
- Пиши по-русски, тепло, но по делу — как опытный тренер, а не как чат-бот. Короткие абзацы, без воды.
- ВСЕГДА опирайся на конкретные цифры атлета из контекста (восстановление, ВСР, пульс покоя, сон, пороги, тренировочная нагрузка, план, самочувствие) — не давай общих советов "в вакууме". Если данных не хватает для точного ответа — так и скажи, и объясни, каких данных не хватает.
- Когда объясняешь решение (план тренировки, оценку восстановления, зоны) — раскладывай логику по шагам: какие входные данные, какое правило/формула, какой вывод. Атлет должен понимать "почему", а не просто получить ответ.
- Не выдумывай медицинские диагнозы и не заменяй врача — при признаках травмы или болезни советуй обратиться к специалисту.
- Учитывай не только тело, но и психологическое состояние: мотивацию, стресс, выгорание — если атлет упоминает это (в чате или в дневном самоотчёте), отнесись серьёзно и по-человечески.
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

async function* streamGroq(systemPrompt: string, history: ChatMessage[]) {
  const groq = getGroqClient();
  const messages: Groq.Chat.Completions.ChatCompletionMessageParam[] = [{ role: "system", content: systemPrompt }, ...history];
  const stream = await groq.chat.completions.create({ model: GROQ_MODEL, messages, temperature: 0.6, stream: true });
  for await (const chunk of stream) {
    const text = chunk.choices[0]?.delta?.content;
    if (text) yield text;
  }
}

async function* streamGemini(systemPrompt: string, history: ChatMessage[]) {
  const genAI = getGeminiClient();
  const model = genAI.getGenerativeModel({ model: GEMINI_MODEL, systemInstruction: systemPrompt });
  // Gemini's chat history is separate from the message being sent, and uses
  // "model" (not "assistant") for the AI's turns.
  const priorTurns = history.slice(0, -1).map((m) => ({ role: m.role === "assistant" ? "model" : "user", parts: [{ text: m.content }] }));
  const last = history.at(-1);
  const chat = model.startChat({ history: priorTurns });
  const result = await chat.sendMessageStream(last?.content ?? "");
  for await (const chunk of result.stream) {
    const text = chunk.text();
    if (text) yield text;
  }
}

export async function* streamCoachReply(history: ChatMessage[], contextSnapshot?: Record<string, unknown>) {
  const provider = activeProvider();
  if (!provider) throw new Error("Ни GEMINI_API_KEY, ни GROQ_API_KEY не заданы.");
  const systemPrompt = COACH_SYSTEM_PROMPT + (contextSnapshot ? `\n\n${buildCoachContext(contextSnapshot)}` : "");
  yield* provider === "gemini" ? streamGemini(systemPrompt, history) : streamGroq(systemPrompt, history);
}

export async function generateText(prompt: string, systemInstruction?: string) {
  const provider = activeProvider();
  if (!provider) throw new Error("Ни GEMINI_API_KEY, ни GROQ_API_KEY не заданы.");
  const system = systemInstruction ?? COACH_SYSTEM_PROMPT;

  if (provider === "gemini") {
    const genAI = getGeminiClient();
    const model = genAI.getGenerativeModel({ model: GEMINI_MODEL, systemInstruction: system });
    const result = await model.generateContent(prompt);
    return result.response.text();
  }

  const groq = getGroqClient();
  const res = await groq.chat.completions.create({
    model: GROQ_MODEL,
    messages: [{ role: "system", content: system }, { role: "user", content: prompt }],
    temperature: 0.5,
  });
  return res.choices[0]?.message?.content ?? "";
}

// Provider-agnostic error → user-facing message, for the streaming chat
// route (which can't just let a raw SDK error reach the client).
export function describeAiError(err: unknown): string {
  if (err instanceof Groq.APIError) {
    if (err.status === 401) return "Ключ GROQ_API_KEY недействителен. Проверь его в .env / Vercel и сделай redeploy.";
    if (err.status === 404) return `Groq не нашёл модель "${GROQ_MODEL}" — проверь GROQ_MODEL.`;
    if (err.status === 429) return "Groq вернул 429 — превышен лимит бесплатного тарифа. Попробуй через минуту.";
    return `Groq вернул ошибку ${err.status ?? ""}: ${err.message}`;
  }
  const message = err instanceof Error ? err.message : String(err);
  if (/API key not valid|API_KEY_INVALID/i.test(message)) return "Ключ GEMINI_API_KEY недействителен. Проверь его в .env / Vercel и сделай redeploy.";
  if (/quota|rate limit|429/i.test(message)) return "Gemini вернул ошибку лимита запросов. Попробуй через минуту.";
  if (message) return `Ошибка ИИ: ${message}`;
  return "Не получилось получить ответ от ИИ. Попробуй ещё раз через минуту.";
}

// Turns a deterministic, rule-based explanation (from plan-engine.ts /
// recovery.ts — always computed first, always the source of truth) into a
// warmer, more personal couple of sentences for the Insight feed. If no AI
// provider is configured, the deterministic reason is used as-is — the
// "why" is never solely dependent on the LLM being available.
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

// The proactive "Coach's Take" shown at the top of the dashboard every
// morning — unlike narrateInsight (which explains one specific change),
// this synthesizes the whole day's picture (readiness + sleep + plan +
// self-reported wellness + any anomaly flags) into one short, personal
// briefing, generated once and cached (see engine.ts ensureDailyBriefing).
// Falls back to a plain deterministic sentence if no AI provider is
// configured — the dashboard always has *something* here, never a blank
// space waiting on the LLM.
export async function generateDailyBriefing(context: Record<string, unknown>): Promise<string> {
  const fallback = `Готовность: ${context["готовность"] ?? "нет данных"}. План на сегодня: ${
    (context["план"] as { название?: string } | undefined)?.название ?? "отдых"
  }.`;
  if (!isAiEnabled()) return fallback;
  try {
    const prompt = `Ты пишешь атлету персональный утренний разбор — он не должен ничего спрашивать в чате, чтобы это получить, поэтому раскрой все три части подробно (5-9 предложений связным текстом, не списком):

1. Состояние — что говорят цифры (готовность, ВСР, пульс покоя, сон, тренировочная нагрузка) и что из этого следует лично для него сегодня. Если есть самоотчёт о самочувствии (энергия/усталость/стресс) — обязательно свяжи его с объективными цифрами: совпадают они или расходятся, и что это значит.
2. Тренировка на сегодня — что запланировано и ПОЧЕМУ именно так, опираясь на состояние выше (не просто "план: интервалы", а как из готовности и нагрузки следует именно эта тренировка).
3. Что делать/на что обратить внимание — конкретный совет на сегодня (интенсивность, питание, сон вечером), не общие фразы.

Не выдумывай цифр сверх приведённых — если каких-то данных нет, так и скажи, не заполняй пробелы догадками.

${buildCoachContext(context)}

Если есть тревожные флаги (риск болезни/перетренированности) или самоотчёт указывает на высокую усталость/стресс — начни именно с этого, мягко, но ясно. Если всё хорошо — можно быть чуть более воодушевляющим. Пиши связным текстом от первого лица тренера, без заголовков и списков.`;
    const text = await generateText(prompt);
    return text.trim() || fallback;
  } catch {
    return fallback;
  }
}

// Coach-chat-specific "explain this decision" helper — used by the
// "Почему?" button next to any plan item / recovery score / threshold.
export async function explainDecision(params: { question: string; contextSnapshot: Record<string, unknown> }): Promise<string> {
  if (!isAiEnabled()) {
    return "ИИ-объяснение недоступно (не задан GEMINI_API_KEY или GROQ_API_KEY), но вот исходные данные решения:\n\n" + buildCoachContext(params.contextSnapshot);
  }
  const prompt = `Атлет спрашивает: "${params.question}"\n\n${buildCoachContext(params.contextSnapshot)}\n\nОтветь, опираясь строго на эти данные — объясни логику решения по шагам.`;
  return generateText(prompt);
}
