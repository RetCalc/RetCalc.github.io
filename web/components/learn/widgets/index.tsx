"use client";

/* The interactive pictures a few lessons have (content/lessons/README.md),
   each built to match its lesson's text. */

import { Sequence } from "./Sequence";
import { Compound } from "./Compound";
import { Fees } from "./Fees";
import { ClaimAge } from "./ClaimAge";
import { Brackets } from "./Brackets";
import { Inflation } from "./Inflation";
import { SavingsRate } from "./SavingsRate";
import { WithdrawalRate } from "./WithdrawalRate";
import { Rmd } from "./Rmd";
import { RothOrTraditional } from "./RothOrTraditional";

const WIDGETS: Record<string, (p: { label: string }) => React.JSX.Element> = {
  sequence: Sequence, compound: Compound, fees: Fees, "claim-age": ClaimAge,
  brackets: Brackets, inflation: Inflation, "savings-rate": SavingsRate, "withdrawal-rate": WithdrawalRate, rmd: Rmd,
  "roth-or-traditional": RothOrTraditional,
};

export function Widget({ name, label }: { name: string; label: string }) {
  const W = WIDGETS[name];
  return W ? <W label={label} /> : null;
}
