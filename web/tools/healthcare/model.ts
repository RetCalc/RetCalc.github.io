/* The Healthcare Cost Planner's inputs and Medicare tables. From
   src/js/app/34-healthcare.js and src/main/22-healthcare-inputs.html. */
import type { ToolDef } from "@/components/tools/ToolState";
import { IRMAA } from "@/lib/engine/typed";

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
