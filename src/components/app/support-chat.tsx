"use client";

import { useRef, useState, useTransition } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Send, LifeBuoy, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";

export type SupportChatMessage = {
  id: string;
  fromAdmin: boolean;
  body: string;
  createdAt: string;
};

export function SupportChat({
  messages: initialMessages,
  action,
  hiddenFields,
  placeholder = "Напиши сообщение…",
  emptyText = "Пока пусто — напиши, и мы ответим здесь же.",
  selfIsAdmin = false,
}: {
  messages: SupportChatMessage[];
  action: (formData: FormData) => Promise<{ ok: boolean; error?: string }>;
  hiddenFields?: Record<string, string>;
  placeholder?: string;
  emptyText?: string;
  selfIsAdmin?: boolean;
}) {
  const [messages, setMessages] = useState(initialMessages);
  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const scrollRef = useRef<HTMLDivElement>(null);

  function submit(formData: FormData) {
    const body = (formData.get("message") as string)?.trim();
    if (!body) return;
    setError(null);
    const optimistic: SupportChatMessage = {
      id: `optimistic-${Date.now()}`,
      fromAdmin: selfIsAdmin,
      body,
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimistic]);
    setInput("");
    requestAnimationFrame(() => scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" }));

    startTransition(async () => {
      const result = await action(formData);
      if (!result.ok) {
        setError(result.error || "Не получилось отправить.");
        setMessages((prev) => prev.filter((m) => m.id !== optimistic.id));
        setInput(body);
      }
    });
  }

  return (
    <div className="card-surface flex h-[560px] flex-col overflow-hidden p-0">
      <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto p-5">
        {messages.length === 0 && (
          <div className="flex h-full flex-col items-center justify-center gap-3 text-center text-sm text-(--color-ink-soft)">
            <LifeBuoy className="h-8 w-8 text-(--color-brand-violet)" />
            <p className="max-w-xs">{emptyText}</p>
          </div>
        )}
        <AnimatePresence initial={false}>
          {messages.map((m) => {
            // "Mine" from this viewer's perspective: admin's own messages
            // align right in the admin view, student's own align right
            // in the student view — same field, different frame of
            // reference depending on who's looking at the thread.
            const mine = m.fromAdmin === selfIsAdmin;
            return (
              <motion.div
                key={m.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.22, ease: "easeOut" }}
                className={cn("flex max-w-[85%] flex-col gap-1", mine ? "ml-auto items-end" : "items-start")}
              >
                {!selfIsAdmin && m.fromAdmin && (
                  <span className="flex items-center gap-1 px-1 text-[0.7rem] font-bold text-(--color-brand-violet)">
                    <ShieldCheck className="h-3 w-3" /> Поддержка «Тренер»
                  </span>
                )}
                <div
                  className={cn(
                    "whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-sm leading-relaxed",
                    mine
                      ? "rounded-br-sm btn-gradient text-white"
                      : "rounded-tl-sm bg-(--color-paper-dim) text-(--color-ink)"
                  )}
                >
                  {m.body}
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      {error && (
        <p className="border-t border-black/5 dark:border-white/10 px-5 py-2 text-xs font-semibold text-(--color-brand-pink)">
          {error}
        </p>
      )}

      <form
        action={submit}
        className="flex items-center gap-2 border-t border-black/5 dark:border-white/10 p-4"
      >
        {Object.entries(hiddenFields ?? {}).map(([k, v]) => (
          <input key={k} type="hidden" name={k} value={v} />
        ))}
        <input
          name="message"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={placeholder}
          className="flex-1 rounded-full bg-(--color-paper-dim) px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-(--color-brand-blue)"
        />
        <button
          type="submit"
          disabled={isPending || !input.trim()}
          className="btn-gradient press-spring flex h-10 w-10 shrink-0 items-center justify-center rounded-full disabled:opacity-40"
        >
          <Send className="h-4 w-4" />
        </button>
      </form>
    </div>
  );
}
