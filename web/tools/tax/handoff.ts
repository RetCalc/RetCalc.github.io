/* Loads one year of retirement withdrawals into Income Tax, everything else
   at zero, so the tool opens on the same tax the sender showed and Social
   Security or a pension can be added. The Early Retirement Bridge and the
   By account type tables send this. From brToTax() in src/js/app/36-bridge.js
   and the .txlink handler in 18-debt.js. */
import { setToolInputs, toolInputs } from "@/components/tools/ToolState";
import { dollarsField } from "@/lib/format";
import { TAX_DEFAULTS, agesFromSeniors } from "./model";

export function sendYearToTax(y: {
  status: string; state: string; trad: number; roth: number; brok: number;
  /** The share of the brokerage withdrawal that's gain, 0 to 1. */
  gainShare: number;
  /** Each person's age that year, when the sender knows them. Otherwise how
      many are 65 or older. */
  ages?: number[];
  seniors?: number;
}): void {
  const [a1, a2] = y.ages?.length ? [y.ages[0], y.ages[1] ?? y.ages[0]] : agesFromSeniors(y.seniors ?? 0, y.status === "m");
  setToolInputs("tax", {
    ...toolInputs("tax", TAX_DEFAULTS), mode: "retire", status: y.status, state: y.state,
    trad: dollarsField(y.trad), roth: dollarsField(y.roth), brok: dollarsField(y.brok),
    // Two decimals: a tenth of a percent of a large brokerage withdrawal is
    // enough to move the tax by a few dollars off the sender's figure.
    gainPct: String(Math.round(y.gainShare * 10000) / 100), age: String(Math.round(a1)), spouseAge: String(Math.round(a2)), seniors: "",
    ss: "0", pension: "0", other: "0", pre: "0", dedType: "std", item: "0",
    // The senders use the newest year's rules.
    year: TAX_DEFAULTS.year,
  });
}
