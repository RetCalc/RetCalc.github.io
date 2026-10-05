/* Compare: saved Basic, Advanced and Stages scenarios side by side. Read
   only by design: every figure comes from a saved scenario, run through the
   same math its own calculator uses, and nothing is written back. From
   src/js/app/05-compare.js. */
import { readScenarios } from "@/components/tools/ToolState";
import { project, projectBasic, projectSeries } from "@/lib/engine/typed";
import { fmtNum, fmtYears, money, pctStr } from "@/lib/format";
import type { Household } from "@/lib/household";
import { PERIOD_ADV } from "@/lib/periods";
import { ADVANCED_DEFAULTS, advancedPlan, type AdvancedInputs } from "@/tools/advanced/model";
import { BASIC_INPUTS, basicInput, type BasicInputs } from "@/tools/basic/model";
import { STAGES_DEFAULTS, stagesPlan, type StagesInputs } from "@/tools/stages/model";

export type CmpMode = "basic" | "advanced" | "stages";
export const CMP_MODES: CmpMode[] = ["basic", "advanced", "stages"];
export const CMP_MODE_LABEL: Record<CmpMode, string> = { basic: "Basic", advanced: "Advanced", stages: "Stages" };
export const CMP_LETTERS = ["A", "B", "C"];

export type Kind = "money" | "money2" | "pct" | "years" | "int";
export interface CmpRun {
  years: number;
  pts: { year: number; value: number }[];
  out: { k: string; n: number; kind: Kind }[];
  inp: [string, string][];
}
const row = (k: string, n: number, kind: Kind = "money") => ({ k, n, kind });

/** The slots Compare last showed, kept for the visit. */
export interface Slot { name: string; mode: CmpMode }
export const compareSlots: { list: Slot[] } = {
  list: [{ name: "", mode: "advanced" }, { name: "", mode: "advanced" }, { name: "", mode: "advanced" }],
};

export function rememberSlots(list: Slot[]): void {
  compareSlots.list = list;
}

export function savedNames(mode: CmpMode): string[] {
  return readScenarios(mode).map((x) => x.name);
}

/** One saved scenario as a chart line and two labeled sets of rows. */
export function cmpRun(mode: CmpMode, name: string, household: Household | null): CmpRun | null {
  const sc = name ? readScenarios(mode).find((x) => x.name === name) : null;
  if (!sc) return null;
  if (mode === "basic") {
    const b = { ...BASIC_INPUTS, ...(sc.data as Partial<BasicInputs>) };
    const p = basicInput(b);
    if (!(p.years > 0)) return null;
    const R = projectBasic(p);
    return {
      years: p.years,
      pts: [{ year: 0, value: p.initial }, ...R.years.map((y) => ({ year: y.year, value: y.end }))],
      out: [row("Value at retirement", R.fv), row("Income, per year (4%)", R.fv * 0.04), row("Income, per month", (R.fv * 0.04) / 12),
        row("You put in", R.contribTotal), row("Growth adds", R.growth), row("Years saving", p.years, "years")],
      inp: [["Age today", fmtNum(p.age)], ["Retirement age", fmtNum(p.retire)], ["Starting balance", money(p.initial)],
        ["Contribution", money(p.contrib, 2) + " " + PERIOD_ADV[p.period]], ["Growth after inflation", pctStr(p.real, 2)]],
    };
  }
  if (mode === "stages") {
    const P = stagesPlan({ ...STAGES_DEFAULTS, ...(sc.data as Partial<StagesInputs>) }, household);
    if (!P.stages.length) return null;
    const R = projectSeries(P.g, P.eff);
    if (!R.rows.length) return null;
    const g = P.g, defl = (yr: number) => Math.pow(1 + g.inflation, yr);
    const inp: [string, string][] = [["Starting value", money(g.initial)], ["Inflation", pctStr(g.inflation, 2)],
      ["Withdrawal rate", pctStr(g.withdrawal, 2)], ["Effective tax rate", pctStr(g.taxRate, 2)], ["Fees", pctStr(g.fees || 0, 2)]];
    P.stages.forEach((st, i) => {
      const nm = st.name || "Stage " + (i + 1);
      inp.push([nm + " · years", fmtNum(st.years)]);
      inp.push([nm + " · contribution", money(st.contrib, 2) + " " + PERIOD_ADV[st.period]]);
      inp.push([nm + " · contribution growth", pctStr(st.growth || 0, 2)]);
      inp.push([nm + " · rate of return", pctStr(st.nominal, 2)]);
    });
    return {
      years: R.totalYears,
      pts: [{ year: 0, value: g.initial }, ...R.rows.map((r) => ({ year: r.endYear, value: r.end / defl(r.endYear) }))],
      out: [row("Future value", R.fv), row("Inflation adjusted", R.fvReal), row("After-tax income, per year", R.afterTax),
        row("After-tax income, per month", R.afterTaxMo), row("Amount invested", R.invested), row("Growth", R.growth),
        row("Total contributions", R.contribTotal), row("Final contribution, inflation adj.", R.lastContribReal),
        row("Total years", R.totalYears, "years"), row("Stages", P.stages.length, "int")],
      inp,
    };
  }
  const p = advancedPlan({ ...ADVANCED_DEFAULTS, ...(sc.data as Partial<AdvancedInputs>) }, household).p;
  if (!(p.years > 0)) return null;
  const R = project(p);
  const defl = (yr: number) => Math.pow(1 + p.inflation, yr);
  const inp: [string, string][] = [["Starting value", money(p.initial || 0)], ["Contribution", money(p.contrib || 0, 2) + " " + PERIOD_ADV[p.period]],
    ["Contribution growth", pctStr(p.growth || 0, 2)], ["Time period", fmtYears(p.years)], ["Rate of return", pctStr(p.gross, 2)],
    ["Fees", pctStr(p.fees || 0, 2)], ["Return net of fees", pctStr(p.nominal, 2)], ["Inflation", pctStr(p.inflation, 2)],
    ["Withdrawal rate", pctStr(p.withdrawal, 2)], ["Effective tax rate", pctStr(p.taxRate, 2)]];
  if (p.glide.on) inp.push(["Glide", pctStr(p.glide.endRate!, 2) + " over the final " + fmtYears(p.glide.years!)]);
  return {
    years: p.years,
    pts: [{ year: 0, value: p.initial }, ...R.years.map((y) => ({ year: y.year, value: y.end / defl(y.year) }))],
    out: [row("Future value", R.fv), row("Inflation adjusted", R.fvReal), row("After-tax income, per year", R.afterTax),
      row("After-tax income, per month", R.afterTaxMo), row("Amount invested", R.invested), row("Growth", R.growth),
      row("Total contributions", R.contribTotal), row("Final contribution, inflation adj.", R.lastContribReal)],
    inp,
  };
}

export function cmpFmt(n: number | null, kind: Kind): string {
  if (n == null || !isFinite(n)) return "—";
  if (kind === "pct") return pctStr(n, 2);
  if (kind === "years") return fmtYears(n);
  if (kind === "int") return fmtNum(n);
  if (kind === "money2") return money(n, 2);
  return money(n);
}

export function cmpDelta(a: number | null, b: number | null, kind: Kind): { t: string; cls: string } | null {
  if (a == null || b == null || !isFinite(a) || !isFinite(b)) return null;
  const d = b - a;
  if (Math.abs(d) < 1e-9) return { t: "—", cls: "" };
  const body = kind === "pct" ? pctStr(Math.abs(d), 2) : kind === "years" ? fmtYears(Math.abs(d))
    : kind === "int" ? fmtNum(Math.abs(d)) : money(Math.abs(d), kind === "money2" ? 2 : 0);
  return { t: (d > 0 ? "+" : "−") + body, cls: d > 0 ? "pos" : "neg" };
}

/** The slots as Compare opens: every one on the calculator it was opened
    from, the first two on different saved scenarios where there are two. */
export function openingSlots(from: string): Slot[] {
  const mode: CmpMode = from === "basic" || from === "stages" ? from : "advanced";
  const names = savedNames(mode);
  const [a, b, c] = compareSlots.list.map((sl) => ({ ...sl, mode }));
  if (!names.includes(a.name)) a.name = names[0] || "";
  if (!names.includes(b.name) || b.name === a.name) b.name = names.find((x) => x !== a.name) || "";
  if (!names.includes(c.name)) c.name = "";
  return [a, b, c];
}
