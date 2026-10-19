/* Copy into my tools: the walkthrough's inputs into the standalone tools,
   which show them when next opened. Apart from flow.ts, which tests load
   without the screens' code. */
import { TAB_STORE } from "@/components/tools/ToolState";
import { toolOf } from "./flow";
import type { PlanState } from "./model";

/** Copies the walkthrough's inputs into the standalone tools (Copy into my tools). */
export function copyToTools(p: PlanState): string[] {
  const done: string[] = [];
  if (p.tools.tax) { TAB_STORE.write("tax", toolOf(p, "tax")); done.push("Income Tax"); }
  if (p.tools.budget) { TAB_STORE.write("budget", { ...toolOf(p, "budget"), view: "budget" }); done.push("Budget"); }
  if (p.tools.advanced) { TAB_STORE.write("advanced", toolOf(p, "advanced")); done.push("Advanced"); }
  if (p.stagesOn && p.tools.stages) { TAB_STORE.write("stages", toolOf(p, "stages")); done.push("Stages"); }
  return done;
}
