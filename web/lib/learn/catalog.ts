/* Learn's curriculum: the tracks, in order, and each track's lessons by
   slug. A lesson's words live in content/lessons/<slug>.html (its title,
   summary and the rest come from there, lib/learn/lessons.ts); this file
   only says what goes where. Shared by server and client. */

export type TrackId = "foundations" | "saving" | "investing" | "withdrawing" | "taxes" | "social" | "early" | "decisions";

export interface Track { id: TrackId; name: string; blurb: string; lessons: string[] }

export const TRACKS: Track[] = [
  { id: "foundations", name: "Foundations", blurb: "What a plan answers, and the few ideas everything else rests on.", lessons: [
    "what-a-plan-answers", "compound-growth", "todays-dollars", "savings-rate", "spending-target", "how-long-to-plan-for", "emergency-fund"] },
  { id: "saving", name: "Saving and accounts", blurb: "Which account each dollar should go to, and why.", lessons: [
    "where-each-dollar-goes", "employer-match", "traditional-or-roth", "iras", "hsa", "taxable-account", "contribution-limits"] },
  { id: "investing", name: "Investing and risk", blurb: "What you own, how much it swings, and how a plan measures risk.", lessons: [
    "stocks-bonds-cash", "how-much-in-stocks", "fees-and-index-funds", "range-not-a-line", "sequence-risk", "cape-valuations", "chance-of-success", "when-markets-fall"] },
  { id: "withdrawing", name: "Withdrawing", blurb: "Turning savings into a paycheck that lasts.", lessons: [
    "four-percent-rule", "fixed-or-flexible", "guardrails", "spending-a-percentage", "choosing-a-strategy", "withdrawal-order", "rmds", "spending-with-age", "annuities-and-pensions"] },
  { id: "taxes", name: "Taxes", blurb: "How income is taxed now and in retirement.", lessons: [
    "tax-brackets", "deductions", "retirement-income-taxes", "roth-conversions", "irmaa", "state-taxes"] },
  { id: "social", name: "Social Security and health care", blurb: "Claiming, Medicare and covering the years before it.", lessons: [
    "social-security-benefit", "when-to-claim", "spouses-and-survivors", "social-security-future", "health-cover-before-65", "medicare", "long-term-care"] },
  { id: "early", name: "Retiring early", blurb: "Leaving work before the usual ages, and paying for the gap.", lessons: [
    "fire", "bridge-to-59", "rule-72t", "roth-conversion-ladder"] },
  { id: "decisions", name: "Big decisions", blurb: "Homes, debt, college and children, and how each fits the plan.", lessons: [
    "rent-or-buy", "mortgage-payoff", "paying-down-debt", "saving-for-college", "children-and-the-plan", "home-in-retirement"] },
];

export const LESSON_SLUGS: string[] = TRACKS.flatMap((t) => t.lessons);

/** The track a lesson is in, and its place there (0-based). */
export function placeOf(slug: string): { track: Track; index: number; number: string } | null {
  for (let n = 0; n < TRACKS.length; n++) {
    const index = TRACKS[n].lessons.indexOf(slug);
    if (index >= 0) return { track: TRACKS[n], index, number: `${n + 1}.${index + 1}` };
  }
  return null;
}

/** The lessons with a Your numbers panel, and which one: each applies the
    lesson to the reader's plan (components/learn/Yours.tsx). */
export type YoursKey = "plan" | "compound" | "inflation" | "saverate" | "target" | "horizon" | "efund" | "match" | "accounts"
  | "stocks" | "band" | "sequence" | "success" | "rate" | "guardrails" | "strategy" | "rmd" | "claim" | "couple-ss" | "pre65"
  | "medicare" | "bridge" | "college" | "kids" | "mortgage";

export const YOURS: Record<string, YoursKey> = {
  "what-a-plan-answers": "plan", "compound-growth": "compound", "todays-dollars": "inflation", "savings-rate": "saverate",
  "spending-target": "target", "how-long-to-plan-for": "horizon", "emergency-fund": "efund",
  "where-each-dollar-goes": "match", "employer-match": "match", "traditional-or-roth": "accounts",
  "how-much-in-stocks": "stocks", "range-not-a-line": "band", "sequence-risk": "sequence", "chance-of-success": "success",
  "four-percent-rule": "rate", "fixed-or-flexible": "guardrails", "guardrails": "guardrails", "spending-a-percentage": "strategy",
  "choosing-a-strategy": "strategy", "rmds": "rmd", "irmaa": "medicare",
  "social-security-benefit": "claim", "when-to-claim": "claim", "spouses-and-survivors": "couple-ss",
  "health-cover-before-65": "pre65", "medicare": "medicare",
  "fire": "saverate", "bridge-to-59": "bridge", "rule-72t": "bridge", "roth-conversion-ladder": "bridge",
  "mortgage-payoff": "mortgage", "saving-for-college": "college", "children-and-the-plan": "kids", "home-in-retirement": "mortgage",
};
