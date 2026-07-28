import { headers } from "next/headers";

export const rpName = "Тренер";

// Derived from the actual incoming request, not NEXTAUTH_URL — that env
// var isn't strictly required for Auth.js to work on Vercel (it can
// auto-detect the URL from request headers), so it's easy to end up
// running in production without it set. If that happens here, falling
// back to a hardcoded/default origin would silently generate WebAuthn
// options for the wrong domain — the browser then rejects the real
// navigator.credentials call outright because the RP ID doesn't match
// the page's actual origin. Reading the real Host header instead means
// this is correct no matter what NEXTAUTH_URL is set to.
export async function getRpConfig() {
  const h = await headers();
  const host = h.get("x-forwarded-host") || h.get("host") || "localhost:3000";
  const proto = h.get("x-forwarded-proto") || (host.startsWith("localhost") ? "http" : "https");
  return { rpID: host.split(":")[0], origin: `${proto}://${host}` };
}

export function toBase64Url(bytes: Uint8Array) {
  return Buffer.from(bytes).toString("base64url");
}

export function fromBase64Url(s: string) {
  return new Uint8Array(Buffer.from(s, "base64url"));
}
