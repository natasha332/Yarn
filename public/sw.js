// Yarn's service worker: keeps a copy of the app on the phone so it opens with no signal.
// Plain JavaScript on purpose (it runs outside the app).

const STATIC = "yarn-static-v1"; // the app's code, fonts and icons
const PAGES = "yarn-pages-v1"; // the last home screen you saw, plus the "no signal" page
const OFFLINE_URL = "/offline.html";

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(PAGES)
      .then((cache) => cache.add(OFFLINE_URL))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      for (const name of await caches.keys()) {
        if (name !== STATIC && name !== PAGES) await caches.delete(name);
      }
      await self.clients.claim();
    })(),
  );
});

// The app tells us what it loaded, so even the very first visit gets saved for offline use.
self.addEventListener("message", (event) => {
  const data = event.data || {};
  if (data.type !== "CACHE_ASSETS") return;
  event.waitUntil(
    (async () => {
      const statics = await caches.open(STATIC);
      for (const url of data.urls || []) {
        try {
          if (!(await statics.match(url))) await statics.add(url);
        } catch {
          /* skip anything that fails */
        }
      }
      if (data.page === "/") {
        try {
          const res = await fetch("/", { credentials: "same-origin" });
          if (res.ok && !res.redirected) await (await caches.open(PAGES)).put("/", res);
        } catch {
          /* offline right now: nothing to save */
        }
      }
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    event.respondWith(openPage(request));
  } else if (url.pathname.startsWith("/_next/static/") || /\.(png|ico|svg|woff2?)$/.test(url.pathname)) {
    event.respondWith(fromCacheFirst(request));
  }
  // Everything else (your notes, uploads, the transcriber) always goes straight to the internet.
});

async function openPage(request) {
  try {
    const response = await fetch(request);
    const pages = await caches.open(PAGES);
    const path = new URL(response.url).pathname;
    if (response.ok && path === "/") {
      await pages.put("/", response.clone());
    } else if (path === "/login") {
      await pages.delete("/"); // logged out: forget the signed-in screen
    }
    return response;
  } catch {
    const pages = await caches.open(PAGES);
    if (new URL(request.url).pathname === "/") {
      const home = await pages.match("/");
      if (home) return home;
    }
    return (await pages.match(OFFLINE_URL)) || Response.error();
  }
}

async function fromCacheFirst(request) {
  const cache = await caches.open(STATIC);
  const hit = await cache.match(request);
  if (hit) return hit;
  const response = await fetch(request);
  if (response.ok) cache.put(request, response.clone());
  return response;
}
