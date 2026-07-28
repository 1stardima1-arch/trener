"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { LayoutDashboard, Dumbbell, Users, Grid2x2 } from "lucide-react";

const links = [
  { href: "/app", label: "Дом", icon: LayoutDashboard, exact: true },
  { href: "/app/training", label: "План", icon: Dumbbell },
  { href: "/app/feed", label: "Лента", icon: Users },
  { href: "/app/more", label: "Ещё", icon: Grid2x2 },
];

export function MobileNav({ isAdmin }: { isAdmin?: boolean }) {
  const pathname = usePathname();
  void isAdmin; // admin entry lives inside /app/more now, not the tab bar itself

  return (
    <nav
      className="fixed inset-x-3 z-40 flex items-center justify-between rounded-[1.75rem] border border-white/8 bg-(--color-surface)/95 px-1 py-1.5 backdrop-blur-xl lg:hidden"
      style={
        {
          viewTransitionName: "app-shell-mobilenav",
          bottom: "calc(0.75rem + env(safe-area-inset-bottom))",
        } as React.CSSProperties
      }
    >
      {links.map((l) => {
        const active = l.exact ? pathname === l.href : pathname.startsWith(l.href);
        return (
          <Link key={l.href} href={l.href} className="relative flex flex-1 flex-col items-center">
            {active && (
              <motion.span
                layoutId="mobilenav-active-bubble"
                className="absolute inset-x-2 inset-y-0.5 rounded-2xl bg-white/8"
                transition={{ type: "spring", stiffness: 420, damping: 32 }}
              />
            )}
            <motion.span
              whileTap={{ scale: 0.86 }}
              transition={{ type: "spring", stiffness: 500, damping: 25 }}
              className={cn(
                "relative z-10 flex flex-col items-center gap-0.5 whitespace-nowrap px-0.5 py-2 text-[0.62rem] font-bold transition-colors duration-300",
                active ? "text-white" : "text-(--color-ink-soft)"
              )}
            >
              <l.icon className="h-5 w-5" strokeWidth={2.2} />
              {l.label}
            </motion.span>
          </Link>
        );
      })}
    </nav>
  );
}
