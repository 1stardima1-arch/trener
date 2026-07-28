// Pure helpers shared by both server-rendered pages (the dashboard) and
// client components (Ring, trend charts) — deliberately NOT in rings.tsx,
// which is "use client": every export of a "use client" module becomes an
// opaque client reference to importers, so a Server Component calling these
// directly would crash at runtime ("function is on the client") even though
// they're plain, browser-free logic.
export function recoveryColor(score: number | null | undefined): string {
  if (score == null) return "var(--color-ink-soft)";
  if (score >= 67) return "var(--color-brand-green)";
  if (score >= 34) return "var(--color-brand-amber)";
  return "var(--color-brand-pink)";
}

export function recoveryBand(score: number | null | undefined): "HIGH" | "MEDIUM" | "LOW" | null {
  if (score == null) return null;
  if (score >= 67) return "HIGH";
  if (score >= 34) return "MEDIUM";
  return "LOW";
}
