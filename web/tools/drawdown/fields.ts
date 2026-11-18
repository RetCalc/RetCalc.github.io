/* The Drawdown Simulator's inputs (model.ts), and filling them from another
   tool, which writes to that tool's saved inputs. */
import { TAB_STORE, type ToolStore } from "@/components/tools/ToolState";
import { DRAWDOWN_DEFAULTS, ddWrite } from "./model";

export * from "./model";

/** Fills the Drawdown Simulator from another tool, as writeDDState() did:
    it shows these numbers when next opened. `store`: the scope's, when the sender runs in one (the Dashboard's Tools). */
export function sendToDrawdown(d: Record<string, unknown>, store: ToolStore = TAB_STORE): void {
  store.write("drawdown", ddWrite(store.read("drawdown", DRAWDOWN_DEFAULTS), d));
}
