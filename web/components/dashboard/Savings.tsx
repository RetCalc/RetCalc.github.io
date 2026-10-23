"use client";

/* Savings: where what's left after taxes and spending goes, by the Paycheck
   tab's own sliders (401(k) up to the match, HSA, emergency fund, IRA,
   401(k) beyond the match, brokerage), each traditional or Roth. Pre-tax
   lines lower the taxes on the Taxes tab; the plan saves into each account
   as set here, rising each year by what's set below. */

import { PiggyBankIcon } from "lucide-react";
import { useState } from "react";
import { NumberField } from "@/components/fields/Field";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogClose, DialogContent } from "@/components/ui/dialog";
import type { ToolInputs } from "@/components/tools/ToolState";
import type { BudgetInputs } from "@/tools/budget/model";
import { Frame } from "./Frame";
import { num } from "./fields";
import { budgetFor, flow, fromBudget, growthLines, taxFor } from "./flows";
import { money10 } from "./format";
import { Hosted, TOOL_VIEWS } from "./host";
import { outsideUS } from "./model";
import { useDashboard } from "./store";
import { Note, Tile } from "./ui";

const pct = (v: number) => String(Math.round(v * 1000) / 10);

/** How each line grows: a line at its limit can't, one below it grows to
    it and stops, brokerage has none. Shown under where the rest goes. */
function Growth() {
  const { data, setProfile } = useDashboard();
  const pr = data.profile, L = growthLines(pr), year = new Date().getFullYear();
  const [open, setOpen] = useState(false);
  const summary = L.filter((l) => l.amount > 0).map((l) => `${l.name} ${l.capped ? "at its limit" : pct(l.growth) + "%"}`).join(" · ");
  return (
    <Card id="growth" className="min-w-0">
      <CardHeader>
        <CardTitle>How your saving grows</CardTitle>
        <CardDescription>Each year, beyond inflation. {summary || "Nothing saved yet."}</CardDescription>
        <CardAction><Button variant="outline" size="sm" onClick={() => setOpen(true)}>Set by account</Button></CardAction>
      </CardHeader>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent size="study" aria-labelledby="dshGrowTitle">
          <h2 id="dshGrowTitle" className="dsh-dlg-h">How each line grows</h2>
          <p className="dsh-cap">Raises let you put in more each year. Limits rise with inflation, so a line already at its limit can&apos;t grow beyond it; one below grows until it gets there, then holds.</p>
          <div className="dsh-growlist">
            {L.map((l) => (
              <div className="dsh-growrow" key={l.id}>
                <div><b>{l.name}</b><span>{money10(l.amount)} per month{isFinite(l.cap) ? `, limit ${money10(l.cap)}` : ", no limit"}</span></div>
                <NumberField id={"dshGrow" + l.id} label="Grows each year" unit="%" step={0.5} max={30} disabled={l.capped}
                  value={l.capped ? "0" : pct(pr.growth[l.id] ?? 0)} onValueChange={(v) => setProfile((p) => ({ ...p, growth: { ...p.growth, [l.id]: (num(v) ?? 0) / 100 } }))} />
                <span className={l.capped ? "dsh-badge" : "dsh-cap"}>{l.capped ? "At the limit" : !(l.amount > 0) ? "Nothing goes here yet: set it above" : l.years != null ? `Reaches the limit in ${year + l.years}` : l.growth > 0 ? "No limit" : ""}</span>
              </div>
            ))}
          </div>
          <div className="dsh-navbtns"><DialogClose render={<Button />}>Done</DialogClose></div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

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
        {outsideUS(pr) ? <div className="dsh-mt"><Note>The 401(k), IRA and HSA lines follow US rules; outside the US, use them for the accounts closest to yours.</Note></div> : null}
      </Tile>
      <div className="dsh-r4">
        <Hosted household={null} slots={{ afterSliders: <Growth /> }}
          seed={(id) => (id === "budget" ? ({ ...budgetFor(pr), view: "paycheck" } as unknown as ToolInputs) : id === "tax" ? (taxFor(pr) as unknown as ToolInputs) : undefined)}
          keep={(id, d) => { if (id === "budget") setProfile((p) => fromBudget(p, d as unknown as BudgetInputs)); }}>
          <Budget />
        </Hosted>
      </div>
    </Frame>
  );
}
