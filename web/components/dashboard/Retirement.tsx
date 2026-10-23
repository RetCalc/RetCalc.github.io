"use client";

/* Retirement: where the plan stands at retirement, Social Security (the
   estimate, or each person's statement, and when to claim), and how the
   money comes out (the withdrawal strategies, each run through every past
   market). */

import Link from "next/link";
import { useMemo } from "react";
import { ArrowDownToLineIcon, IdCardIcon, SunsetIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MoneyField, SelectField } from "@/components/fields/Field";
import { Frame } from "./Frame";
import { num, txt } from "./fields";
import { money, money10, shortMoney } from "./format";
import { allStrategies, couple, nameOf, results, spendMonth, yearAt } from "./model";
import { useDashboard } from "./store";
import { Note, Tile } from "./ui";

export function Retirement() {
  const { data, setProfile: set } = useDashboard();
  const pr = data.profile, two = couple(pr);
  const R = useMemo(() => results(pr, data.entries), [pr, data.entries]);
  const opts = useMemo(() => allStrategies(pr, data.entries), [pr, data.entries]);
  const tax = R.abroad ? ", before taxes" : "";
  const ss = (v: Partial<typeof pr.ss>) => set((p) => ({ ...p, ss: { ...p.ss, ...v } }));
  const people = two ? ([0, 1] as const) : ([0] as const);

  return (
    <Frame current="retirement" title="Retirement" sub={R.retireYear ? `Starting ${R.retireYear}` : "Needs your ages and retirement age"}>
      <Tile icon={SunsetIcon} title="At retirement" right={<Button variant="link" size="inline" nativeButton={false} render={<Link href="/dashboard/profile" />}>Ages, spending and assumptions</Button>}>
        <div className="dsh-stats">
          <div className="dsh-stat"><div className="dsh-label">Savings, {R.retireYear ?? "—"}</div><div className="dsh-fig dsh-key">{R.atRetire != null ? shortMoney(R.atRetire) : "—"}</div></div>
          <div className="dsh-stat"><div className="dsh-label">Chance of success</div><div className="dsh-fig">{R.success != null ? Math.round(R.success * 100) + "%" : "—"}</div></div>
          <div className="dsh-stat"><div className="dsh-label">From savings{tax}</div><div className="dsh-fig">{R.savingsIncome != null ? money10(R.savingsIncome) : "—"}<small>per month</small></div></div>
          {!R.abroad ? <div className="dsh-stat"><div className="dsh-label">Social Security</div><div className="dsh-fig">{R.ss != null ? money10(R.ss) : "—"}<small>per month</small></div></div> : null}
          <div className="dsh-stat"><div className="dsh-label">You plan to spend</div><div className="dsh-fig">{money(pr.retSpend ?? spendMonth(pr) ?? 0)}<small>per month</small></div></div>
        </div>
        <div className="dsh-cap dsh-mt">In today&apos;s dollars{tax}. From savings is 4% of what you&apos;ll have; the plan itself spends what you plan to spend and tests it against history.</div>
      </Tile>

      {R.abroad ? (
        <div className="dsh-r4"><Note>Outside the US, Social Security isn&apos;t counted, and the plan&apos;s figures for retirement are before taxes.</Note></div>
      ) : (
        <div className="dsh-r4"><Tile icon={IdCardIcon} title="Social Security" right={pr.ss.checked ? <span className="dsh-badge dsh-gain">Checked</span> : <span className="dsh-badge">Estimated</span>}>
          <p className="dsh-cap dsh-mt6">We estimate each benefit from today&apos;s pay. For your real figure, sign in at ssa.gov and enter the monthly benefit your statement shows at full retirement age (67).</p>
          <div className="dsh-fields dsh-fields-sm">
            {people.map((i) => (
              <div className="dsh-perrow" key={i}>
                <MoneyField id={"dshSs" + i} label={`${nameOf(pr, i)}: benefit at 67 on your statement`} unit="per month" placeholder="Estimated"
                  value={txt(i ? pr.ss.own2 : pr.ss.own1)} onValueChange={(v) => ss(i ? { own2: num(v) } : { own1: num(v) })} />
                <div><div className="dsh-label">Claimed at {i ? R.claim2 ?? "—" : R.claim1 ?? "—"}{(i ? pr.p2 : pr.p1).by ? `, in ${yearAt(i ? pr.p2 : pr.p1, (i ? R.claim2 : R.claim1) ?? 67)}` : ""}</div>
                  <div className="dsh-fig dsh-md">{(i ? R.ss2 : R.ss1) != null ? money10((i ? R.ss2 : R.ss1)!) : "—"}<small>per month</small></div></div>
                <div />
              </div>
            ))}
            <div className="dsh-perrow">
              <SelectField id="dshClaim" label="When to claim" value={String(pr.ss.claim ?? "")} onChange={(v) => ss({ claim: v ? Number(v) : null })}>
                <option value="">At 67, or when you retire if later</option>
                {[62, 63, 64, 65, 66, 67, 68, 69, 70].map((a) => <option key={a} value={a}>At {a}{a === 70 ? " (the most per month)" : a === 62 ? " (the earliest)" : ""}</option>)}
              </SelectField>
              <div className="dsh-self-end"><Button variant={pr.ss.checked ? "outline" : "default"} onClick={() => ss({ checked: true })}>{pr.ss.checked ? "Saved" : "These look right"}</Button></div>
              <div className="dsh-self-end"><Button variant="link" size="inline" nativeButton={false} render={<Link href="/social-security" />}>Best ages to claim, in the Social Security Calculator</Button></div>
            </div>
          </div>
        </Tile></div>
      )}

      <div className="dsh-r4"><Tile icon={ArrowDownToLineIcon} title="Withdrawal strategy" right={<span className="dsh-cap">Each one tested on your plan in every market since 1926</span>}>
        {opts.length ? (
          <div className="dsh-opts">
            {opts.map((o) => {
              const on = pr.strategy === o.st.id;
              return (
                <div className="dsh-opt" key={o.st.id} data-on={on ? "" : undefined}>
                  <div><b>{o.st.name}</b><p>{o.st.d}</p></div>
                  <div className="dsh-cell">{Math.round(o.success * 100)}%<small>{o.canFail ? "lasted" : "can't run out"}</small></div>
                  <div className="dsh-cell">{money10(o.typical / 12)}<small>typical per month{tax}</small></div>
                  <div className="dsh-cell">{money10(o.lean / 12)}<small>leanest month{o.leanAge ? `, age ${o.leanAge}` : ""}</small></div>
                  <Button variant={on ? "default" : "outline"} size="sm" onClick={() => set((p) => ({ ...p, strategy: on ? null : o.st.id }))}>{on ? "Chosen" : "Choose"}</Button>
                </div>
              );
            })}
          </div>
        ) : <p className="dsh-cap dsh-mt">The strategies appear once your plan has your ages, savings, retirement age and spending.</p>}
        <div className="dsh-foot"><Button variant="link" size="inline" nativeButton={false} render={<Link href="/drawdown" />}>Compare all 15 strategies in the Drawdown Simulator</Button></div>
      </Tile></div>
    </Frame>
  );
}
