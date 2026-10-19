#!/usr/bin/env node
/* Writes lib/lastmod.json: for each page, the date of the last commit that
   touched its article, its route or its tool's folder (or today, if any of
   those has uncommitted changes). app/sitemap.ts serves these as <lastmod>,
   so a search engine can tell which pages changed. Not the build date: a
   date that moves on every deploy is ignored.

     node scripts/lastmod.mjs            # rewrite lib/lastmod.json
     node scripts/lastmod.mjs check      # exit 1 if it is out of date

   Run it before committing a change to a page's article or tool (it needs
   the full git history, so it can't run on the shallow clone a deploy
   makes). tests/run.py checks that every page has a date.
   Shared code (components, the calculation engine) is not counted: a change
   there would move every page's date at once. */

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const WEB = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(WEB, "lib", "lastmod.json");
const slugs = Object.keys(JSON.parse(readFileSync(join(WEB, "lib", "page-meta.json"), "utf8")).pages);

/* The tool's folder when it isn't tools/<slug>. */
const TOOL_DIR = {
  home: "components/home", calculator: "tools/basic", incometax: "tools/tax", tools: "components/tools",
  "72t": "tools/bridge", rmd: "tools/roth", privacy: "app/privacy", "guide/paycheck": "tools/plan",
  "4-percent-rule": "tools/drawdown", guardrails: "tools/drawdown", vpw: "tools/drawdown",
  "vanguard-dynamic-spending": "tools/drawdown", "risk-based-guardrails": "tools/drawdown",
  "rmd-withdrawal-strategy": "tools/drawdown", "ratcheting-withdrawal": "tools/drawdown", "cape-withdrawal": "tools/drawdown",
};

const git = (...args) => execFileSync("git", ["-C", WEB, ...args], { encoding: "utf8" }).trim();
if (git("rev-parse", "--is-shallow-repository") === "true") {
  console.error("lastmod: this clone is shallow; the dates would be wrong. Use a full clone.");
  process.exit(2);
}
const today = new Date().toISOString().slice(0, 10);

const out = {};
for (const slug of slugs) {
  const paths = [`content/articles/${slug}.html`, `app/${slug}/page.tsx`, TOOL_DIR[slug] ?? `tools/${slug}`]
    .filter((p) => existsSync(join(WEB, p)));
  if (slug === "home") paths.push("app/page.tsx");
  if (!paths.length) continue;
  const dirty = git("status", "--porcelain", "--", ...paths) !== "";
  out[slug] = dirty ? today : git("log", "-1", "--format=%cs", "--", ...paths) || today;
}
const text = JSON.stringify(out, null, 2) + "\n";

if (process.argv[2] === "check") {
  const have = existsSync(OUT) ? readFileSync(OUT, "utf8") : "";
  if (have !== text) { console.error("lib/lastmod.json is out of date: run node scripts/lastmod.mjs"); process.exit(1); }
  console.log("lastmod: up to date");
} else {
  writeFileSync(OUT, text);
  console.log(`lastmod: wrote ${Object.keys(out).length} pages to lib/lastmod.json`);
}
