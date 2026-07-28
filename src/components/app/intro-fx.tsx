"use client";

import { motion, useReducedMotion } from "framer-motion";

// Small drifting/twinkling sparks behind the intro content — cheap (pure
// transform+opacity, GPU-composited) but reads as much more alive than a
// static background.
const PARTICLES = Array.from({ length: 14 }, (_, i) => {
  // Deterministic pseudo-random layout (no Math.random in render — stable
  // across server/client and re-renders).
  const seed = i * 137.508; // golden angle, gives a nice even scatter
  const left = (seed % 100);
  const top = ((seed * 1.7) % 100);
  const size = 3 + (i % 4);
  const delay = (i % 7) * 0.35;
  const duration = 3.2 + (i % 5) * 0.6;
  return { left, top, size, delay, duration, key: i };
});

export function IntroParticles() {
  const reduceMotion = useReducedMotion();
  if (reduceMotion) return null;

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      {PARTICLES.map((p) => (
        <motion.span
          key={p.key}
          className="absolute rounded-full bg-white"
          style={{ left: `${p.left}%`, top: `${p.top}%`, width: p.size, height: p.size }}
          initial={{ opacity: 0, scale: 0 }}
          animate={{ opacity: [0, 0.9, 0], scale: [0, 1, 0.6], y: [0, -18, -30] }}
          transition={{
            duration: p.duration,
            delay: p.delay,
            repeat: Infinity,
            repeatDelay: 1.2,
            ease: "easeInOut",
          }}
        />
      ))}
    </div>
  );
}

// Denser "glitter suspended in liquid" dust for the auth backdrop — more
// numerous and smaller than IntroParticles, mixed white/warm-gold tones,
// twinkling in place rather than drifting upward (glitter in fluid stays
// roughly put, it doesn't rise like the intro's celebratory sparks).
const SPARKLES = Array.from({ length: 40 }, (_, i) => {
  const seed = i * 91.3;
  const left = seed % 100;
  const top = (seed * 2.3) % 100;
  const size = 1.5 + (i % 3) * 0.8;
  const delay = (i % 11) * 0.4;
  const duration = 2.4 + (i % 6) * 0.5;
  const warm = i % 5 === 0;
  return { left, top, size, delay, duration, warm, key: i };
});

export function LiquidSparkles() {
  const reduceMotion = useReducedMotion();
  if (reduceMotion) return null;

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      {SPARKLES.map((s) => (
        <motion.span
          key={s.key}
          className="absolute rounded-full"
          style={{
            left: `${s.left}%`,
            top: `${s.top}%`,
            width: s.size,
            height: s.size,
            background: s.warm ? "#e8c88a" : "#ffffff",
          }}
          initial={{ opacity: 0 }}
          animate={{ opacity: [0, 0.8, 0] }}
          transition={{ duration: s.duration, delay: s.delay, repeat: Infinity, repeatDelay: 1.6, ease: "easeInOut" }}
        />
      ))}
    </div>
  );
}

// Badge that "pops" in with an expanding ring pulse, then idles with a gentle
// breathing loop — much more alive than a plain scale-in emoji.
export function IntroBadge({ emoji }: { emoji: string }) {
  const reduceMotion = useReducedMotion();

  return (
    <motion.span
      className="relative mb-8 flex h-32 w-32 items-center justify-center"
      initial={reduceMotion ? false : { scale: 0, rotate: -25 }}
      animate={{ scale: 1, rotate: 0 }}
      transition={{ type: "spring", stiffness: 260, damping: 14, delay: 0.1 }}
    >
      {!reduceMotion && (
        <>
          <motion.span
            className="absolute inset-0 rounded-full border-2 border-white/60"
            initial={{ scale: 0.6, opacity: 0.8 }}
            animate={{ scale: 1.7, opacity: 0 }}
            transition={{ duration: 1.1, delay: 0.35, ease: "easeOut" }}
          />
          <motion.span
            className="absolute inset-0 rounded-full border-2 border-white/40"
            initial={{ scale: 0.6, opacity: 0.6 }}
            animate={{ scale: 2.1, opacity: 0 }}
            transition={{ duration: 1.3, delay: 0.55, ease: "easeOut" }}
          />
        </>
      )}
      <motion.span
        className="blob-morph relative flex h-32 w-32 items-center justify-center bg-white/25 text-6xl"
        animate={reduceMotion ? undefined : { y: [0, -6, 0] }}
        transition={{ duration: 2.6, delay: 1, repeat: Infinity, ease: "easeInOut" }}
      >
        {emoji}
      </motion.span>
    </motion.span>
  );
}

// Splits a headline into words, each springing in with a stagger, followed
// by a one-shot gradient shimmer sweep across the settled text.
export function StaggerTitle({ text, className }: { text: string; className?: string }) {
  const reduceMotion = useReducedMotion();
  const words = text.split(" ");

  if (reduceMotion) {
    return <h1 className={className}>{text}</h1>;
  }

  return (
    <h1 className={`${className ?? ""} relative inline-block overflow-hidden`}>
      <motion.span
        className="inline-block"
        initial="hidden"
        animate="show"
        variants={{
          hidden: {},
          show: { transition: { staggerChildren: 0.07, delayChildren: 0.15 } },
        }}
      >
        {words.map((word, i) => (
          <motion.span
            key={i}
            className="relative inline-block"
            variants={{
              hidden: { opacity: 0, y: 22, rotateX: -40 },
              show: { opacity: 1, y: 0, rotateX: 0 },
            }}
            transition={{ type: "spring", stiffness: 320, damping: 22 }}
          >
            {word}
            {i < words.length - 1 ? " " : ""}
          </motion.span>
        ))}
      </motion.span>
      <motion.span
        className="pointer-events-none absolute inset-0 -skew-x-12 bg-gradient-to-r from-transparent via-white/50 to-transparent"
        style={{ mixBlendMode: "overlay" }}
        initial={{ x: "-120%" }}
        animate={{ x: "220%" }}
        transition={{ duration: 1, delay: 0.9, ease: "easeInOut" }}
      />
    </h1>
  );
}
