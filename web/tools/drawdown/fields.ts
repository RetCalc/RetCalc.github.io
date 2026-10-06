/* The Drawdown Simulator's inputs (model.ts), and filling them from another
   tool, which writes to that tool's saved inputs. */
import { setToolInputs, toolInputs } from "@/components/tools/ToolState";
import { DRAWDOWN_DEFAULTS, ddWrite } from "./model";

export * from "./model";

/** Fills the Drawdown Simulator from another tool, as writeDDState() did:
    it shows these numbers when next opened. */
export function sendToDrawdown(d: Record<string, unknown>): void {
  setToolInputs("drawdown", ddWrite(toolInputs("drawdown", DRAWDOWN_DEFAULTS), d));
}
