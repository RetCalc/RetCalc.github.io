/* The Roth Conversion & RMDs tool's inputs, and the parsing that clamps
   them into a plan runRoth() can take. From src/js/app/17-roth.js. */
import type { ToolDef } from "@/components/tools/ToolState";
import { groupDigits, parseNum } from "@/lib/format";

const g = (v: number) => groupDigits(v, true);
export const ROTH_DEFAULTS = {
  age: "62", spouseAge: "62", status: "m", state: "IL", endAge: "92",
  trad: g(1500000), roth: g(150000), brok: g(400000), basis: "60", ret: "5", spend: g(100000),
  ss: g(36000), ssAge: "67", spSS: g(22000), spSSAge: "67", other: "0", otherStart: "62",
  death: "15", strategy: "brk", bracket: "0.22", irmaaTarget: "0", fixed: g(75000),
  pct: "8", startAge: "62", stopAge: "75", payFrom: "taxable", heir: "32", disc: "3", irmaaOn: "1",
};
export type RothInputs = typeof ROTH_DEFAULTS;

export const ROTH_DEF: ToolDef<RothInputs> = { id: "roth", label: "Roth Conversion", noun: "Roth plan", defaults: ROTH_DEFAULTS };

export const STRATEGIES: Record<string, string> = {
  brk: "Fill to the top of a bracket", irm: "Fill to an IRMAA threshold", fix: "A fixed amount each year",
  pct: "A share of the balance each year", none: "No conversions",
};

/* As on the old site, a blank field reads as 0; the fallbacks are there for
   anything that still isn't a number. */
function clamp(v: number, lo: number, hi: number, fallback: number): number {
  const x = Math.round(v);
  return isFinite(x) ? Math.max(lo, Math.min(hi, x)) : fallback;
}
const n = parseNum;
const z = (v: number) => (isFinite(v) ? v : 0);

/** The inputs in the shape runRoth() takes. */
export function rothInput(s: RothInputs) {
  const status = s.status === "m" ? "m" : "s";
  const age = clamp(n(s.age), 30, 95, 62);
  return {
    age, spouseAge: clamp(n(s.spouseAge), 30, 105, age), status, state: s.state,
    endAge: clamp(n(s.endAge), age + 1, 100, Math.min(100, age + 30)),
    trad: z(n(s.trad)), roth: z(n(s.roth)), brokerage: z(n(s.brok)),
    basisPct: Math.max(0, Math.min(1, z(n(s.basis)) / 100)), ret: z(n(s.ret)) / 100, spend: z(n(s.spend)),
    ss: z(n(s.ss)), ssAge: clamp(n(s.ssAge), 62, 70, 67),
    spSS: status === "m" ? z(n(s.spSS)) : 0, spSSAge: clamp(n(s.spSSAge), 62, 70, 67),
    other: z(n(s.other)), otherStart: clamp(n(s.otherStart), 30, 100, age),
    deathYear: status === "m" ? clamp(n(s.death), 0, 45, 0) : 0,
    strategy: s.strategy, bracket: parseFloat(s.bracket) || 0.22, irmaaTarget: parseInt(s.irmaaTarget, 10) || 0,
    fixedAmt: z(n(s.fixed)), pctAmt: z(n(s.pct)) / 100,
    startAge: clamp(n(s.startAge), 30, 100, age), stopAge: clamp(n(s.stopAge), 30, 100, 100),
    payFrom: s.payFrom, heirRate: Math.max(0, Math.min(1, z(n(s.heir)) / 100)), disc: z(n(s.disc)) / 100,
    irmaaOn: s.irmaaOn === "1",
  };
}
