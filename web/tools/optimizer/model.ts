/* The Retirement Plan Optimizer's inputs, and the plan they describe. From opToolIn(),
   opSyncFields() and opSetMode() in src/js/app/31b-plan-optimizer.js and
   src/main/25b-optimizer-inputs.html. */
import type { ToolDef } from "@/components/tools/ToolState";
import { BASIC_INFL, HIST_START, NEWEST_YEAR, ssFRA, ssFraFromAge } from "@/lib/engine/typed";
import { ssEstimate } from "@/lib/engine/typed-drawdown";
import type { PlToday } from "@/lib/engine/types";
import { parseNum } from "@/lib/format";

export const OP_DEFAULTS = {
  mode: "ret", status: "m", state: "IL", age: "58", spAge: "56", retire: "62", spRet: "60",
  trad: "1,200,000", roth: "250,000", rothBasis: "120,000", brok: "350,000", basis: "60",
  saveTrad: "2,000", saveRoth: "500", saveBrok: "0", risk: "0.045", riskFrom: "",
  spend: "90,000", mix: "60", ss1: "3,000", inc1: "", ss2: "1,800", inc2: "", claim: "",
  /* The years you and your spouse were born, which set each full retirement
     age. Blank: this year less the age above (67 when that is blank too). Links
     and saved plans from before these fields have neither. */
  birth: "", spBirth: "",
  pension: "0", penAge: "", penCola: "0", aca: "1", rule55: "0", heir: "24", target: "0.9",
};
export type OptimizerInputs = typeof OP_DEFAULTS;

export const OP_DEF: ToolDef<OptimizerInputs> = { id: "optimizer", label: "Retirement Plan Optimizer", noun: "optimizer plan", defaults: OP_DEFAULTS };


/* A blank field takes its default; anything else is held to the range. */
function num(raw: string, lo: number, hi: number, d: number): number {
  if (raw.trim() === "") return d;
  const v = parseNum(raw);
  return Math.max(lo, Math.min(hi, isFinite(v) ? v : d));
}

/** Which mode the inputs are in, and the ages the fields show. */
export function opView(s: OptimizerInputs) {
  const married = s.status === "m", now = s.mode === "now";
  const retire = Math.round(num(s.retire, 30, 90, 62)), age = now ? Math.round(num(s.age, 18, 90, 58)) : retire;
  return { married, now, retire, age };
}

// The benefit at full retirement age is the same whatever age it is claimed at,
// and whatever that full retirement age is.
const ssPia = (income: number, years: number) => ssEstimate(income, years, 67).pia;

/** A birth year as typed, when it is a plausible one. */
function birthYear(raw: string): number | null {
  const v = Math.round(parseNum(String(raw ?? "")));
  return isFinite(v) && v >= 1900 && v <= NEWEST_YEAR ? v : null;
}

/** Your and your spouse's full retirement age, in years (66.5 is 66 and 6
    months), from the year each was born: the year typed, else this year less
    the age field (Today mode's age, or the household's), else 67. */
export function opFras(s: OptimizerInputs): { fra1: number; fra2: number } {
  const age = (raw: string) => { const v = parseNum(String(raw ?? "")); return isFinite(v) && v > 0 ? v : null; };
  const one = (birth: string, ageRaw: string) => { const b = birthYear(birth); return b != null ? ssFRA(b) : ssFraFromAge(age(ageRaw)); };
  return { fra1: one(s.birth, s.age), fra2: s.status === "m" ? one(s.spBirth, s.spAge) : 67 };
}

/** The plan, from today, as plAtRetire() takes it. */
export function opToolIn(s: OptimizerInputs): PlToday {
  const m = s.status === "m", now = s.mode === "now";
  const age = Math.round(now ? num(s.age, 18, 90, 58) : num(s.retire, 30, 90, 62));
  const retire = now ? Math.max(age, Math.round(num(s.retire, 30, 90, 62))) : age;
  const spAge = !m ? null : now ? Math.round(num(s.spAge, 18, 95, age)) : Math.round(num(s.spRet, 18, 95, retire));
  const yrs1 = Math.max(1, Math.min(35, retire - 22));
  const spRet = m ? spAge! + (retire - age) : retire;
  const ss1 = num(s.ss1, 0, 1e5, 0), ss2 = m ? num(s.ss2, 0, 1e5, 0) : 0;
  const pia1 = ss1 > 0 ? ss1 : ssPia(num(s.inc1, 0, 1e8, 0), yrs1);
  const pia2 = !m ? 0 : ss2 > 0 ? ss2 : ssPia(num(s.inc2, 0, 1e8, 0), Math.max(1, Math.min(35, spRet - 22)));
  const roth = num(s.roth, 0, 1e10, 0), brok = num(s.brok, 0, 1e10, 0);
  const F = opFras(s);
  // Blank: the usual plan claims at full retirement age, to the nearest year.
  const claim1 = (s.claim ?? "").trim() === "" ? Math.round(F.fra1) : Math.round(num(s.claim, 62, 70, 67));
  const claim2 = (s.claim ?? "").trim() === "" ? Math.round(F.fra2) : claim1;
  const years = Math.max(20, Math.min(60, Math.max(95 - retire, m ? 95 - spRet : 0)));
  const save = (v: string) => (now ? num(v, 0, 1e7, 0) : 0);
  return {
    status: m ? "m" : "s", state: s.state || "IL", age, spouseAge: spAge, retire, stopAge: null,
    trad: num(s.trad, 0, 1e10, 0), roth, rothBasis: Math.min(roth, num(s.rothBasis, 0, 1e10, roth * 0.5)),
    brok, brokBasis: (brok * num(s.basis, 0, 100, 60)) / 100,
    saveTrad: save(s.saveTrad), saveRoth: save(s.saveRoth), saveBrok: save(s.saveBrok),
    real: parseFloat(s.risk) || 0.045, infl: BASIC_INFL as number,
    spend: num(s.spend, 0, 1e8, 0), pia1, pia2, claim1, claim2, fra1: F.fra1, fra2: F.fra2,
    pension: num(s.pension, 0, 1e8, 0), pensionAge: s.penAge.trim() === "" ? null : Math.round(num(s.penAge, 40, 90, retire)),
    pensionCola: s.penCola === "1", aca: s.aca === "1", household: m ? 2 : 1,
    rule55: s.rule55 === "1", heirRate: num(s.heir, 0, 50, 24) / 100, mix: num(s.mix, 0, 100, 60),
    years, target: parseFloat(s.target) || 0.9, strategy: "fixed", minSpend: 0, fromYear: HIST_START as number,
  };
}

/** Switching modes keeps the balances as typed (their meaning changes, and
    the heading says so) and carries the spouse's age across. */
export function opSetMode(s: OptimizerInputs, to: "ret" | "now"): OptimizerInputs {
  const age = parseNum(s.age), r = parseNum(s.retire), next = { ...s, mode: to };
  if (to === "ret" && age > 0 && r > 0 && parseNum(s.spAge) > 0) next.spRet = String(Math.round(parseNum(s.spAge) + (r - age)));
  if (to === "now" && age > 0 && r > 0 && parseNum(s.spRet) > 0) next.spAge = String(Math.round(parseNum(s.spRet) - (r - age)));
  return next;
}
