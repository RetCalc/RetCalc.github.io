#!/usr/bin/env node
/* Builds public/sw.js, the service worker, from scripts/sw/sw.template.js:
   stamps this build's id (so every deploy ships a new worker and the
   browser installs it) and the list of pages the home-screen app saves
   ahead of time (every calculator and tool in lib/page-meta.json, and the
   pages that lead to them). Runs before `next build` and `next dev`
   (package.json), beside build-worker.mjs. */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const WEB = join(dirname(fileURLToPath(import.meta.url)), "..");
const slugs = Object.keys(JSON.parse(readFileSync(join(WEB, "lib", "page-meta.json"), "utf8")).pages);
/* Not saved ahead of time: the Dashboard's front page (it leads to an
   account) and privacy (short, and saved once opened). */
const SKIP = new Set(["financial-dashboard", "privacy"]);
const warm = [...slugs.filter((s) => !SKIP.has(s)).map((s) => (s === "home" ? "/" : "/" + s)), "/compare", "/learn"];
const build = process.env.VERCEL_GIT_COMMIT_SHA || process.env.VERCEL_DEPLOYMENT_ID || new Date().toISOString();
const src = readFileSync(join(WEB, "scripts", "sw", "sw.template.js"), "utf8");
for (const mark of ["__BUILD__", "__WARM__"]) if (!src.includes(mark)) throw new Error("sw.template.js has lost its " + mark + " marker");
writeFileSync(join(WEB, "public", "sw.js"), src.replace("__BUILD__", build).replace("__WARM__", JSON.stringify(warm)));
console.log(`public/sw.js: build ${build.slice(0, 12)}, ${warm.length} pages saved ahead in the home-screen app`);
