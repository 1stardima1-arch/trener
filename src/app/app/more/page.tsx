import Link from "next/link";
import { auth } from "@/auth";
import { isAdminSession } from "@/lib/admin";
import { Moon, Apple, Watch, Sparkles, User, LifeBuoy, ShieldCheck, ArrowRight, Activity } from "lucide-react";

const ITEMS = [
  { href: "/app/coach", label: "ИИ-тренер", desc: "Спроси о готовности, плане, питании", icon: Sparkles, color: "var(--color-brand-violet)" },
  { href: "/app/health", label: "Health Monitor", desc: "ВСР, пульс, сон, дыхание, давление", icon: Activity, color: "var(--color-brand-pink)" },
  { href: "/app/sleep", label: "Сон", desc: "История сна, долг сна, ручная запись", icon: Moon, color: "var(--color-brand-blue)" },
  { href: "/app/nutrition", label: "Питание", desc: "Норма калорий и БЖУ на сегодня", icon: Apple, color: "var(--color-brand-green)" },
  { href: "/app/devices", label: "Устройства", desc: "Garmin, Polar, Athyx, .fit-файлы", icon: Watch, color: "var(--color-brand-amber)" },
  { href: "/app/profile", label: "Профиль", desc: "Данные, цели, пороги, настройки", icon: User, color: "var(--color-brand-pink)" },
  { href: "/app/support", label: "Поддержка", desc: "Вопрос или проблема — напиши нам", icon: LifeBuoy, color: "var(--color-ink-soft)" },
];

export default async function MorePage() {
  const session = await auth();
  const isAdmin = isAdminSession(session);

  return (
    <div>
      <h1 className="font-display text-2xl font-extrabold sm:text-3xl">Ещё</h1>
      <div className="mt-6 space-y-2.5">
        {ITEMS.map((i) => (
          <Link key={i.href} href={i.href} className="card-surface press-spring flex items-center gap-3 p-4">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full" style={{ background: `${i.color}1a`, color: i.color }}>
              <i.icon className="h-4.5 w-4.5" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-bold">{i.label}</div>
              <div className="text-xs text-(--color-ink-soft)">{i.desc}</div>
            </div>
            <ArrowRight className="h-4 w-4 shrink-0 text-(--color-ink-soft)" />
          </Link>
        ))}
        {isAdmin && (
          <Link href="/app/admin" className="card-surface press-spring flex items-center gap-3 p-4">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-(--color-brand-violet)/10 text-(--color-brand-violet)">
              <ShieldCheck className="h-4.5 w-4.5" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-bold">Админ-панель</div>
              <div className="text-xs text-(--color-ink-soft)">Статистика и обращения</div>
            </div>
            <ArrowRight className="h-4 w-4 shrink-0 text-(--color-ink-soft)" />
          </Link>
        )}
      </div>
    </div>
  );
}
