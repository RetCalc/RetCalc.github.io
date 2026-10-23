"use client";

/* Spending: what goes out each month, against what comes in after taxes.
   One number up top; "More detail" opens the Budget tool itself below it,
   its reading on top, and from then on the budget's total is your spending
   everywhere. The emergency fund is sized here, on the budget or on the
   emergency budget built beside it. */

import { useState } from "react";
import { ChevronDownIcon, ChevronUpIcon, ReceiptIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MoneyField } from "@/components/fields/Field";
import type { ToolInputs } from "@/components/tools/ToolState";
import type { BudgetInputs } from "@/tools/budget/model";
import { Frame } from "./Frame";
import { num, txt } from "./fields";
import { ALL_TOGETHER, budgetFor, detailed, flow, fromBudget, setAllTogether, taxFor } from "./flows";
import { money, money10 } from "./format";
import { Hosted, TOOL_VIEWS } from "./host";
import { otherMonth, outsideUS } from "./model";
import { useDashboard } from "./store";
import { Note, Tile } from "./ui";

export function Spending() {
  const { data, setProfile } = useDashboard();
  const pr = data.profile, F = flow(pr), abroad = outsideUS(pr);
  const [open, setOpen] = useState(() => detailed(F.b));
  // Bumped when the one number changes the budget from out here, so the
  // budget below opens again with it.
  const [rev, setRev] = useState(0);
  const coming = abroad ? null : F.hasPay ? F.afterTax + otherMonth(pr) : null;
  const left = coming != null ? coming - F.spend : null;
  const many = detailed(F.b);
  const setTotal = (v: number | null) => {
    setProfile((p) => fromBudget(p, setAllTogether(budgetFor(p), v ?? 0)));
    setRev((r) => r + 1);
  };
  const Budget = TOOL_VIEWS.budget;
  return (
    <Frame current="spending" title="Spending" sub={F.spend ? `${money(F.spend)} per month` : "What goes out"}>
      <Tile icon={ReceiptIcon} title="Each month">
        <div className="dsh-stats">
          <div className="dsh-stat"><div className="dsh-label">Spending</div><div className="dsh-fig dsh-key">{money(F.spend)}<small>per month</small></div></div>
          {coming != null ? <div className="dsh-stat"><div className="dsh-label">Coming in, after taxes</div><div className="dsh-fig dsh-md">{money10(coming)}<small>per month</small></div></div> : null}
          {left != null ? <div className="dsh-stat"><div className="dsh-label">{left >= 0 ? "Left over to save" : "Short"}</div><div className="dsh-fig dsh-md">{money10(Math.abs(left))}<small>per month</small></div></div> : null}
          <div className="dsh-stat"><div className="dsh-label">Emergency fund, {F.efMonths} months</div><div className="dsh-fig dsh-md">{money(F.efTarget)}</div></div>
        </div>
        {left != null && left < 0 ? <div className="dsh-mt"><Note>You&apos;re spending more than comes in after taxes. Check the numbers, or look for room in the detail.</Note></div> : null}
        <div className="dsh-fields dsh-fields-sm"><div className="dsh-row">
          <MoneyField id="dshSAll" label="Spending, all together" unit="per month" value={txt(Math.round(F.spend) || null)} onValueChange={(v) => setTotal(num(v))} />
          <div className="dsh-hint dsh-self-end">{many ? <>The budget below adds up to this. Changing it here moves its &ldquo;{ALL_TOGETHER}&rdquo; line.</> : "Everything that leaves your checking account, housing included. Saving isn't spending."}</div>
        </div></div>
        <div className="dsh-foot">
          <Button variant="outline" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
            {open ? <ChevronUpIcon aria-hidden="true" /> : <ChevronDownIcon aria-hidden="true" />}{open ? "Less detail" : "More detail"}
          </Button>
          <span className="dsh-cap">Line by line, with the emergency fund and an emergency budget.</span>
        </div>
      </Tile>
      {open ? (
        <div className="dsh-r4">
          <Hosted key={rev} household={null}
            seed={(id) => (id === "budget" ? ({ ...budgetFor(pr), view: "budget" } as unknown as ToolInputs) : id === "tax" ? (taxFor(pr) as unknown as ToolInputs) : undefined)}
            keep={(id, d) => { if (id === "budget") setProfile((p) => fromBudget(p, d as unknown as BudgetInputs)); }}>
            <Budget />
          </Hosted>
        </div>
      ) : null}
    </Frame>
  );
}
