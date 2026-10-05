/* The Basic calculator's inputs. Their keys `contrib` and `period` are read
   by the Budget's "+ Retirement contribution" (lib/retirement-contribs.ts).
   From src/js/app/20-basic.js. */
import type { ToolDef } from "@/components/tools/ToolState";
import { BASIC_DEFAULTS, RISK_LEVELS } from "@/lib/engine/typed";
import { groupDigits, parseNum } from "@/lib/format";

export const BASIC_INPUTS = {
  age: String(BASIC_DEFAULTS.age), retire: String(BASIC_DEFAULTS.retire),
  saved: groupDigits(BASIC_DEFAULTS.saved, true), contrib: groupDigits(BASIC_DEFAULTS.contrib, true),
  period: BASIC_DEFAULTS.period, risk: String(BASIC_DEFAULTS.risk),
};
export type BasicInputs = typeof BASIC_INPUTS;

export const BASIC_DEF: ToolDef<BasicInputs> = { id: "basic", label: "Basic", noun: "retirement scenario", defaults: BASIC_INPUTS };

export const RISK_OPTIONS = (RISK_LEVELS as { label: string; sub: string; real: number }[])
  .map((r) => ({ value: String(r.real), label: r.label + " · " + r.sub }));

/** The inputs as the engine takes them. */
export function basicInput(s: BasicInputs) {
  const age = parseNum(s.age), retire = parseNum(s.retire), real = parseFloat(s.risk) || 0;
  return {
    age, retire, years: Math.min(100, Math.max(0, retire - age)), real,
    initial: parseNum(s.saved), contrib: parseNum(s.contrib), period: s.period, withdrawal: 0.04,
  };
}
