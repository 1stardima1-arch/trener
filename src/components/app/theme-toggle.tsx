"use client";

import { useSyncExternalStore } from "react";
import { motion } from "framer-motion";
import { Moon, Sun } from "lucide-react";

const STORAGE_KEY = "trener-theme";

// useSyncExternalStore (not useState+useEffect) reads the .dark class
// correctly through hydration without a "flash of the wrong icon" and
// without the setState-in-effect anti-pattern: it's the class the
// pre-hydration inline script (see layout.tsx) already applied, so this
// is just observing it, not owning it.
function subscribe(callback: () => void) {
  const observer = new MutationObserver(callback);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
  return () => observer.disconnect();
}

function getSnapshot() {
  return document.documentElement.classList.contains("dark");
}

function getServerSnapshot() {
  // Matches the inline script in layout.tsx — dark is the default theme.
  return true;
}

export function ThemeToggle() {
  const isDark = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  function toggle() {
    const next = !isDark;
    document.documentElement.classList.toggle("dark", next);
    localStorage.setItem(STORAGE_KEY, next ? "dark" : "light");
  }

  return (
    <button
      onClick={toggle}
      className="liquid-glass press-spring relative flex h-11 w-20 shrink-0 items-center rounded-full px-1"
      aria-label="Переключить тему"
    >
      <motion.span
        className="btn-gradient flex h-9 w-9 items-center justify-center rounded-full"
        animate={{ x: isDark ? 36 : 0 }}
        transition={{ type: "spring", stiffness: 500, damping: 32 }}
      >
        {isDark ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
      </motion.span>
    </button>
  );
}
