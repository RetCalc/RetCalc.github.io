/* "Copy from Advanced or Stages": whichever has its savings split by account
   type. Each is worked out from its inputs as last left, so the numbers are
   the ones on its screen. From opSources(), opSourceSaving() and opCopy() in
   src/js/app/31b-plan-optimizer.js. */
import { toolInputs } from "@/components/tools/ToolState";
import { matchPer, type AccountResult, type Accounts } from "@/lib/accounts";
import { PPY, RISKS } from "@/lib/engine/typed";
import { fmtNum, groupDigits, money, pctStr } from "@/lib/format";
import type { Household } from "@/lib/household";
import { STATE_OPTIONS } from "@/lib/states";
import { ADVANCED_DEFAULTS, advancedPlan } from "@/tools/advanced/model";
import { STAGES_DEFAULTS, stageSplit, stagesPlan } from "@/tools/stages/model";
import { type OptimizerInputs } from "./model";
import { opCompact } from "./words";

export interface Source {
  label: string; B: AccountResult; a: Accounts; years: number; defl: number;
  /** What it puts in each month, today, with any match, and its return after inflation. */
  saving: { t: number; r: number; b: number; real: number };
  notes: string[];
}

export function opSources(profile: Household | null): Source[] {
  const out: Source[] = [];
  const adv = toolInputs("advanced", ADVANCED_DEFAULTS);
  if (adv.acOn) {
    const { p, a, B } = advancedPlan(adv, profile);
    if (a && B) {
      const ppy = (PPY as Record<string, number>)[p.period], mo = (v: number) => (v * ppy) / 12;
      const notes = [];
      if (Math.abs(p.growth - p.inflation) > 0.0025) notes.push("Advanced raises your saving " + pctStr(p.growth, 1) + " a year; here it keeps pace with inflation");
      if (p.glide?.on) notes.push("the glide path isn't carried over");
      out.push({ label: "Advanced", B, a, years: p.years, defl: Math.pow(1 + p.inflation, p.years), notes,
        saving: { t: mo(a.tradC + matchPer(a, ppy)), r: mo(a.rothC), b: mo(a.brokC), real: (1 + p.nominal) / (1 + p.inflation) - 1 } });
    }
  }
  const st = toolInputs("stages", STAGES_DEFAULTS);
  if (st.saOn) {
    const { g, stages, eff, B } = stagesPlan(st, profile);
    if (B && g.acct) {
      const years = B.years ?? 0, e = eff[0];
      let saving = { t: 0, r: 0, b: 0, real: 0.045 };
      if (e) {
        const ppy = (PPY as Record<string, number>)[e.period], sp = stageSplit(stages[0]), mine = Math.max(0, e.mine), mo = (v: number) => (v * ppy) / 12;
        saving = { t: mo(mine * sp.t + mine * (e.mf - 1)), r: mo(mine * sp.r), b: mo(mine * sp.b), real: (1 + e.nominal) / (1 + g.inflation) - 1 };
      }
      out.push({ label: "Stages", B, a: g.acct, years, defl: Math.pow(1 + g.inflation, years), saving,
        notes: stages.length > 1 ? ["only stage 1's saving comes across; Retirement day mode keeps every stage"] : [] });
    }
  }
  return out;
}

/** What each source offers, for the pop-up that picks one. */
export function sourceDesc(x: Source, now: boolean): string {
  if (now) {
    const v = x.saving;
    return opCompact(x.a.tradBal + x.a.rothBal + x.a.brokBal) + " today, saving " + money(v.t + v.r + v.b) + "/mo";
  }
  return opCompact(x.B.totalReal) + " at retirement, in " + fmtNum(x.years) + " years";
}

/** The inputs with the source copied in, and the toast that says so. */
export function copyFrom(s: OptimizerInputs, pick: Source, profile: Household | null): { next: OptimizerInputs; msg: string } {
  const now = s.mode === "now", B = pick.B, a = pick.a, notes: string[] = [];
  const put = (v: number) => groupDigits(Math.round(Math.max(0, v)), true);
  const next = { ...s };
  if (a.status) next.status = a.status;
  if (a.state && STATE_OPTIONS.some((o) => o.code === a.state)) next.state = a.state;
  if (now) {
    next.trad = put(a.tradBal); next.roth = put(a.rothBal); next.brok = put(a.brokBal);
    next.rothBasis = put(a.rothBal * 0.5);
    next.basis = String(a.brokBal > 0 ? Math.round(Math.min(1, (a.brokBasis == null ? a.brokBal : a.brokBasis) / a.brokBal) * 100) : 100);
    const v = pick.saving;
    next.saveTrad = put(v.t); next.saveRoth = put(v.r); next.saveBrok = put(v.b);
    // one of the usual levels if it is one, or its own
    const hit = RISKS.find((r) => Math.abs(r.real - v.real) < 5e-4);
    next.risk = String(hit ? hit.real : Math.round(v.real * 1e5) / 1e5);
    next.riskFrom = hit ? "" : pick.label;
    const age = parseFloat(s.age.replace(/,/g, ""));
    if (age > 0) next.retire = String(Math.round(age + pick.years));
    notes.push(...pick.notes);
  } else {
    next.trad = put(B.real.trad); next.roth = put(B.real.roth); next.brok = put(B.real.brok);
    // Roth contributions: half of today's Roth (the part that's growth isn't
    // known), plus everything put in along the way, in today's dollars.
    next.rothBasis = put(Math.min(B.real.roth, (a.rothBal * 0.5 + (B.rothIn || 0)) / pick.defl));
    next.basis = String(Math.round(Math.max(0, Math.min(1, 1 - B.gainPct)) * 100));
    if (profile?.age && profile.age > 0) {
      next.retire = String(Math.round(profile.age + pick.years));
      if (a.status === "m" && profile.spouseAge && profile.spouseAge > 0) next.spRet = String(Math.round(profile.spouseAge + pick.years));
    } else notes.push("check your age at retirement: " + pick.label + " counts years, not ages");
  }
  const tot = now ? a.tradBal + a.rothBal + a.brokBal : B.totalReal;
  return { next, msg: "Copied " + opCompact(tot) + (now ? " today" : " at retirement") + " from " + pick.label + (notes.length ? ". Note: " + notes.join("; ") + "." : "") };
}
