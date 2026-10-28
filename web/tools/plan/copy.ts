/* Copy into my tools: the walkthrough's inputs into the standalone tools,
   which show them when next opened. Apart from flow.ts, which tests load
   without the screens' code. */
import { TAB_STORE } from "@/components/tools/ToolState";
import { taxOfPaycheck, toolOf } from "./flow";
import type { PlanState } from "./model";

/** Copies the walkthrough's inputs into the standalone tools (Copy into my tools). */
export function copyToTools(p: PlanState): string[] {
  const done: string[] = [];
  // Income Tax as the paycheck has it: the pay, status, state and pre-tax money by kind.
  const tax = taxOfPaycheck(p);
  if (tax) { TAB_STORE.write("tax", tax); done.push("Income Tax"); }
  if (p.tools.budget) { TAB_STORE.write("budget", { ...toolOf(p, "budget"), view: "budget" }); done.push("Budget"); }
  if (p.tools.advanced) { TAB_STORE.write("advanced", toolOf(p, "advanced")); done.push("Advanced"); }
  return done;
}
