/* The readiness score as the guide explains it (doc 3, section 3, item 7;
   doc 1, "A score that explains itself"): each area's rule in one sentence,
   and how much of the score rests on answers the person gave rather than
   estimates and defaults. The points themselves are calc.ts's (parts and
   score), unchanged. */

import { guessing, pos, type FactorId } from "./calc";
import type { AnswerKey, Answers, Sources } from "./store";

/** Each area's rule, as the card states it. */
export const RULES: Record<FactorId, string> = {
  outlook: "Full marks when the plan lasted in 95% of history",
  rate: "15% of gross income, or a plan that already lasts",
  cushion: "Six months of spending in cash",
  debt: "Nothing owed at 8% or more, besides a mortgage",
  flow: "Spend no more than 80% of take-home",
};

/** The answers each area reads. */
const READS: Record<FactorId, AnswerKey[]> = {
  outlook: ["age", "retire", "saved", "contrib", "employer", "risk", "retSpend", "ssOwn"],
  rate: ["income", "contrib", "employer", "match"],
  cushion: ["cash", "spend"],
  debt: ["debtTotal", "debtHi"],
  flow: ["takehome", "spend"],
};

export interface Confidence { entered: number; estimated: number; defaults: number }

/** Over the answers the scored areas read, how many the person gave
    (typed, or brought back from a tool), how many the guide estimated, and
    how many defaults stand in. Social Security with no statement figure
    counts as an estimate; retirement spending still on its placeholder as
    a default. No points move with it. */
export function confidence(a: Answers, src: Sources, areas: FactorId[]): Confidence {
  const out: Confidence = { entered: 0, estimated: 0, defaults: 0 }, seen = new Set<string>();
  for (const id of areas) for (const k of READS[id]) {
    if (seen.has(k)) continue;
    seen.add(k);
    if (k === "ssOwn") { if (pos(a.ssOwn)) out.entered++; else out.estimated++; continue; }
    if (k === "retSpend" && guessing(a)) { out.defaults++; continue; }
    const s = src[k];
    if (a[k] == null || a[k] === "") continue;
    if (!s || s.kind === "entered" || s.kind === "tool") out.entered++;
    else if (s.kind === "estimated") out.estimated++;
    else out.defaults++;
  }
  return out;
}

const n = (k: number, one: string, many: string) => k + " " + (k === 1 ? one : many);
/** "Based on 9 answers you gave, 1 estimate and 1 default." */
export function confidenceLine(c: Confidence): string {
  const parts = [n(c.entered, "answer you gave", "answers you gave")];
  if (c.estimated) parts.push(n(c.estimated, "estimate", "estimates"));
  if (c.defaults) parts.push(n(c.defaults, "default", "defaults"));
  return "Based on " + parts.join(", ").replace(/, ([^,]*)$/, " and $1") + ".";
}

