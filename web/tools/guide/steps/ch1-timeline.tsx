"use client";

/* Chapter 1 · You and your timeline (doc 2, card 1, About you): the two
   numbers everything else hangs on, and why those ages matter. */

import { fmtNum } from "@/lib/format";
import { STATE_OPTIONS } from "@/lib/states";
import { mar, ok, yearsFor } from "../calc";
import { Timeline } from "../charts/Timeline";
import { Lesson, Term } from "../lessons/Lesson";
import { NumF, Q, SelF, useGuideView } from "../ui";
import { Learn, Means, Numbers } from "../zones";
import { Button } from "@/components/ui/button";

const yrs = (n: number) => fmtNum(n) + (n === 1 ? " year" : " years");

export function AboutYou() {
  const G = useGuideView(), { v, a } = G;
  const valid = ok(a.age) && ok(a.retire) && a.retire > a.age;
  const end = valid ? a.retire! + yearsFor(a, a.retire!) : 95;
  return (
    <>
      <Q>First, your timeline</Q>
      <Learn>
        <Lesson id="two-clocks" figure={<Timeline age={valid ? a.age! : 40} retire={valid ? a.retire! : 65} end={end} />}
          caption={valid ? "Your two clocks, from your answers." : "An example: saving from 40 to 65. Yours appears as you answer."}>
          <p>Retirement runs on two clocks. The first counts the years you have to save, from now until you stop work. The second counts the years your savings
            {" "}must pay for, from then until about 95. Working a year longer moves both: one more year of saving, one fewer to fund. That&apos;s why the
            {" "}retirement age is the strongest lever you have.</p>
          <p>A few ages are set by law: 59½ opens retirement accounts without a penalty, 62 is the earliest Social Security, 65 brings Medicare,
            {" "}67 is <Term k="fra">full retirement age</Term>, and 75 starts required withdrawals.</p>
        </Lesson>
      </Learn>
      <Numbers more={<div className="gd-fields">
        <SelF k="state" label="State" opts={[["", "Choose your state"], ...STATE_OPTIONS.map((o) => [o.code, o.name] as [string, string])]} full
          hint="For state income tax and healthcare costs." /></div>}>
        <div className="gd-fields">
          <SelF k="status" label="Household" opts={[["s", "Just me"], ["m", "Me and a spouse or partner"]]} redraw full />
          <NumF k="age" label="Your age" affix="age" />
          {mar(v) ? <NumF k="spouseAge" label="Spouse's age" affix="age" /> : null}
          <NumF k="retire" label="Age you'd like to retire" affix="age" hint="A guess is fine. You can try other ages later."
            err={ok(a.age) && ok(a.retire) && a.retire <= a.age ? <>Your retirement age needs to be later than your age today. This guide is built for the saving years; if you&apos;ve
              {" "}already retired, <Button variant="quiet" size="inline" data-gd="retired" onClick={() => { G.set("retired", true, true); G.go("retired"); }}>start from what you have</Button>
              {" "}and the guide opens the <b>Drawdown Simulator</b> with it.</> : null} />
        </div>
      </Numbers>
      <Means>
        {valid ? <TimelineReadout /> : <p className="gd-means-empty">Your timeline appears once your age and a retirement age after it are in.</p>}
      </Means>
    </>
  );
}

function TimelineReadout() {
  const { a } = useGuideView();
  const age = a.age!, retire = a.retire!, fund = yearsFor(a, retire), save = retire - age;
  const spouseYounger = mar(a) && ok(a.spouseAge) && a.spouseAge < age;
  const toMedicare = 65 - retire, before59 = 59.5 - retire;
  // The spouse's own years before Medicare, at your retirement.
  const spouseToMedicare = mar(a) && ok(a.spouseAge) ? 65 - (a.spouseAge + save) : null;
  return (
    <ul className="gd-read">
      <li><b>{yrs(save)}</b> to save, then about <b>{yrs(fund)}</b> to fund{spouseYounger && retire + fund > 95 ? ", to your spouse's 95, since they're younger" : ", to 95"}.</li>
      {toMedicare > 0 ? <li>Medicare starts at 65: <b>{yrs(toMedicare)}</b> after you retire{spouseToMedicare != null && spouseToMedicare !== toMedicare
        ? ", " + (spouseToMedicare > 0 ? fmtNum(spouseToMedicare) : "none") + " for your spouse" : ""}. Until then you&apos;d buy your own coverage; the plan prices it for you.</li>
        : spouseToMedicare != null && spouseToMedicare > 0 ? <li>You&apos;d have Medicare from the day you retire; your spouse would wait <b>{yrs(spouseToMedicare)}</b>, buying their own coverage until then. The plan prices it for you.</li>
        : <li>You&apos;d retire at or after 65, so Medicare covers you from the start.</li>}
      {before59 > 0 ? <li>That&apos;s {yrs(before59)} before 59½, when retirement accounts open without a penalty. <b>Getting to 59½</b> joins your route to plan the years between.</li> : null}
      <li>Social Security can start at 62{retire <= 62 ? "" : ", or whenever you choose after"}; the full benefit comes at 67, and waiting to 70 pays the most.</li>
      {!a.state ? <li>Taxes follow Illinois&apos;s rules until you choose your state, under More detail.</li> : null}
    </ul>
  );
}
