/* Carries Advanced's plan into Stages as two stages: the plan as entered and
   then either ten more years of the same (Model these numbers in Stages) or,
   for Coast FIRE, the years after contributions stop. Split by account type
   carries across as-is: the same balances, match and tax settings, and each
   stage's contribution split in the same shares. A glide only makes sense at
   the true end of the plan, so it moves to the second stage, clamped to fit.
   From advToStages(), applyCoast() and the btnToStages handler in
   src/js/app/06-solve.js. */
import { setToolInputs, toolInputs } from "@/components/tools/ToolState";
import { fmtYears, groupDigits, parseNum } from "@/lib/format";
import { STAGES_DEFAULTS, stageFields, stagesLookEdited, type StagesInputs } from "@/tools/stages/model";
import { pctField, type AdvancedInputs, type AdvancedPlan } from "./model";

/** Writes the stages and returns the confirmation to show, or null if the
    person chose to keep the stages they have. `coastYears`: contributions
    stop after this many years. */
export function toStages({ p, a }: AdvancedPlan, s: AdvancedInputs, coastYears: number | null): string | null {
  const cur = toolInputs<StagesInputs>("stages", STAGES_DEFAULTS);
  if (stagesLookEdited(cur.stages) && !confirm(coastYears != null
    ? "Replace the stages currently on the Stages tab with this Coast FIRE plan?"
    : "Replace the stages currently on the Stages tab with these numbers?")) return null;

  // The stage contribution is yours alone; Stages adds the match back on top.
  const mine = a ? a.tradC + a.rothC + a.brokC : p.contrib;
  const split = !a ? {} : {
    ...(mine > 0 ? { sTrad: a.tradC / mine, sRoth: a.rothC / mine } : { sTrad: 1, sRoth: 0 }),
    ...(a.gRates ? { gRates: { ...a.gRates } } : {}),
  };
  const m = (v: number) => groupDigits(v || 0, true);
  const acct = !a ? { saOn: false } : {
    saOn: true, saTradBal: m(a.tradBal), saRothBal: m(a.rothBal), saBrokBal: m(a.brokBal),
    saBrokBasis: a.brokBasis == null ? "" : m(a.brokBasis), saSalary: m(a.salary),
    saMatchPct: String(a.matchPct || 0), saMatchCap: String(a.matchCap == null ? 6 : a.matchCap),
    saStatus: a.status, saState: a.state,
  };

  const secondYears = coastYears != null ? Math.round((p.years - coastYears) * 100) / 100 : 10;
  const glideYears = p.glide.on ? Math.min(p.glide.years!, secondYears) : 0;
  const clipped = p.glide.on && glideYears < p.glide.years!;
  const base = { period: p.period, nominal: p.gross, vol: p.vol, adj: false, ...split };
  const stages = [
    stageFields({ years: coastYears ?? p.years, contrib: mine, growth: p.growth, ...base }),
    stageFields({
      years: secondYears, contrib: coastYears != null ? 0 : mine, growth: coastYears != null ? 0 : p.growth, ...base,
      glide: p.glide.on ? { on: true, endRate: p.glide.endRate! + p.fees, years: Math.max(1, glideYears) } : { on: false },
    }),
  ];
  setToolInputs("stages", {
    ...cur, ...acct,
    initial: groupDigits(p.initial, true), inflation: pctField(p.inflation), withdrawal: pctField(p.withdrawal),
    taxRate: pctField(p.taxRate), fees: pctField(p.fees),
    stages, target: groupDigits(parseNum(s.target), true), solveFor: s.solveFor,
  });
  const shortened = " — glide shortened to " + fmtYears(Math.max(1, glideYears));
  return coastYears != null
    ? clipped ? "Coast FIRE plan loaded" + shortened + " to fit the final stage" : "Coast FIRE plan loaded into the Stages tab"
    : clipped ? "Copied into two stages" + shortened + " to fit the second stage" : "Copied into two stages, the second running 10 years longer";
}
