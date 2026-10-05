/* The Early Retirement Bridge's inputs, and the parsing that clamps them
   into the plan brCtx() takes. From readBR() in src/js/app/36-bridge.js. */
import type { ToolDef } from "@/components/tools/ToolState";
import type { BrInput } from "@/lib/engine/types";
import { parseNum } from "@/lib/format";

export const BRIDGE_DEFAULTS = {
  age: "50", status: "m", state: "IL", spend: "60,000",
  trad: "1,000,000", k401: "400,000", roth: "150,000", rothBasis: "90,000", brok: "450,000", basis: "60",
  g457: "0", stock: "70", work: "0", workUntil: "55",
  aca: "1", household: "2", premium: "", fill: "auto", seppMethod: "amort", seppRate: "5",
};
export type BridgeInputs = typeof BRIDGE_DEFAULTS;

export const BRIDGE_DEF: ToolDef<BridgeInputs> = { id: "bridge", label: "Early Retirement Bridge", noun: "bridge plan", defaults: BRIDGE_DEFAULTS };

export const FILLS: [value: string, label: string][] = [
  ["auto", "Automatic: whatever holds up best"],
  ["none", "Nothing: no conversions"],
  ["need", "Only what the ladder needs"],
  ["zero", "Up to the standard deduction (no tax)"],
  ["b10", "To the top of the 10% bracket"],
  ["b12", "To the top of the 12% bracket"],
  ["aca", "Up to the ACA subsidy cliff"],
];

/* A blank field takes its default; anything else is held to the range. */
function num(raw: string, lo: number, hi: number, d: number): number {
  if (raw.trim() === "") return d;
  const v = parseNum(raw);
  return Math.max(lo, Math.min(hi, isFinite(v) ? v : d));
}

/** The age the plan starts at: the rule of 55's field shows only from 55. */
export const bridgeAge = (s: BridgeInputs) => Math.round(num(s.age, 30, 59, 50));

/** The inputs in the shape brCtx() takes. */
export function bridgeInput(s: BridgeInputs): BrInput {
  const trad = num(s.trad, 0, 1e10, 0), roth = num(s.roth, 0, 1e10, 0);
  return {
    status: s.status === "m" ? "m" : "s", state: s.state || "IL",
    age: bridgeAge(s), spend: num(s.spend, 0, 1e8, 0),
    trad, k401: bridgeAge(s) >= 55 ? Math.min(trad, num(s.k401, 0, 1e10, 0)) : 0,
    roth, rothBasis: Math.min(roth, num(s.rothBasis, 0, 1e10, 0)),
    brok: num(s.brok, 0, 1e10, 0), basisPct: num(s.basis, 0, 100, 100) / 100,
    g457: num(s.g457, 0, 1e10, 0), stock: num(s.stock, 0, 100, 70),
    work: num(s.work, 0, 1e8, 0), workUntil: num(s.workUntil, 0, 120, 0),
    aca: s.aca === "1", household: Math.round(num(s.household, 1, 10, 2)),
    premium: num(s.premium, 0, 1e5, 0),
    seppMethod: s.seppMethod === "rmd" ? "rmd" : "amort",
    seppRate: num(s.seppRate, 0, 12, 5) / 100,
    fill: s.fill || "auto",
  };
}
