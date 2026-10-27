/* Retiring before 59½: the years before retirement accounts open without
   the 10% penalty, and the Early Retirement Bridge that plans them. The
   bridge runs on the plan's own figures (the age you retire, spending once
   retired, and what each account holds at retirement); the choices made in
   it (how to fill the bridge, 72(t), health cover, work) are saved to the
   profile once you say it's your plan. Without one, the readiness score
   holds back part of the retirement outlook (model.ts). */

import { withDefaults, type ToolInputs } from "@/components/tools/ToolState";
import { groupDigits } from "@/lib/format";
import { BRIDGE_DEF, bridgeInput, type BridgeInputs } from "@/tools/bridge/model";
import { runBridge } from "@/tools/bridge/run";
import { ageOf, couple, grossYear, holdings, nameOf, nowYear, people, results, type Results } from "./model";
import { OUTSIDE_US, sum, type Entry, type Profile } from "./store";
import { retireMix, taxState } from "./flows";
import { collegeChildren } from "./college";

export const UNLOCK = 59.5;
/** The share of the retirement outlook held back while there's no bridge plan. */
export const BRIDGE_DOCK = 0.25;

export interface EarlyRetiree { i: 0 | 1; name: string; retire: number; years: number; from: number; to: number }

/** Each of you who retires before 59½: the years until then, as calendar years. */
export function earlyRetirees(pr: Profile): EarlyRetiree[] {
  if (pr.state === OUTSIDE_US) return [];
  return people(pr).flatMap((p, k) => {
    const i = k as 0 | 1;
    if (p.retire == null || p.by == null || !(p.retire < UNLOCK)) return [];
    const age = ageOf(p);
    if (age != null && age >= UNLOCK) return [];
    return [{ i, name: nameOf(pr, i), retire: p.retire, years: UNLOCK - p.retire, from: p.by + p.retire, to: p.by + UNLOCK }];
  });
}
export const needsBridge = (pr: Profile) => earlyRetirees(pr).length > 0;
export const hasBridgePlan = (pr: Profile) => !!pr.bridge;

const g = (n: number) => groupDigits(Math.round(Math.max(0, n)), true);

/** The people in the household in a year: the two of you (or you), and the
    children still at home (under 19, born by then), as the ACA counts a
    household for its subsidy. */
export function householdAt(pr: Profile, year: number): number {
  const now = Math.floor(nowYear());
  const kids = collegeChildren(pr).filter((c) => { const born = c.by ?? now + c.bornIn; return born <= year && year - born < 19; }).length;
  return (couple(pr) ? 2 : 1) + kids;
}

/** A partner still working after the early retiree stops: their pay a year
    before taxes, and the early retiree's age when it ends. */
export function partnerWork(pr: Profile, early: EarlyRetiree): { pay: number; until: number; name: string } | null {
  if (!couple(pr)) return null;
  const j = early.i ? 0 : 1, p = j ? pr.p2 : pr.p1;
  if (p.by == null || p.retire == null) return null;
  const stops = p.by + p.retire, pay = grossYear(p) ?? 0;
  if (!(stops > early.from) || !(pay > 0)) return null;
  return { pay, until: early.retire + (stops - early.from), name: nameOf(pr, j as 0 | 1) };
}

/** The Bridge's inputs the plan sets, which Retirement locks: the
    situation, the accounts at retirement, the household; and the Roth's
    contributions once Net worth gives them. */
export function bridgeLocked(pr: Profile, entries: Entry[]): string[] {
  return ["situation", "accounts", "household", ...(holdings(entries, pr).rothBasis != null ? ["rothBasis"] : [])];
}

/** The Bridge on the plan: its figures from the plan, its choices from the
    saved bridge plan (or the Bridge's own starting choices). */
export function bridgeFor(pr: Profile, entries: Entry[], R: Results = results(pr, entries)): BridgeInputs {
  const cur = withDefaults(BRIDGE_DEF, (pr.bridge?.inputs ?? {}) as Partial<BridgeInputs>);
  const early = earlyRetirees(pr)[0];
  const P = R.S?.P;
  if (!early || !P) return cur;
  // Of today's traditional money, the share in workplace plans (the part
  // the rule of 55 can reach) and in a 457(b) (open once you leave that
  // job), carried to retirement in proportion.
  const H = holdings(entries, pr), last = entries[entries.length - 1];
  const work = last ? sum(last.items, "asset", ["workplace"]) : H.trad;
  const k401Share = H.trad > 0 ? Math.min(1, work / H.trad) : 1, g457Share = H.trad > 0 ? H.g457 / H.trad : 0;
  const basis = P.brok > 0 ? Math.round((P.brokBasis / P.brok) * 100) : 100;
  const mix = retireMix(pr), partner = partnerWork(pr, early);
  // Roth contributions: from the plan once Net worth gives them; otherwise
  // as typed here (saved with the bridge's choices), else the plan's estimate.
  const rothBasis = H.rothBasis != null || pr.bridge?.inputs.rothBasis == null ? g(Math.min(P.roth, P.rothBasis)) : cur.rothBasis;
  return {
    ...cur,
    age: String(Math.round(early.retire)), status: couple(pr) ? "m" : "s", state: taxState(pr) || cur.state,
    household: String(householdAt(pr, early.from)),
    spend: g((R.spend ?? 0) * 12),
    // The mix once retired, as Retirement's simulator holds it.
    stock: String(mix.us), sv: String(mix.sv), cash: String(mix.cash),
    trad: g(P.trad), k401: g(P.trad * k401Share), g457: g(P.trad * g457Share), roth: g(P.roth), rothBasis,
    brok: g(P.brok), basis: String(basis),
    work2: partner ? g(partner.pay) : "0", work2Until: partner ? String(Math.round(partner.until * 10) / 10) : "0",
  };
}

/** What the profile keeps from the Bridge: only the choices, since its
    figures always come from the plan (and the Roth's contributions, while
    Net worth doesn't give them). */
export function bridgeChoices(d: BridgeInputs, pr?: Profile, entries?: Entry[]): ToolInputs {
  const keep: (keyof BridgeInputs)[] = ["fill", "seppMethod", "seppRate", "aca", "premium", "work", "workUntil"];
  if (pr && entries && holdings(entries, pr).rothBasis == null) keep.push("rothBasis");
  return Object.fromEntries(keep.filter((k) => d[k] != null).map((k) => [k, d[k]])) as ToolInputs;
}

export interface BridgeSummary { plan: string; phrase: string; hold: number; cost: number; tax: number; pen: number; health: number; left: number; spend: number }
const memo = new Map<string, BridgeSummary | null>();
/** The bridge as the plan has it: the Bridge's best plan on the plan's
    figures and your saved choices, its chance of lasting to 59½ across
    history, its costs over the bridge years and what's left at 59½. */
export function bridgeSummary(pr: Profile, entries: Entry[], R?: Results): BridgeSummary | null {
  if (!needsBridge(pr)) return null;
  const inputs = bridgeFor(pr, entries, R), key = JSON.stringify(inputs);
  if (memo.has(key)) return memo.get(key)!;
  const { run } = runBridge(bridgeInput(inputs), "hist", 0);
  const b = run?.best;
  const out = b ? { plan: b.name, phrase: b.phrase, hold: b.score.hold / 100, cost: b.steady.cost, tax: b.steady.tax, pen: b.steady.pen, health: b.steady.health, left: b.steady.end.total, spend: run!.ctx.spend } : null;
  if (memo.size > 30) memo.clear();
  memo.set(key, out);
  return out;
}
