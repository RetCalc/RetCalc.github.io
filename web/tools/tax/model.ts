/* The Income Tax tool's inputs and its one entry point to the engine, apart
   from the screen so the Budget can copy net pay from it. From
   src/js/app/11-income-tax.js and 23-scenarios.js. */
import type { ToolDef } from "@/components/tools/ToolState";
import { computeRetireTax, computeTax } from "@/lib/engine/typed";
import { groupDigits, parseNum } from "@/lib/format";

const g = (v: number) => groupDigits(v, true);
export const TAX_DEFAULTS = {
  mode: "normal" as "normal" | "retire",
  /** Normal mode's headline: net pay (after taxes) or take-home (after pre-tax savings too). */
  view: "net" as "net" | "take",
  gross: g(100000), gross2: g(0), status: "s", state: "IL", pre: g(0), dedType: "std", item: g(0),
  trad: g(40000), roth: g(10000), brok: g(20000), gainPct: "40", ss: g(30000), pension: g(0),
  penType: "priv", other: g(0), seniors: "1",
};
export type TaxInputs = typeof TAX_DEFAULTS;

export const TAX_DEF: ToolDef<TaxInputs> = { id: "tax", label: "Tax", noun: "tax scenario", defaults: TAX_DEFAULTS };

/** The inputs as the engine takes them, in either mode. */
export function taxInput(t: TaxInputs) {
  const n = (v: string) => parseNum(v);
  const status = t.status;
  const seniors = Math.min(status === "m" ? 2 : 1, parseInt(t.seniors, 10) || 0);
  const trad = n(t.trad), roth = n(t.roth), brok = n(t.brok), ss = n(t.ss), pension = n(t.pension), other = n(t.other);
  // A spouse's income is separate only in Normal mode, where FICA's
  // per-earner wage cap makes the split matter.
  const gross2 = t.mode === "normal" && status === "m" ? n(t.gross2) : 0;
  return {
    mode: t.mode,
    gross: t.mode === "retire" ? trad + roth + brok + ss + pension + other : n(t.gross),
    gross2, trad, roth, brok, ss, pension, other,
    penPublic: t.penType === "pub", gainPct: n(t.gainPct) / 100, seniors,
    status: status as "s" | "m", state: t.state, pre: n(t.pre), dedType: t.dedType as "std" | "item", item: n(t.item),
  };
}

/* One entry point: both modes return the same core keys. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- the engine's result is described where it's read
export function runTax(inp: ReturnType<typeof taxInput>): any {
  return inp.mode === "retire" ? computeRetireTax(inp) : computeTax(inp);
}
