import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { isAdminSession } from "@/lib/admin";
import { getAdminOverview } from "@/lib/admin-stats";
import { AnimatedBar } from "@/components/motion/animated-bar";
import { Users, UserCheck, Flame, CalendarRange, LifeBuoy, ArrowRight, TrendingDown } from "lucide-react";

export default async function AdminOverviewPage() {
  const session = await auth();
  if (!isAdminSession(session)) notFound();

  const stats = await getAdminOverview();
  const maxSignup = Math.max(1, ...stats.signupTrend.map((d) => d.count));

  return (
    <div>
      <h1 className="font-display text-2xl font-extrabold sm:text-3xl">Админ-панель</h1>
      <p className="mt-1 text-(--color-ink-soft)">Статистика приложения и обращения пользователей.</p>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="card-surface p-5">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-(--color-brand-blue)/12">
            <Users className="h-4.5 w-4.5 text-(--color-brand-blue)" />
          </span>
          <div className="mt-3 text-xs font-bold uppercase tracking-wide text-(--color-ink-soft)">Всего пользователей</div>
          <div className="font-display mt-1 text-3xl font-extrabold">{stats.totalUsers}</div>
        </div>
        <div className="card-surface p-5">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-(--color-brand-green)/12">
            <UserCheck className="h-4.5 w-4.5 text-(--color-brand-green)" />
          </span>
          <div className="mt-3 text-xs font-bold uppercase tracking-wide text-(--color-ink-soft)">Прошли настройку</div>
          <div className="font-display mt-1 text-3xl font-extrabold">{stats.onboardedUsers}</div>
        </div>
        <div className="card-surface p-5">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-(--color-brand-amber)/12">
            <Flame className="h-4.5 w-4.5 text-(--color-brand-amber)" />
          </span>
          <div className="mt-3 text-xs font-bold uppercase tracking-wide text-(--color-ink-soft)">Активны за 7 дней</div>
          <div className="font-display mt-1 text-3xl font-extrabold">{stats.active7d}</div>
        </div>
        <div className="card-surface p-5">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-(--color-brand-violet)/12">
            <CalendarRange className="h-4.5 w-4.5 text-(--color-brand-violet)" />
          </span>
          <div className="mt-3 text-xs font-bold uppercase tracking-wide text-(--color-ink-soft)">Активны за 30 дней</div>
          <div className="font-display mt-1 text-3xl font-extrabold">{stats.active30d}</div>
        </div>
      </div>

      <Link
        href="/app/admin/support"
        className="mt-6 flex items-center justify-between gap-4 rounded-[1.75rem] p-6 text-white shadow-(--shadow-glow) transition-transform hover:-translate-y-0.5"
        style={{ background: "linear-gradient(135deg, #4f6bff, #8b5cf6)" }}
      >
        <div className="flex items-center gap-4">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/20">
            <LifeBuoy className="h-6 w-6" />
          </span>
          <div>
            <div className="text-xs font-bold uppercase tracking-wide text-white/80">Поддержка</div>
            <div className="font-display text-lg font-bold">
              {stats.unreadMessages > 0
                ? `${stats.unreadMessages} новых сообщений в ${stats.unreadThreads} обращениях`
                : "Нет новых обращений"}
            </div>
          </div>
        </div>
        <ArrowRight className="h-5 w-5 shrink-0" />
      </Link>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <div>
          <div className="mb-3 flex items-center gap-2">
            <TrendingDown className="h-4 w-4 text-(--color-ink-soft)" />
            <h2 className="text-sm font-bold uppercase tracking-wide text-(--color-ink-soft)">
              Воронка: на каком этапе уходят
            </h2>
          </div>
          <div className="card-surface space-y-4 p-5">
            {stats.funnel.map((stage) => (
              <div key={stage.key}>
                <div className="flex items-center justify-between text-sm">
                  <span className="font-semibold">{stage.label}</span>
                  <span className="text-(--color-ink-soft)">
                    {stage.count} · {stage.percentOfTotal}%
                    {stage.droppedFromPrev > 0 && (
                      <span className="ml-2 font-semibold text-(--color-brand-pink)">−{stage.droppedFromPrev}</span>
                    )}
                  </span>
                </div>
                <AnimatedBar percent={stage.percentOfTotal} className="btn-gradient" trackClassName="mt-1.5" />
              </div>
            ))}
          </div>
        </div>

        <div>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-bold uppercase tracking-wide text-(--color-ink-soft)">Регистрации за 14 дней</h2>
          </div>
          <div className="card-surface flex h-full items-end gap-1.5 p-5">
            {stats.signupTrend.map((d) => (
              <div key={d.date} className="flex flex-1 flex-col items-center gap-1.5">
                <div
                  className="w-full min-h-[3px] rounded-t-md bg-(--color-brand-blue)"
                  style={{ height: `${Math.max(3, Math.round((d.count / maxSignup) * 120))}px` }}
                  title={`${d.label}: ${d.count}`}
                />
                <span className="text-[0.6rem] font-semibold text-(--color-ink-soft)">{d.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
