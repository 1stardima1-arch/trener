import { LiquidSparkles } from "@/components/app/intro-fx";

// Black liquid backdrop for the auth pages — slow-morphing dark blobs
// (reusing the blob-morph/blob-drift keyframes, see the .auth-liquid-*
// rules in globals.css) with glitter dust suspended on top. Replaces the
// old rainbow conic-gradient glow, which read as a generic app-template
// background rather than something premium.
export function AuthBackdrop() {
  return (
    <div className="pointer-events-none fixed inset-0 overflow-hidden bg-black" aria-hidden>
      <div className="auth-liquid-wrap">
        <span className="auth-liquid-blob auth-liquid-blob-1" />
        <span className="auth-liquid-blob auth-liquid-blob-2" />
        <span className="auth-liquid-blob auth-liquid-blob-3" />
        <div className="auth-liquid-sheen" />
      </div>
      <LiquidSparkles />
      <div className="noise-overlay" />
    </div>
  );
}
