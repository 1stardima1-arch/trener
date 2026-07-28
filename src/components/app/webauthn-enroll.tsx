"use client";

import { useEffect, useState, useTransition } from "react";
import { startRegistration, browserSupportsWebAuthn, platformAuthenticatorIsAvailable } from "@simplewebauthn/browser";
import { Fingerprint, Trash2 } from "lucide-react";
import { generateWebAuthnRegistrationOptions, verifyWebAuthnRegistration, removeWebAuthnCredential } from "@/lib/actions/webauthn";

// The login page's fingerprint button reads this flag to decide whether to
// show itself at all — a device that never enrolled here would otherwise
// trigger a confusing native "no passkeys found" dialog when tapped.
export const DEVICE_ENROLLED_KEY = "trener-webauthn-device-enrolled";

export function WebAuthnEnroll({
  devices: initialDevices,
}: {
  devices: { id: string; createdAt: string }[];
}) {
  const [supported, setSupported] = useState(false);
  const [devices, setDevices] = useState(initialDevices);
  const [status, setStatus] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    (async () => {
      if (!browserSupportsWebAuthn()) return;
      const available = await platformAuthenticatorIsAvailable();
      if (available) setSupported(true);
    })();
  }, []);

  function enroll() {
    setStatus(null);
    startTransition(async () => {
      try {
        const options = await generateWebAuthnRegistrationOptions();
        const response = await startRegistration(options);
        const result = await verifyWebAuthnRegistration(response);
        if (result.ok) {
          localStorage.setItem(DEVICE_ENROLLED_KEY, "1");
          setStatus({ kind: "ok", text: "Готово — теперь можно входить по отпечатку." });
          setDevices((prev) => [...prev, { id: `local-${Date.now()}`, createdAt: new Date().toISOString() }]);
        } else {
          setStatus({ kind: "error", text: result.error });
        }
      } catch {
        setStatus({ kind: "error", text: "Не получилось привязать устройство." });
      }
    });
  }

  function remove(id: string) {
    startTransition(async () => {
      await removeWebAuthnCredential(id);
      setDevices((prev) => prev.filter((d) => d.id !== id));
    });
  }

  if (!supported && devices.length === 0) {
    return (
      <p className="text-xs text-(--color-ink-soft)">
        На этом устройстве нет сканера отпечатка/Face ID, или браузер их не поддерживает.
      </p>
    );
  }

  return (
    <div>
      {devices.length > 0 && (
        <div className="mb-3 space-y-2">
          {devices.map((d) => (
            <div key={d.id} className="flex items-center justify-between rounded-xl bg-(--color-paper-dim) px-3 py-2 text-sm">
              <span className="flex items-center gap-2">
                <Fingerprint className="h-4 w-4 text-(--color-brand-blue)" />
                Привязано {new Date(d.createdAt).toLocaleDateString("ru-RU")}
              </span>
              <button
                onClick={() => remove(d.id)}
                disabled={isPending}
                className="text-(--color-ink-soft) hover:text-(--color-brand-pink)"
                aria-label="Убрать устройство"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}
      {supported && (
        <button
          onClick={enroll}
          disabled={isPending}
          className="press-spring flex items-center gap-2 rounded-full border border-black/10 dark:border-white/10 bg-(--color-surface) px-4 py-2.5 text-sm font-semibold disabled:opacity-50"
        >
          <Fingerprint className="h-4 w-4" />
          {isPending ? "Ждём отпечаток…" : "Привязать это устройство"}
        </button>
      )}
      {status && (
        <p className={`mt-2 text-xs font-semibold ${status.kind === "ok" ? "text-(--color-brand-green)" : "text-(--color-brand-pink)"}`}>
          {status.text}
        </p>
      )}
    </div>
  );
}
