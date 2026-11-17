/* RetCalc's service worker (served as /sw.js; scripts/build-sw.mjs stamps
   the two __PLACEHOLDERS__ below and writes public/sw.js before every build).

   What it promises:

   1. Fresh first. A page is always fetched from the network; the copy saved
      here is used only when the network can't be reached. Nobody is ever
      shown an old page while online.
   2. Nothing private is saved. Requests to other sites (the account
      service, Google sign-in, analytics, error reports) never pass through
      here at all. On this site, the Dashboard, the account page, sign-in
      returns and anything that isn't a plain GET are fetched and never
      stored. What is stored is what the site serves to everyone alike: the
      public pages, their scripts and styles, the engine worker, icons.
   3. The calculators work offline. In the home-screen app, every
      calculator's page and the files it needs are saved ahead of time (the
      "warm" message below), with the engine worker they compute in. In a
      browser tab, the pages you've opened are saved as you open them.
   4. New versions reach installed users. This file changes with every
      deploy (BUILD), the browser re-checks it on each visit, and a new one
      takes over at once (skipWaiting + claim). Because pages are fresh
      first, a new deploy's pages show on the next load with a connection,
      whichever worker is running; taking over at once just retires the
      previous deploy's saved files sooner.

   Next.js's own page-data requests (RSC) are left to the network: when one
   fails offline, Next.js falls back to loading the page whole, and that
   load is answered from the saved copy. */

const BUILD = "__BUILD__";
/* The pages saved ahead of time in the home-screen app: every calculator
   and tool, and the pages that lead to them. */
const WARM = __WARM__;

const PAGES = "retcalc-pages-v1"; // public pages' HTML, by path
const ASSETS = "retcalc-assets-v1"; // /_next/static: hashed, never change
const FILES = "retcalc-files-v1"; // other public files (the engine worker, icons)
const META = "retcalc-meta-v1"; // which build was last warmed

/* Fetched, never stored: the Dashboard and everything under it, the
   account page, the unsubscribe page, any API or monitoring route. */
const NEVER = [/^\/dashboard(\/|$)/, /^\/account(\/|$)/, /^\/unsubscribe(\/|$)/, /^\/api\//, /^\/monitoring/, /^\/og-card\//, /^\/_next\/(image|data)/];
const neverStore = (url) => NEVER.some((r) => r.test(url.pathname)) || url.searchParams.has("code") || url.searchParams.has("error_description");
/* Too big or streamed in pieces: left to the browser's own cache. */
const SKIP_FILE = /\.(mp4|webm|mov|m4v|zip|xlsx|pdf)$/i;

self.addEventListener("install", (event) => {
  // The engine worker first: a calculator opened later without a
  // connection needs it before anything else.
  event.waitUntil(caches.open(FILES).then((c) => c.add(new Request("/engine-worker.js", { cache: "reload" }))).catch(() => {}).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keep = new Set([PAGES, ASSETS, FILES, META]);
    for (const name of await caches.keys()) if (name.startsWith("retcalc-") && !keep.has(name)) await caches.delete(name);
    await self.clients.claim();
  })());
});

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "warm") event.waitUntil(warm().catch(() => {}));
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  // Next.js's page data: the network's alone (see the note at the top).
  if (req.headers.get("RSC") || req.headers.get("Next-Router-Prefetch") || url.searchParams.has("_rsc")) return;

  if (req.mode === "navigate") {
    event.respondWith(neverStore(url) ? fetch(req).catch(() => offline(url)) : page(event, url));
    return;
  }
  if (neverStore(url) || req.headers.has("range") || SKIP_FILE.test(url.pathname)) return;
  event.respondWith(url.pathname.startsWith("/_next/static/") ? asset(event) : file(event));
});

/* A page: the network's copy, saved for a day without a connection; the
   saved copy only when the network can't be reached. */
async function page(event, url) {
  const cache = await caches.open(PAGES);
  try {
    const res = await fetch(event.request);
    if (res.status === 200 && !res.redirected && (res.headers.get("content-type") || "").includes("text/html")) keep(event, cache, url.pathname, res);
    return res;
  } catch {
    return (await cache.match(url.pathname)) || (await cache.match(url.pathname.replace(/\/+$/, "") || "/")) || offline(url);
  }
}

/* A hashed build file never changes under its name: the saved copy, else
   the network's, kept. (A deployment tag in the query is ignored.) */
async function asset(event) {
  const req = event.request, cache = await caches.open(ASSETS);
  const hit = await cache.match(req, { ignoreSearch: true });
  if (hit) return hit;
  const res = await fetch(req);
  if (res.status === 200) keep(event, cache, req, res);
  return res;
}

/* Saves a copy without holding up the answer. */
function keep(event, cache, key, res) {
  event.waitUntil(cache.put(key, res.clone()).catch(() => {}));
}

/* Any other public file (the engine worker, an icon, a picture): fresh
   first, the saved copy without a connection. */
async function file(event) {
  const req = event.request, cache = await caches.open(FILES);
  try {
    const res = await fetch(req);
    if (res.status === 200 && res.type === "basic") keep(event, cache, req, res);
    return res;
  } catch (e) {
    const hit = await cache.match(req, { ignoreSearch: true });
    if (hit) return hit;
    throw e;
  }
}

/* The home-screen app, once per build: every calculator's page and the
   build files each one names, saved ahead of time. Then the build files of
   earlier deploys are dropped: any saved before the previous warm that no
   saved page names now (a file loaded on demand, like a tip's text, is
   named by no page, so it is kept until a second deploy has passed).
   Stops at the first failure (a lost connection) and tries again at the
   next launch. */
const NAMED = /\/_next\/static\/[^"'\\\s<>)]+/g;
async function warm() {
  const meta = await caches.open(META);
  const read = async (key) => { const r = await meta.match(key); return r ? r.text() : ""; };
  if ((await read("/warmed")) === BUILD) return;
  const pages = await caches.open(PAGES), assets = await caches.open(ASSETS), files = await caches.open(FILES);
  const named = new Set();
  const note = (html) => { for (const m of html.matchAll(NAMED)) named.add(new URL(m[0].replace(/&amp;/g, "&"), self.location.origin).pathname); };
  const each = async (list, fn, at) => {
    const todo = [...list];
    await Promise.all(Array.from({ length: at }, async () => { while (todo.length) await fn(todo.shift()); }));
  };
  await each(WARM, async (path) => {
    const res = await fetch(path, { credentials: "same-origin", cache: "no-cache" });
    if (res.status !== 200 || res.redirected) throw new Error(path + ": " + res.status);
    note(await res.clone().text());
    await pages.put(path, res);
  }, 4);
  await each(named, async (path) => {
    if (await assets.match(path, { ignoreSearch: true })) return;
    const res = await fetch(path);
    if (res.status === 200) await assets.put(path, res);
  }, 6);
  await each(["/engine-worker.js", "/site.webmanifest", "/icon-192.png", "/icon-512.png", "/apple-touch-icon.png", "/favicon.svg"], async (f) => {
    const res = await fetch(f, { cache: "no-cache" });
    if (res.status === 200) await files.put(f, res);
  }, 3);
  // Pages saved by visiting them keep their files too.
  for (const req of await pages.keys()) note(await (await pages.match(req)).text());
  const before = Number(await read("/warmed-at")) || 0;
  if (before) for (const req of await assets.keys()) {
    if (named.has(new URL(req.url).pathname)) continue;
    const saved = Date.parse((await assets.match(req)).headers.get("date") || "") || 0;
    if (saved && saved < before) await assets.delete(req);
  }
  await meta.put("/warmed", new Response(BUILD));
  await meta.put("/warmed-at", new Response(String(Date.now())));
}

/* Shown when a page was never saved and the network can't be reached. */
function offline(url) {
  const dash = /^\/(dashboard|account)(\/|$)/.test(url.pathname);
  const body = dash
    ? "Your Dashboard needs a connection to open. What you've entered is safe on this device and in your account."
    : "This page hasn't been opened on this device before, so there's no saved copy of it. The calculators you've used still work without a connection.";
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><title>You're offline | RetCalc</title>
<style>:root{color-scheme:light dark;--g:#f5f5f7;--s:#fff;--t:#1d1d1f;--m:#6e6e73;--a:#975300;--oa:#fff;--f:rgba(118,118,128,.12)}@media (prefers-color-scheme:dark){:root{--g:#000;--s:#1c1c1e;--t:#f5f5f7;--m:#a1a1a6;--a:#ffb340;--oa:#000;--f:rgba(118,118,128,.24)}}
*{box-sizing:border-box}body{margin:0;min-height:100vh;display:grid;place-items:center;padding:calc(24px + env(safe-area-inset-top)) 20px calc(24px + env(safe-area-inset-bottom));background:var(--g);color:var(--t);font:16px/1.5 -apple-system,BlinkMacSystemFont,"SF Pro Text",Inter,"Helvetica Neue",Arial,sans-serif;-webkit-font-smoothing:antialiased}
main{width:100%;max-width:400px;padding:28px 24px;border-radius:20px;background:var(--s);text-align:center}h1{margin:0 0 8px;font-size:24px;line-height:1.2;letter-spacing:-.02em}p{margin:0 0 20px;color:var(--m)}
a,button{display:flex;align-items:center;justify-content:center;width:100%;min-height:48px;margin-top:10px;border:0;border-radius:99px;font:600 16px/1 inherit;font-family:inherit;text-decoration:none;cursor:pointer;background:var(--f);color:var(--t)}button{background:var(--a);color:var(--oa)}</style></head>
<body><main><h1>You're offline</h1><p>${body}</p><button onclick="location.reload()">Try again</button><a href="/calculator">Open the Calculator</a><a href="/tools">All tools</a></main></body></html>`;
  return new Response(html, { status: 503, headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } });
}
