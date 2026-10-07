/* Where each answer came from (doc 3, "Sources"): whoever writes an answer
   writes its source. A field typed or a choice tapped is "entered"; a trip's
   capture is "tool", naming the tool; a figure the guide works out and the
   person hasn't replaced is "estimated"; a stated default standing in for a
   question the pace skipped is "default", written only where the answer is
   empty. Pure, for the page and the tests alike. */

import { ok, taxEst } from "./calc";
import type { AnswerKey, Answers, Source, SourceKind, Sources } from "./store";

/* Keys that record how the guide got somewhere (which choice led to a
   field, a tool's saved rows, the optimizer's applied choices) rather than
   an answer of the person's: they carry no source. */
export const BOOKKEEPING = new Set<string>([
  "thKnow", "bgKnow", "spendSrc", "debtSrc", "bgRows", "debtRows", "moState", "clState", "ddTool",
  "hcSeen", "hcAdded", "advSeen", "stagesSeen", "btSeen", "kitSeen", "retired",
  "optGoal", "optC1", "optC2", "optF", "optU", "optIm", "optAc", "target", "spendGuess",
]);

export const empty = (v: unknown) => v == null || v === "" || (typeof v === "number" && !isFinite(v));
export const stamp = () => new Date().toISOString();

/** Records where answer `k` came from; an empty answer has no source. */
export function mark(g: { a: Answers; src: Sources }, k: AnswerKey, kind: SourceKind, tool?: string, at = stamp()) {
  if (BOOKKEEPING.has(k)) return;
  if (empty(g.a[k])) { delete g.src[k]; return; }
  const s: Source = tool ? { kind, tool, at } : { kind, at };
  g.src[k] = s;
}

/** Sets answer `k` and its source together. */
export function setAnswer<K extends AnswerKey>(g: { a: Answers; src: Sources }, k: K, v: Answers[K], kind: SourceKind = "entered", tool?: string) {
  g.a[k] = v;
  mark(g, k, kind, tool);
}

/** For a card's prep and commit: an answer the card assumes, written only
    where there's none yet. */
export const putter = (g: { a: Answers; src: Sources }) =>
  <K extends AnswerKey>(k: K, v: Answers[K], kind: Exclude<SourceKind, "entered">, tool?: string) => {
    if (!empty(g.a[k])) return;
    setAnswer(g, k, v, kind, tool);
  };

/** The tool a trip's figures come from, by the trip's id. */
export const tripTool = (id: string) => (id === "mortBuy" || id === "mortOwn" ? "mortgage" : id);

/** The figures the guide estimates for the person, kept current while
    they're still its own: take-home from income by the 2026 tax rules,
    until it's typed or brought back from Income Tax (doc 2, card 2). */
export function refreshEstimates(g: { a: Answers; src: Sources }) {
  const s = g.src.takehome;
  if (s && s.kind !== "estimated") return;
  if (!s && !empty(g.a.takehome)) return;
  if (!ok(g.a.income)) return;
  const est = Math.round(taxEst(g.a));
  if (est > 0) { if (g.a.takehome !== est) setAnswer(g, "takehome", est, "estimated"); }
  else { g.a.takehome = null; delete g.src.takehome; }
}
