const STATIC_CACHE = "huggy-offline-static-v1";
const DOCUMENT_CACHE = "huggy-offline-documents-v1";
const PREFIX = "huggy-offline-";
const STATIC_FILES = ["/offline.html", "/manifest.webmanifest", "/favicon.png", "/apple-touch-icon.png", "/icons/icon-192.png", "/icons/icon-512.png", "/icons/icon-512-maskable.png"];
const APP_ROUTES = ["/", "/app", "/app/scrap-calculator", "/app/sales-log"];

async function cacheStaticAsset(rawUrl, depth = 0, seen = new Set()) {
  let url;
  try { url = new URL(rawUrl, self.location.origin); } catch { return; }
  if (url.origin !== self.location.origin || !url.pathname.startsWith("/assets/") || depth > 4 || seen.has(url.href)) return;
  seen.add(url.href);
  const cache = await caches.open(STATIC_CACHE);
  const request = new Request(url.href, { credentials: "same-origin" });
  let response = await cache.match(request);
  if (!response) {
    try { response = await fetch(request); } catch { return; }
    if (!response.ok || response.type === "opaque") return;
    await cache.put(request, response.clone());
  }
  if (depth >= 4) return;
  const source = await response.clone().text();
  const references = new Set();
  const pattern = /["'](\/assets\/[^"']+\.(?:m?js|css|woff2?|png|svg)(?:\?[^"']*)?)["']/g;
  for (const match of source.matchAll(pattern)) if (match[1]) references.add(match[1]);
  const cssPattern = /url\(["']?(\/assets\/[^)"'\s]+)["']?\)/g;
  for (const match of source.matchAll(cssPattern)) if (match[1]) references.add(match[1]);
  await Promise.all([...references].map((reference) => cacheStaticAsset(reference, depth + 1, seen)));
}

async function cachePage(url, response) {
  const documents = await caches.open(DOCUMENT_CACHE);
  await documents.put(url, response.clone());
  const html = await response.text();
  const assets = new Set();
  for (const match of html.matchAll(/(?:src|href)=["']([^"']+)["']/g)) {
    try {
      const asset = new URL(match[1], self.location.origin);
      if (asset.origin === self.location.origin && asset.pathname.startsWith("/assets/")) assets.add(asset.href);
    } catch { /* Ignore malformed asset URLs. */ }
  }
  await Promise.all([...assets].map((asset) => cacheStaticAsset(asset)));
}

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(STATIC_CACHE);
    await Promise.all(STATIC_FILES.map(async (url) => {
      try {
        const response = await fetch(url, { cache: "reload" });
        if (response.ok) await cache.put(url, response);
      } catch {
        // A missing optional icon must not prevent service-worker installation.
      }
    }));
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names.filter((name) => name.startsWith(PREFIX) && name !== STATIC_CACHE && name !== DOCUMENT_CACHE).map((name) => caches.delete(name)));
    await self.clients.claim();
  })());
});

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "CLEAR_PRIVATE") {
    event.waitUntil(caches.delete(DOCUMENT_CACHE));
    return;
  }
  if (event.data && event.data.type === "PRECACHE_ROUTES") {
    event.waitUntil((async () => {
      await Promise.all(APP_ROUTES.map(async (url) => {
        try {
          const response = await fetch(url, { credentials: "same-origin", cache: "no-store" });
          if (response.ok && response.type !== "opaque") await cachePage(url, response);
        } catch {
          // Keep the route out of cache if the network is unavailable.
        }
      }));
    })());
  }
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    event.respondWith((async () => {
      try {
        const response = await fetch(request);
        if (response.ok) {
          event.waitUntil(cachePage(url.pathname, response.clone()).catch(() => undefined));
          return response;
        }
        if (response.status >= 500) {
          const documents = await caches.open(DOCUMENT_CACHE);
          const cached = await documents.match(url.pathname, { ignoreSearch: true });
          if (cached) return cached;
        }
        return response;
      } catch {
        const documents = await caches.open(DOCUMENT_CACHE);
        const exact = await documents.match(url.pathname, { ignoreSearch: true });
        if (exact) return exact;
        const appShell = await documents.match("/app", { ignoreSearch: true });
        if (appShell) return appShell;
        const statics = await caches.open(STATIC_CACHE);
        return (await statics.match("/offline.html")) || Response.error();
      }
    })());
    return;
  }

  const isAsset = request.destination === "script" || request.destination === "style" || request.destination === "font" || request.destination === "image" || url.pathname.startsWith("/assets/");
  if (!isAsset) return;
  event.respondWith((async () => {
    const cache = await caches.open(STATIC_CACHE);
    const cached = await cache.match(request);
    if (cached) return cached;
    try {
      const response = await fetch(request);
      if (response.ok && response.type !== "opaque") await cache.put(request, response.clone());
      return response;
    } catch {
      return cached || Response.error();
    }
  })());
});
