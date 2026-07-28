"use client";

import { useEffect, useState } from "react";
import { startAuthentication, browserSupportsWebAuthn } from "@simplewebauthn/browser";
import { Fingerprint } from "lucide-react";
import { generateWebAuthnLoginOptions, verifyWebAuthnLogin } from "@/lib/actions/webauthn";
import { DEVICE_ENROLLED_KEY } from "@/components/app/webauthn-enroll";

export function WebAuthnLoginButton() {
  const [supported, setSupported] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Only show this button on a device that has actually enrolled a
    // credential here before (via Profile → "Привязать это устройство").
    // Without this check, a browser that supports WebAuthn but never
    // enrolled anything would show the button anyway, tap it, and hit a
    // confusing native "no passkeys found for this site" dialog instead of
    // a normal in-app error.
    (async () => {
      const enrolledHere = localStorage.getItem(DEVICE_ENROLLED_KEY) === "1";
      if (enrolledHere && browserSupportsWebAuthn()) setSupported(true);
    })();
  }, []);

  async function handleClick() {
    setError(null);
    setBusy(true);
    try {
      const options = await generateWebAuthnLoginOptions();
      const response = await startAuthentication(options);
      const result = await verifyWebAuthnLogin(response);
      if (!result.ok) setError(result.error);
      // On success, verifyWebAuthnLogin's signIn() throws a redirect that
      // the framework handles — nothing left to do here.
    } catch {
      setError("Не получилось войти по отпечатку. Попробуй по-другому.");
    } finally {
      setBusy(false);
    }
  }

  if (!supported) return null;

  return (
    <div>
      <button
        type="button"
        onClick={handleClick}
        disabled={busy}
        className="flex w-full items-center justify-center gap-2.5 rounded-full border border-white/15 bg-transparent px-5 py-3.5 text-sm font-semibold text-white transition-colors hover:border-white/30 disabled:cursor-not-allowed disabled:opacity-60"
      >
        <Fingerprint className="h-4.5 w-4.5" />
        {busy ? "Проверяю…" : "Войти по отпечатку"}
      </button>
      {error && <p className="mt-2 text-center text-xs font-semibold text-(--color-brand-pink)">{error}</p>}
    </div>
  );
}
