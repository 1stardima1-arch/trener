import Link from "next/link";
import { Activity } from "lucide-react";
import { Container } from "@/components/ui/card";

export function SiteFooter() {
  return (
    <footer className="mt-24 border-t border-black/5 py-12">
      <Container className="flex flex-col items-start justify-between gap-8 sm:flex-row">
        <div>
          <div className="flex items-center gap-2 font-display text-lg font-bold">
            <span className="flex h-8 w-8 items-center justify-center rounded-full btn-gradient">
              <Activity className="h-4 w-4" strokeWidth={2.5} />
            </span>
            Тренер
          </div>
          <p className="mt-3 max-w-xs text-sm text-(--color-ink-soft)">
            ИИ-тренер для эндуранс- и силовых атлетов: готовность, тренировки, сон и питание
            под твои реальные данные.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-10 sm:grid-cols-3">
          <div>
            <div className="mb-3 text-sm font-semibold">Продукт</div>
            <ul className="space-y-2 text-sm text-(--color-ink-soft)">
              <li><Link href="/#features" className="hover:text-(--color-ink)">Возможности</Link></li>
              <li><Link href="/#devices" className="hover:text-(--color-ink)">Устройства</Link></li>
              <li><Link href="/#how" className="hover:text-(--color-ink)">Как работает</Link></li>
            </ul>
          </div>
          <div>
            <div className="mb-3 text-sm font-semibold">Аккаунт</div>
            <ul className="space-y-2 text-sm text-(--color-ink-soft)">
              <li><Link href="/login" className="hover:text-(--color-ink)">Войти</Link></li>
              <li><Link href="/login" className="hover:text-(--color-ink)">Регистрация</Link></li>
            </ul>
          </div>
        </div>
      </Container>

      <Container className="mt-10 flex flex-col gap-2 border-t border-black/5 pt-6 text-xs text-(--color-ink-soft) sm:flex-row sm:items-center sm:justify-between">
        <span>© {new Date().getFullYear()} Тренер. Все права защищены.</span>
        <span>Не заменяет консультацию врача — при травмах и симптомах болезни обратись к специалисту.</span>
      </Container>
    </footer>
  );
}
