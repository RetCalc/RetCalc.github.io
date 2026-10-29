"use client";

/* Your numbers: a lesson applied to the reader's own plan, from the
   Dashboard's profile and the same projection its pages use. Someone
   signed out, or without a plan yet, sees a sample household (Sam and
   Jordan, with their daughter Nora) and an invitation to set up their own.
   Each lesson with a panel names its key in lib/learn/catalog.ts. */

import Link from "next/link";
import { useMemo, type ReactNode } from "react";
import { SparklesIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAccount } from "@/components/account/AccountProvider";
import { useDashboard, unstarted, entryFrom, EMPTY_PROFILE, type Profile, type Entry } from "@/components/dashboard/store";
import { results, holdings, mortgage as mortgageOf, ageOf, couple, contribMonth, grossYear, people, nameOf, spendMonth, realGrowth, type Results } from "@/components/dashboard/model";
import { guardrailsChance } from "@/components/dashboard/readiness";
import { flow, retireMix, stocksOf } from "@/components/dashboard/flows";
import { money, money10 } from "@/components/dashboard/format";
import type { YoursKey } from "@/lib/learn/catalog";
import { runSeq, SEQ_RETURNS } from "./widgets/sequence-data";
import { claimShare } from "./widgets/ClaimAge";

/* ---------- The sample household ---------- */
const SAMPLE: Profile = {
  ...EMPTY_PROFILE,
  who: "couple", kids: 1, state: "IL",
  p1: { name: "Sam", bm: 4, by: 1974, retire: 62, pay: 104000, per: "year", taxed: "before" },
  p2: { name: "Jordan", bm: 8, by: 1976, retire: 62, pay: 76000, per: "year", taxed: "before" },
  kidList: [{ name: "Nora", bm: 6, by: 2011 }],
  saved: 560000, contrib: 2100, cper: "month", employer: 650, match: "full",
  spend: 8100, retSpend: null,
  home: "own", value: 520000, owed: 205000, mortRate: 0.0375, mortPay: 2150,
  college: { help: "part", cost: 27000 },
};

interface Plan { pr: Profile; entries: Entry[]; R: Results; sample: boolean; dashboard: boolean }

/** The reader's plan when they have one started, else the sample's. */
function usePlan(): Plan {
  const { account } = useAccount();
  const { data } = useDashboard();
  const own = !!account && !unstarted(data);
  return useMemo(() => {
    const pr = own ? data.profile : SAMPLE;
    const e0 = own ? data.entries : [entryFrom(SAMPLE)].filter((e): e is Entry => e != null);
    return { pr, entries: e0, R: results(pr, e0), sample: !own, dashboard: own };
  }, [own, data]);
}

const pct = (v: number, d = 0) => `${(v * 100).toFixed(d)}%`;
const yr = (n: number) => `${n} ${n === 1 ? "year" : "years"}`;
/** Full retirement age by birth year, in years (66.5 is 66 and 6 months). */
export function fraOf(by: number): number {
  if (by <= 1937) return 65;
  if (by <= 1942) return 65 + ((by - 1937) * 2) / 12;
  if (by <= 1954) return 66;
  if (by <= 1959) return 66 + ((by - 1954) * 2) / 12;
  return 67;
}
const ageLabel = (a: number) => { const y = Math.floor(a), m = Math.round((a - y) * 12); return m ? `${y} and ${m} months` : String(y); };

type Row = [string, ReactNode, ("gain" | "loss")?];
interface Out { rows: Row[]; note?: ReactNode; line: ReactNode }

/** The panel's rows, its note and the sentence that goes in the text. */
function build(key: YoursKey, P: Plan): Out | null {
  const { pr, entries, R } = P;
  const ps = people(pr), names = ps.map((_, i) => nameOf(pr, i as 0 | 1));
  const who = P.sample ? `${names[0]} and ${names[1]}` : couple(pr) ? "you" : "you";
  const yourP = P.sample ? "their" : "your";
  const age = ageOf(pr.p1), retire = pr.p1.retire;
  const H = holdings(entries, pr);
  const need = (what: string): Out => ({ rows: [], line: null, note: <>This needs {what}. </> });
  switch (key) {
    case "plan": {
      if (R.atRetire == null) return need("your ages, pay, savings and spending");
      return {
        rows: [["Retire in", R.retireYear ?? "—"], ["Savings at retirement", money(R.atRetire)], ["Chance of success", R.success != null ? pct(R.success) : "—"], ["Income per month in retirement", R.savingsIncome != null ? money10(R.savingsIncome + (R.ss ?? 0)) : "—"]],
        line: <>Applied to {yourP} plan: retiring in <b>{R.retireYear}</b> with about <b>{money(R.atRetire)}</b>, it lasted in <b>{pct(R.success ?? 0)}</b> of past markets.</>,
      };
    }
    case "compound": {
      if (age == null || retire == null) return need("your age and retirement age");
      const years = retire - age, g = realGrowth(pr), now = H.trad + H.roth + H.brok, grown = now * Math.pow(1 + g, years);
      return {
        rows: [["Saved today", money(now)], ["Years until retirement", years], ["Growth after inflation", pct(g, 1) + " per year"], ["Today's savings alone, at retirement", money(grown)]],
        line: <>{P.sample ? "Sam and Jordan's" : "Your"} {money(now)} saved today, left alone for {yr(years)} at {pct(g, 1)} per year after inflation, would grow to about <b>{money(grown)}</b>.</>,
      };
    }
    case "inflation": {
      const s = spendMonth(pr), i = pr.assume.inflation;
      if (s == null || age == null || retire == null) return need("your spending and ages");
      const years = retire - age, later = s * Math.pow(1 + i, years);
      return {
        rows: [["Spending today", money10(s) + " per month"], ["Inflation assumed", pct(i, 1) + " per year"], [`The same spending in ${R.retireYear ?? "retirement"}`, money10(later) + " per month"]],
        line: <>At {pct(i, 1)} inflation, {yourP} {money10(s)} per month today costs about <b>{money10(later)} per month</b> by {R.retireYear ?? "retirement"}. RetCalc shows it as {money10(s)}, in today&rsquo;s dollars.</>,
      };
    }
    case "saverate": {
      const c = contribMonth(pr), gross = ps.reduce((t, p) => t + (grossYear(p) ?? 0), 0);
      if (c == null || !gross) return need("your pay and what you save");
      const save = (c + (pr.employer ?? 0)) * 12;
      return {
        rows: [["Saving per year, with the employer's", money(save)], ["Pay before taxes per year", money(gross)], ["Savings rate", pct(save / gross, 1)]],
        line: <>{P.sample ? "Sam and Jordan save" : "You save"} about <b>{pct(save / gross, 1)}</b> of {yourP} pay, counting {P.sample ? "their" : "your"} employers&rsquo; contributions.</>,
      };
    }
    case "target": {
      if (R.goal == null) return need("your spending and retirement age");
      const spendY = R.goal * 12, ssY = (R.ss ?? 0) * 12, fromSav = Math.max(0, spendY - ssY);
      return {
        rows: [["Spending in retirement per year", money(spendY)], ["Social Security per year", money(ssY)], ["Left for savings to cover", money(fromSav)], ["25 times that", money(fromSav * 25)], ["Projected savings at retirement", money(R.atRetire ?? 0)]],
        line: <>{P.sample ? "Sam and Jordan's" : "Your"} savings need to cover about <b>{money(fromSav)} per year</b> after Social Security. 25 times that is <b>{money(fromSav * 25)}</b>.</>,
      };
    }
    case "horizon": {
      if (age == null || retire == null) return need("your ages and retirement age");
      const rows: Row[] = ps.map((p, i) => [`${names[i]} today`, ageOf(p) ?? "—"]);
      rows.push(["Retire at", retire], ["Years from retirement to 95", 95 - retire]);
      return { rows, line: <>A plan to 95 asks {yourP} savings to last <b>{yr(95 - retire)}</b> after retiring at {retire}.</> };
    }
    case "efund": {
      const F = flow(pr), months = F.efMonths || 6;
      if (R.cushion == null) return { rows: [["Months to aim for", months]], note: <>Add {P.sample ? "" : "your "}cash accounts on Net worth to see how many months {P.sample ? "they" : "you"} have.</>, line: <>{P.sample ? "Their" : "Your"} plan aims for <b>{months} months</b> of spending in cash.</> };
      return {
        rows: [["Months covered today", R.cushion.toFixed(1)], ["Months to aim for", months]],
        line: <>{P.sample ? "Their" : "Your"} cash covers <b>{R.cushion.toFixed(1)} months</b> of spending, against a goal of {months}.</>,
      };
    }
    case "match": {
      const F = flow(pr), m = pr.employer ?? F.match;
      if (!m) return { rows: [["Employer adds per month", "Nothing entered"]], line: <>{P.sample ? "Their" : "Your"} plan has no employer contribution entered yet.</> };
      return {
        rows: [["Employer adds per month", money(m)], ["Per year", money(m * 12)], ["The whole match?", pr.match === "full" ? "Yes" : pr.match === "partial" ? "Not all of it" : "—"]],
        line: <>{P.sample ? "Their employers add" : "Your employer adds"} <b>{money(m * 12)} per year</b>{pr.match === "partial" ? ", and there's more match available" : pr.match === "full" ? ", the whole match" : ""}.</>,
      };
    }
    case "accounts": {
      const tot = H.trad + H.roth + H.brok;
      if (!tot) return need("what you've saved");
      return {
        rows: [["Pre-tax (401(k), traditional IRA)", money(H.trad)], ["Roth and HSA", money(H.roth)], ["Taxable", money(H.brok)], ["Pre-tax share", pct(H.trad / tot)]],
        note: H.accounts ? undefined : <>Until accounts are added on Net worth, savings count as pre-tax.</>,
        line: <><b>{pct(H.trad / tot)}</b> of {yourP} savings is pre-tax, taxed when it comes out.</>,
      };
    }
    case "stocks": {
      // The mix once retired, in full, as Retirement's simulator holds it.
      const M = retireMix(pr), st = Math.round(stocksOf(M));
      return {
        rows: [["Stocks once retired", st + "%" + (M.sv > 0 ? ` (${Math.round(M.sv)}% small-cap value)` : "")], ["Bonds", Math.max(0, Math.round(100 - st - M.cash)) + "%"],
          ...(M.cash > 0 ? [["Cash", Math.round(M.cash) + "%"] as [string, string]] : []), ...(M.end != null && Math.round(M.end) !== st ? [["Stocks by the end", Math.round(M.end) + "%"] as [string, string]] : [])],
        line: <>{P.sample ? "Their" : "Your"} plan holds <b>{st}% in stocks</b> once retired. {P.sample ? "It's set" : "You can change it"} in the Retirement simulator.</>,
      };
    }
    case "band": {
      const at = R.path.find((p) => retire != null && age != null && p.t >= (R.retireYear ?? 0) + 25) ?? R.path[R.path.length - 1];
      if (!at) return need("a plan that can run");
      return {
        rows: [["Year", Math.round(at.t)], ["Middle of history", money(at.v)], ["Low (1 in 10 did worse)", money(at.lo), "loss"], ["High (1 in 10 did better)", money(at.hi), "gain"]],
        line: <>Twenty-five years into {yourP} retirement, the middle outcome is <b>{money(at.v)}</b>, but 8 in 10 histories land between {money(at.lo)} and {money(at.hi)}.</>,
      };
    }
    case "sequence": {
      if (R.atRetire == null || !R.S) return need("a plan that can run");
      // Spending and its taxes each year, less Social Security once it starts.
      const W0 = R.S.spend + R.S.taxYr, W1 = Math.max(0, W0 - (R.ss ?? 0) * 12), ssAt = R.ssYear && R.retireYear ? R.ssYear - R.retireYear : 0;
      const W = (y: number) => (y < ssAt ? W0 : W1), bad = runSeq(SEQ_RETURNS, R.atRetire, W), good = runSeq([...SEQ_RETURNS].reverse(), R.atRetire, W);
      const out = bad.findIndex((b) => b <= 0);
      return {
        rows: [["You retire in", R.retireYear ?? "—"], ["Savings at retirement", money(R.atRetire)], ["Withdrawals per year", ssAt > 0 ? `${money(W0)}, then ${money(W1)}` : money(W1)],
          ["Bad years first", out > 0 ? `Runs out in ${(R.retireYear ?? 0) + out}` : money(bad[30]) + " left", out > 0 ? "loss" : undefined],
          ["Good years first", money(Math.round(good[30] / 1000) * 1000) + " left after 30 years", "gain"]],
        note: R.success != null ? <>{P.sample ? "Their" : "Your"} chance of success is <b>{pct(R.success)}</b>. Most past retirements that fell short began with a weak first decade.</> : undefined,
        line: <>The same returns, applied to {yourP} plan ({money(R.atRetire)} at retirement in {R.retireYear}, withdrawing {money(W0)} per year{ssAt > 0 ? <> until Social Security starts, then {money(W1)}</> : null}): {out > 0 ? <>with the weak years first, the money runs out in <b>{(R.retireYear ?? 0) + out}</b></> : <>even with the weak years first, <b>{money(bad[30])}</b> is left after 30 years</>}.</>,
      };
    }
    case "success": {
      if (R.success == null) return need("a plan that can run");
      return {
        rows: [["Chance of success", pct(R.success)], ["Withdrawals", R.strategy ? R.strategy.name : "A fixed amount, raised with inflation"], ["Lasting to", "Age 95"]],
        line: <>{P.sample ? "Their" : "Your"} plan lasted in <b>{pct(R.success)}</b> of past retirements, which means it ran short in about {pct(1 - R.success)} of them.</>,
      };
    }
    case "rate": {
      if (R.atRetire == null || !R.S) return need("a plan that can run");
      // The first year's withdrawal: spending and its taxes. Once Social Security starts, the benefits cover part of it.
      const W = R.S.spend + R.S.taxYr, rate = W / R.atRetire, later = Math.max(0, W - (R.ss ?? 0) * 12) / R.atRetire;
      const rows: Row[] = [["Savings at retirement", money(R.atRetire)], ["First year's withdrawal", money(W)], ["Starting withdrawal rate", pct(rate, 1)]];
      if (R.ss && R.ssYear) rows.push([`Once Social Security starts (${R.ssYear})`, pct(later, 1) + " of the starting balance"]);
      rows.push(["Chance of success", pct(R.success ?? 0)]);
      // Why a starting rate above 4% can still last: it's only that high
      // until Social Security takes over part of the spending.
      const early = R.ss && R.ssYear && R.ssYear > (R.retireYear ?? 0) && rate > 0.045;
      return {
        rows,
        note: early ? <>The 4% rule assumes one withdrawal, raised with inflation, for all 30 years. Here the rate is high only until Social Security starts in {R.ssYear}. After that, withdrawals come to {pct(later, 1)} of the starting balance.</> : undefined,
        line: <>{P.sample ? "Their" : "Your"} plan starts by withdrawing <b>{pct(rate, 1)}</b> of savings{R.ss && R.ssYear && R.ssYear > (R.retireYear ?? 0) ? <>, falling to about {pct(later, 1)} once Social Security starts in {R.ssYear}</> : null}.</>,
      };
    }
    case "guardrails": {
      if (R.success == null) return need("a plan that can run");
      const g = guardrailsChance(pr, R);
      return {
        rows: [["Fixed spending, raised with inflation", pct(R.success)], ...(g != null ? [["With guardrails", pct(g), g > R.success ? "gain" : undefined] as Row] : [])],
        line: g != null ? <>Switching {yourP} plan from fixed spending to guardrails moves its chance of success from <b>{pct(R.success)}</b> to <b>{pct(g)}</b>.</> : <>{P.sample ? "Their" : "Your"} plan already uses guardrails: <b>{pct(R.success)}</b> lasted.</>,
      };
    }
    case "strategy": {
      if (R.success == null) return need("a plan that can run");
      return {
        rows: [["Strategy", R.strategy ? R.strategy.name : "Not chosen (a fixed amount)"], ["Chance of success", pct(R.success)], ...(R.strategy ? [["First year's spending", money10(R.strategy.first) + " per month"] as Row] : [])],
        line: R.strategy ? <>{P.sample ? "Their" : "Your"} plan uses <b>{R.strategy.name}</b>, which lasted in {pct(R.success)} of past retirements.</> : <>{P.sample ? "Their" : "Your"} plan hasn&rsquo;t chosen a strategy, so it spends a fixed amount. Pick one on the Retirement tab to compare.</>,
      };
    }
    case "rmd": {
      const rows: Row[] = ps.filter((p) => p.by).map((p, i) => { const a = (p.by ?? 0) >= 1960 ? 75 : 73; return [`${names[i]}: RMDs start at ${a}`, `in ${(p.by ?? 0) + a}`]; });
      if (!rows.length) return need("your birth years");
      const a = (pr.p1.by ?? 0) >= 1960 ? 75 : 73;
      return { rows, line: <>Born in {pr.p1.by}, {P.sample ? "Sam's" : "your"} required withdrawals start at <b>{a}</b>, in {(pr.p1.by ?? 0) + a}.</> };
    }
    case "claim": {
      if (R.ss1 == null || !pr.p1.by) return need("your birth year and pay");
      const fra = fraOf(pr.p1.by), c = R.claim1 ?? 67;
      return {
        rows: [["Full retirement age", ageLabel(fra)], ["Claiming at", c], ["Benefit per month, today's dollars", money10(R.ss1)], ["First check", `${pr.p1.by + Math.ceil(c)}`]],
        note: pr.ss.checked ? undefined : <>An estimate from pay. A statement from ssa.gov makes it exact.</>,
        line: <>{P.sample ? "Sam's" : "Your"} plan claims at <b>{c}</b>, for about <b>{money10(R.ss1)} per month</b> in today&rsquo;s dollars; full retirement age is {ageLabel(fra)}.</>,
      };
    }
    case "couple-ss": {
      if (!couple(pr)) return { rows: [], note: <>This one is about couples, and {yourP} plan is for one person.</>, line: null };
      if (R.ss1 == null || R.ss2 == null || !pr.p1.by || !pr.p2.by) return need("both your birth years and pay");
      // A survivor gets the larger of their own check and the one who died's,
      // and never less than 82.5% of the one who died's full benefit.
      const pia1 = R.ss1 / claimShare(R.claim1 ?? 67, fraOf(pr.p1.by)), pia2 = R.ss2 / claimShare(R.claim2 ?? 67, fraOf(pr.p2.by));
      const hi = Math.max(Math.max(R.ss1, 0.825 * pia1, R.ss2), Math.max(R.ss2, 0.825 * pia2, R.ss1));
      return {
        rows: [[`${names[0]}, from ${R.claim1}`, money10(R.ss1) + " per month"], [`${names[1]}, from ${R.claim2}`, money10(R.ss2) + " per month"], ["Survivor keeps", money10(hi) + " per month"]],
        line: <>When one of {who === "you" ? "you" : "them"} dies, the household keeps the larger benefit, about <b>{money10(hi)} per month</b>, and loses the smaller.</>,
      };
    }
    case "pre65": {
      if (retire == null || !pr.p1.by) return need("your birth year and retirement age");
      const gap = Math.max(0, 65 - retire);
      return {
        rows: [["Retire at", retire], ["Medicare from", `${pr.p1.by + 65}`], ["Years to cover before Medicare", gap]],
        line: gap > 0 ? <>Retiring at {retire} leaves <b>{yr(gap)}</b> before {P.sample ? "Sam's" : "your"} Medicare starts in {pr.p1.by + 65}.</> : <>{P.sample ? "Sam retires" : "You retire"} at {retire}, after Medicare starts, so there&rsquo;s no gap to cover.</>,
      };
    }
    case "medicare": {
      const rows: Row[] = ps.filter((p) => p.by).map((p, i) => [`${names[i]} turns 65`, `${(p.by ?? 0) + 65}`]);
      if (!rows.length) return need("your birth years");
      return { rows, line: <>{P.sample ? "Sam turns" : "You turn"} 65, and can join Medicare, in <b>{(pr.p1.by ?? 0) + 65}</b>.</> };
    }
    case "bridge": {
      if (retire == null || !pr.p1.by) return need("your birth year and retirement age");
      const gap = Math.max(0, 59.5 - retire);
      return {
        rows: [["Retire at", retire], ["59½ in", `${pr.p1.by + 60}`], ["Years before 59½", gap ? gap.toFixed(1) : "None"]],
        line: gap > 0 ? <>Retiring at {retire} leaves <b>{gap.toFixed(1)} years</b> before {P.sample ? "Sam" : "you"} can take from retirement accounts without the 10% penalty.</> : <>{P.sample ? "Sam retires" : "You retire"} at {retire}, after 59½, so the early-withdrawal penalty doesn&rsquo;t come into it.</>,
      };
    }
    case "college": {
      const kids = pr.kidList.filter((k) => k.by);
      if (!kids.length) return { rows: [], note: <>{P.sample ? "" : "Your plan has no children entered."}</>, line: null };
      return {
        rows: [...kids.map((k, i): Row => [`${k.name || `Child ${i + 1}`} starts college`, `${(k.by ?? 0) + 18}`]), ["Help with college", pr.college.help === "all" ? "All of it" : pr.college.help === "part" ? "Part of it" : "None planned"]],
        line: <>{kids[0].name || "Your first child"} starts college in <b>{(kids[0].by ?? 0) + 18}</b>{pr.college.help !== "none" ? `, with ${pr.college.help === "all" ? "all" : "part"} of it planned for` : ""}.</>,
      };
    }
    case "kids": {
      const n = pr.kidList.length + pr.planned.count;
      if (!n) return { rows: [], note: <>{yourP === "your" ? "Your" : "Their"} plan has no children entered.</>, line: null };
      return {
        rows: [["Children now", pr.kidList.length], ["Planned", pr.planned.count], ["Childcare before school", pr.childcare ? "Yes" : "No"]],
        line: <>{P.sample ? "Their" : "Your"} plan counts the costs of <b>{n === 1 ? "one child" : `${n} children`}</b> year by year, from birth through {pr.college.help !== "none" ? "college" : "18"}.</>,
      };
    }
    case "mortgage": {
      const M = mortgageOf(pr, entries);
      if (!M.owed) return { rows: [["Mortgage", "None"]], line: <>{P.sample ? "They have" : "You have"} no mortgage in {yourP} plan.</> };
      return {
        rows: [["Owed", money(M.owed)], ["Rate", M.rate != null ? pct(M.rate, 2) : "—"], ["Paid off", M.payoff ? String(Math.ceil(M.payoff)) : "—"], ["Retire in", R.retireYear ?? "—"]],
        line: M.payoff && R.retireYear ? <>At {money(M.pay ?? 0)} per month, {yourP} mortgage is paid off in <b>{Math.ceil(M.payoff)}</b>, {Math.ceil(M.payoff) <= R.retireYear ? "before" : "after"} retirement in {R.retireYear}.</> : <>{P.sample ? "They owe" : "You owe"} {money(M.owed)} on the home.</>,
      };
    }
  }
}

function Footnote({ P }: { P: Plan }) {
  return P.sample
    ? <p className="lrn-yours-foot">A sample household. <Link href="/dashboard/setup">Set up your plan</Link> to see your own.</p>
    : <p className="lrn-yours-foot">From your plan. <Link href="/dashboard/profile">Change it in your dashboard</Link>.</p>;
}

/** The panel beside the lesson. */
export function YoursPanel({ k }: { k: YoursKey }) {
  const P = usePlan(), out = useMemo(() => build(k, P), [k, P]);
  if (!out) return null;
  return (
    // A section, not an aside: the site's older styles make every aside sticky.
    <section className="lrn-yours" aria-label="Your numbers">
      <div className="lrn-yours-h"><SparklesIcon aria-hidden="true" />{P.sample ? "Sample numbers" : "Your numbers"}</div>
      {out.rows.length ? <dl>{out.rows.map(([a, b, tone]) => <div key={a}><dt>{a}</dt><dd className={tone}>{b}</dd></div>)}</dl> : null}
      {out.note ? <p className="lrn-yours-note">{out.note}</p> : null}
      {P.sample ? <Button size="sm" variant="outline" className="lrn-yours-btn" nativeButton={false} render={<Link href="/dashboard/setup" />}>Use my own numbers</Button> : null}
      <Footnote P={P} />
    </section>
  );
}

/** The sentence in the text that applies the lesson to the plan. */
export function YoursLine({ k }: { k: YoursKey }) {
  const P = usePlan(), out = useMemo(() => build(k, P), [k, P]);
  if (!out?.line) return null;
  return <p className="lrn-yours-line">{P.sample ? <span className="lrn-yours-tag">Sample household: </span> : null}{out.line}</p>;
}
