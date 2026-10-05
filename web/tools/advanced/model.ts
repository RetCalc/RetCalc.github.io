/* The Advanced calculator's inputs. This file starts with the plain plan
   fields; the account, solve and market-history inputs join it when the
   Advanced screen is ported. `contrib` and `period` are read by the Budget
   (lib/retirement-contribs.ts). From writeInputs() in src/js/app/01-inputs.js. */
import type { ToolDef } from "@/components/tools/ToolState";
import { DEFAULTS } from "@/lib/engine/typed";
import { groupDigits } from "@/lib/format";

/** A plan in the engine's own terms: rates as decimals, dollars as numbers. */
export interface PlainPlan {
  initial: number; contrib: number; period: string; growth: number; nominal: number; inflation: number;
  years: number; withdrawal: number; taxRate: number; vol?: number; fees?: number; gross?: number;
}

/* A rate as the field shows it: 8.5 for 0.085, without float noise. */
const pct = (v: number) => String(+(v * 100).toFixed(6));

/** The fields for a plan, as writeInputs() filled them; accounts off. */
export function advancedFields(p: PlainPlan) {
  return {
    initial: groupDigits(p.initial, true), contrib: groupDigits(p.contrib), period: p.period,
    growth: pct(p.growth), nominal: pct(p.gross ?? p.nominal), inflation: pct(p.inflation), years: String(p.years),
    withdrawal: pct(p.withdrawal), taxRate: pct(p.taxRate), vol: pct(p.vol ?? 0.15), fees: pct(p.fees ?? 0),
    glideOn: false, glideEnd: "", glideYears: "", acOn: false,
  };
}

export const ADVANCED_DEFAULTS = advancedFields(DEFAULTS as PlainPlan);
export type AdvancedInputs = typeof ADVANCED_DEFAULTS;

export const ADVANCED_DEF: ToolDef<AdvancedInputs> = { id: "advanced", label: "Advanced", noun: "retirement scenario", defaults: ADVANCED_DEFAULTS };
