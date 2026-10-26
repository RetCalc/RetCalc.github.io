"use client";

/* Savings: where what's left after taxes and spending goes, by the Paycheck
   tab's own sliders (401(k) up to the match, HSA, emergency fund, IRA,
   401(k) beyond the match, brokerage), each traditional or Roth. Pre-tax
   lines lower the taxes on the Taxes tab; the plan saves into each account
   as set here, rising each year by what's set below. */

import Link from "next/link";
import { PiggyBankIcon } from "lucide-react";
import { useState } from "react";
import { NumberField } from "@/components/fields/Field";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogClose, DialogContent } from "@/components/ui/dialog";
import type { ToolInputs } from "@/components/tools/ToolState";
import type { BudgetInputs } from "@/tools/budget/model";
import { parseNum } from "@/lib/format";
import { STATE_OPTIONS } from "@/lib/states";
import { Frame } from "./Frame";
import { num } from "./fields";
import { budgetFor, flow, fromBudget, growthLines, taxFor } from "./flows";
import { money } from "./format";
import { Hosted, TOOL_VIEWS } from "./host";
import { nameOf, outsideUS } from "./model";
import { useDashboard, type Profile } from "./store";
import { Note, Tile, Tip, TipLabel } from "./ui";

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
        <CardTitle>How your saving grows <Tip id="growLines" title="How your saving grows" /></CardTitle>
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
                <div><b>{l.name}</b><span>{money(l.amount)} per month{isFinite(l.cap) ? `, limit ${money(l.cap)}` : ", no limit"}</span></div>
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

const PAID: Record<string, string> = { "52": "every week", "26": "every two weeks", "24": "twice a month", "12": "monthly" };
const STATUS: Record<string, string> = { s: "Single", m: "Married, one income", m2: "Married, two incomes" };

/** What the Paycheck takes from Income and Profile, said in place of its
    fields: pay, how often, filing status, state and the match. Changed
    there, not here. */
function PayFacts({ pr }: { pr: Profile }) {
  const b = budgetFor(pr), abroad = outsideUS(pr), two = b.pcStatus === "m2";
  const who = two ? [0, 1] as const : [0] as const;
  const pay = (i: 0 | 1) => {
    const g = parseNum(i ? b.pcGross2 : b.pcGross);
    return g > 0 ? `${money(g)} per year${abroad ? " after taxes" : ""}, ${PAID[i ? b.pcFreq2 : b.pcFreq] ?? "every two weeks"}` : null;
  };
  const match = (i: 0 | 1) => {
    const rate = parseNum(i ? b.pcMatchRate2 : b.pcMatchRate), upTo = parseNum(i ? b.pcMatchUpTo2 : b.pcMatchUpTo);
    return rate > 0 && upTo > 0 ? `${pct(rate / 100)}% on the first ${pct(upTo / 100)}% of pay` : "None";
  };
  return (
    <div className="dsh-payfacts">
      <dl className="dsh-facts">
        {abroad ? <div><dt>Where you live</dt><dd>Outside the US</dd></div> : <>
          <div><dt>Filing status</dt><dd>{STATUS[b.pcStatus] ?? "Single"}</dd></div>
          <div><dt>State</dt><dd>{STATE_OPTIONS.find((o) => o.code === b.pcState)?.name ?? b.pcState}</dd></div>
        </>}
        {who.map((i) => <div key={"p" + i} className={pay(i) ? undefined : "dsh-todo"}><dt>{two ? nameOf(pr, i) + "'s pay" : "Pay"}</dt><dd>{pay(i) ?? "Not given yet"}</dd></div>)}
        {abroad ? null : who.map((i) => <div key={"m" + i}><dt>{two ? nameOf(pr, i) + "'s 401(k) match" : "401(k) match"}</dt><dd>{match(i)}</dd></div>)}
      </dl>
      <p className="dsh-cap dsh-mt6">
        {abroad ? "Pay is" : "Pay and the match are"} set in <Button variant="link" size="inline" nativeButton={false} render={<Link href="/dashboard/income#pay" />}>Income</Button>, {abroad ? "where you live" : "filing status and state"} in <Button variant="link" size="inline" nativeButton={false} render={<Link href="/dashboard/profile#household" />}>Profile</Button>.
      </p>
    </div>
  );
}

export function Savings() {
  const { data, setProfile } = useDashboard();
  const pr = data.profile, F = flow(pr);
  const Budget = TOOL_VIEWS.budget;
  const rate = F.gross > 0 ? (F.invested + F.match) / F.gross : null;
  // Shown once the emergency fund line is in "Where the rest goes", even at 0.
  const efOn = budgetFor(pr).pcEfOn;
  return (
    <Frame current="savings" title="Savings" sub={F.hasPay ? `${money(F.invested + F.match)} per month into savings, with your employer's match` : "Where your paycheck goes"}>
      <Tile id="month" icon={PiggyBankIcon} title="Each month">
        <div className="dsh-stats">
          <div className="dsh-stat"><div className="dsh-label">You save and invest</div><div className="dsh-fig dsh-key">{money(F.invested)}<small>per month</small></div></div>
          <div className="dsh-stat"><div className="dsh-label">Employer match</div><div className="dsh-fig dsh-md">{money(F.match)}<small>per month</small></div></div>
          {efOn ? <div className="dsh-stat"><div className="dsh-label">To the emergency fund</div><div className="dsh-fig dsh-md">{money(F.ef)}<small>per month</small></div></div> : null}
          <div className="dsh-stat"><div className="dsh-label">{F.left >= 0 ? <TipLabel text="Not assigned" id="notAssigned" /> : "Short"}</div><div className="dsh-fig dsh-md">{money(Math.abs(F.left))}<small>per month</small></div></div>
          {rate != null ? <div className="dsh-stat"><div className="dsh-label"><TipLabel text="Savings rate, with the match" id="savingsRate" /></div><div className="dsh-fig dsh-md">{Math.round(rate * 1000) / 10}%</div></div> : null}
        </div>
        <div className="dsh-cap dsh-mt">
          {F.fullMatch == null ? "No employer match set. Add it in Income if you have one." : F.fullMatch ? "You're getting the full employer match." : <b>You&apos;re not getting the full employer match: raise the first 401(k) line to reach it.</b>}
          {F.left > 0.5 ? " What's not assigned stays in checking, not invested." : ""}
        </div>
        {outsideUS(pr) ? <div className="dsh-mt"><Note>The 401(k), IRA and HSA lines follow US rules; outside the US, use them for the accounts closest to yours.</Note></div> : null}
      </Tile>
      <div className="dsh-r4">
        <Hosted household={null} slots={{ afterSliders: <Growth />, payFacts: <PayFacts pr={pr} /> }}
          seed={(id) => (id === "budget" ? ({ ...budgetFor(pr), view: "paycheck" } as unknown as ToolInputs) : id === "tax" ? (taxFor(pr) as unknown as ToolInputs) : undefined)}
          keep={(id, d) => { if (id === "budget") setProfile((p) => fromBudget(p, d as unknown as BudgetInputs)); }}>
          <Budget />
        </Hosted>
      </div>
    </Frame>
  );
}
