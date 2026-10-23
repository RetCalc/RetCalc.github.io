"use client";

/* Savings: where what's left after taxes and spending goes, by the Paycheck
   tab's own sliders (401(k) up to the match, HSA, emergency fund, IRA,
   401(k) beyond the match, brokerage), each traditional or Roth. Pre-tax
   lines lower the taxes on the Taxes tab; the plan saves into each account
   as set here, rising each year by what's set below. */

import { PiggyBankIcon } from "lucide-react";
import { NumberField } from "@/components/fields/Field";
import type { ToolInputs } from "@/components/tools/ToolState";
import type { BudgetInputs } from "@/tools/budget/model";
import { Frame } from "./Frame";
import { num, pctTxt } from "./fields";
import { budgetFor, flow, fromBudget, taxFor } from "./flows";
import { money10 } from "./format";
import { Hosted, TOOL_VIEWS } from "./host";
import { outsideUS } from "./model";
import { useDashboard } from "./store";
import { Note, Tile } from "./ui";

export function Savings() {
  const { data, setProfile } = useDashboard();
  const pr = data.profile, F = flow(pr);
  const Budget = TOOL_VIEWS.budget;
  const rate = F.gross > 0 ? (F.invested + F.match) / F.gross : null;
  return (
    <Frame current="savings" title="Savings" sub={F.hasPay ? `${money10(F.invested + F.match)} per month into savings, with your employer's match` : "Where your paycheck goes"}>
      <Tile icon={PiggyBankIcon} title="Each month">
        <div className="dsh-stats">
          <div className="dsh-stat"><div className="dsh-label">You save and invest</div><div className="dsh-fig dsh-key">{money10(F.invested)}<small>per month</small></div></div>
          <div className="dsh-stat"><div className="dsh-label">Employer match</div><div className="dsh-fig dsh-md">{money10(F.match)}<small>per month</small></div></div>
          <div className="dsh-stat"><div className="dsh-label">To the emergency fund</div><div className="dsh-fig dsh-md">{money10(F.ef)}<small>per month</small></div></div>
          <div className="dsh-stat"><div className="dsh-label">{F.left >= 0 ? "Not assigned" : "Short"}</div><div className="dsh-fig dsh-md">{money10(Math.abs(F.left))}<small>per month</small></div></div>
          {rate != null ? <div className="dsh-stat"><div className="dsh-label">Savings rate</div><div className="dsh-fig dsh-md">{Math.round(rate * 1000) / 10}%</div></div> : null}
        </div>
        <div className="dsh-cap dsh-mt">
          {F.fullMatch == null ? "No employer match set. Add it in Income if you have one." : F.fullMatch ? "You're getting the full employer match." : <b>You&apos;re not getting the full employer match: raise the first 401(k) line to reach it.</b>}
          {F.left > 0.5 ? " What's not assigned stays in checking, not invested." : ""}
        </div>
        <div className="dsh-fields dsh-fields-sm"><div className="dsh-row3">
          <NumberField id="dshRaise" label="Saving rises each year, beyond inflation" unit="%" step={0.5} max={20} value={pctTxt(pr.raise)} onValueChange={(v) => setProfile((p) => ({ ...p, raise: (num(v) ?? 0) / 100 }))} />
          <div className="dsh-hint dsh-self-end">Raises usually lift what you put in. 0% keeps it level in today&apos;s dollars until you retire.</div>
          <div />
        </div></div>
        {outsideUS(pr) ? <div className="dsh-mt"><Note>The 401(k), IRA and HSA lines follow US rules; outside the US, use them for the accounts closest to yours.</Note></div> : null}
      </Tile>
      <div className="dsh-r4">
        <Hosted household={null}
          seed={(id) => (id === "budget" ? ({ ...budgetFor(pr), view: "paycheck" } as unknown as ToolInputs) : id === "tax" ? (taxFor(pr) as unknown as ToolInputs) : undefined)}
          keep={(id, d) => { if (id === "budget") setProfile((p) => fromBudget(p, d as unknown as BudgetInputs)); }}>
          <Budget />
        </Hosted>
      </div>
    </Frame>
  );
}
