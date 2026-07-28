import Link from "next/link";
import { LinkButton } from "@/components/ui/button";
import { Activity } from "lucide-react";

const links = [
  { href: "/#features", label: "Возможности" },
  { href: "/#devices", label: "Устройства" },
  { href: "/#how", label: "Как работает" },
];

export function SiteHeader() {
  return (
    <header className="sticky top-4 z-50 mx-auto w-full max-w-6xl px-4">
      <div className="flex items-center justify-between rounded-full border border-black/5 bg-white/80 px-4 py-2.5 shadow-(--shadow-soft) backdrop-blur-xl sm:px-6">
        <Link href="/" className="flex items-center gap-2 font-display text-lg font-bold">
          <span className="flex h-8 w-8 items-center justify-center rounded-full btn-gradient">
            <Activity className="h-4 w-4" strokeWidth={2.5} />
          </span>
          Тренер
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          {links.map((l) => (
            <Link key={l.href} href={l.href} className="rounded-full px-4 py-2 text-sm font-medium text-(--color-ink-soft) transition-colors hover:bg-black/5 hover:text-(--color-ink)">
              {l.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <LinkButton href="/login" variant="ghost" size="sm" className="hidden sm:inline-flex">Войти</LinkButton>
          <LinkButton href="/login" variant="primary" size="sm">Начать бесплатно</LinkButton>
        </div>
      </div>
    </header>
  );
}
