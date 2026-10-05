#!/usr/bin/env node
/* Compares what search engines read on every page of the new site with the
   current one: title, description, canonical address, link-preview tags,
   structured data and the main heading. The old pages are the built files
   in the repo root (index.html, drawdown.html, ...); the new ones are
   fetched from a running copy of the new site.

     node web/scripts/seo-compare.mjs                       # against http://localhost:3100
     node web/scripts/seo-compare.mjs https://xyz.vercel.app

   Exits 1 if any page differs. Not counted as differences:
   - the robots noindex on the new site, until the switch (MIGRATION.md)
   - twitter:title and twitter:description, which Next.js adds from the
     page's own title and description (the old site left them out)
   - "https://retcalc.app" for "https://retcalc.app/": the same address */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const BASE = (process.argv[2] || "http://localhost:3100").replace(/\/$/, "");
const slugs = Object.keys(JSON.parse(readFileSync(join(ROOT, "src", "page-meta.json"), "utf8")).pages);

const unescape = (s) => s.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
  .replace(/&quot;/g, '"').replace(/&#x27;|&#39;|&apos;/g, "'");

function attrs(tag) {
  const out = {};
  for (const m of tag.matchAll(/([\w:-]+)\s*=\s*("([^"]*)"|'([^']*)')/g)) out[m[1].toLowerCase()] = unescape(m[3] ?? m[4]);
  return out;
}

function facts(html) {
  const f = {};
  f.title = unescape((html.match(/<title[^>]*>([\s\S]*?)<\/title>/) || [])[1] ?? "");
  for (const m of html.matchAll(/<meta\b[^>]*>/g)) {
    const a = attrs(m[0]);
    const key = a.property || a.name;
    if (key && (key === "description" || key.startsWith("og:") || key.startsWith("twitter:"))) f[key] = a.content;
  }
  for (const m of html.matchAll(/<link\b[^>]*>/g)) {
    const a = attrs(m[0]);
    if (a.rel === "canonical") f.canonical = a.href;
  }
  const ld = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
  f.ld = ld ? JSON.stringify(JSON.parse(ld[1].replace(/<\\\//g, "</"))) : "";
  // the visible main heading: the tool's name on a tool's page, else #pageH1
  const h1s = [...html.matchAll(/<h1\b([^>]*)>([\s\S]*?)<\/h1>/g)].filter((m) => !/\shidden(\s|=|$)/.test(m[1]));
  f.h1 = h1s.filter((m) => m[2].trim()).map((m) => unescape(m[2].replace(/<[^>]+>/g, "")).trim()).join(" | ");
  return f;
}

let bad = 0;
for (const slug of slugs) {
  const old = facts(readFileSync(join(ROOT, slug === "home" ? "index.html" : `${slug}.html`), "utf8"));
  const res = await fetch(`${BASE}${slug === "home" ? "/" : "/" + slug}`);
  const now = facts(await res.text());
  const keys = new Set([...Object.keys(old), ...Object.keys(now)]);
  const same = (k) => {
    const a = old[k] ?? "", b = now[k] ?? "";
    if (a === b) return true;
    if ((k === "twitter:title" || k === "twitter:description") && !a) return true;
    return a.replace(/\/$/, "") === b.replace(/\/$/, "") && /^https:\/\/retcalc\.app\/?$/.test(a);
  };
  const diffs = [...keys].filter((k) => !same(k));
  if (res.status !== 200) diffs.unshift(`HTTP ${res.status}`);
  if (diffs.length) {
    bad++;
    console.log(`  FAIL  ${slug}`);
    for (const k of diffs) console.log(`        ${k}\n          old: ${old[k] ?? "(none)"}\n          new: ${now[k] ?? "(none)"}`);
  } else console.log(`  ok    ${slug}`);
}
console.log(`\n${slugs.length - bad} of ${slugs.length} pages match`);
process.exit(bad ? 1 : 0);
