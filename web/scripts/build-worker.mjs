#!/usr/bin/env node
/* Builds public/engine-worker.js: the engine (math.js, drawdown.js and
   plan.js, between their START and END markers, `export` dropped) and
   lib/engine/worker-glue.js, as one plain script a Web Worker can load. The
   same assembly tests/run.py makes, and build.py made for the old site.
   Runs before `next build` and `next dev` (package.json). */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const WEB = join(dirname(fileURLToPath(import.meta.url)), "..");
const engine = (name, tag) => {
  const text = readFileSync(join(WEB, "lib", "engine", name + ".js"), "utf8");
  const a = text.indexOf("// ===" + tag + " START==="), b = text.indexOf("// ===" + tag + " END===");
  if (a < 0 || b < 0) throw new Error(name + ".js has lost its " + tag + " markers");
  return text.slice(a, b).replace(/^export /gm, "");
};
const out = [
  "/* Built by scripts/build-worker.mjs from web/lib/engine; don't edit. */",
  engine("math", "MATH"), engine("drawdown", "DRAWDOWN"), engine("plan", "PLAN"),
  readFileSync(join(WEB, "lib", "engine", "worker-glue.js"), "utf8"),
].join("\n;\n");
writeFileSync(join(WEB, "public", "engine-worker.js"), out);
console.log("public/engine-worker.js: " + Math.round(out.length / 1024) + " KB");
