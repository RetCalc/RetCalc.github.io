"use client";

/* The notes under a step's fields that follow what's typed: how many years
   to prepare, what's left each month, the months an emergency fund covers,
   Social Security, and so on. They read the answers as they are now. From
   GD_LIVE in src/js/app/29-guide-trips.js. */

import { BASIC_INFL } from "@/lib/engine/typed";
import { escapeHtml } from "@/tools/drawdown/text";
import { fmtNum, money, pctStr } from "@/lib/format";
import { Html } from "@/components/common/Html";
import { accts, bridgeSplit, coastNow, gross, mar, minSpend, months, ok, pos, saveMo, sim, ssFor } from "./calc";
import type { Answers } from "./store";
import { Callout } from "./ui";

export function AboutNote({ a }: { a: Answers }) {
  if (!ok(a.age) || !ok(a.retire)) return null;
  if (a.retire <= a.age) return <Callout cls="warn">Your retirement age needs to be later than your age today. This guide is built for the saving years; if you&apos;ve already retired, the <b>Drawdown Simulator</b> is the tool for you.</Callout>;
  const yrs = a.retire - a.age;
  return <Callout>That gives you <b>{fmtNum(yrs) + (yrs === 1 ? " year" : " years")}</b> to prepare.
    {a.retire < 65 ? " Retiring before 65 means buying your own health insurance until Medicare starts; we'll price that out later." : ""}</Callout>;
}

export function IncomeNote({ a }: { a: Answers }) {
  const g = gross(a);
  return g > 0 ? <Callout>That&apos;s <b>{money(g / 12)}</b> a month before taxes{mar(a) ? " for the two of you" : ""}.</Callout> : null;
}

export function FlowNote({ a }: { a: Answers }) {
  if (!pos(a.takehome) || !pos(a.spend)) return null;
  const left = a.takehome - a.spend, pct = left / a.takehome;
  if (left < 0) return <Callout cls="bad">You&apos;re spending <b>{money(-left) + "/mo more"}</b> than you bring home. That gap usually lands on a credit card, so it&apos;s the first thing to fix.</Callout>;
  const sv = pos(a.bgSave) && a.bgSave <= left ? a.bgSave : 0;
  return (
    <Callout cls={pct >= 0.1 ? "ok" : "warn"}>That leaves <b>{money(left) + "/mo"}</b> unspent, {pctStr(pct, 0)} of your take-home
      {sv ? <>: {money(sv)} already going to savings and <b>{money(left - sv)}</b> left over.</> : ", for saving and paying down debt."}
      {pct < 0.1 ? " Under 10% leaves little room for surprises." : ""}</Callout>
  );
}

export function CashNote({ a }: { a: Answers }) {
  if (!ok(a.cash)) return null;
  if (!pos(a.spend)) return <Callout>Tell us your monthly spending on the step before this one to see how many months this covers.</Callout>;
  const m = a.cash / a.spend, lo = a.spend * 3, hi = a.spend * 6;
  return (
    <Callout cls={m >= 3 ? "ok" : m >= 1 ? "warn" : "bad"}>That covers <b>{months(m) + (m === 1 ? " month" : " months")}</b> of spending.
      {" "}The usual target is 3 to 6 months: <b>{money(lo)}</b> to <b>{money(hi)}</b> for you.
      {m < 1 ? " Start with one month, " + money(a.spend) + ", before anything else." : ""}</Callout>
  );
}

export function RateNote({ a }: { a: Answers }) {
  const inc = gross(a);
  if (!(inc > 0) || !ok(a.contrib)) return null;
  const r = (saveMo(a) * 12) / inc;
  return (
    <Callout cls={r >= 0.15 ? "ok" : r >= 0.1 ? "warn" : "bad"}>
      {coastNow(a) ? <>Your plan has you coasting from now (set on <b>Adjust your plan</b>), so these are what you were putting in. </> : null}
      You&apos;re saving <b>{pctStr(r, 1)}</b> of your gross income for retirement, counting your employer&apos;s share.{" "}
      {r >= 0.15 ? "That meets the common 15% target." : <>A common target is 15%: about {money((inc * 0.15) / 12)}/mo in all for you, <b>{money((inc * 0.15) / 12 - saveMo(a)) + "/mo more"}</b> than now.</>}
      {a.match === "partial" ? " You're also leaving employer match on the table: raising your contribution to get all of it is the best return available anywhere." : ""}
    </Callout>
  );
}

export function SSNote({ a }: { a: Answers }) {
  if (!ok(a.retire)) return null;
  const ss = ssFor(a, a.retire), both = mar(a) && ss.a2 > 0;
  const src = (own: boolean, who: string) => (own ? "from " + who + " statement" : "estimated from " + who + " income");
  let tail = "";
  if (ss.tactics) tail += " These are the Plan Optimizer's claiming ages, which your plan now uses.";
  if (!ss.own && ss.career < 35) tail += " Social Security averages your best 35 years, so retiring this early counts the missing years as zeros.";
  let cover: React.ReactNode = null;
  if (pos(a.retSpend)) {
    const pen = pos(a.pension) ? a.pension * 12 : 0, got = ss.total + pen;
    const share = got / a.retSpend, early = Math.max(0, ss.claim - Math.round(a.retire));
    const that = pen ? " Together with your pension, that" : " That";
    cover = share >= 1
      ? (pen ? " Once it starts, it and your pension cover the spending you entered" : " Once it starts, that alone covers the spending you entered") +
        (early ? "; your savings carry the " + early + (early === 1 ? " year" : " years") + " before it." : ".")
      : <>{that} covers about <b>{pctStr(share, 0)}</b> of your spending; your savings cover the other {money(a.retSpend - got)} a year and its tax
        {early ? ", and more for the " + early + (early === 1 ? " year" : " years") + " before " + ss.claim : ""}.</>;
  }
  return (
    <Callout>
      {both
        ? <>Social Security: about <b>{money(ss.a1 / 12) + "/mo"}</b> for you from {ss.claim} ({src(ss.own, "your")}) and <b>{money(ss.a2 / 12) + "/mo"}</b> for your spouse from {ss.claim2} ({src(ss.own2, "their")}){ss.spousal ? ", including the spousal benefit" : ""}, in today&apos;s dollars.</>
        : <>{ss.own ? "Using your statement: " : "We estimate Social Security at about "}<b>{money(ss.total / 12) + "/mo"}</b>
          {ss.own ? (ss.claim !== 67 ? ", adjusted for claiming at " + ss.claim : "") : " in today's dollars, from your income " +
            (ss.career < 35 ? "over the " + ss.career + " years you'll have worked by " + fmtNum(a.retire) + ", from 22" : "over a full career")}
          , starting at {ss.claim}.</>}
      {tail}{cover}
      {!ss.own ? " The program's trust fund is projected to run short in the 2030s; for a cautious plan, enter a lower figure below." : ""}
    </Callout>
  );
}

export function MinNote({ a }: { a: Answers }) {
  const S = sim(a), m = minSpend(a);
  if (!m || !S) return null;
  if (m >= S.spend) return <Callout cls="warn">That&apos;s at or above the {money(S.spend)} a year you plan to spend, so no approach can flex: they&apos;d all behave like the fixed one.</Callout>;
  const base = S.ss.total + S.pension;
  return (
    <Callout>{pctStr(m / S.spend, 0)} of your planned spending.{" "}
      {base >= m ? "Social Security" + (S.pension ? " and your pension" : "") + " cover it on their own once they start, so the floor mostly matters in the years before."
        : (S.pension ? "Social Security and your pension cover " : "Social Security covers ") + money(base) + " of it; the other " + money(m - base) + " a year has to come from savings even in the worst markets."}
    </Callout>
  );
}

export function InflNote({ a }: { a: Answers }) {
  const m = saveMo(a), infl = BASIC_INFL as number;
  return (
    <p className="hint -mt-0.5 mx-0 mb-4 max-w-copy-narrow">Every projection in this guide raises both amounts with inflation each year, so they stay the same in today&apos;s dollars.
      {" "}At the {pctStr(infl, 2)} inflation it assumes, next year&apos;s {m > 0 ? money(m) + "/mo becomes about " + money(m * (1 + infl)) + "/mo" : "contribution rises " + pctStr(infl, 2) + " too"}.
      {" "}The Basic calculator works the same way.</p>
  );
}

export function TaxNote() {
  return (
    <Callout><b>You don&apos;t need to add tax.</b> Your plan works out each year&apos;s federal and state income tax from where the money comes from:
      {" "}traditional 401(k) and IRA withdrawals are taxed as income, Roth withdrawals aren&apos;t, a brokerage account is taxed only on its gains, and part of Social Security can be taxed too.
      {" "}Medicare&apos;s income surcharge and health insurance before 65 are counted the same way.</Callout>
  );
}

export function AcctNote({ a }: { a: Answers }) {
  if (!pos(a.saved)) return null;
  const A = accts(a), over = (pos(a.rothNow) ? a.rothNow : 0) + (pos(a.brokNow) ? a.brokNow : 0) > a.saved + 0.5;
  if (over) return <Callout cls="warn">Those add up to more than the {money(a.saved)} you have saved. Count each dollar once.</Callout>;
  if (!(A.roth > 0) && !(A.brok > 0)) return null;
  return <Callout>So <b>{money(A.trad)}</b> traditional, taxed when it comes out; <b>{money(A.roth)}</b> Roth, tax-free; and <b>{money(A.brok)}</b> in a brokerage account, taxed only on its gains.</Callout>;
}

export function PensionNote({ a }: { a: Answers }) {
  if (!pos(a.pension)) return null;
  const from = ok(a.pensionAge) ? a.pensionAge : a.retire;
  return (
    <Callout>Counted from {ok(from) ? "age " + fmtNum(from) : "retirement"}: <b>{money(a.pension * 12) + " a year"}</b>
      {a.pensionCola === "yes" ? ", rising with inflation." : ", a fixed amount, so it buys a little less each year as prices rise."}</Callout>
  );
}

export function BridgeNote({ a }: { a: Answers }) {
  const B = bridgeSplit(a);
  if (!(B.total > 0)) return null;
  return (
    <Callout>At {fmtNum(a.retire!)} that&apos;s about <b>{money(B.total)}</b>: {money(B.trad)} traditional, {money(B.roth)} Roth ({money(B.basis)} of it contributions, which can come out any time) and {money(B.brok)} in a brokerage account, in today&apos;s dollars.
      {a.bridge ? <Html as="span" html={" Last time, the bridge tool picked <b>" + escapeHtml(a.bridge) + "</b>, holding up in <b>" + a.bridgeHold + "%</b> of markets."} /> : null}</Callout>
  );
}

export function HcNote({ a }: { a: Answers }) {
  const S = sim(a);
  if (!S) return null;
  if (a.hcIncl === "yes") return <Callout>Your plan won&apos;t add premiums before 65. Make sure the {money(S.spend)} a year you entered really covers them: marketplace plans can run hundreds a month each without a subsidy.</Callout>;
  if (!(S.hcYr > 0)) return <Callout cls="ok">In your plan, income stays low enough before 65 that coverage comes through Medicaid or a full subsidy.</Callout>;
  return (
    <Callout>In your plan: about <b>{money(S.hcYr) + " a year"}</b> for {S.hcYears + (S.hcYears === 1 ? " year" : " years")}, after the subsidy its income earns.
      {" "}Above 400% of the poverty line the subsidy disappears all at once; the Plan Optimizer can keep income under that line.</Callout>
  );
}

export function HouseNote({ a }: { a: Answers }) {
  const inc = gross(a);
  if (!pos(a.housePay)) return null;
  const p = inc > 0 ? (a.housePay * 12) / inc : null;
  return (
    <Callout cls={p == null ? "" : p <= 0.28 ? "ok" : p <= 0.36 ? "warn" : "bad"}>Housing: <b>{money(a.housePay) + "/mo"}</b>
      {p != null ? ", " + pctStr(p, 0) + " of your gross income. Planners and lenders like to see 28% or less." : "."}</Callout>
  );
}
