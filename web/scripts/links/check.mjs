#!/usr/bin/env node
/* Broken-link check for the live site: reads every page in the sitemap and
   tries every link on them, internal and outside (IRS, SSA, Medicare and the
   like), plus every in-page #jump. The Monday health check runs it.

     node scripts/links/check.mjs                      # retcalc.app
     node scripts/links/check.mjs http://localhost:3200
     node scripts/links/check.mjs --json               # machine-readable

   Outside sites sometimes turn away scripts (403, 429) or time out; those
   are listed as "couldn't check", not broken, so only a real 404/410 or a
   site that doesn't exist counts as broken. Exits 1 if anything is broken.
   Needs no packages: Node's own fetch. */

const args = process.argv.slice(2);
const JSON_OUT = args.includes("--json");
const BASE = (args.find((a) => !a.startsWith("--")) || "https://retcalc.app").replace(/\/$/, "");
const ORIGIN = new URL(BASE).origin;
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0 Safari/537.36 RetCalc-link-check";
const TIMEOUT = 20000;

async function get(url, method = "GET") {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), TIMEOUT);
  try {
    const r = await fetch(url, { method, redirect: "follow", signal: ctl.signal, headers: { "user-agent": UA, accept: "text/html,*/*" } });
    const body = method === "GET" && (r.headers.get("content-type") || "").includes("html") ? await r.text() : "";
    return { status: r.status, finalUrl: r.url, body };
  } catch (e) {
    const code = e?.cause?.code || e?.name || "error";
    return { status: 0, error: code };
  } finally {
    clearTimeout(timer);
  }
}

/** Runs `fn` over `list`, `n` at a time. */
async function pool(list, n, fn) {
  const out = new Array(list.length);
  let i = 0;
  await Promise.all(Array.from({ length: n }, async () => {
    while (i < list.length) { const k = i++; out[k] = await fn(list[k]); }
  }));
  return out;
}

const decode = (s) => s.replace(/&amp;/g, "&").replace(/&#x27;|&#39;/g, "'").replace(/&quot;/g, '"');

// 1. The pages.
let xml = "";
try {
  const r = await fetch(BASE + "/sitemap.xml", { headers: { "user-agent": UA } });
  if (r.ok) xml = await r.text();
} catch { /* reported below */ }
if (!xml) {
  console.error("Couldn't read " + BASE + "/sitemap.xml");
  process.exit(2);
}
const pages = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => ORIGIN + new URL(m[1]).pathname);

// 2. Each page's links and ids.
const ids = new Map();          // page url -> Set of element ids
const found = new Map();        // link -> Set of pages it appears on
const fetched = await pool(pages, 6, async (p) => ({ p, r: await get(p) }));
const pageErrors = [];
for (const { p, r } of fetched) {
  if (r.status !== 200) { pageErrors.push({ url: p, status: r.status || r.error }); continue; }
  ids.set(p, new Set([...r.body.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1])));
  for (const m of r.body.matchAll(/<a\b[^>]*\shref="([^"]+)"/g)) {
    const href = decode(m[1]);
    if (/^(mailto|tel|javascript|data):/i.test(href)) continue;
    let u;
    try { u = new URL(href, p); } catch { continue; }
    if (!/^https?:$/.test(u.protocol)) continue;
    const key = u.origin === new URL(ORIGIN).origin ? ORIGIN + u.pathname + u.search + u.hash : u.href;
    if (!found.has(key)) found.set(key, new Set());
    found.get(key).add(new URL(p).pathname);
  }
}

// 3. Try each link once (internal pages without their #, outside links whole).
const internal = [...found.keys()].filter((k) => k.startsWith(ORIGIN));
const external = [...found.keys()].filter((k) => !k.startsWith(ORIGIN));
const targets = [...new Set([...internal.map((k) => k.split("#")[0]), ...external.map((k) => k.split("#")[0])])];
const status = new Map();
await pool(targets, 6, async (t) => {
  let r = await get(t);
  if (r.status === 405 || r.status === 0) {
    const h = await get(t, "HEAD");
    if (h.status) r = h;
  }
  status.set(t, r);
  if (t.startsWith(ORIGIN) && r.status === 200 && !ids.has(t)) {
    ids.set(t, new Set([...r.body.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1])));
  }
});

// 4. Sort them out.
const broken = [], unsure = [], badJumps = [];
for (const [link, on] of found) {
  const [bare, hash] = link.split("#");
  const r = status.get(bare);
  const where = [...on].sort();
  const row = { url: link, status: r.status || r.error, on: where };
  if (r.status === 404 || r.status === 410 || ["ENOTFOUND", "EAI_AGAIN", "ERR_INVALID_URL"].includes(r.error)) broken.push(row);
  else if (!(r.status >= 200 && r.status < 400)) unsure.push(row);
  else if (hash && bare.startsWith(ORIGIN)) {
    const known = ids.get(bare);
    if (known && !known.has(decodeURIComponent(hash))) badJumps.push({ ...row, status: "no #" + hash + " on that page" });
  }
}

const result = {
  base: BASE, pages: pages.length, pageErrors,
  links: { internal: internal.length, external: external.length },
  broken, badJumps, unsure,
};

if (JSON_OUT) console.log(JSON.stringify(result, null, 1));
else {
  console.log(`Link check, ${BASE}: ${pages.length} pages, ${internal.length} internal and ${external.length} outside links.`);
  const list = (title, rows) => {
    if (!rows.length) return;
    console.log(`\n${title} (${rows.length})`);
    for (const r of rows) console.log(`  ${r.status}  ${r.url}\n        on ${r.on.join(", ")}`);
  };
  list("Pages that didn't load", pageErrors.map((e) => ({ ...e, on: ["sitemap"] })));
  list("Broken", broken);
  list("Jumps to a missing #section", badJumps);
  list("Couldn't check (the site turned the script away or didn't answer)", unsure);
  if (!pageErrors.length && !broken.length && !badJumps.length) console.log("\nNo broken links.");
}
process.exit(pageErrors.length || broken.length || badJumps.length ? 1 : 0);
