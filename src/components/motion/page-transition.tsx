"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import type { ReactNode } from "react";

const ENTRY_FLAG = "trener-app-entered";

// Route content crossfades via framer-motion rather than React's native
// <ViewTransition> (the browser View Transitions API) — that API is still
// experimental and its GPU-compositing behavior varies a lot across real
// Android devices/Chrome versions in ways impossible to catch from this
// sandbox's desktop testing; it showed up as a visible rendering glitch on
// a real phone. framer-motion is a well-established library with none of
// that risk, at the cost of a slightly less "native" crossfade.
// The Siri rainbow edge glow plays only on the first entry into the app this
// session and whenever the AI assistant tab is opened (it's the "AI moment",
// not an every-page effect).
export function PageTransition({ children, glow = "auto" }: { children: ReactNode; glow?: "auto" | "never" }) {
  const reduceMotion = useReducedMotion();
  const pathname = usePathname();
  const [showGlow, setShowGlow] = useState(false);

  useEffect(() => {
    if (glow === "never" || reduceMotion) return;
    const isAi = pathname?.startsWith("/app/ai") ?? false;
    const firstEntry = !sessionStorage.getItem(ENTRY_FLAG);
    if (firstEntry) sessionStorage.setItem(ENTRY_FLAG, "1");
    if (!isAi && !firstEntry) return;
    const id = requestAnimationFrame(() => setShowGlow(true));
    return () => cancelAnimationFrame(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <>
      {showGlow && (
        <motion.div
          className="siri-glow"
          initial={{ opacity: 0 }}
          animate={{ opacity: [0, 1, 1, 0] }}
          transition={{ duration: 1.25, times: [0, 0.18, 0.55, 1], ease: "easeInOut" }}
          onAnimationComplete={() => setShowGlow(false)}
        />
      )}
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={pathname}
          initial={reduceMotion ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={reduceMotion ? undefined : { opacity: 0 }}
          transition={{ duration: 0.18, ease: "easeInOut" }}
        >
          {children}
        </motion.div>
      </AnimatePresence>
    </>
  );
}
