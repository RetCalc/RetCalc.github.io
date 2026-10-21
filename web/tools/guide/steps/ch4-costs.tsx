"use client";

/* Chapter 4 · What retirement costs (doc 2, cards 8 and 9): the yearly
   spending the plan has to pay, where the placeholder becomes a real
   answer; and Social Security, the largest single line in most plans,
   with a pension or other steady income under More detail. */

import { fmtNum, money, pctStr } from "@/lib/format";
import { guessing, mar, ok, pias, pos, spendGuess, ssFor, withGuess, type Sim } from "../calc";
import { Ladder } from "../charts/Ladder";
import { LADDER_AGES, ladder } from "../figures";
import { Lesson, Term } from "../lessons/Lesson";
import { SourceBadge } from "../SourceBadge";
import { BackNote, MoneyF, NumF, Q, SelF, fill, useGuideView } from "../ui";
import { usePlanJob } from "../usePlan";
import { rounded } from "../words";
import { Learn, Means, Numbers } from "../zones";
import { Button } from "@/components/ui/button";
import { CircleAlertIcon } from "lucide-react";

const yrs = (n: number) => fmtNum(n) + (n === 1 ? " year" : " years");

/* ---------- Card 8 · Spending in retirement ---------- */
export function RetSpendCard() {
  const G = useGuideView(), { v } = G, picks: [string, number][] = [];
  if (pos(v.spend)) {
    picks.push(["Same as today", v.spend * 12]);
    picks.push(["80% of today", v.spend * 12 * 0.8]);
    // Only the loan itself goes away; property tax and insurance don't.
    const loan = pos(v.mortPI) ? v.mortPI : pos(v.bgMort) ? v.bgMort : 0;
    if (v.home === "mortgage" && v.mortPaid === "yes" && loan > 0 && v.spend > loan) picks.push(["Today, less the loan payment", (v.spend - loan) * 12]);
  }
  return (
    <>
      <Q>What will you spend in retirement?</Q>
      <Learn>
        <Lesson id="eighty">
          <p>Most people spend less once they stop work: no commute, no saving for retirement, no payroll tax, often no mortgage. That&apos;s where the
            {" "}common rule of 80% of today&apos;s spending comes from, a <Term k="replacement">replacement rate</Term>. Travel, hobbies and health can push it
            {" "}back up, so it&apos;s a starting point, not an answer.</p>
          <p>Enter what you&apos;ll live on <b>after</b> income tax, at today&apos;s prices. The plan works out each year&apos;s tax itself, from where the money
            {" "}comes from, so adding it here would count it twice. Leave out health insurance before 65 too: the plan prices that as well.</p>
        </Lesson>
      </Learn>
      <BackNote step="retspend" />
      <Numbers>
        {picks.length ? <div className="gd-picks">{picks.map(([lab, val]) => {
          const r = Math.round(val / 100) * 100;
          return <Button key={lab} variant="outline" size="sm" data-fill="retSpend" data-v={r} onClick={() => fill(G, "retSpend", r)}>{lab}: <b className="font-semibold tabular-nums">{money(r) + "/yr"}</b></Button>;
        })}</div> : null}
        <div className="gd-fields"><MoneyF k="retSpend" label="Yearly spending in retirement" per="/yr" full hint="In today's dollars, after tax." /></div>
        <LowSpendCheck />
      </Numbers>
      <NeedMeans />
    </>
  );
}
/** A retirement budget far below today's spending is allowed, but it's
    often a monthly figure typed into the yearly field: say so, and offer
    the yearly amount when twelve times it looks like today's spending. */
function LowSpendCheck() {
  const G = useGuideView(), { a, v } = G;
  if (!pos(a.retSpend) || !pos(v.spend)) return null;
  const today = v.spend * 12, share = a.retSpend! / today;
  if (share >= 0.4) return null;
  const yearly = Math.round(a.retSpend! * 12 / 100) * 100, monthly = yearly >= today * 0.4 && yearly <= today * 1.5;
  return (
    <div className="mt-0 mb-2 flex items-start gap-2 text-note"><CircleAlertIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
      <div role="status">That&apos;s only <b>{pctStr(share, 0)}</b> of what you spend today ({money(today)} per year).
        {monthly ? <> If {money(a.retSpend!)} is what you&apos;ll spend each month, that&apos;s {money(yearly)} per year.
          {" "}<Button variant="outline" size="sm" className="mt-1.5" onClick={() => fill(G, "retSpend", yearly)}>Use {money(yearly)} per year</Button></>
          : " Check that it's the yearly amount, after tax."}</div>
    </div>
  );
}

function NeedMeans() {
  const { a } = useGuideView();
  const own = pos(a.retSpend), guess = spendGuess(a);
  const plan = usePlanJob<Sim>("sim", own ? a : null), need = usePlanJob<number>("need", own ? a : null);
  // What the plan needed with the placeholder, to say what entering it changed.
  const was = usePlanJob<number>("need", own && guess > 0 && Math.round(a.retSpend!) !== guess ? withGuess({ ...a, retSpend: null }) : null, { prio: 2 });
  const S = plan.res, N = need.res;
  return (
    <Means stale={(plan.stale || need.stale) && !!S}>
      {!own ? <p className="gd-means-empty">{guess > 0 ? <>Until you enter it, the plan uses <b>{money(guess)}</b> per year, 80% of your take-home. <SourceBadge kind="default" /></>
        : "What the plan needs appears once it's in."}</p>
        : !S ? <p className="gd-means-empty">{plan.stale ? "Working it out…" : "What the plan needs appears once your ages, savings and monthly saving are in."}</p> : (
          <ul className="gd-read">
            {N != null ? <li>To last in {S.I.target >= 1 ? "every" : Math.round(S.I.target * 100) + "% of"} historical retirements, spending <b>{money(S.spend)}</b> per year,
              {" "}the plan needs about <b>{rounded(N)}</b> at {fmtNum(S.retire)}{was.res != null && was.res !== N
                ? <>: entering it {N < was.res ? "cut" : "raised"} that from {rounded(was.res)}, with the starting estimate of {money(guess)} per year</> : null}.</li> : null}
            {pos(a.spend) ? <li>That&apos;s <b>{pctStr(S.spend / (a.spend * 12), 0)}</b> of what you spend today.</li> : null}
            <li>Income tax comes on top, worked out by the plan: about <b>{money(S.taxYr)}</b> in a typical year
              {S.hcYr > 0 ? <>, and about <b>{money(S.hcYr)}</b> per year for health insurance for the {yrs(S.hcYears)} before Medicare</> : null}.</li>
            <li>That counts Social Security {S.ss.own ? "from your statement" : "as estimated from your income"}; the next card checks it.</li>
          </ul>
        )}
    </Means>
  );
}

/* ---------- Card 9 · Social Security ---------- */
export function SocialCard() {
  const { v, a } = useGuideView(), m = mar(v);
  const retire = ok(a.retire) ? a.retire : 67, P = pias(a, retire), ss = ssFor(a, retire);
  const ages = (c: number) => [...new Set([...LADDER_AGES, c])].sort((x, y) => x - y);
  const groups = [{ who: "You", rows: ladder(P.pia1, ages(ss.claim)), claim: ss.claim }];
  if (m && P.pia2 > 0) groups.push({ who: "Your spouse", rows: ladder(P.pia2, ages(ss.claim2)), claim: ss.claim2 });
  return (
    <>
      <Q>What will Social Security pay, and when?</Q>
      <Learn>
        <Lesson id="wait" figure={P.pia1 > 0 ? <Ladder groups={groups} /> : null}
          caption={P.pia1 > 0 ? "A month, in today's dollars, " + (P.own ? "from your statement" : "estimated from your income") + ", claimed at each age." : null}>
          <p>Your benefit is set by your highest 35 years of earnings. What it pays at full retirement age, 67, is your <Term k="pia">PIA</Term>. Claim at 62 and
            {" "}it&apos;s cut by 30%, for life; every year you wait past 67 adds 8%, up to 124% at 70. Whenever it starts, it rises with inflation after.</p>
          <p>{m ? <>For a couple, the survivor keeps the larger of the two benefits, so the higher earner waiting protects you both. A spouse with a small record
            {" "}gets a top-up, the <Term k="spousal">spousal benefit</Term>, of up to half the other&apos;s PIA.</>
            : "Waiting means living on more of your savings first, for a larger check for the rest of your life."}</p>
        </Lesson>
      </Learn>
      <BackNote step="social" />
      <Numbers moreLabel="A pension, or other steady income?" moreOpen={pos(v.pension)} more={<>
        <div className="gd-fields">
          <MoneyF k="pension" label="Pension, annuity or part-time pay" per="/mo" ph="optional" hint="In today's dollars. Leave blank if none." />
          <NumF k="pensionAge" label="Starting at" affix="yrs old" hint="Blank means when you retire." />
          <SelF k="pensionCola" label="Does it rise with inflation?" opts={[["no", "No, it's a fixed amount"], ["yes", "Yes, it has cost-of-living raises"]]} full />
        </div>
      </>}>
        <div className="gd-fields">
          <MoneyF k="ssOwn" label={m ? "Your benefit at 67, from your statement" : "Your monthly benefit at 67, from your statement"} per="/mo" full={!m} ph="optional"
            hint="From ssa.gov/myaccount. It uses your real earnings record, so it beats our estimate." />
          {m ? <MoneyF k="ssOwn2" label="Your spouse's benefit at 67" per="/mo" ph="optional" hint="From their own statement." /> : null}
          <SelF k="ssClaim" label={m ? "When would you each claim it?" : "When would you claim it?"} num full
            opts={[["", "At 67, or when I retire if that's later"], ...[62, 63, 64, 65, 66, 67, 68, 69, 70].map((x) =>
              [x, "At " + x + (x === 62 ? ", the earliest" : x === 67 ? ", full retirement age" : x === 70 ? ", the most it pays" : "")] as [number, string])]}
            hint={"In this plan it never starts before you retire. The Retirement Plan Optimizer, near the end, tries every age for " + (m ? "each of you." : "you.")} />
        </div>
      </Numbers>
      <SocialMeans />
    </>
  );
}
function SocialMeans() {
  const { a } = useGuideView();
  const plan = usePlanJob<Sim>("sim", withGuess(a));
  const S = plan.res;
  if (!ok(a.retire)) return <Means><p className="gd-means-empty">What it pays appears once your retirement age is in.</p></Means>;
  const ss = S ? S.ss : ssFor(a, a.retire), both = mar(a) && ss.a2 > 0, est = !ss.own || (both && !ss.own2);
  const pen = S ? S.pension : pos(a.pension) ? a.pension * 12 : 0;
  const needYr = S ? S.spend + S.taxYr : null, early = Math.max(0, ss.claim - Math.round(a.retire));
  const from = ok(a.pensionAge) ? a.pensionAge : a.retire;
  return (
    <Means stale={plan.stale && !!S}>
      <ul className="gd-read">
        <li><b>{money(ss.total / 12)} per month</b> from {ss.claim}{both && ss.claim2 !== ss.claim ? " (" + ss.claim2 + " for your spouse)" : ""}, <b>{money(ss.total)}</b> per year
          {both ? " for the two of you" : ""}{ss.spousal ? ", with the spousal top-up" : ""}. <SourceBadge kind={est ? "estimated" : "entered"} /></li>
        {needYr != null ? <li>That&apos;s <b>{pctStr(Math.min(9.99, (ss.total + pen) / needYr), 0)}</b> of the <b>{money(needYr)}</b> per year your plan needs including tax
          {pen ? ", counting your pension" : ""}.{early ? " Savings carry the " + yrs(early) + " before it starts." : ""}{guessing(a) ? " Spending is still the starting estimate." : ""}</li> : null}
        {pos(a.pension) ? <li>Your pension: <b>{money(a.pension * 12)}</b> per year from {ok(from) ? fmtNum(from) : "retirement"}{a.pensionCola === "yes" ? ", rising with inflation." : ", a fixed amount, so it buys a little less each year."}</li> : null}
        {ss.tactics ? <li>These are the Retirement Plan Optimizer&apos;s claiming ages, which your plan now uses.</li> : null}
        {!ss.own && ss.career < 35 ? <li>It averages your best 35 years, so retiring after {ss.career} years of work counts the rest as zeros.</li> : null}
        {est ? <li>An estimate from your income. Your statement at ssa.gov/myaccount uses your real record; the trust fund is also projected to run short in the 2030s,
          {" "}so a cautious plan can enter a lower figure.</li> : null}
      </ul>
    </Means>
  );
}
