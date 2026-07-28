"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Dumbbell,
  Moon,
  Apple,
  Watch,
  Users,
  Sparkles,
  User,
  ShieldCheck,
} from "lucide-react";

const links = [
  { href: "/app", label: "Дашборд", icon: LayoutDashboard, exact: true },
  { href: "/app/training", label: "Тренировки", icon: Dumbbell },
  { href: "/app/coach", label: "ИИ-тренер", icon: Sparkles },
  { href: "/app/sleep", label: "Сон", icon: Moon },
  { href: "/app/nutrition", label: "Питание", icon: Apple },
  { href: "/app/devices", label: "Устройства", icon: Watch },
  { href: "/app/feed", label: "Лента", icon: Users },
  { href: "/app/profile", label: "Профиль", icon: User },
];

const adminLink = { href: "/app/admin", label: "Админ-панель", icon: ShieldCheck, exact: false };

// motion.create(Link) instead of relying on CSS :active — pointer-event
// driven press feedback is reliable on real touch devices even for a fast
// tap that immediately triggers navigation, unlike :active which mobile
// browsers frequently skip in that exact situation.
const MotionLink = motion.create(Link);

export function NavLinks({ onNavigate, isAdmin }: { onNavigate?: () => void; isAdmin?: boolean }) {
  const pathname = usePathname();
  const items = isAdmin ? [adminLink, ...links] : links;

  return (
    <nav className="flex flex-col gap-1">
      {items.map((l) => {
        const active = l.exact ? pathname === l.href : pathname.startsWith(l.href);
        return (
          <MotionLink
            key={l.href}
            href={l.href}
            onClick={onNavigate}
            whileTap={{ scale: 0.97 }}
            transition={{ type: "spring", stiffness: 500, damping: 28 }}
            className={cn(
              "relative flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-semibold transition-colors duration-300",
              active ? "text-white" : "text-(--color-ink-soft) hover:bg-white/5 hover:text-(--color-ink)"
            )}
          >
            {active && (
              <motion.span
                layoutId="sidebar-active-pill"
                className="absolute inset-0 rounded-2xl bg-white/10"
                transition={{ type: "spring", stiffness: 420, damping: 34 }}
              />
            )}
            <l.icon className="relative z-10 h-4.5 w-4.5" strokeWidth={2.2} />
            <span className="relative z-10">{l.label}</span>
          </MotionLink>
        );
      })}
    </nav>
  );
}
