/* Loads one year of retirement withdrawals into Income Tax, everything else
   at zero, so the tool opens on the same tax the sender showed and Social
   Security or a pension can be added. The Early Retirement Bridge and the
   By account type tables send this. From brToTax() in src/js/app/36-bridge.js
   and the .txlink handler in 18-debt.js. */
import { setToolInputs, toolInputs } from "@/components/tools/ToolState";
import { dollarsField } from "@/lib/format";
import { TAX_DEFAULTS } from "./model";

export function sendYearToTax(y: {
  status: string; state: string; trad: number; roth: number; brok: number;
  /** The share of the brokerage withdrawal that's gain, 0 to 1. */
  gainShare: number;
  seniors: number;
}): void {
  setToolInputs("tax", {
    ...toolInputs("tax", TAX_DEFAULTS), mode: "retire", status: y.status, state: y.state,
    trad: dollarsField(y.trad), roth: dollarsField(y.roth), brok: dollarsField(y.brok),
    gainPct: String(Math.round(y.gainShare * 1000) / 10), seniors: String(y.seniors || 0),
    ss: "0", pension: "0", other: "0", pre: "0", dedType: "std", item: "0",
  });
}
