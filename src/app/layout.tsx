import type { Metadata, Viewport } from "next";
import { Manrope, Unbounded } from "next/font/google";
import { SwRegister } from "@/components/pwa/sw-register";
import { AppSplash } from "@/components/app/app-splash";
import "./globals.css";

const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin", "cyrillic"],
});

const unbounded = Unbounded({
  variable: "--font-unbounded",
  subsets: ["latin", "cyrillic"],
  weight: ["500", "600", "700", "800", "900"],
});

export const metadata: Metadata = {
  title: "Тренер — ИИ-тренер: готовность, тренировки, сон, питание",
  description:
    "Тренер — ИИ-тренер для эндуранс- и силовых атлетов: пороги лактата, ЧСС и VO2max определяются автоматически из данных Garmin/Polar/Athyx, план тренировок адаптируется под готовность каждый день, с объяснением каждого решения.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Тренер",
  },
  icons: {
    icon: [
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: "/apple-touch-icon.png",
  },
};

export const viewport: Viewport = {
  // Matches the app's actual (true-black) background rather than the brand
  // blue accent — the OS status/nav bar reads this color directly, and the
  // brand blue there looked like a broken/unstyled system bar sitting on
  // top of the dark UI instead of blending into it.
  themeColor: "#000000",
  // Lets the app draw under the notch/home-indicator area instead of
  // leaving a hard browser-chrome band there — required for the
  // safe-area-inset-* CSS vars below to resolve to anything but 0.
  viewportFit: "cover",
  width: "device-width",
  initialScale: 1,
  // Pinch/double-tap zoom has no use in an app-shell layout and, once
  // triggered, leaves the page pannable/zoomed with content clipped at the
  // edges — exactly the "crooked screen" look a native app should never
  // show. Locking scale keeps every screen pixel-stable.
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ru"
      data-scroll-behavior="smooth"
      className={`${manrope.variable} ${unbounded.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-(--color-paper) text-(--color-ink)">
        {/* Runs before first paint so the page never flashes light-then-dark
            (or vice versa) — the alternative, applying the class from a
            client component after hydration, would always show a flash.
            Dark is the default theme: only an explicit "light" choice
            (saved by ThemeToggle) turns it off. */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              "try{if(localStorage.getItem('trener-theme')!=='light')document.documentElement.classList.add('dark')}catch(e){}",
          }}
        />
        <SwRegister />
        <AppSplash />
        {children}
      </body>
    </html>
  );
}
