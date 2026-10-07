/* The readiness score as the guide explains it (doc 3, section 3, item 7;
   doc 1, "A score that explains itself"): each area's rule in one sentence,
   how much of the score rests on answers the person gave rather than
   estimates and defaults, and what each area still has to give. The points
   themselves are calc.ts's (parts and score). */

import { money } from "@/lib/format";
import { FACTORS, gross, guessing, pos, type FactorId, type Part } from "./calc";
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


/** What an area still has to give (correction 3): the points to come, and
    the change that earns them, in the person's own figures: "3 months
    earns 11; 6 months earns 15". Null at full marks or unanswered. */
export function headroom(id: FactorId, P: Part | undefined, a: Answers): { pts: number; line: string } | null {
  if (!P) return null;
  const w = FACTORS.find((f) => f.id === id)!.w, pts = Math.round((1 - P.p) * w);
  if (pts < 1) return null;
  if (P.bad) return { pts, line: "An answer it can't use; fix it to score this area" };
  let line = "";
  if (id === "outlook") {
    line = P.p < 0.85 ? "Lasting in 85% of history earns " + Math.round(0.85 * w) + "; 95% earns " + w : "Lasting in 95% of history earns " + w;
  } else if (id === "rate") {
    if (a.match === "partial") line = "All of your employer's match earns " + Math.min(w, Math.round((P.p / 0.75) * w)) + "; 15% of income earns " + w;
    else line = (P.r ?? 0) < 0.1 ? "10% of income earns " + Math.round(0.7 * w) + "; 15% earns " + w : "15% of income, or a plan that already lasts, earns " + w;
  } else if (id === "cushion") {
    line = (P.m ?? 0) < 3 ? "3 months earns " + Math.round(0.75 * w) + "; 6 months earns " + w : "6 months earns " + w;
  } else if (id === "debt") {
    const inc = gross(a), hi = Math.min(a.debtHi || 0, a.debtTotal || 0), lo = (a.debtTotal || 0) - hi;
    line = hi > 0 ? "Paying off the " + money(hi) + " at 8% or more earns " + Math.round(Math.max(0, 1 - Math.min(1, lo / Math.max(1, inc)) * 0.3) * w) : "Paying it all off earns " + w;
  } else if (id === "flow") {
    const m = P.m ?? 0;
    line = m < 0 ? "Spending within take-home earns " + Math.round(0.25 * w) + "; 80% of it earns " + w
      : m < 0.1 ? "Keeping 10% unspent earns " + Math.round(0.75 * w) + "; 20% earns " + w : "Spending no more than 80% of take-home earns " + w;
  }
  return { pts, line };
}

/** What a default stands in for, as the sources line names it. */
const DEFAULT_WORDS: Partial<Record<AnswerKey, (a: Answers) => string>> = {
  risk: (a) => "a " + (a.risk === 0.045 ? "balanced" : "chosen") + " mix while saving",
  saveTo: () => "new saving going to traditional accounts",
  employer: () => "no employer contribution",
  match: () => "the match as not sure",
  hcIncl: () => "health insurance before 65 priced by the plan",
  status: () => "a household of one",
};

/** Every estimate and default the number rests on, for the sources line on
    Your number (doc 2, card 10; doc 3, "Sources"): what the guide worked out,
    and what stands in until it's answered, including the ones no card asks
    on the Quick check (all traditional, 60% stocks in retirement, to 95). */
export function planSources(a: Answers, src: Sources) {
  const estimated: string[] = [], defaults: string[] = [];
  if (src.takehome?.kind === "estimated") estimated.push("take-home (from the 2026 tax rules)");
  if (!pos(a.ssOwn) || (a.status === "m" && !pos(a.ssOwn2))) estimated.push("Social Security (from income)");
  if (guessing(a)) defaults.push("retirement spending at 80% of take-home");
  for (const k of Object.keys(DEFAULT_WORDS) as AnswerKey[]) if (src[k]?.kind === "default" && a[k] != null) defaults.push(DEFAULT_WORDS[k]!(a));
  if (!pos(a.rothNow) && !pos(a.brokNow) && pos(a.saved)) defaults.push("all savings in traditional accounts");
  if (a.retMix == null) defaults.push("60% in stocks in retirement");
  defaults.push("money lasting to 95" + (a.status === "m" ? " for the younger of you" : ""));
  return { estimated, defaults };
}
