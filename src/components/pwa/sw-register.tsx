"use client";

import { useEffect } from "react";

// Registers the service worker that gives the app its instant, native-like
// launch (cached shell/static assets) and the offline fallback page.
export function SwRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    if (process.env.NODE_ENV !== "production") return;
    navigator.serviceWorker.register("/sw.js").catch(() => {
      // registration failure is non-fatal — the app just works online-only
    });
  }, []);

  return null;
}
