"use client";

/* Taxes & Savings: the year's taxes on pay, and where what's left after
   taxes and spending goes, by the Paycheck tab's own sliders (401(k) up to
   the match, HSA, emergency fund, IRA, 401(k) beyond the match,
   brokerage), each traditional or Roth. The Paycheck is the household's
   one tax calculator: the deductions (standard or itemized) and any local
   tax are chosen here, pre-tax lines lower the taxes, and the plan saves
   into each account as set here, rising each year by what's set below. */

import Link from "next/link";
import { LandmarkIcon, PiggyBankIcon } from "lucide-react";
import { useState } from "react";
import { Affixed, Field, NumberField, SelectField } from "@/components/fields/Field";
import { MoneyInput } from "@/components/fields/NumberInput";
import { Badge } from "@/components/ui/badge";
import { yearData } from "@/lib/engine/typed";
import { LOCAL_TAX } from "@/tools/tax/local";
import { TAX_DEF, type TaxInputs } from "@/tools/tax/model";
import { withDefaults } from "@/components/tools/ToolState";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogClose, DialogContent } from "@/components/ui/dialog";
import type { ToolInputs } from "@/components/tools/ToolState";
import type { BudgetInputs } from "@/tools/budget/model";
import { parseNum } from "@/lib/format";
import { STATE_OPTIONS } from "@/lib/states";
import { Frame } from "./Frame";
import { num } from "./fields";
import { agesOf } from "./ages";
import { budgetFor, flow, fromBudget, fromTax, growthLines, taxFor, taxState } from "./flows";
import { money } from "./format";
import { Hosted, TOOL_VIEWS } from "./host";
import { couple, nameOf, outsideUS } from "./model";
import { useDashboard, type Profile } from "./store";
import { Note, Tile, Tip, TipLabel, To } from "./ui";

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
          <p className="dsh-cap">Raises let you put in more each year. Limits rise with inflation, so a line already at its limit can&apos;t grow beyond it. One below grows until it gets there, then holds.</p>
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
      <TaxChoices />
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
    <Frame current="savings" title="Taxes & Savings" sub={F.hasPay ? `${F.tax ? money(F.tax.total) + " per year in taxes, " : ""}${money(F.invested + F.match)} per month into savings, with your employer's match` : "Where your paycheck goes"}>
      <Taxes pr={pr} />
      <Tile id="month" icon={PiggyBankIcon} title="Each month" className="dsh-r4">
        <div className="dsh-stats">
          <div className="dsh-stat"><div className="dsh-label">You save and invest</div><div className="dsh-fig dsh-key">{money(F.invested)}<small>per month</small></div></div>
          <div className="dsh-stat"><div className="dsh-label">Employer match</div><div className="dsh-fig dsh-md">{money(F.match)}<small>per month</small></div></div>
          {efOn ? <div className="dsh-stat"><div className="dsh-label">To the emergency fund</div><div className="dsh-fig dsh-md">{money(F.ef)}<small>per month</small></div></div> : null}
          <div className="dsh-stat"><div className="dsh-label">{F.left >= 0 ? <TipLabel text="Not assigned" id="notAssigned" /> : "Short"}</div><div className="dsh-fig dsh-md">{money(Math.abs(F.left))}<small>per month</small></div></div>
          {rate != null ? <div className="dsh-stat"><div className="dsh-label"><TipLabel text="Savings rate, with the match" id="savingsRate" /></div><div className="dsh-fig dsh-md">{Math.round(rate * 1000) / 10}%</div></div> : null}
        </div>
        <div className="dsh-cap dsh-mt">
          {F.fullMatch == null ? "No employer match set. Add it in Income if you have one." : F.fullMatch ? "You're getting the full employer match." : <b>You&apos;re not getting the full employer match: raise 401(k) up to the match to reach it.</b>}
          {F.left > 0.5 ? " What's not assigned stays in checking, not invested." : ""}
        </div>
        {outsideUS(pr) ? <div className="dsh-mt"><Note>The 401(k), IRA and HSA lines follow US rules. Outside the US, use them for the accounts closest to yours.</Note></div> : null}
      </Tile>
      <div className="dsh-r4">
        <Hosted household={null} slots={{ afterSliders: <Growth />, payFacts: <PayFacts pr={pr} />, ages: agesOf(pr) }}
          seed={(id) => (id === "budget" ? ({ ...budgetFor(pr), view: "paycheck" } as unknown as ToolInputs) : id === "tax" ? (taxFor(pr) as unknown as ToolInputs) : undefined)}
          keep={(id, d) => { if (id === "budget") setProfile((p) => fromBudget(p, d as unknown as BudgetInputs)); }}>
          <Budget />
        </Hosted>
      </div>
    </Frame>
  );
}

/** The year's taxes on pay, as the Paycheck figures them. */
function Taxes({ pr }: { pr: Profile }) {
  const F = flow(pr), T = F.tax, abroad = outsideUS(pr);
  if (abroad) return <Tile id="taxes" icon={LandmarkIcon} title="Taxes"><p className="dsh-cap dsh-mt6">Outside the US we don&apos;t work out taxes: your pay is entered after taxes, and figures for retirement are before taxes.</p></Tile>;
  const yr = F.gross * 12;
  return (
    <Tile id="taxes" icon={LandmarkIcon} title="Taxes this year">
      <div className="dsh-stats">
        <div className="dsh-stat"><div className="dsh-label">Pay after taxes</div><div className="dsh-fig dsh-key">{F.hasPay ? money(F.afterTax) : "—"}<small>per month</small></div></div>
        <div className="dsh-stat"><div className="dsh-label">Federal income tax</div><div className="dsh-fig dsh-md">{T ? money(T.federal) : "—"}<small>per year</small></div></div>
        <div className="dsh-stat"><div className="dsh-label">State income tax</div><div className="dsh-fig dsh-md">{T ? money(T.state) : "—"}<small>per year</small></div></div>
        {T && T.local > 0 ? <div className="dsh-stat"><div className="dsh-label">Local income tax</div><div className="dsh-fig dsh-md">{money(T.local)}<small>per year</small></div></div> : null}
        <div className="dsh-stat"><div className="dsh-label"><TipLabel text="Social Security and Medicare" id="fica" /></div><div className="dsh-fig dsh-md">{T ? money(T.fica) : "—"}<small>per year</small></div></div>
        {T && yr > 0 ? <div className="dsh-stat"><div className="dsh-label"><TipLabel text="Of your pay" k="effrate" /></div><div className="dsh-fig dsh-md">{Math.round((T.total / yr) * 1000) / 10}%</div></div> : null}
      </div>
      <p className="dsh-cap dsh-mt">Pay comes from <To href="/dashboard/income#pay">Income</To>. Your deduction{LOCAL_TAX[taxState(pr)] ? " and local income tax are" : " is"} chosen with your paycheck below, and what goes to your 401(k), HSA and health premiums there lowers these taxes.</p>
    </Tile>
  );
}

/** The choices that change the year's taxes, with the paycheck's other
    inputs: the standard deduction or itemizing, and a local tax where the
    state has them. Kept as Income Tax's own inputs. Reads the profile
    itself, so it's current wherever the paycheck draws it. */
function TaxChoices() {
  const { data, setProfile } = useDashboard();
  const pr = data.profile;
  if (outsideUS(pr)) return null;
  const t = withDefaults(TAX_DEF, pr.tools.tax ?? {});
  const put = (v: Partial<TaxInputs>) => setProfile((p) => fromTax(p, { ...withDefaults(TAX_DEF, p.tools.tax ?? {}), ...v }));
  const local = LOCAL_TAX[taxState(pr)], std = yearData().fedStd[couple(pr) ? "m" : "s"];
  const localOn = !!local && parseNum(t.localRate ?? "0") > 0;
  return (
    <div className="dsh-taxin" id="taxChoices">
      <h3 className="dsh-taxin-h">Taxes</h3>
      <SelectField id="dshDed" label={<TipLabel text="Deduction" id="deduction" />} value={t.dedType} onChange={(v) => put({ dedType: v as TaxInputs["dedType"] })}>
        <option value="std">Standard deduction ({money(std)})</option>
        <option value="item">Itemized</option>
      </SelectField>
      {t.dedType === "item" ? (
        <Field id="dshItem" label="Itemized total, per year">
          <Affixed prefix="$"><MoneyInput id="dshItem" nonNeg value={t.item} onValueChange={(v) => put({ item: v })} /></Affixed>
        </Field>
      ) : null}
      <p className="dsh-cap">
        {t.dedType === "item"
          ? <>Mortgage interest, gifts to charity, and state and local taxes (income or sales, plus property) up to the cap, added up for the year.{parseNum(t.item) > 0 && parseNum(t.item) < std ? <b> That&apos;s less than the {money(std)} standard deduction, which you&apos;d take instead.</b> : null}</>
          : "Most households take the standard deduction. Itemize only if your mortgage interest, charity and state and local taxes add up to more."}
      </p>
      {local ? <>
        <NumberField id="dshLocal" label={<>Local income tax <Badge variant="outline" className="ml-1.25">optional</Badge></>} unit="%" step={0.1} max={20} value={t.localRate ?? "0"} onValueChange={(v) => put({ localRate: v })} />
        <p className="dsh-cap">{local.note} {localOn ? "" : "Leave it at 0 if there's none where you live. "}Your pay stub shows any local tax taken out{local.links.length ? ", or look up your rate: " : "."}
          {local.links.map(([label, url], i) => <span key={url}>{i ? ", " : ""}<a href={url} target="_blank" rel="noopener noreferrer">{label}</a></span>)}{local.links.length ? "." : null}</p>
      </> : null}
    </div>
  );
}
