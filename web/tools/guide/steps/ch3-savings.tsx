"use client";

/* Chapter 3 · Building your savings (doc 2, cards 6 and 7 and the deeper
   Where it sits): what's saved and what's added, which gives the first
   number; how it's invested, the assumption that number rests on; and how
   the savings are taxed, which changes the tax the plan pays rather than
   the number. Changes ahead joins this chapter in phase 4. */

import { useState } from "react";
import { RISKS } from "@/lib/engine/typed";
import { fmtNum, money, pctStr } from "@/lib/format";
import { NativeRange } from "@/components/ui/native-range";
import { SAVE_TO, coastNow, gross, ok, parts, pos, riskLabel, saveNow, withGuess, type Sim } from "../calc";
import { Buckets } from "../charts/Buckets";
import { Compound } from "../charts/Compound";
import { RangeBars } from "../charts/RangeBars";
import { buckets, byMix, compounding, dollarAt, growthParts, mixHistory } from "../figures";
import { Lesson, Term } from "../lessons/Lesson";
import { SourceBadge } from "../SourceBadge";
import { BackNote, Choice, H3, MoneyF, Q, SelF, useGuideView } from "../ui";
import { usePlanJob } from "../usePlan";
import { rounded } from "../words";
import { Learn, Means, Numbers } from "../zones";

/** 5.75%, 4.5%, 2%. */
const rate = (v: number) => (v * 100).toFixed(2).replace(/0$/, "").replace(/\.0$/, "") + "%";
/** −3.3%, 14.1%. */
const pc1 = (v: number) => (v < 0 ? "−" : "") + Math.abs(v * 100).toFixed(1) + "%";
const yrs = (n: number) => fmtNum(n) + (n === 1 ? " year" : " years");
const mixIndex = (real: number | null | undefined) => Math.max(0, RISKS.findIndex((r) => Math.abs(r.real - (real || 0.045)) < 1e-6));

/* ---------- Card 6 · What you have and add ---------- */
export function SavingsCard() {
  const { v, a, g } = useGuideView();
  const [mo, setMo] = useState(100);
  const valid = ok(a.age) && ok(a.retire) && a.retire > a.age;
  const age = valid ? a.age! : 40, retire = valid ? a.retire! : 65, real = a.risk || 0.045;
  const C = compounding(age, retire, real, mo), A = dollarAt(age, retire, real);
  const kept = C ? C.years - C.gap : 0;
  return (
    <>
      <Q>What have you saved, and what do you add each month?</Q>
      <Learn>
        <Lesson id="time" caption={C ? (valid ? "At your ages, with a " + riskLabel(real) + " mix, in today's dollars." : "An example: saving from 40 to 65, in today's dollars.") : null}
          figure={C ? <>
            <div className="gd-slide">
              <label htmlFor="gdCmpSlide">Saving <b>{money(mo)}</b> a month</label>
              <NativeRange id="gdCmpSlide" min={50} max={2000} step={50} value={mo} aria-valuetext={money(mo) + " a month"} onChange={(e) => setMo(+e.target.value)} />
            </div>
            <Compound C={C} />
          </> : null}>
          <p>Money saved early has the longest to grow, and its growth grows too: <Term k="compound">compound growth</Term>. At a {riskLabel(real)} mix&apos;s
            {" "}{rate(real)} a year after inflation, a dollar saved at {fmtNum(age)} is worth <b>${A.toFixed(2)}</b> by {fmtNum(retire)}.</p>
          {C ? <p>That&apos;s why the years matter more than the amount. {money(mo)} a month from now comes to <b>{money(C.curves[0].fv)}</b> by {fmtNum(retire)}.
            {" "}Stop after {yrs(kept)} and it&apos;s still {money(C.curves[1].fv)}; start {yrs(C.gap)} late and save for the same {yrs(kept)}, and it&apos;s {money(C.curves[2].fv)}.</p> : null}
          {a.match === "none" ? <p>Self-employed? A SEP IRA or a solo 401(k) lets you put in far more than an IRA alone, since you contribute as both the employer and the employee.</p> : null}
        </Lesson>
      </Learn>
      <BackNote step="savings" />
      <Numbers more={<>
        <H3>Does your employer match what you put in? {g.src.match?.kind === "default" ? <SourceBadge s={g.src.match} /> : null}</H3>
        <div className="gd-choices two">
          <Choice k="match" val="full" title="Yes, and I get all of it" /><Choice k="match" val="partial" title="Yes, but I'm not getting all of it" />
          <Choice k="match" val="none" title="No match, or I'm self-employed" /><Choice k="match" val="unsure" title="Not sure" />
        </div>
        <H3>Where does your monthly saving go?</H3>
        <div className="gd-choices two">{SAVE_TO.map(([k, t, s]) => <Choice key={k} k="saveTo" val={k} title={t} sub={s} />)}</div>
        <p className="hint mx-0 mt-0 mb-1">Your employer&apos;s share goes into a traditional account either way.</p>
      </>} moreOpen={v.match === "partial"}>
        <div className="gd-fields">
          <MoneyF k="saved" label="Saved for retirement so far" full
            hint="401(k), 403(b), IRAs, Roth accounts and investments set aside for retirement. Your account websites show the balances." />
          <MoneyF k="contrib" label="You contribute" per="/mo" hint={pos(v.bgSave) ? "Your budget shows " + money(v.bgSave) + "/mo going to savings." : "From your paycheck and on your own."} />
          <MoneyF k="employer" label="Your employer adds" per="/mo" hint="Matching or profit sharing. 0 if none." />
        </div>
      </Numbers>
      <Means><SavingsReadout /></Means>
    </>
  );
}
function SavingsReadout() {
  const { a, g } = useGuideView();
  // The plan the rail shows, for the savings rate's "a plan that already lasts".
  const plan = usePlanJob<Sim>("sim", withGuess(a));
  const P = growthParts(a);
  if (!P || !ok(a.contrib)) return <p className="gd-means-empty">What your savings grow to appears once your savings and monthly saving are in, even if they&apos;re 0.</p>;
  const inc = gross(a), r = inc > 0 ? (saveNow(a) * 12) / inc : null, coast = coastNow(a);
  const rp = plan.res !== undefined ? parts(a, plan.res).rate : null;
  const allTrad = !pos(a.rothNow) && !pos(a.brokNow);
  return (
    <ul className="gd-read">
      {coast ? <li>Your plan has you coasting from now, set on <b>Adjust your plan</b>: what&apos;s saved grows on its own.</li>
        : r != null ? <li>You&apos;re putting in <b>{money(P.monthly)} a month</b>, <b>{pctStr(r, 1)}</b> of gross income counting your employer&apos;s share.
          {r >= 0.15 ? " That meets the usual 15% target." : <> The usual target is 15%: about {money((inc * 0.15) / 12)} a month for you.</>}</li>
          : <li><b>{money(P.monthly)} a month</b> going in.</li>}
      <li>By {fmtNum(a.retire!)}, at the {riskLabel(P.real)} mix&apos;s {rate(P.real)} a year after inflation: today&apos;s <b>{money(a.saved!)}</b> grows to <b>{money(P.fromSaved)}</b>
        {coast ? "." : <>, and what you add comes to <b>{money(P.fromSaving)}</b>.</>} Together, <b>{rounded(P.total)}</b>: your number so far, in today&apos;s dollars.</li>
      {rp ? <li>Savings rate scores {Math.round(rp.p * 20)} of 20{rp.p >= 1 && r != null && r < 0.15 ? ": under 15%, but your plan already lasts" : ""}.</li> : null}
      {a.match === "partial" ? <li>You&apos;re missing part of your employer&apos;s match: getting all of it is the best return there is, and the first move on your plan.</li>
        : !a.match ? <li>Does your employer match? Answer under <b>More detail</b>; until then the plan treats it as not sure.</li> : null}
      {g.pace === "quick" && allTrad && pos(a.saved) ? <li>The Quick check counts it all as traditional, taxed when it comes out; <b>Where it sits</b>, on the route, splits it.</li> : null}
    </ul>
  );
}

/* ---------- Card 7 · How it's invested ---------- */
export function InvestedCard() {
  const { a } = useGuideView();
  const H = mixHistory(), i = mixIndex(a.risk), h = H[i];
  const P = growthParts(a);
  return (
    <>
      <Q>How are your savings invested?</Q>
      <Learn>
        <Lesson id="real-returns" figure={<RangeBars H={H} cur={i} />}
          caption={"Every ten years in a row from " + h.first + " to " + h.last + ", each mix rebalanced yearly, a year after inflation. The Portfolio Backtest's record."}>
          <p>Every figure in this guide is in today&apos;s dollars: growth after inflation, a <Term k="realreturn">real return</Term>.
            {P ? <> So {rounded(P.total)} at {fmtNum(a.retire!)} means what {rounded(P.total)} buys now, </> : " So a figure decades away means what it would buy now, "}
            and your saving is assumed to rise with prices, so it stays the same in real terms.</p>
          <p>Since {h.first}, a {h.label.toLowerCase()} mix earned about <b>{pc1(h.cagr)}</b> a year after inflation; the guide assumes <b>{rate(h.real)}</b>, a little less.
            {" "}The average hides the range: its ten-year stretches ran from <b>{pc1(h.worst)}</b> to <b>{pc1(h.best)}</b> a year. More stocks raise the average and widen the range.</p>
        </Lesson>
      </Learn>
      <BackNote step="invested" />
      <Numbers>
        <div className="gd-fields"><SelF k="risk" label="How is it invested?" opts={RISKS.map((r) => [r.real, r.label + " · " + r.sub])} num full redraw
          hint="Target-date funds are usually Balanced or Growth until the last decade before retirement; the fund's page shows its share in stocks." /></div>
      </Numbers>
      <Means><MixReadout /></Means>
    </>
  );
}
function MixReadout() {
  const { a } = useGuideView();
  const M = byMix(a), i = mixIndex(a.risk), h = mixHistory()[i];
  if (!M) return <p className="gd-means-empty">What each mix grows your savings to appears once your ages and savings are in.</p>;
  return (
    <>
      <table className="gd-mixes">
        <caption className="sr-only">What your savings grow to by {fmtNum(a.retire!)} with each mix</caption>
        <thead><tr><th scope="col">Mix</th><th scope="col">Assumes</th><th scope="col">At {fmtNum(a.retire!)}</th></tr></thead>
        <tbody>{RISKS.map((r, j) => (
          <tr key={r.label} className={j === i ? "on" : undefined}>
            <th scope="row">{r.label}{j === i ? <em>yours</em> : null}</th><td>{rate(r.real)}</td><td>{rounded(M[j])}</td>
          </tr>
        ))}</tbody>
      </table>
      <ul className="gd-read">
        <li>In history, a {h.label.toLowerCase()} mix&apos;s ten-year stretches ran from <b>{pc1(h.worst)}</b> to <b>{pc1(h.best)}</b> a year after inflation; the middle one, <b>{pc1(h.med)}</b>.</li>
        <li>This is the mix while you save. In retirement the plan holds 60% in stocks unless you change it on a trip into the Drawdown Simulator.</li>
      </ul>
    </>
  );
}

/* ---------- Deeper · Where it sits ---------- */
export function AccountsCard() {
  const { a } = useGuideView();
  const B = buckets(a);
  return (
    <>
      <Q>Where do your savings sit?</Q>
      <Learn>
        <Lesson id="buckets" figure={pos(a.saved) ? <Buckets B={B} /> : null} caption={pos(a.saved) ? "Your " + money(a.saved) + ", by how it's taxed." : null}>
          <p>Retirement money sits in three tax buckets. <Term k="bkttrad">Traditional</Term> accounts, a 401(k), 403(b) or IRA, took no tax going in, so every
            {" "}dollar is taxed as income coming out. <Term k="bktroth">Roth</Term> accounts were taxed going in and are never taxed again. A brokerage account is
            {" "}taxed only on its gains, the growth above its <Term k="basis">cost basis</Term>.</p>
          <p>The split doesn&apos;t change what you&apos;re on course for. It changes the tax: Roth and brokerage dollars let the plan keep taxable income low in
            {" "}retirement, which can lower the tax on Social Security and raise a healthcare subsidy before 65.</p>
        </Lesson>
      </Learn>
      <BackNote step="accounts" />
      <Numbers>
        <div className="gd-fields">
          <MoneyF k="rothNow" label="Of that, in Roth accounts" ph="0" hint="Roth 401(k) and Roth IRA." err={overErr(a)} />
          <MoneyF k="brokNow" label="In a taxable brokerage account" ph="0" hint="Only money meant for retirement." />
        </div>
        <H3>Where does your monthly saving go?</H3>
        <div className="gd-choices two">{SAVE_TO.map(([k, t, s]) => <Choice key={k} k="saveTo" val={k} title={t} sub={s} />)}</div>
        <p className="hint mx-0 mt-0 mb-1">Your employer&apos;s share goes into a traditional account either way.</p>
      </Numbers>
      <AccountsMeans />
    </>
  );
}
const overErr = (a: ReturnType<typeof useGuideView>["a"]) =>
  pos(a.saved) && (pos(a.rothNow) ? a.rothNow : 0) + (pos(a.brokNow) ? a.brokNow : 0) > a.saved + 0.5
    ? "Roth and brokerage add up to more than the " + money(a.saved) + " you have saved. Count each dollar once." : null;
function AccountsMeans() {
  const { a } = useGuideView();
  const plan = usePlanJob<Sim>("sim", withGuess(a));
  const S = plan.res, B = buckets(a);
  return (
    <Means stale={plan.stale && !!S}>
      {!pos(a.saved) ? <p className="gd-means-empty">The split appears once your savings are in, on What you have and add.</p> : (
        <ul className="gd-read">
          <li><b>{money(B[0].v)}</b> traditional, taxed when it comes out; <b>{money(B[1].v)}</b> Roth, tax-free; <b>{money(B[2].v)}</b> in a brokerage account, taxed only on its gains.</li>
          {S ? <li>By {fmtNum(S.retire)} that&apos;s about {rounded(S.P.trad)} traditional, {rounded(S.P.roth)} Roth and {rounded(S.P.brok)} brokerage. Unless the Plan Optimizer finds better, the plan
            {" "}draws the brokerage account first in retirement, then traditional, then Roth, and pays about <b>{money(S.taxYr)}</b> in income tax in a typical year.</li> : null}
        </ul>
      )}
    </Means>
  );
}
