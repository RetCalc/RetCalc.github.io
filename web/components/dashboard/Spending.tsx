"use client";

/* Spending: what goes out each month, against what comes in after taxes,
   and the Budget tool itself below it, line by line. Setup's one number
   starts its "Everything else" line; from then on the budget's total is
   your spending everywhere. The emergency fund is sized here, on the
   budget or on the emergency budget beside it. */

import Link from "next/link";
import { useState } from "react";
import { ReceiptIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ToolInputs } from "@/components/tools/ToolState";
import type { BudgetInputs } from "@/tools/budget/model";
import { Frame } from "./Frame";
import { budgetFor, flow, fromBudget, taxFor, withCollegeLine } from "./flows";
import { collegeNeedOf } from "./college";
import { money } from "./format";
import { Hosted, TOOL_VIEWS, toolHref } from "./host";
import { otherMonth } from "./model";
import { useDashboard } from "./store";
import { Note, Tile, TipLabel } from "./ui";

export function Spending() {
  const { data, setProfile } = useDashboard();
  const pr = data.profile, F = flow(pr);
  // Bumped when the budget is changed from out here (the college line), so
  // the budget below opens again with it.
  const [rev, setRev] = useState(0);
  const coming = F.hasPay ? F.afterTax + otherMonth(pr) : null;
  // Saving for college through the budget leaves less to save otherwise;
  // premiums already taken out of pay aren't spent twice.
  const left = coming != null ? coming - F.spendPaid - F.college : null, premiums = F.spend - F.spendPaid;
  const need = collegeNeedOf(pr), short = need - F.college;
  const addCollege = () => { setProfile((p) => fromBudget(p, withCollegeLine(budgetFor(p), collegeNeedOf(p)))); setRev((r) => r + 1); };
  const Budget = TOOL_VIEWS.budget;
  return (
    <Frame current="spending" title="Spending" sub={F.spend ? `${money(F.spend)} per month` : "What goes out"}>
      <Tile id="month" icon={ReceiptIcon} title="Each month">
        <div className="dsh-stats">
          <div className="dsh-stat"><div className="dsh-label">Spending</div><div className="dsh-fig dsh-key">{money(F.spend)}<small>per month</small></div>{premiums > 0.5 ? <div className="dsh-cap dsh-mt6">{money(premiums)} of it is premiums, taken out of pay</div> : null}</div>
          <div className="dsh-stat"><div className="dsh-label">Spending per year</div><div className="dsh-fig dsh-md">{money(F.spend * 12)}</div></div>
          {coming != null ? <div className="dsh-stat"><div className="dsh-label">Pay after taxes</div><div className="dsh-fig dsh-md">{money(coming)}<small>per month</small></div></div> : null}
          {left != null ? <div className="dsh-stat"><div className="dsh-label">{left >= 0 ? <TipLabel text="Left after spending" id="leftAfter" /> : "Short"}</div><div className="dsh-fig dsh-md">{money(Math.abs(left))}<small>per month</small></div></div> : null}
          <div className="dsh-stat"><div className="dsh-label">Emergency fund, {F.efMonths} months</div><div className="dsh-fig dsh-md">{money(F.efTarget)}</div></div>
        </div>
        {need > 0 && short > 25 ? (
          <div className="dsh-mt dsh-tip">
            <span>{F.college > 0 ? <>Saving for college: <b>{money(F.college)}</b> of the <b>{money(need)}</b> per month your plan for it takes. Raise it, and college won&apos;t come out of your saving later.</>
              : <>You&apos;re planning to help with college: saving about <b>{money(need)}</b> per month starting now covers it. Add it to your budget, and it won&apos;t come out of your saving later.</>}
              {" "}<Button variant="link" size="inline" nativeButton={false} render={<Link href={toolHref("college", "/dashboard/spending")} />}>See how it&apos;s worked out</Button></span>
            <Button size="sm" onClick={addCollege}>{F.college > 0 ? "Raise it to " + money(need) : "Add it to my budget"}</Button>
          </div>
        ) : null}
        {left != null && left < 0 ? <div className="dsh-mt"><Note>You&apos;re spending more than comes in after taxes. Check the numbers, or look for room in the budget below.</Note></div> : null}
      </Tile>
      <div className="dsh-r4" id="budget">
        <Hosted key={rev} household={null}
          seed={(id) => (id === "budget" ? ({ ...budgetFor(pr), view: "budget" } as unknown as ToolInputs) : id === "tax" ? (taxFor(pr) as unknown as ToolInputs) : undefined)}
          keep={(id, d) => { if (id === "budget") setProfile((p) => fromBudget(p, d as unknown as BudgetInputs)); }}>
          <Budget />
        </Hosted>
      </div>
    </Frame>
  );
}
