/* The Income Tax tool's inputs and its one entry point to the engine, apart
   from the screen so the Budget can copy net pay from it. From
   src/js/app/11-income-tax.js and 23-scenarios.js. */
import type { ToolDef } from "@/components/tools/ToolState";
import { NEWEST_YEAR, computeRetireTax, computeTax, dataYears } from "@/lib/engine/typed";
import { groupDigits, oneOf, parseNum } from "@/lib/format";
import { localFor } from "./local";

const g = (v: number) => groupDigits(v, true);
export const TAX_DEFAULTS = {
  mode: "normal" as "normal" | "retire",
  /** Normal mode's headline: net pay (after taxes) or take-home (after pre-tax savings too). */
  view: "net" as "net" | "take",
  gross: g(100000), gross2: g(0), status: "s", state: "IL", pre: g(0), dedType: "std", item: g(0),
  trad: g(40000), roth: g(10000), brok: g(20000), gainPct: "40", ss: g(30000), pension: g(0),
  penType: "priv", other: g(0),
  /** Retirement mode: each person's age in the year being taxed (their age
      at the end of it). Federal rules read 65, and every state has its own
      ages (Iowa 55, Georgia 62, New York 59½ and so on). The spouse's counts
      only on a joint return. */
  age: "65", spouseAge: "65",
  /** Where an older saved copy or share link left "Age 65 or older" (0, 1 or
      2 people). It decodes to ages in \`clean\` and is empty otherwise. */
  seniors: "",
  /** Normal mode's pre-tax deductions by kind and earner (the Pre-tax
      deductions pop-up), in place of the one figure in `pre` while
      `itemize` is on. The spouse's (…2) count only on a joint return. */
  itemize: false,
  k401: g(0), ira: g(0), hsa: g(0), health: g(0), dother: g(0),
  k4012: g(0), ira2: g(0), hsa2: g(0), health2: g(0), dother2: g(0),
  /** How the pop-up shows each line's amounts, in PRE_ROWS order: per
      paycheck ("check", with prePay paychecks a year), per month or per
      year. They're kept as a year of each either way. */
  preUnits: "year,year,year,year,year", prePay: "26",
  /** The tax year: the newest there are figures for, unless picked. Saved
      and shared with the rest, so a scenario keeps its year's rules. */
  year: String(NEWEST_YEAR),
  /** A local (city, county or school district) income tax, optional and
      only in a state that has them (local.ts): its rate in percent, and
      whether it's on wages or the state's taxable income ("" for the
      state's usual). */
  localRate: "0", localBase: "" as "" | "wages" | "state",
};
export type TaxInputs = typeof TAX_DEFAULTS;

/** The pop-up's rows: the kind, the engine's name for it, and each earner's field. */
export const PRE_ROWS = [
  { kind: "k401", you: "k401", spouse: "k4012", name: "Traditional 401(k), 403(b) or 457", desc: "Your own deferrals, not the employer match. Off income tax, not FICA." },
  { kind: "ira", you: "ira", spouse: "ira2", name: "Traditional IRA", desc: "Deductible as far as the income limits allow when you have a plan at work." },
  { kind: "hsa", you: "hsa", spouse: "hsa2", name: "HSA", desc: "Through payroll: off income tax and FICA." },
  { kind: "health", you: "health", spouse: "health2", name: "Health, dental and vision premiums", desc: "Paid through work before tax. Off income tax and FICA." },
  { kind: "other", you: "dother", spouse: "dother2", name: "Other pre-tax", desc: "FSAs, commuter benefits and the like. Off income tax, not FICA." },
] as const;
export type PreField = (typeof PRE_ROWS)[number]["you" | "spouse"];

/** Whether the pre-tax deductions come by kind: Normal mode with the
    pop-up's breakdown in use. Retirement mode keeps the one figure. */
export const itemized = (t: TaxInputs) => t.mode === "normal" && !!t.itemize;

/** The breakdown as the engine takes it: [you, spouse], each by kind. */
export function preBuckets(t: TaxInputs) {
  const n = (v: string) => parseNum(v);
  const joint = t.status === "m";
  return [0, 1].map((i) => Object.fromEntries(PRE_ROWS.map((r) => [r.kind, i === 1 && !joint ? 0 : n(t[i ? r.spouse : r.you])]))) as Record<string, number>[];
}

/** The breakdown's total, for the field that shows it. */
export function preTotal(t: TaxInputs): number {
  return preBuckets(t).reduce((a, p) => a + Object.values(p).reduce((x, y) => x + y, 0), 0);
}

/** The ages an older "how many are 65 or older" answer stands for: a person
    who counted is 65, one who did not is 50 (younger than every state's age
    rule, so the answer comes out as it always did). */
export function agesFromSeniors(seniors: number, joint: boolean): [number, number] {
  const n = Math.max(0, Math.min(joint ? 2 : 1, seniors));
  return [n >= 1 ? 65 : 50, n >= 2 ? 65 : 50];
}

export const TAX_DEF: ToolDef<TaxInputs> = {
  id: "tax", label: "Tax", noun: "tax scenario", defaults: TAX_DEFAULTS,
  clean: (t) => {
    const status = oneOf(t.status, ["s", "m"], "s");
    const out = { ...t, status, dedType: oneOf(t.dedType, ["std", "item"], "std") };
    // A copy from before the age fields: turn its "65 or older" answer into ages.
    if (out.seniors !== "") {
      const [a, b] = agesFromSeniors(parseInt(out.seniors, 10) || 0, status === "m");
      out.age = String(a);
      out.spouseAge = String(b);
      out.seniors = "";
    }
    return out;
  },
};

/** The years the Tax year picker offers, newest first. It shows only once
    there's more than one. */
export function taxYears(): number[] {
  return dataYears();
}
/** The year the inputs ask for, or the newest when it isn't one there are
    figures for (a link from before the year was dropped, say). */
export function taxYearOf(t: TaxInputs): number {
  const y = parseInt(t.year, 10);
  return taxYears().includes(y) ? y : taxYears()[0];
}

/** The inputs as the engine takes them, in either mode. Only the Income Tax
    tool itself runs its chosen year (`ownYear`); the tools that borrow its
    inputs (Budget, Healthcare, the Guide) get the newest year's rules, as
    everything else on the site does. */
export function taxInput(t: TaxInputs, ownYear = false) {
  const n = (v: string) => parseNum(v);
  const status = t.status;
  // Each person's age (blank is left out, so no age rule applies to them), and
  // how many are 65 or older for the federal rules.
  const ageOf = (v: string) => { const x = parseNum(v); return v.trim() !== "" && isFinite(x) ? Math.max(0, Math.min(120, x)) : null; };
  const ages = (status === "m" ? [t.age, t.spouseAge] : [t.age]).map(ageOf).filter((a): a is number => a != null);
  const seniors = ages.filter((a) => a >= 65).length;
  const trad = n(t.trad), roth = n(t.roth), brok = n(t.brok), ss = n(t.ss), pension = n(t.pension), other = n(t.other);
  // A spouse's income is separate only in Normal mode, where FICA's
  // per-earner wage cap makes the split matter.
  const gross2 = t.mode === "normal" && status === "m" ? n(t.gross2) : 0;
  return {
    mode: t.mode,
    gross: t.mode === "retire" ? trad + roth + brok + ss + pension + other : n(t.gross),
    gross2, trad, roth, brok, ss, pension, other,
    penPublic: t.penType === "pub", gainPct: n(t.gainPct) / 100, seniors, ages,
    status: status as "s" | "m", state: t.state,
    pre: itemized(t) ? preTotal(t) : n(t.pre), ded: itemized(t) ? preBuckets(t) : undefined, dedType: t.dedType as "std" | "item", item: n(t.item),
    year: ownYear ? taxYearOf(t) : taxYears()[0],
    ...localFor(t.state, t.localRate, t.localBase),
  };
}

/* One entry point: both modes return the same core keys. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- the engine's result is described where it's read
export function runTax(inp: ReturnType<typeof taxInput>): any {
  return inp.mode === "retire" ? computeRetireTax(inp) : computeTax(inp);
}

/** The deduction line under "How the federal tax was figured": the label and
    the amount follow the deduction the return takes, standard or itemized.
    Retirement mode adds the age 65 amounts that came with it. */
export function deductionLine(dedType: string, seniors: number, fedDed: number): { label: string; amount: number } {
  return { label: (dedType === "item" ? "Itemized deduction" : "Standard deduction") + (seniors > 0 ? ", incl. 65+" : ""), amount: fedDed };
}
