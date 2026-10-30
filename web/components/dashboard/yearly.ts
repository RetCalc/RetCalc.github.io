/* Year by year's settings in words: each of you's raises, and how much of
   each raise is saved. The years themselves are worked out in cover.ts
   (yearlySaving). No React. */

import type { Profile } from "./store";

/** How much of each raise, after tax, is saved: the choices offered.
    null keeps saving the same share of take-home pay as now. */
export const KEEP_CHOICES: { v: number | null; label: string }[] = [
  { v: null, label: "The same share of take-home pay as now" },
  { v: 0, label: "None of it: spend every raise" },
  { v: 0.25, label: "A quarter of each raise" },
  { v: 0.5, label: "Half of each raise" },
  { v: 0.75, label: "Three quarters of each raise" },
  { v: 1, label: "All of each raise" },
];

/** A rate as "1.5%". */
export const pctWord = (r: number) => (Math.round(r * 1000) / 10).toString() + "%";

/** The raises and what's saved of them, as one sentence. */
export function raiseWords(pr: Profile, names: [string, string] | null): string {
  const Y = pr.yearly, keep = KEEP_CHOICES.find((c) => c.v === Y.keep)?.label.toLowerCase() ?? pctWord(Y.keep ?? 0) + " of each raise";
  const raises = !names || Y.raise[0] === Y.raise[1]
    ? (Y.raise[0] > 0 ? `Pay rises ${pctWord(Y.raise[0])} per year beyond inflation` : "Pay keeps pace with inflation")
    : `${names[0]}'s pay rises ${pctWord(Y.raise[0])} and ${names[1]}'s ${pctWord(Y.raise[1])} per year beyond inflation`;
  return `${raises}; saved: ${keep}.`;
}
