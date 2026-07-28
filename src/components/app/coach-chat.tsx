"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { User, Send } from "lucide-react";
import { cn } from "@/lib/utils";

type Message = { role: "user" | "assistant"; content: string };

export function CoachChat({ initialMessages = [], autoStartMessage }: { initialMessages?: Message[]; autoStartMessage?: string }) {
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [input, setInput] = useState("");
  const [isPending, startTransition] = useTransition();
  const scrollRef = useRef<HTMLDivElement>(null);
  const autoStarted = useRef(false);

  function scrollToBottom() {
    requestAnimationFrame(() => scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" }));
  }

  async function send(text: string) {
    if (!text.trim() || isPending) return;
    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: text }, { role: "assistant", content: "" }]);
    scrollToBottom();

    startTransition(async () => {
      try {
        const res = await fetch("/api/coach/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message: text }) });
        if (!res.body) throw new Error("no body");
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let acc = "";
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          acc += decoder.decode(value, { stream: true });
          setMessages((prev) => { const next = [...prev]; next[next.length - 1] = { role: "assistant", content: acc }; return next; });
          scrollToBottom();
        }
      } catch {
        setMessages((prev) => { const next = [...prev]; next[next.length - 1] = { role: "assistant", content: "Не получилось связаться с ИИ. Проверь соединение и попробуй снова." }; return next; });
      }
    });
  }

  useEffect(() => {
    if (autoStartMessage && messages.length === 0 && !autoStarted.current) {
      autoStarted.current = true;
      send(autoStartMessage);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoStartMessage]);

  const thinking = isPending && messages[messages.length - 1]?.content === "";
  const suggestions = ["Почему сегодня такая тренировка?", "Как улучшить восстановление?", "Что есть перед длинной тренировкой?"];

  return (
    <div className="siri-panel flex h-[640px] flex-col overflow-hidden p-0">
      <div className="relative z-10 flex items-center gap-3 border-b border-white/10 px-5 py-4">
        <span className={cn("siri-orb h-9 w-9", thinking && "is-thinking")} />
        <div>
          <div className="text-sm font-bold text-white">ИИ-тренер</div>
          <div className="text-xs text-white/50">тренер · нутрициолог · психолог</div>
        </div>
      </div>

      <div ref={scrollRef} className="scrollbar-thin relative z-10 flex-1 space-y-4 overflow-y-auto p-5">
        {messages.length === 0 && (
          <div className="flex h-full flex-col items-center justify-center gap-4 text-center text-sm text-white/60">
            <span className="siri-orb h-16 w-16" />
            <p className="font-display text-lg font-bold text-white">Чем помочь?</p>
            <p className="max-w-xs text-white/55">Объясню любое решение — план, восстановление, зоны, питание — опираясь на твои реальные данные.</p>
            <div className="flex flex-wrap justify-center gap-2 pt-1">
              {suggestions.map((s) => (
                <button key={s} onClick={() => send(s)} className="siri-chip rounded-full px-3 py-1.5 text-xs font-semibold">{s}</button>
              ))}
            </div>
          </div>
        )}

        <AnimatePresence initial={false}>
          {messages.map((m, i) => (
            <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25, ease: "easeOut" }} className={cn("flex max-w-[90%] items-start gap-2", m.role === "user" ? "ml-auto flex-row-reverse" : "")}>
              {m.role === "assistant" && <span className={cn("siri-orb mt-1 h-6 w-6 shrink-0", thinking && i === messages.length - 1 && "is-thinking")} />}
              {m.role === "user" && <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/10"><User className="h-3.5 w-3.5 text-white" /></span>}
              <div className={cn("whitespace-pre-wrap rounded-2xl px-4 py-3 text-sm leading-relaxed", m.role === "user" ? "siri-bubble-user rounded-br-sm" : "siri-bubble-ai rounded-tl-sm")}>
                {m.content || (thinking && i === messages.length - 1 ? <span className="siri-thinking flex items-center gap-1 py-1"><span /><span /><span /></span> : "")}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      <form onSubmit={(e) => { e.preventDefault(); send(input); }} className="relative z-10 flex items-center gap-2 border-t border-white/10 p-4">
        <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Спроси тренера о чём угодно…" className="siri-input flex-1 rounded-full px-4 py-2.5 text-sm" />
        <button type="submit" disabled={isPending || !input.trim()} className="press-spring flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#ff5f9e] via-[#b06bff] to-[#5a8dff] text-white shadow-[0_6px_20px_rgba(176,107,255,0.45)] disabled:opacity-40">
          <Send className="h-4 w-4" />
        </button>
      </form>
    </div>
  );
}
