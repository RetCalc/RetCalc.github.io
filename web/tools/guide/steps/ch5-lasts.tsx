"use client";

/* Chapter 5 · Will it last (doc 2, cards 10 and 11): the settled number,
   on course against what the plan needs, with where a year's income comes
   from; then the plan replayed through every retirement since 1926, and
   why the order of returns matters as much as their average. Both read the
   plan the worker ran; neither asks anything. */

import { fmtNum, money, pctStr } from "@/lib/format";
import { HeroReading } from "@/components/common/Reading";
import { CircleCheckIcon } from "lucide-react";
import { riskLabel, target, withGuess, yearsList, type Sim } from "../calc";
import { PlanChart, series } from "../chart";
import { Coverage } from "../charts/Coverage";
import { Starts } from "../charts/Starts";
import { threeStarts } from "../figures";
import { Lesson, Term } from "../lessons/Lesson";
import { planSources } from "../score";
import { After, BackNote, Callout, NeedsPlan, Q, Task, useGuideView } from "../ui";
import { usePlanJob } from "../usePlan";
import { and, rounded } from "../words";
import { Learn, Means } from "../zones";

/** 5.75%, 4.5%. */
const rate = (v: number) => (v * 100).toFixed(2).replace(/0$/, "").replace(/\.0$/, "") + "%";
const times = (x: number) => (Math.round(x * 10) / 10).toString().replace(/\.0$/, "") + "×";

/* ---------- Card 10 · Your number ---------- */
export function NumberCard() {
  const { a, g } = useGuideView();
  const plan = usePlanJob<Sim>("sim", withGuess(a)), need = usePlanJob<number>("need", withGuess(a));
  const S = plan.res, want = need.res;
  if (S === undefined) return <><Q>Your number</Q><p className="gd-means-empty">Working it out…</p></>;
  if (!S) return <NeedsPlan title="Your number" />;
  const spendNeed = S.spend + S.taxYr, goal = target(a), src = planSources(a, g.src);
  const coast = S.stop != null && S.stop <= a.age!;
  const share = goal >= 1 ? "every" : pctStr(goal, 0) + " of";
  return (
    <>
      <Q>Your number</Q>
      <Learn>
        <Lesson id="income-sources" figure={<Coverage port={S.portIncome} ss={S.ss.total} pen={S.pension} need={spendNeed} />}
          caption={"A typical year of your retirement, in today's dollars, Social Security from " + S.ss.claim + "."}>
          <p>A year of retirement is paid from three places: your savings, Social Security, and any pension. A common rule says savings can pay about 4% of
            {" "}their starting balance a year, rising with prices: a <Term k="swr">safe withdrawal rate</Term>. For you that&apos;s <b>{money(S.portIncome)}</b> a year
            {" "}from {rounded(S.fv)}. The year has to cover what you live on and its tax: <b>{money(spendNeed)}</b>.</p>
          <p>The 4% rule is a rough guide drawn from history. Rather than trust it, the guide tests your own plan, year by year, through every market since
            {" "}{S.H.first}: that&apos;s the next card, and it&apos;s where &ldquo;what the plan needs&rdquo; comes from.</p>
        </Lesson>
      </Learn>
      <BackNote step="number" />
      <Means stale={(plan.stale || need.stale) && !!S}>
        <HeroReading className="mb-3 px-0 pt-1 pb-2 max-sm:px-0 max-sm:pt-1"
          hero={{ label: "On course at " + fmtNum(S.retire), id: "gdOutFv", value: money(S.fv), note: coast ? "What you have grows to" : "What " + money(S.monthly) + "/mo grows to" }}
          figures={[
            { label: "The plan needs", id: "gdOutNeed", value: want == null ? "—" : money(want), note: "To last in " + share + " historical retirements" },
            { label: "Covered", id: "gdOutCover", value: want ? times(S.fv / want) : want === 0 ? "All of it" : "—", note: want === 0 ? "Income alone covers it" : "What you're on course for, over what it needs" },
          ]} />
        <ul className="gd-read">
          <li>Growing at a {riskLabel(S.real)} mix&apos;s {rate(S.real)} a year after inflation{S.stop != null ? (coast ? ", with nothing new going in" : ", saving until " + fmtNum(S.stop)) : ""}.
            {" "}Taxes and premiums are counted: about <b>{money(S.taxYr)}</b> a year in income tax{S.hcYr > 0 ? <>, and <b>{money(S.hcYr)}</b> a year for health insurance for the {S.hcYears} years before Medicare</> : null}, on top of the {money(S.spend)} you live on.</li>
          {want != null && want > 0 && S.fv >= want * 1.2 ? <li>That&apos;s more than the plan needs: <b>Adjust your plan</b> shows what the extra could buy, from retiring sooner to spending more.</li>
            : want != null && want > S.fv ? <li>That&apos;s short of what the plan needs by about <b>{money(want - S.fv)}</b>. <b>Adjust your plan</b> shows the quickest ways to close it.</li> : null}
          {S.retire < S.ss.claim ? <li>Social Security starts at {S.ss.claim}, so for the first {S.ss.claim - Math.round(S.retire)} years of retirement your savings carry everything. The next card tests exactly that.</li> : null}
        </ul>
        <PlanChart id="outlook" series={[series(S, a.age!, "Your plan", "p")]} caption="Your retirement savings over time, in today's dollars" />
        <p className="gd-sources" data-sources="">
          <b>Built on</b> your answers{src.estimated.length ? <>, with estimates for {and(src.estimated)}</> : null}
          {src.defaults.length ? <>, and defaults for {and(src.defaults)}</> : null}. Each is marked where it&apos;s asked, and any of them can be changed.</p>
      </Means>
      <Task id="basic" head="See it in the Basic calculator" after={<After>Optional. Any change you make there can come back with you.</After>} />
    </>
  );
}

/* ---------- Card 11 · Tested against history ---------- */
export function LastingCard() {
  const { a } = useGuideView();
  const plan = usePlanJob<Sim>("sim", withGuess(a));
  const S = plan.res;
  if (S === undefined) return <><Q>Will it last?</Q><p className="gd-means-empty">Working it out…</p></>;
  if (!S) return <NeedsPlan title="Will it last?" />;
  const r = S.success, L = threeStarts(S), r0 = Math.round(S.retire);
  return (
    <>
      <Q>Will it last? Tested against history</Q>
      <Learn>
        <Lesson id="sequence" figure={L.length ? <Starts list={L} retire={r0} /> : null} caption="Your plan, the same in every way but the year it started.">
          <p>An average return hides the real risk: the order the returns arrive in. Retire into a bad decade and you sell low to live, so less is left to
            {" "}recover. The same average can end very differently: that&apos;s <Term k="sequence">sequence risk</Term>, and it&apos;s why the guide replays your
            {" "}plan through each real retirement since {S.H.first} rather than trusting one average.</p>
          <p>Each replay spends {money(S.spend)} a year after tax, rising with prices, pays that year&apos;s tax{S.hcYears ? " and health premiums before Medicare" : ""},
            {" "}starts Social Security at {S.ss.claim}{S.pension ? ", adds your pension" : ""}, and holds {S.mix}% in stocks.</p>
        </Lesson>
      </Learn>
      <BackNote step="lasting" />
      <Means stale={plan.stale && !!S}>
        <HeroReading className="mb-3 px-0 pt-1 pb-2 max-sm:px-0 max-sm:pt-1" tone={r >= 0.85 ? "gain" : "text"}
          hero={{ label: "Lasted", id: "gdLastRate", value: pctStr(r, 0),
            note: <span className="inline-flex items-center gap-1.5">{r >= 0.85 ? <CircleCheckIcon className="size-3.5 shrink-0 text-gain" aria-hidden="true" /> : null}{S.H.survived} of {S.H.total} starting years</span> }}
          figures={[
            { label: "Leanest finish", id: "gdLastWorst", value: S.H.worstEnd > 0 ? money(S.H.worstEnd) : "Ran out", note: "The worst start, at " + (r0 + S.years) },
            { label: "Typical balance left", id: "gdLastLeft", value: money(S.H.medianEnd), note: "The middle start, in today's dollars" },
          ]} />
        {S.H.failYears.length ? <p className="gd-fails">It ran short retiring in {yearsList(S.H.failYears)}.</p> : null}
        {r >= 0.95 ? <Callout cls="ok"><b>Very solid.</b> The plan lasted through {r >= 1 ? "every" : "nearly every"} market in history, which can mean room to spend more or retire sooner.</Callout>
          : r >= 0.85 ? <Callout cls="ok"><b>A solid plan.</b> The few failures came from the worst starting years, and small spending cuts during a bad stretch usually fix those.</Callout>
            : r >= 0.7 ? <Callout cls="warn"><b>Borderline.</b> It works in most markets but fails in enough of them to take seriously. A flexible withdrawal strategy, or the changes on the next card, would firm it up.</Callout>
              : <Callout cls="bad"><b>At risk.</b> This plan runs short in too many historical markets. The next card shows what closes the gap.</Callout>}
      </Means>
    </>
  );
}
