"use client";

/* The interactive pictures a few lessons have (content/lessons/README.md),
   each built to match its lesson's text. */

import { Sequence } from "./Sequence";
import { Compound } from "./Compound";
import { Fees } from "./Fees";
import { ClaimAge } from "./ClaimAge";

const WIDGETS: Record<string, (p: { label: string }) => React.JSX.Element> = {
  sequence: Sequence, compound: Compound, fees: Fees, "claim-age": ClaimAge,
};

export function Widget({ name, label }: { name: string; label: string }) {
  const W = WIDGETS[name];
  return W ? <W label={label} /> : null;
}
