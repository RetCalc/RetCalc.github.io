"use client";

/* The two tax tables Income Tax ends on, shared with the Budget's Paycheck
   tab: the federal brackets and what's paid in each, then the state's rules
   (folded behind their title), with what the figures leave out under them. */

import { useRef } from "react";
import { ChevronDownIcon } from "lucide-react";
import { CsvButton } from "@/components/common/CsvButton";
import { Card, CardAction, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { money, pctStr } from "@/lib/format";
import { STATE_OPTIONS } from "@/lib/states";
import { stateGaps, stateRuleRows } from "./stateRules";

export interface Band { rate: number; lo: number; hi: number; amount: number; tax: number }

const BRACKETS = "Federal brackets, and what you pay in each";

/** The year's federal brackets: each band's range, how much of the taxable
    income falls in it, and its tax. `fold`: behind its title, closed. */
export function BracketsCard({ bands, id, fold }: { bands: Band[]; id: string; fold?: boolean }) {
  const ref = useRef<HTMLTableElement>(null);
  const table = (
    <>
      <div className="swipehint">Swipe the table sideways to see every column.</div>
      <div className="scroll" tabIndex={0} role="region" aria-label="Tax brackets">
        <table id={id} className="txbrackets" ref={ref}>
          <thead><tr><th>Rate</th><th>Income range</th><th>Taxed in this band</th><th>Tax</th></tr></thead>
          <tbody>
            {bands.map((b) => (
              <tr key={b.rate} className={b.amount > 0 ? undefined : "text-muted-foreground"}>
                <td>{pctStr(b.rate, 0)}</td><td>{money(b.lo) + (b.hi === Infinity ? " and up" : " – " + money(b.hi))}</td><td>{money(b.amount)}</td><td>{money(b.tax)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
  const csv = <CardAction><CsvButton table={ref} label={BRACKETS} /></CardAction>;
  if (!fold) return <Card><CardHeader><CardTitle>{BRACKETS}</CardTitle>{csv}</CardHeader>{table}</Card>;
  return (
    <Collapsible className="min-w-0" render={<Card />}>
      <CardHeader>
        <CardTitle><CollapsibleTrigger>{BRACKETS}<ChevronDownIcon aria-hidden="true" /></CollapsibleTrigger></CardTitle>
        {csv}
      </CardHeader>
      <CollapsibleContent keepMounted>{table}</CollapsibleContent>
    </Collapsible>
  );
}

const RULES = "State rules, and what went into the figure above";

/** The state's rules for the year, folded behind their title; what the
    figures leave out stays in view under them. `figuresFrom`: the year the
    state's figures are from, when it isn't `year` yet. */
export function StateRulesCard({ state, status, year, figuresFrom, id }: { state: string; status: string; year: number; figuresFrom?: number; id: string }) {
  const ref = useRef<HTMLTableElement>(null);
  return (
    <Collapsible className="min-w-0" render={<Card />}>
      <CardHeader>
        <CardTitle><CollapsibleTrigger>{RULES}<ChevronDownIcon aria-hidden="true" /></CollapsibleTrigger></CardTitle>
        <CardDescription id={id + "Name"}>{(STATE_OPTIONS.find((o) => o.code === state)?.name ?? "") + (figuresFrom != null && figuresFrom !== year ? ", by " + figuresFrom + "'s state rules" : "")}</CardDescription>
        <CardAction><CsvButton table={ref} label={RULES} /></CardAction>
      </CardHeader>
      <CollapsibleContent keepMounted>
        <div id={id + "Wrap"} className="txrulewrap">
          <table id={id} className="txrules" ref={ref}>
            <tbody>
              {(stateRuleRows(state, status, year) as [string, string][]).map(([k, v]) => (
                <tr key={k}><td className="whitespace-nowrap font-semibold">{k}</td><td>{v}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      </CollapsibleContent>
      <div className="mcnote" id={id + "Gaps"}><b>Not included in the figures above.</b> {stateGaps(state)}</div>
    </Collapsible>
  );
}
