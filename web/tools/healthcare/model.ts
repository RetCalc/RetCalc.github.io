/* The Healthcare Cost Planner's inputs and Medicare tables. From
   src/js/app/34-healthcare.js and src/main/22-healthcare-inputs.html. */
import type { ToolDef } from "@/components/tools/ToolState";
import { HC_AGE40_MULT, HC_STATE_PREMIUM_40, IRMAA, hcCalcACA, hcFPL, hcGrossPremium, ssTaxable } from "@/lib/engine/typed";
import { parseNum } from "@/lib/format";

/* Its own state list, as the old page had it ("DC", in this order). */
export const HC_STATES: [string, string][] = [["AL", "Alabama"], ["AK", "Alaska"], ["AZ", "Arizona"], ["AR", "Arkansas"], ["CA", "California"], ["CO", "Colorado"], ["CT", "Connecticut"], ["DC", "DC"], ["DE", "Delaware"], ["FL", "Florida"], ["GA", "Georgia"], ["HI", "Hawaii"], ["ID", "Idaho"], ["IL", "Illinois"], ["IN", "Indiana"], ["IA", "Iowa"], ["KS", "Kansas"], ["KY", "Kentucky"], ["LA", "Louisiana"], ["ME", "Maine"], ["MD", "Maryland"], ["MA", "Massachusetts"], ["MI", "Michigan"], ["MN", "Minnesota"], ["MS", "Mississippi"], ["MO", "Missouri"], ["MT", "Montana"], ["NE", "Nebraska"], ["NV", "Nevada"], ["NH", "New Hampshire"], ["NJ", "New Jersey"], ["NM", "New Mexico"], ["NY", "New York"], ["NC", "North Carolina"], ["ND", "North Dakota"], ["OH", "Ohio"], ["OK", "Oklahoma"], ["OR", "Oregon"], ["PA", "Pennsylvania"], ["RI", "Rhode Island"], ["SC", "South Carolina"], ["SD", "South Dakota"], ["TN", "Tennessee"], ["TX", "Texas"], ["UT", "Utah"], ["VT", "Vermont"], ["VA", "Virginia"], ["WA", "Washington"], ["WV", "West Virginia"], ["WI", "Wisconsin"], ["WY", "Wyoming"]];

export const HEALTHCARE_DEFAULTS = {
  retireAge: "62", status: "s", household: "2", spouseAge: "62", state: "IL", income: "", ss: "", premium: "",
};
export type HealthcareInputs = typeof HEALTHCARE_DEFAULTS;

export const HEALTHCARE_DEF: ToolDef<HealthcareInputs> = { id: "healthcare", label: "Healthcare", noun: "healthcare plan", defaults: HEALTHCARE_DEFAULTS };

/** Medicare IRMAA, 2026, the same CMS table the Roth tool uses:
    [individual MAGI max, joint MAGI max, Part B monthly, Part D IRMAA monthly]. */
export const HC_IRMAA: [number, number, number, number][] =
  (IRMAA as { tiers: { s: number; m: number; b: number; partD: number }[] }).tiers.map((t) => [t.s, t.m, t.b, t.partD]);
/** Average standalone Part D premium, 2026 (CMS estimate, before IRMAA). */
export const HC_PARTD_BASE = 35;
/** Medigap Plan G at 65, a rough national range. */
export const HC_MEDIGAP_LOW = 120, HC_MEDIGAP_HIGH = 200;

export function irmaaTier(magi: number, joint: boolean): number {
  const col = joint ? 1 : 0;
  for (let i = 0; i < HC_IRMAA.length; i++) if (magi <= HC_IRMAA[i][col]) return i;
  return HC_IRMAA.length - 1;
}

/** Everything the planner shows from its inputs: the ACA bridge (income as
    the ACA counts it, the benchmark premium, the credit now and with the
    enhanced credits) and Medicare (the IRMAA tier, premiums, and what the
    tiers either side would save or cost). */
export function healthcareCompute(s: HealthcareInputs) {
  const retireAge = Math.round(parseNum(s.retireAge)) || 62;
  const joint = s.status === "m";
  const household = parseInt(s.household) || (joint ? 2 : 1);
  const state = s.state || "IL";
  const manualPremium = parseNum(s.premium) || 0;

  /* The field is AGI, also the MAGI Medicare's IRMAA uses. The ACA adds back
     untaxed Social Security, found from the benefit: its taxable part depends
     on the other income, so repeated passes settle it (exact within a cent). */
  const magi = parseNum(s.income) || 0;
  const ssGross = parseNum(s.ss) || 0;
  let ssTaxed = 0;
  for (let it = 0; it < 150 && ssGross > 0; it++) ssTaxed = ssTaxable(ssGross, Math.max(0, magi - ssTaxed), joint ? "m" : "s").taxable;
  const acaMagi = magi + Math.max(0, ssGross - ssTaxed);

  // ── the ACA bridge ──
  const bridgeYears = Math.max(0, 65 - retireAge);
  const fpl = hcFPL(household);
  const pctFPL = acaMagi > 0 ? acaMagi / fpl : 0;
  const acaAge = Math.min(64, Math.max(21, retireAge));
  /* The credit is for the household: the benchmark for everyone enrolling
     (each adult at their own age; a spouse already 65 is on Medicare),
     children at the under-15 rate with at most three counted, less ONE
     contribution based on household income. */
  const spouseAge = Math.round(parseNum(s.spouseAge)) || retireAge;
  const spouseOn = joint && spouseAge < 65;
  const acaAge2 = Math.min(64, Math.max(21, spouseAge));
  const kids = Math.min(3, Math.max(0, household - (joint ? 2 : 1)));
  const childPrem = (((HC_STATE_PREMIUM_40 as Record<string, number>)[state] || 500) / (HC_AGE40_MULT as number)) * 0.765;
  const grossMonthly = manualPremium > 0 ? manualPremium
    : hcGrossPremium(state, acaAge, 0) + (spouseOn ? hcGrossPremium(state, acaAge2, 0) : 0) + kids * childPrem;
  const std = hcCalcACA(acaMagi, grossMonthly, pctFPL, false);
  const enh = hcCalcACA(acaMagi, grossMonthly, pctFPL, true);
  const usingStateEst = manualPremium <= 0;

  const cliff400 = fpl * 4.0;
  // The same credit applied to the cheaper and dearer tiers.
  const bronze = Math.max(0, grossMonthly * 0.75 - std.credit);
  const gold = Math.max(0, grossMonthly * 1.25 - std.credit);

  // ── Medicare ──
  const tier = irmaaTier(magi, joint);
  const [, , partB, partDIrmaa] = HC_IRMAA[tier];
  const partD = HC_PARTD_BASE + partDIrmaa;
  const totalLow = partB + partD + HC_MEDIGAP_LOW, totalHigh = partB + partD + HC_MEDIGAP_HIGH;
  const hasIrmaa = tier > 0;
  const people = joint ? 2 : 1;
  const prev = hasIrmaa ? HC_IRMAA[tier - 1] : null;
  const next = tier < HC_IRMAA.length - 1 ? HC_IRMAA[tier + 1] : null;
  const save = prev ? partB - prev[2] + (partDIrmaa - prev[3]) : 0;
  const nextThreshold = next ? next[joint ? 1 : 0] : 0;
  const nextCost = next ? next[2] - partB + (next[3] - partDIrmaa) : 0;
  return {
    retireAge, joint, household, state, manualPremium, magi, ssGross, ssTaxed, acaMagi, bridgeYears, fpl, pctFPL, acaAge, spouseAge, spouseOn, acaAge2, kids, childPrem, grossMonthly, std, enh, usingStateEst,
    tier, partB, partDIrmaa, partD, totalLow, totalHigh, hasIrmaa, people, prev, next, save, nextThreshold, nextCost, cliff400, bronze, gold,
  };
}
