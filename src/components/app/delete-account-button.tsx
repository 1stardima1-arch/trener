"use client";

import { useState, useTransition } from "react";
import { deleteOwnAccount } from "@/lib/actions/account";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Trash2 } from "lucide-react";

export function DeleteAccountButton({ confirmTarget }: { confirmTarget: string }) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function submit() {
    setError(null);
    startTransition(async () => {
      const result = await deleteOwnAccount(value);
      if (!result.ok) setError(result.error);
    });
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-xs font-semibold text-(--color-brand-pink) hover:underline"
      >
        Удалить аккаунт
      </button>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-xs leading-relaxed text-(--color-ink-soft)">
        Это навсегда удалит аккаунт и все данные: тренировки, показатели сна и
        восстановления, пороги, историю чата с ИИ-тренером, подключённые
        устройства. Отменить нельзя.
      </p>
      <p className="text-xs font-semibold">
        Чтобы подтвердить, введи <span className="text-(--color-brand-pink)">{confirmTarget}</span>:
      </p>
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={confirmTarget}
        className="w-full rounded-full border border-black/10 bg-(--color-paper-dim) px-4 py-2.5 text-sm outline-none focus:border-(--color-brand-pink) dark:border-white/10"
      />
      {error && <p className="text-xs font-semibold text-(--color-brand-pink)">{error}</p>}
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={value !== confirmTarget || isPending}
          onClick={submit}
          className="border-(--color-brand-pink) text-(--color-brand-pink) hover:border-(--color-brand-pink)"
        >
          <Trash2 className="h-3.5 w-3.5" />
          {isPending ? "Удаляю…" : "Удалить безвозвратно"}
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={() => { setOpen(false); setValue(""); setError(null); }}>
          Отмена
        </Button>
      </div>
    </div>
  );
}

export function DeleteAccountCard({ confirmTarget }: { confirmTarget: string }) {
  return (
    <div className="card-surface p-4">
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-(--color-brand-pink)/10 text-(--color-brand-pink)">
          <AlertTriangle className="h-4.5 w-4.5" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-bold">Удаление аккаунта</div>
          <div className="text-xs text-(--color-ink-soft)">Необратимо — весь прогресс будет потерян</div>
        </div>
      </div>
      <div className="mt-3.5 pl-[3.25rem]">
        <DeleteAccountButton confirmTarget={confirmTarget} />
      </div>
    </div>
  );
}
