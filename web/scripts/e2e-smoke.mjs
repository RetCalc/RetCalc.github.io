#!/usr/bin/env node
/* Runs only the smoke set: the e2e checks listed in scripts/e2e-smoke.txt,
   the ones that passed in full on the last complete run. A quick
   "did anything break" before the full suite.

     npm run build                        # once: the checks use the production build
     node scripts/e2e-smoke.mjs           # the smoke set, desktop and phone
     node scripts/e2e-smoke.mjs --list    # the list
     node scripts/e2e-smoke.mjs --dry     # what Playwright would run, without running it

   Each line of the list is `<project> | <spec file> | <test title>`; lines
   starting with # are notes. Extra arguments go on to Playwright. */
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const WEB = join(dirname(fileURLToPath(import.meta.url)), "..");
const rows = readFileSync(join(WEB, "scripts/e2e-smoke.txt"), "utf8").split("\n")
  .map((l) => l.trim()).filter((l) => l && !l.startsWith("#"))
  .map((l) => l.split(" | "));
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const args = process.argv.slice(2).map((a) => (a === "--dry" ? "--list" : a));
if (process.argv.includes("--list")) {
  for (const r of rows) console.log(r.join(" | "));
  console.log(`\n${rows.length} checks`);
  process.exit(0);
}
// One run per project, since a check can be in the set on desktop and not
// on the phone. Titles are anchored at the end so "x" doesn't also pick up
// "x, with y".
let status = 0;
for (const project of [...new Set(rows.map(([p]) => p))]) {
  const mine = rows.filter(([p]) => p === project);
  const files = [...new Set(mine.map(([, f]) => "e2e/" + f))];
  const grep = "(" + [...new Set(mine.map(([, , t]) => esc(t) + "$"))].join("|") + ")";
  const res = spawnSync("npx", ["playwright", "test", ...files, "--project=" + project, "--grep", grep, ...args], { cwd: WEB, stdio: "inherit" });
  status ||= res.status ?? 1;
}
process.exit(status);
