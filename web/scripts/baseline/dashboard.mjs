#!/usr/bin/env node
/* The Dashboard's numbers check: runs a handful of Dashboard plans (the dev
   seed's couple, and variants of it) through the plan's own code, and
   compares the figures with ones recorded earlier.

     node scripts/baseline/dashboard.mjs record   # save them (dashboard.json)
     node scripts/baseline/dashboard.mjs check    # re-run; print differences

   Run from web/. Each plan keeps its savings at retirement, the share of
   historical retirements that last, and its saving year by year. */
import { register } from "node:module";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const QUIET = "--disable-warning=MODULE_TYPELESS_PACKAGE_JSON";
if (!process.execArgv.includes(QUIET)) {
  const { spawnSync } = await import("node:child_process");
  process.exit(spawnSync(process.execPath, [QUIET, ...process.argv.slice(1)], { stdio: "inherit" }).status ?? 1);
}

const HERE = dirname(fileURLToPath(import.meta.url));
const FILE = join(HERE, "dashboard.json");
register(pathToFileURL(join(HERE, "dash-loader.mjs")).href);
const { EMPTY_PROFILE, DEFAULT_ASSUMPTIONS } = await import("@/components/dashboard/store");
const { answers, results } = await import("@/components/dashboard/model");

const raw = JSON.parse(readFileSync(join(HERE, "..", "..", "public", "dev-seed.json"), "utf8"))["retcalc.dashboard.v1"];
const seed = typeof raw === "string" ? JSON.parse(raw) : raw;
const base = { ...EMPTY_PROFILE, ...seed.profile, assume: { ...DEFAULT_ASSUMPTIONS, ...seed.profile.assume } };
const year = new Date().getFullYear();

const PLANS = {
  "Couple, as seeded": (p) => p,
  "Couple, Jordan stops at 50": (p) => ({ ...p, p2: { ...p.p2, retire: 50 } }),
  "Single": (p) => ({ ...p, who: "single" }),
  "Two children planned": (p) => ({ ...p, planned: { count: 2, firstIn: 2, spacing: 3 } }),
  // As the store carries it over on loading: 2% raises for both.
  "Saving grows 2% (old per-line rates)": (p) => ({ ...p, growth: { match: 0.02, hsa: 0.02, rothIra: 0.02, k401max: 0.02, brok: 0.02 }, yearly: { raise: [0.02, 0.02], keep: null } }),
  "Save $600 less from 50 to 55": (p) => ({ ...p, scenarios: [{ id: "x", kind: "saving", name: "", on: true, from: year - p.p1.by + 8, until: year - p.p1.by + 13, mode: "amount", amount: -600, ramp: 0, acct: "auto", nominal: 0 }] }),
};

function run() {
  const out = {};
  for (const [name, f] of Object.entries(PLANS)) {
    const pr = f(structuredClone(base)), a = answers(pr, seed.entries), R = results(pr, seed.entries);
    out[name] = {
      fv: R.S ? Math.round(R.S.fv) : null,
      success: R.success != null ? +R.success.toFixed(4) : null,
      yearly: (a.yearly ?? []).map((y) => Math.round(y.t + y.r + y.b)),
    };
  }
  return out;
}

const mode = process.argv[2];
const now = run();
if (mode === "record") {
  writeFileSync(FILE, JSON.stringify({ when: new Date().toISOString(), plans: now }, null, 1));
  console.log("Recorded " + Object.keys(now).length + " plans.");
} else {
  if (!existsSync(FILE)) { console.error("No dashboard.json yet: run with record first."); process.exit(1); }
  const was = JSON.parse(readFileSync(FILE, "utf8")).plans;
  let diff = 0;
  for (const [name, n] of Object.entries(now)) {
    const o = was[name];
    if (!o) { console.log("+ " + name + " (new)"); continue; }
    const fvd = n.fv != null && o.fv != null ? n.fv - o.fv : null;
    const same = n.fv === o.fv && n.success === o.success && JSON.stringify(n.yearly) === JSON.stringify(o.yearly);
    if (same) { console.log("✓ " + name); continue; }
    diff++;
    console.log("✗ " + name);
    console.log("   at retirement: " + o.fv + " => " + n.fv + (fvd != null ? "  (" + (fvd >= 0 ? "+" : "") + fvd + ", " + (o.fv ? ((fvd / o.fv) * 100).toFixed(1) : "?") + "%)" : ""));
    console.log("   lasting:       " + o.success + " => " + n.success);
    const k = n.yearly.findIndex((v, i) => v !== o.yearly[i]);
    if (k >= 0) console.log("   saving a month from year " + k + ": " + o.yearly.slice(k, k + 6).join(", ") + " => " + n.yearly.slice(k, k + 6).join(", "));
  }
  if (diff) process.exit(1);
}
