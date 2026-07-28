// Dark "AI is here" backdrop for the auth pages — see the .auth-ai-glow-*
// rules in globals.css for why this exists instead of the shared
// dreamy-hero-bg treatment used elsewhere. No hooks/interactivity, so this
// stays a plain server component.
export function AuthBackdrop() {
  return (
    <div className="pointer-events-none fixed inset-0 overflow-hidden bg-[#07070c]" aria-hidden>
      <div className="auth-ai-glow-wrap">
        <div className="auth-ai-glow-spin" />
      </div>
      <div className="noise-overlay" />
    </div>
  );
}
