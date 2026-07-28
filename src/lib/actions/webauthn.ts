"use server";

import { cookies } from "next/headers";
import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from "@simplewebauthn/server";
import type {
  RegistrationResponseJSON,
  AuthenticationResponseJSON,
} from "@simplewebauthn/types";
import { auth, signIn } from "@/auth";
import { prisma } from "@/lib/prisma";
import { rpName, getRpConfig, toBase64Url, fromBase64Url } from "@/lib/webauthn";

const CHALLENGE_COOKIE = "webauthn_challenge";
const COOKIE_OPTS = {
  httpOnly: true,
  // Secure cookies are dropped by browsers over plain http:// — only
  // production (Vercel, always https) can set it; local dev needs it off.
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: 300,
};

export type WebAuthnResult = { ok: true } | { ok: false; error: string };

// --- Enrolling a new fingerprint/Face ID/Windows Hello on an existing account ---

export async function generateWebAuthnRegistrationOptions() {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Нужно войти в аккаунт.");

  const existing = await prisma.authenticator.findMany({
    where: { userId: session.user.id },
    select: { credentialID: true, transports: true },
  });

  const { rpID } = await getRpConfig();
  const options = await generateRegistrationOptions({
    rpName,
    rpID,
    userID: session.user.id,
    userName: session.user.username || session.user.name || session.user.id,
    userDisplayName: session.user.name || undefined,
    attestationType: "none",
    excludeCredentials: existing.map((a) => ({
      id: fromBase64Url(a.credentialID),
      type: "public-key" as const,
      transports: (a.transports?.split(",") as AuthenticatorTransport[]) || undefined,
    })),
    authenticatorSelection: {
      residentKey: "preferred",
      userVerification: "preferred",
      authenticatorAttachment: "platform",
    },
  });

  const jar = await cookies();
  jar.set(CHALLENGE_COOKIE, options.challenge, COOKIE_OPTS);
  return options;
}

export async function verifyWebAuthnRegistration(response: RegistrationResponseJSON): Promise<WebAuthnResult> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "Нужно войти в аккаунт." };

  const jar = await cookies();
  const expectedChallenge = jar.get(CHALLENGE_COOKIE)?.value;
  if (!expectedChallenge) return { ok: false, error: "Истекло время — попробуй ещё раз." };

  const { rpID, origin } = await getRpConfig();
  let verification;
  try {
    verification = await verifyRegistrationResponse({
      response,
      expectedChallenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
    });
  } catch {
    return { ok: false, error: "Не удалось подтвердить устройство." };
  }
  jar.delete(CHALLENGE_COOKIE);

  if (!verification.verified || !verification.registrationInfo) {
    return { ok: false, error: "Не удалось подтвердить устройство." };
  }

  const { credentialID, credentialPublicKey, counter } = verification.registrationInfo;
  await prisma.authenticator.create({
    data: {
      userId: session.user.id,
      credentialID: toBase64Url(credentialID),
      credentialPublicKey: toBase64Url(credentialPublicKey),
      counter,
      transports: response.response.transports?.join(",") || null,
    },
  });

  return { ok: true };
}

export async function removeWebAuthnCredential(id: string): Promise<WebAuthnResult> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "Нужно войти в аккаунт." };
  await prisma.authenticator.deleteMany({ where: { id, userId: session.user.id } });
  return { ok: true };
}

// --- Logging in with a previously-enrolled fingerprint (usernameless) ---

export async function generateWebAuthnLoginOptions() {
  const { rpID } = await getRpConfig();
  const options = await generateAuthenticationOptions({
    rpID,
    userVerification: "preferred",
    // No allowCredentials on purpose: the authenticator itself surfaces
    // which discoverable credential to use, so there's no "type your
    // username first" step before the fingerprint prompt.
  });

  const jar = await cookies();
  jar.set(CHALLENGE_COOKIE, options.challenge, COOKIE_OPTS);
  return options;
}

export async function verifyWebAuthnLogin(response: AuthenticationResponseJSON): Promise<WebAuthnResult> {
  const jar = await cookies();
  const expectedChallenge = jar.get(CHALLENGE_COOKIE)?.value;
  if (!expectedChallenge) return { ok: false, error: "Истекло время — попробуй ещё раз." };

  const authenticator = await prisma.authenticator.findUnique({
    where: { credentialID: response.id },
  });
  if (!authenticator) return { ok: false, error: "Это устройство не привязано ни к одному аккаунту." };

  const { rpID, origin } = await getRpConfig();
  let verification;
  try {
    verification = await verifyAuthenticationResponse({
      response,
      expectedChallenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
      authenticator: {
        credentialID: fromBase64Url(authenticator.credentialID),
        credentialPublicKey: fromBase64Url(authenticator.credentialPublicKey),
        counter: authenticator.counter,
        transports: (authenticator.transports?.split(",") as AuthenticatorTransport[]) || undefined,
      },
    });
  } catch {
    return { ok: false, error: "Не удалось подтвердить вход." };
  }
  jar.delete(CHALLENGE_COOKIE);

  if (!verification.verified) return { ok: false, error: "Не удалось подтвердить вход." };

  await prisma.authenticator.update({
    where: { id: authenticator.id },
    data: { counter: verification.authenticationInfo.newCounter },
  });

  await signIn("webauthn-verified", { userId: authenticator.userId, redirectTo: "/app" });
  return { ok: true };
}
