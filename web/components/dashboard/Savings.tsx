"use client";

/* Taxes & Savings: the year's taxes on pay, and where what's left after
   taxes and spending goes, by the Paycheck tab's own sliders (401(k) up to
   the match, HSA, emergency fund, IRA, 401(k) beyond the match,
   brokerage), each traditional or Roth. The Paycheck is the household's
   one tax calculator: the deductions (standard or itemized) and any local
   tax are chosen here, pre-tax lines lower the taxes, and the plan saves
   into each account as set here, rising each year by what's set below. */

import Link from "next/link";
import { Affixed, Field, NumberField, SelectField } from "@/components/fields/Field";
import { MoneyInput } from "@/components/fields/NumberInput";
import { Badge } from "@/components/ui/badge";
import { yearData } from "@/lib/engine/typed";
import { LOCAL_TAX } from "@/tools/tax/local";
import { TAX_DEF, type TaxInputs } from "@/tools/tax/model";
import { PC_ZERO, paycheckRun } from "@/tools/budget/paycheck-math";
import { withDefaults } from "@/components/tools/ToolState";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { ToolInputs } from "@/components/tools/ToolState";
import type { BudgetInputs } from "@/tools/budget/model";
import { parseNum } from "@/lib/format";
import { STATE_OPTIONS } from "@/lib/states";
import { Frame } from "./Frame";
import { agesOf } from "./ages";
import { budgetFor, flow, fromBudget, fromTax, taxFor, taxState } from "./flows";
import { raiseWords } from "./yearly";
import { money } from "./format";
import { Hosted, TOOL_VIEWS } from "./host";
import { couple, nameOf, outsideUS } from "./model";
import type { ReactNode } from "react";
import { useDashboard, type Profile } from "./store";
import { Note, StackBar, StatusDot, Tip, TipLabel, type BarPart } from "./ui";

const pct = (v: number) => String(Math.round(v * 1000) / 10);

/** How saving grows: it follows pay, as set on Year by year. Shown under
    where the rest goes. */
function Growth() {
  const { data } = useDashboard();
  const pr = data.profile, names: [string, string] | null = pr.who === "couple" ? [pr.p1.name || "You", pr.p2.name || "Your partner"] : null;
  return (
    <Card id="growth" className="min-w-0">
      <CardHeader>
        <CardTitle>How your saving grows <Tip id="growLines" title="How your saving grows" /></CardTitle>
        <CardDescription>It follows your pay. {raiseWords(pr, names)}</CardDescription>
        <CardAction><Button variant="outline" size="sm" nativeButton={false} render={<Link href="/dashboard/years" />}>Set on Year by year</Button></CardAction>
      </CardHeader>
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
  // Siblings, not one block, so the inputs column groups them as the
  // mock does: the facts, their note, then the Taxes choices.
  return (
    <>
      <dl className="dsh-facts">
        {abroad ? <div><dt>Where you live</dt><dd>Outside the US</dd></div> : <>
          <div><dt>Filing status</dt><dd>{STATUS[b.pcStatus] ?? "Single"}</dd></div>
          <div><dt>State</dt><dd>{STATE_OPTIONS.find((o) => o.code === b.pcState)?.name ?? b.pcState}</dd></div>
        </>}
        {who.map((i) => <div key={"p" + i} className={pay(i) ? undefined : "dsh-todo"}><dt>{two ? nameOf(pr, i) + "'s pay" : "Pay"}</dt><dd>{pay(i) ?? "Not given yet"}</dd></div>)}
        {abroad ? null : who.map((i) => <div key={"m" + i}><dt>{two ? nameOf(pr, i) + "'s 401(k) match" : "401(k) match"}</dt><dd>{match(i)}</dd></div>)}
      </dl>
      <p className="dsh-cap">
        {abroad ? "Pay is" : "Pay and the match are"} set in <Button variant="link" size="inline" nativeButton={false} render={<Link href="/dashboard/income#pay" />}>Income</Button>, {abroad ? "where you live" : "filing status and state"} in <Button variant="link" size="inline" nativeButton={false} render={<Link href="/dashboard/profile#household" />}>Profile</Button>.
      </p>
      <TaxChoices />
    </>
  );
}

export function Savings() {
  const { data, setProfile } = useDashboard();
  const pr = data.profile, F = flow(pr);
  const Budget = TOOL_VIEWS.budget;
  return (
    <Frame current="savings" title="Taxes & Savings" sub={F.hasPay ? `${F.tax ? money(F.tax.total) + " per year in taxes, " : ""}${money(F.invested + F.match)} per month into savings, with your employer's match` : "Where your paycheck goes"}>
      <Top pr={pr} />
      <div className="dsh-r4">
        {/* The paycheck's own reading (its figures and donut) is said by
            Each month above, so it's left out here. */}
        <Hosted household={null} slots={{ afterSliders: <Growth />, payFacts: <PayFacts pr={pr} />, ages: agesOf(pr), noReading: true }}
          seed={(id) => (id === "budget" ? ({ ...budgetFor(pr), view: "paycheck" } as unknown as ToolInputs) : id === "tax" ? (taxFor(pr) as unknown as ToolInputs) : undefined)}
          keep={(id, d) => { if (id === "budget") setProfile((p) => fromBudget(p, d as unknown as BudgetInputs)); }}>
          <Budget />
        </Hosted>
      </div>
    </Frame>
  );
}

/** A label and its figure in a card's row of three. */
function Fig({ label, children }: { label: ReactNode; children: ReactNode }) {
  return <div className="dsh-stat"><div className="dsh-label">{label}</div><div className="dsh-fig dsh-md">{children}</div></div>;
}

/** The two cards at the top, built alike so their rows line up (.dsh-duo):
    the year's taxes, and where each month's pay goes. Each has a figure,
    a row of three, and a bar with its key. */
function Top({ pr }: { pr: Profile }) {
  const F = flow(pr), T = F.tax, r = F.r, m = F.pi.p / 12, abroad = outsideUS(pr);
  const free = paycheckRun(F.pi, PC_ZERO).toAssign * m;
  const rate = F.gross > 0 ? (F.invested + F.match) / F.gross : null;
  const yr = F.gross * 12, short = F.left < 0;
  const pctOf = (v: number, of: number) => (of > 0 ? Math.round((v / of) * 100) + "%" : "");
  const taxParts: BarPart[] = T ? [
    { name: "Federal income tax", v: T.federal, color: "var(--dsh-c-tax)" },
    { name: "State income tax", v: T.state, color: "var(--dsh-c-tax2)" },
    ...(T.local > 0 ? [{ name: "Local income tax", v: T.local, color: "var(--dsh-c-tax3)" }] : []),
    { name: <TipLabel text="FICA" id="fica" />, v: T.fica, color: "var(--dsh-c-tax4)" },
  ].map((p) => ({ ...p, value: <>{money(p.v)}<small data-u="/yr"> per year</small></>, share: pctOf(p.v, T.total) + " of taxes" })) : [];
  const monthParts: BarPart[] = [
    { name: "Savings", v: r.saved * m, color: "var(--dsh-c-save)" },
    { name: "Taxes", v: F.taxes, color: "var(--dsh-c-tax)" },
    { name: "Expenses", v: (r.spend + r.health) * m, color: "var(--dsh-c-spend)" },
    { name: short ? "Short" : <TipLabel text="Unassigned" id="notAssigned" />, v: Math.max(0, F.left), color: "", hatch: true, tone: short ? "loss" as const : undefined },
  ].map((p) => ({ ...p, value: money(p.name === "Short" ? Math.abs(F.left) : p.v), share: pctOf(p.name === "Short" ? Math.abs(F.left) : p.v, F.gross) + " of pay" }));
  return (
    <div className="dsh-duo">
      <section className="dsh-tile" id="taxes">
        <div className="dsh-tile-h"><span className="dsh-tile-t"><h2>Taxes this year</h2><Tip id="taxesFrom" title="Taxes this year" /></span></div>
        {abroad ? <>
          <p className="dsh-cap dsh-mt6">Outside the US we don&apos;t work out taxes: your pay is entered after taxes, and figures for retirement are before taxes.</p>
        </> : <>
          <div className="dsh-duo-hero"><div className="dsh-label">Pay after taxes</div><div className="dsh-fig dsh-key">{F.hasPay ? money(F.afterTax) : "—"}<small data-u="/mo">per month</small></div></div>
          <div className="dsh-duo-figs">
            <Fig label="All taxes">{T ? money(T.total) : "—"}<small data-u="/yr">per year</small></Fig>
            <Fig label="Taxes each month">{T ? money(F.taxes) : "—"}<small data-u="/mo">per month</small></Fig>
            <Fig label={<TipLabel text="Of your pay" k="effrate" />}>{T && yr > 0 ? Math.round((T.total / yr) * 1000) / 10 + "%" : "—"}</Fig>
          </div>
          {T ? <>
            <div className="dsh-duo-of">What makes up <b>{money(T.total)}</b> of taxes each year</div>
            <StackBar label="What makes up the year's taxes" parts={taxParts} />
          </> : null}
        </>}
      </section>
      <section className="dsh-tile" id="month">
        <div className="dsh-tile-h"><h2>Each month</h2></div>
        <div className="dsh-duo-hero"><div className="dsh-label">You save and invest</div><div className="dsh-fig dsh-key">{money(F.invested)}<small data-u="/mo">per month</small></div></div>
        <div className="dsh-duo-figs">
          <Fig label={<>Employer match{F.fullMatch == null ? null : <StatusDot ok={F.fullMatch} title="Employer match" text={F.fullMatch ? "You're getting the full employer match." : "You're not getting the full employer match: raise 401(k) up to the match to reach it."} />}</>}>{money(F.match)}<small data-u="/mo">per month</small></Fig>
          {budgetFor(pr).pcEfOn ? <Fig label="To the emergency fund">{money(F.ef)}<small data-u="/mo">per month</small></Fig> : null}
          <Fig label={<TipLabel text="Savings rate" id="savingsRate" />}>{rate != null ? Math.round(rate * 1000) / 10 + "%" : "—"}</Fig>
          <Fig label={<TipLabel text="Free before saving" id="freeBefore" />}>{F.hasPay ? money(free) : "—"}<small data-u="/mo">per month</small></Fig>
        </div>
        {F.hasPay ? <>
          <div className="dsh-duo-of">Where <b>{money(F.gross)}</b> of pay goes each month</div>
          <StackBar label="Where each month's pay goes" parts={monthParts} />
        </> : <p className="dsh-cap dsh-mt">No pay yet: add it in <Link href="/dashboard/income#pay">Income</Link>.</p>}
        {F.fullMatch == null && F.hasPay ? <p className="dsh-cap dsh-mt">No employer match set. Add it in Income if you have one.</p> : null}
        {outsideUS(pr) ? <div className="dsh-mt"><Note>The 401(k), IRA and HSA lines follow US rules. Outside the US, use them for the accounts closest to yours.</Note></div> : null}
      </section>
    </div>
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
    <>
      <h3 className="dsh-taxin-h">Taxes</h3>
      <SelectField id="dshDed" wrapId="taxChoices" label={<TipLabel text="Deduction" id="deduction" />} value={t.dedType} onChange={(v) => put({ dedType: v as TaxInputs["dedType"] })}>
        <option value="std">Standard ({money(std)})</option>
        <option value="item">Itemized</option>
      </SelectField>
      {t.dedType === "item" ? (
        <Field id="dshItem" label={<TipLabel text="Itemized total, per year" id="itemized" />}>
          <Affixed prefix="$"><MoneyInput id="dshItem" nonNeg value={t.item} onValueChange={(v) => put({ item: v })} /></Affixed>
        </Field>
      ) : null}
      {/* What a deduction is lives in its tip; only a warning is said here. */}
      {t.dedType === "item" && parseNum(t.item) > 0 && parseNum(t.item) < std ? <p className="dsh-cap"><b>That&apos;s less than the {money(std)} standard deduction, which you&apos;d take instead.</b></p> : null}
      {local ? <>
        <NumberField id="dshLocal" label={<>Local income tax <Badge variant="outline" className="ml-1.25">optional</Badge></>} unit="%" step={0.1} max={20} value={t.localRate ?? "0"} onValueChange={(v) => put({ localRate: v })} />
        <p className="dsh-cap">{local.note} {localOn ? "" : "Leave it at 0 if there's none where you live. "}Your pay stub shows any local tax taken out{local.links.length ? ", or look up your rate: " : "."}
          {local.links.map(([label, url], i) => <span key={url}>{i ? ", " : ""}<a href={url} target="_blank" rel="noopener noreferrer">{label}</a></span>)}{local.links.length ? "." : null}</p>
      </> : null}
    </>
  );
}
