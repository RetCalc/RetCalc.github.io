/* How your spending compares to the usual budget rules, on Spending: one
   card per rule, then needs, wants and saving against 50/30/20. Owning
   and renting are measured differently: lenders' 28% and 36% of gross pay
   for a mortgage, and for rent the government's 30% burden line with
   other debt held to 10% of income after taxes (rent isn't a debt, and
   lenders don't count it as one). Pure: the figures come in, the cards
   go out. */

import { annualize, isPlannedRow, isSavingsRow, rowSlot, type BudgetRow } from "@/tools/budget/model";

/** The line setup's one spending number sits on (flows.ts ALL_TOGETHER). */
const ALL_TOGETHER = "Everything else";
/** A debt being paid off, set on Net worth (flows.ts DEBT_SLOT). */
const DEBT = "debt:";

/** Housing for the rules: the payment, property tax, insurance and HOA
    dues (lenders count all four); renting, the rent and renter's insurance. */
const HOUSING_OWN = ["Rent / Mortgage", "Property tax", "Home / Renters insurance", "HOA"];
const HOUSING_RENT = ["Rent / Mortgage", "Home / Renters insurance"];
/** Debt payments besides housing: loans set on Net worth, and the budget's own debt lines. */
const DEBT_SLOTS = ["Car payment", "Other debt payments"];
/** The preset lines that are wants; every other preset line is a need. */
const WANT_SLOTS = ["Eating out", "Activities & hobbies", "Subscriptions", "Travel", "Gifts"];
/** A line you add, until you say: by its group. */
const WANT_GROUPS = ["Lifestyle", "Food", "Custom", ""];

export type Sort = "need" | "want";

/** Whether a budget line is a need or a want, or neither (saving, or a
    line the paycheck plans). A line you added says so itself, once set. */
export function sortOf(r: BudgetRow, i: number): Sort | null {
  if (isSavingsRow(r) || isPlannedRow(r)) return null;
  const slot = rowSlot(r, i);
  if (slot?.startsWith(DEBT)) return "need";
  if (!r.custom && slot) return WANT_SLOTS.includes(slot) ? "want" : "need";
  if (r.want != null) return r.want ? "want" : "need";
  if (slot) return "need"; // a line set on Home (HOA, upkeep)
  return WANT_GROUPS.includes(r.group) ? "want" : "need";
}

/** Whether a line can be switched between need and want: lines you add
    (not the ones the Dashboard sets, nor setup's one number). */
export const sortable = (r: BudgetRow, i: number) =>
  r.custom && !rowSlot(r, i) && r.desc !== ALL_TOGETHER && sortOf(r, i) != null;

export interface RuleCard {
  id: "house" | "debt" | "car" | "retire";
  name: string;
  /** Your share, in percent. */
  pct: number;
  /** The guideline: at most `max`, a range `min`–`max`, or at least `min`. */
  min?: number; max?: number; atLeast?: boolean;
  /** What it's measured against. */
  of: "gross" | "after";
  ok: boolean;
  /** Percentage points over (or short). */
  gap: number;
  /** Dollars per month over (or short of) the guideline. */
  gapDollars: number;
  /** Your dollars per month, and the income they're a share of. */
  dollars: number; base: number;
  /** Where the rule comes from. */
  why: string;
}

export interface Split {
  /** Income after taxes, with premiums taken out of pay added back. */
  base: number;
  need: number; want: number; save: number;
  /** In percent of `base`. */
  needPct: number; wantPct: number; savePct: number;
}

export interface RulesInput {
  rows: BudgetRow[];
  rent: boolean;
  /** Per month, both of you: pay before taxes; all income after taxes
      (what Spending's "All income after taxes" shows); premiums taken
      out of pay; saved for retirement through work, the match with it. */
  gross: number; after: number; premiums: number; retire: number;
}

export interface Rules { cards: RuleCard[]; split: Split | null }

const monthly = (r: BudgetRow) => annualize(r) / 12;

function card(c: Omit<RuleCard, "ok" | "gap" | "gapDollars" | "pct">): RuleCard {
  const pct = c.base > 0 ? (c.dollars / c.base) * 100 : 0;
  const gap = c.atLeast ? (c.min ?? 0) - pct : pct - (c.max ?? Infinity);
  const ok = gap <= 0.05;
  return { ...c, pct, ok, gap: Math.max(0, gap), gapDollars: ok ? 0 : (gap / 100) * c.base };
}

export function budgetRules(x: RulesInput): Rules {
  const rows = x.rows.map((r, i) => ({ r, i, slot: rowSlot(r, i), m: monthly(r) })).filter((o) => o.m > 0 && !isPlannedRow(o.r));
  const sum = (f: (o: (typeof rows)[number]) => boolean) => rows.filter(f).reduce((s, o) => s + o.m, 0);
  const housing = sum((o) => !!o.slot && (x.rent ? HOUSING_RENT : HOUSING_OWN).includes(o.slot));
  const debts = sum((o) => !!o.slot && (o.slot.startsWith(DEBT) || DEBT_SLOTS.includes(o.slot)) || (o.r.custom && !o.slot && o.r.group === "Debt"));
  const car = sum((o) => o.r.group === "Transportation");
  // While setup's one number holds spending, a rule whose lines are all
  // empty would read 0% when the money is really in that one line.
  const lump = rows.some((o) => o.r.desc === ALL_TOGETHER && o.r.custom);

  const cards: RuleCard[] = [];
  if (housing > 0) cards.push(x.rent
    ? card({ id: "house", name: "Rent", max: 30, of: "gross", dollars: housing, base: x.gross,
      why: "The government's line for when rent is a burden: rent and renter's insurance under 30% of pay before taxes. Over 50% counts as a severe burden." })
    : card({ id: "house", name: "Housing", max: 28, of: "gross", dollars: housing, base: x.gross,
      why: "Lenders' front-end rule: the whole mortgage payment, with property tax, insurance and any HOA dues, under 28% of pay before taxes." }));
  if (!(lump && x.rent && debts === 0)) cards.push(x.rent
    ? card({ id: "debt", name: "Debt payments", max: 10, of: "after", dollars: debts, base: x.after,
      why: "The 20/10 rule for debt: payments on car loans, student loans, cards and other loans under 10% of income after taxes. Rent isn't a debt, so it isn't counted; lenders don't count it either." })
    : card({ id: "debt", name: "All debt payments", max: 36, of: "gross", dollars: housing + debts, base: x.gross,
      why: "Lenders' back-end rule: every debt payment, the mortgage included, under 36% of pay before taxes. Many lenders allow up to 43%." }));
  if (!(lump && car === 0)) cards.push(card({ id: "car", name: "Transportation", min: 10, max: 15, of: "after", dollars: car, base: x.after,
    why: "A common planners' range: everything getting around costs, car payment, insurance, gas and upkeep, at 10–15% of income after taxes." }));
  cards.push(card({ id: "retire", name: "Saving for retirement", min: 15, atLeast: true, of: "gross", dollars: x.retire, base: x.gross,
    why: "The usual target for anyone starting in their twenties or thirties: about 15% of pay before taxes into retirement accounts, the employer's match included. Starting later takes more." }));

  // 50/30/20 needs every line sorted: not while setup's one number holds spending.
  let split: Split | null = null;
  const base = x.after + x.premiums;
  if (!lump && base > 0) {
    const need = sum((o) => sortOf(o.r, o.i) === "need"), want = sum((o) => sortOf(o.r, o.i) === "want");
    const save = base - need - want;
    split = { base, need, want, save, needPct: (need / base) * 100, wantPct: (want / base) * 100, savePct: (save / base) * 100 };
  }
  return { cards: x.gross > 0 ? cards : [], split };
}
