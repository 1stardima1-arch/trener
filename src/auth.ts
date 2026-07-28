import NextAuth from "next-auth";
import type { NextAuthConfig } from "next-auth";
import Resend from "next-auth/providers/resend";
import Credentials from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/lib/prisma";
import { verificationEmailHtml, verificationEmailText } from "@/lib/verification-email";
import { verifyPassword } from "@/lib/password";

const providers: NextAuthConfig["providers"] = [];

providers.push(
  Credentials({
    id: "username-password",
    name: "Ник и пароль",
    credentials: {
      username: { label: "Ник", type: "text" },
      password: { label: "Пароль", type: "password" },
    },
    async authorize(credentials) {
      const username = (credentials?.username as string)?.trim();
      const password = credentials?.password as string;
      if (!username || !password) return null;

      const user = await prisma.user.findUnique({ where: { username } });
      if (!user?.passwordHash) return null;

      const valid = await verifyPassword(password, user.passwordHash);
      if (!valid) return null;

      return { id: user.id, name: user.name, email: user.email, image: user.image, username: user.username };
    },
  })
);

// Only ever invoked internally, right after /src/lib/actions/webauthn.ts
// has already verified a WebAuthn signature server-side — never exposed
// as a public form, so there's no password/secret to trust here beyond
// "this server code decided to call signIn with this exact userId".
providers.push(
  Credentials({
    id: "webauthn-verified",
    name: "Отпечаток пальца",
    credentials: { userId: {} },
    async authorize(credentials) {
      const userId = credentials?.userId as string;
      if (!userId) return null;
      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (!user) return null;
      return { id: user.id, name: user.name, email: user.email, image: user.image, username: user.username };
    },
  })
);

// Passwordless email login: entering an email and clicking the link that
// arrives is both "sign in by email" and "email verification" in one step —
// no password to store/reset, no separate verified-email flag to track.
if (process.env.RESEND_API_KEY) {
  providers.push(
    Resend({
      apiKey: process.env.RESEND_API_KEY,
      from: process.env.RESEND_FROM_EMAIL || "Тренер <onboarding@resend.dev>",
      async sendVerificationRequest({ identifier: to, url, provider }) {
        const res = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${provider.apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: provider.from,
            to,
            subject: "Вход в Тренер",
            html: verificationEmailHtml(url),
            text: verificationEmailText(url),
          }),
        });
        if (!res.ok) {
          throw new Error("Resend error: " + JSON.stringify(await res.json()));
        }
      },
    })
  );
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  adapter: PrismaAdapter(prisma),
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
    verifyRequest: "/login/check-email",
    error: "/login",
  },
  providers,
  callbacks: {
    async jwt({ token, user }) {
      if (user?.id) {
        token.uid = user.id;
        token.username = user.username ?? null;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user && token.uid) {
        session.user.id = token.uid as string;
        session.user.username = (token.username as string | null) ?? null;
      }
      return session;
    },
  },
});
