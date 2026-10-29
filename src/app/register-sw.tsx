"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

// Installs Yarn's service worker (see public/sw.js) so the app opens with no signal.
// It also tells the worker what each screen loaded, so a copy of the home screen is kept
// the moment you land on it (not only the next time you open the app).
export default function RegisterServiceWorker() {
  const pathname = usePathname();

  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;

    navigator.serviceWorker
      .register("/sw.js")
      .then(() => navigator.serviceWorker.ready)
      .then((registration) => {
        const urls = performance
          .getEntriesByType("resource")
          .map((entry) => new URL(entry.name))
          .filter((u) => u.origin === location.origin && u.pathname.startsWith("/_next/static/"))
          .map((u) => u.pathname + u.search);
        registration.active?.postMessage({ type: "CACHE_ASSETS", urls, page: pathname });
      })
      .catch(() => {});
  }, [pathname]);

  return null;
}
