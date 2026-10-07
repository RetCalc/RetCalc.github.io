"use client";

/* Already retired (doc 2, "Alternate paths": the on-ramp). The guide is
   built for the saving years; a retirement under way is the Drawdown
   Simulator's. One card asks what it needs, balances by account type,
   yearly spending, and Social Security or a pension already paid, then
   opens the simulator with them, the way a trip does. No plan is run and
   there's no score; the answers stay, so coming back is easy. */

import { fmtNum, money, pctStr } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { STATE_OPTIONS } from "@/lib/states";
import { accts, mar, ok, pos } from "../calc";
import { BackNote, Callout, Lead, MoneyF, NumF, Q, SelF, Task, useGuideView } from "../ui";
import { Means, Numbers } from "../zones";

export function RetiredCard() {
  const G = useGuideView(), { v, a } = G, m = mar(v);
  const A = accts(a), income = (pos(a.ssOwn) ? a.ssOwn * 12 : 0) + (m && pos(a.ssOwn2) ? a.ssOwn2 * 12 : 0) + (pos(a.pension) ? a.pension * 12 : 0);
  const draw = pos(a.retSpend) ? Math.max(0, a.retSpend - income) : null;
  return (
    <>
      <Q>Already retired? Start from what you have</Q>
      <Lead>This guide is built for the saving years. For a retirement under way, the <b>Drawdown Simulator</b> is the tool: it replays your savings and
        {" "}spending through every market since 1926. Enter what you have, and it opens with your numbers.</Lead>
      <BackNote step="retired" />
      <Numbers more={<div className="gd-fields">
        <MoneyF k="pension" label="A pension or annuity" per="/mo" ph="optional" />
        <SelF k="pensionCola" label="Does it rise with inflation?" opts={[["no", "No, it's a fixed amount"], ["yes", "Yes, it has cost-of-living raises"]]} />
        <SelF k="state" label="State" opts={[["", "Choose your state"], ...STATE_OPTIONS.map((o) => [o.code, o.name] as [string, string])]} full />
      </div>} moreLabel="A pension, and your state">
        <div className="gd-fields">
          <SelF k="status" label="Household" opts={[["s", "Just me"], ["m", "Me and a spouse or partner"]]} redraw full />
          <NumF k="age" label="Your age" affix="age" />
          {m ? <NumF k="spouseAge" label="Spouse's age" affix="age" /> : null}
          <MoneyF k="saved" label="Your savings, in all" full hint="Every retirement account and investment you'll live on." />
          <MoneyF k="rothNow" label="Of that, in Roth accounts" ph="0" />
          <MoneyF k="brokNow" label="In taxable brokerage accounts" ph="0" />
          <MoneyF k="retSpend" label="What you spend a year" per="/yr" full hint="Include income tax: the simulator doesn't work it out." />
          <MoneyF k="ssOwn" label="Social Security you get now" per="/mo" ph="not yet" hint="Leave blank if you haven't claimed." />
          {m ? <MoneyF k="ssOwn2" label="Your spouse's" per="/mo" ph="not yet" /> : null}
        </div>
      </Numbers>
      <Means>
        {!pos(a.saved) || draw == null ? <p className="gd-means-empty">What you&apos;d draw from savings appears once your savings and spending are in.</p> : (
          <ul className="gd-read">
            <li><b>{money(A.trad)}</b> traditional, <b>{money(A.roth)}</b> Roth and <b>{money(A.brok)}</b> in brokerage accounts.</li>
            <li>You&apos;d draw about <b>{money(draw)}</b> a year from savings{income ? <> after {money(income)} of Social Security and pensions</> : null}: <b>{pctStr(draw / a.saved, 1)}</b> of what you have.
              {" "}The simulator tests whether that lasted{ok(a.age) ? " to " + fmtNum(Math.max(95, a.age! + 20)) : ""} in every retirement since 1926.</li>
          </ul>
        )}
      </Means>
      <Task id="retired" head="Open the Drawdown Simulator with these numbers" />
      <Callout>No score here: it measures the saving years. Your answers stay in this browser, so you can come back.</Callout>
    </>
  );
}

export function RetiredFoot() {
  const G = useGuideView();
  return (
    <>
      <Button variant="outline" size="lg" data-gd="not-retired" onClick={() => { G.set("retired", null, true); G.go("about"); }}>I&apos;m not retired yet</Button>
      <span className="sp"></span>
    </>
  );
}
