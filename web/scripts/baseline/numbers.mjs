#!/usr/bin/env node
/* The redesign's numbers check: runs the saved scenarios (scenarios.mjs)
   through the app's calculation code and compares them with the baseline
   recorded before the redesign started.

     node scripts/baseline/numbers.mjs record   # save the baseline (baseline.json)
     node scripts/baseline/numbers.mjs check    # re-run; print differences, exit 1 if any

   Run from web/. Each scenario stores its headline figures, rounded to the
   cent, and a fingerprint of every field of its full results: a headline
   that moves is printed old => new; a change only in the detail (a year's
   row, a chart's band) names the fields that changed. */
import { register } from "node:module";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

/* Node warns that web/package.json doesn't say "type": "module" each time it
   loads a .ts file. That's expected here, so the script runs itself again
   with only that warning turned off. */
const QUIET = "--disable-warning=MODULE_TYPELESS_PACKAGE_JSON";
if (!process.execArgv.includes(QUIET)) {
  const { spawnSync } = await import("node:child_process");
  process.exit(spawnSync(process.execPath, [QUIET, ...process.argv.slice(1)], { stdio: "inherit" }).status ?? 1);
}

const HERE = dirname(fileURLToPath(import.meta.url));
const FILE = join(HERE, "baseline.json");
register(pathToFileURL(join(HERE, "loader.mjs")).href);
const { SCENARIOS } = await import("./scenarios.mjs");

/* Numbers rounded so float noise in the last digits never counts as a
   change: the headline figures to 4 places (cents, and rates like 0.2563),
   the detail to 6. */
const tidy = (v, places) => JSON.parse(JSON.stringify(v, (_, x) => (typeof x === "number" ? +x.toFixed(places) : x)));
const fingerprint = (v) => createHash("sha256").update(JSON.stringify(tidy(v, 6))).digest("hex").slice(0, 16);

function runAll() {
  return SCENARIOS.map((s) => {
    const { full, out } = s.run();
    const fields = Object.fromEntries(Object.keys(full).sort().map((k) => [k, fingerprint(full[k])]));
    return { id: `${s.tool}: ${s.name}`, out: tidy(out, 4), fields, expect: s.expect };
  });
}

/* The worked examples' known answers, checked on every run. */
function checkExpected(results) {
  let bad = 0;
  for (const r of results) for (const [k, want] of Object.entries(r.expect ?? {})) {
    const got = Math.round(r.out[k]);
    if (got !== want) { bad++; console.log(`✗ ${r.id}\n    ${k}: expected ${want}, got ${got}`); }
  }
  return bad;
}

function flat(o, pre = "") {
  return Object.entries(o).flatMap(([k, v]) => (v && typeof v === "object" ? flat(v, pre + k + ".") : [[pre + k, v]]));
}

const cmd = process.argv[2];
const results = runAll();

if (cmd === "record") {
  if (checkExpected(results)) process.exit(1);
  const save = results.map(({ expect, ...r }) => r);
  writeFileSync(FILE, JSON.stringify({ recorded: new Date().toISOString(), scenarios: save }, null, 2) + "\n");
  console.log(`Recorded ${save.length} scenarios to ${FILE}`);
  for (const r of save) console.log("  " + r.id);
} else if (cmd === "check") {
  if (!existsSync(FILE)) { console.log("No baseline yet: run `node scripts/baseline/numbers.mjs record` first."); process.exit(2); }
  const base = JSON.parse(readFileSync(FILE, "utf8"));
  let diffs = checkExpected(results);
  const byId = new Map(results.map((r) => [r.id, r]));
  for (const b of base.scenarios) {
    const r = byId.get(b.id);
    if (!r) { diffs++; console.log(`✗ ${b.id}\n    scenario missing from scenarios.mjs`); continue; }
    const lines = [];
    const now = new Map(flat(r.out));
    for (const [k, v] of flat(b.out)) if (now.get(k) !== v) lines.push(`${k}: ${v} => ${now.get(k)}`);
    const changed = Object.keys({ ...b.fields, ...r.fields }).filter((k) => b.fields[k] !== r.fields[k]);
    if (changed.length) lines.push(`detail changed in: ${changed.join(", ")}`);
    if (lines.length) { diffs++; console.log(`✗ ${b.id}\n    ${lines.join("\n    ")}`); }
    else console.log(`✓ ${b.id}`);
    byId.delete(b.id);
  }
  for (const id of byId.keys()) console.log(`? ${id}\n    new scenario, not in the baseline (record again to add it)`);
  console.log(diffs ? `\n${diffs} scenario(s) differ from the baseline recorded ${base.recorded}.` : `\nAll ${base.scenarios.length} scenarios match the baseline recorded ${base.recorded}.`);
  process.exit(diffs ? 1 : 0);
} else {
  console.log("Usage: node scripts/baseline/numbers.mjs record | check");
  process.exit(2);
}
