/* Pieces both of the Advanced calculator's screens draw (Advanced.tsx on
   the site, PlanScreen.tsx on the Dashboard). */

"use client";

import { useRef } from "react";
import { ChevronDownIcon, CircleAlertIcon } from "lucide-react";
import { Affixed, Field, NumberField, SelectField } from "@/components/fields/Field";
import { MoneyInput } from "@/components/fields/NumberInput";
import { Tipped } from "@/components/shell/Tooltips";
import { CsvButton } from "@/components/common/CsvButton";
import { Card, CardAction, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { InputGroupInput } from "@/components/ui/input-group";
import { Label } from "@/components/ui/label";
import { money, pctStr } from "@/lib/format";
import { cn } from "@/lib/utils";

/** A heading over one group of the inputs, on a rule after the first. */
export function GroupHead({ first, children }: { first?: boolean; children: React.ReactNode }) {
  return <h3 className={cn("m-0 mb-3 text-sm font-semibold", !first && "mt-1 border-t border-border pt-4")}>{children}</h3>;
}

/** Why an after-tax income goal can't be met: a portfolio that pays
    nothing after tax (a 0% withdrawal rate, or a 100% tax rate) reaches
    no income. `badWd` and `badTax` say which field to mark; the tax rate
    is a field only without the account split. */
export function payCheck(income: boolean, target: number, withdrawal: number, taxRate: number, split: boolean) {
  const noPay = income && target > 0 && !(withdrawal > 0 && taxRate < 1);
  const payWarn = !noPay ? "" : withdrawal > 0
    ? "At a 100% tax rate nothing is left after tax, so no portfolio reaches an after-tax income. Lower the tax rate."
    : "At a 0% withdrawal rate the portfolio pays no income, so no amount reaches your target. Set a withdrawal rate above 0%.";
  const badWd = noPay && !(withdrawal > 0), badTax = noPay && !badWd && !split;
  return { noPay, payWarn, badWd, badTax };
}

type GoalKey = "solveFor" | "target" | "withdrawal" | "taxRate";
/** Each screen's own ids for the goal's fields. */
export interface GoalIds { solveFor: string; target: string; withdrawal: string; taxRate: string; taxRateWrap: string; calc: string; calcOut: string; warn: string }

/** "Your goal": what to solve for and the target, the withdrawal rate, and
    the tax rate (typed in, or worked out from the accounts when they're
    split), with the warning when the goal can't be paid. */
export function GoalFields({ ids, s, set, split, calcRate, pay, wdTip, nonNegTarget }: {
  ids: GoalIds; s: Record<GoalKey, string>; set: (k: GoalKey) => (v: string) => void; split: boolean; calcRate: number | null;
  pay: ReturnType<typeof payCheck>; wdTip?: boolean; nonNegTarget?: boolean;
}) {
  const { noPay, payWarn, badWd, badTax } = pay;
  return (
    <>
      <GroupHead>Your goal</GroupHead>
      <div className="two bottomalign">
        <SelectField id={ids.solveFor} label="Solve for" value={s.solveFor} onChange={set("solveFor")}>
          <option value="After-Tax Withdrawal">After-tax income</option>
          <option value="Portfolio Value">Portfolio value</option>
        </SelectField>
        <Field id={ids.target} label="Target, inflation adjusted">
          <Affixed prefix="$"><MoneyInput id={ids.target} nonNeg={nonNegTarget} value={s.target} onValueChange={set("target")} /></Affixed>
        </Field>
      </div>
      <div className="two bottomalign max-sm:grid-cols-2">
        <NumberField id={ids.withdrawal} label={wdTip ? <Tipped text="Withdrawal rate" k="withdrawal" /> : "Withdrawal rate"} unit="%" value={s.withdrawal} onValueChange={set("withdrawal")}
          aria-invalid={badWd || undefined} aria-describedby={badWd ? ids.warn + "Text" : undefined} />
        <NumberField id={ids.taxRate} wrapId={ids.taxRateWrap} hidden={split} label={<Tipped text="Effective tax rate" k="efftaxrate" />} unit="%" value={s.taxRate} onValueChange={set("taxRate")}
          aria-invalid={badTax || undefined} aria-describedby={badTax ? ids.warn + "Text" : undefined} />
        <div className="field" id={ids.calc} hidden={!split}>
          <Label className="mb-1.5"><span><Tipped text="Tax on withdrawals" k="actax" /></span></Label>
          <Affixed suffix="calc">
            <InputGroupInput variant="numeric" id={ids.calcOut} type="text" readOnly tabIndex={-1} aria-label="Tax on withdrawals, calculated" value={calcRate != null ? pctStr(calcRate, 1) : ""} /></Affixed>
        </div>
      </div>
      <div className="-mt-1 mb-1 flex items-start gap-2 text-note text-destructive" id={ids.warn} hidden={!noPay}>
        <CircleAlertIcon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
        <span id={ids.warn + "Text"} role="alert">{payWarn}</span>
      </div>
    </>
  );
}

/** One row of the year-by-year table. */
export interface YearRow { key: number; when: React.ReactNode; stage?: React.ReactNode; start: number; contrib: number; growth: number; end: number; real: number }

/** "Year by year", folded: start, contributions, growth and end for each
    year, and the end in today's dollars, with a CSV of it. `when` heads the
    first column (Year, or Age where your age is known); `stage` adds the
    Stage column. */
export function YearTable({ id, when, stage, rows, hidden }: { id: string; when: string; stage?: boolean; rows: YearRow[]; hidden?: boolean }) {
  const ref = useRef<HTMLTableElement>(null);
  return (
    <Collapsible className="min-w-0" hidden={hidden} render={<Card />}>
      <CardHeader>
        <CardTitle><CollapsibleTrigger>Year by year<ChevronDownIcon aria-hidden="true" /></CollapsibleTrigger></CardTitle>
        <CardAction><CsvButton table={ref} label="Year by year" /></CardAction>
      </CardHeader>
      <CollapsibleContent keepMounted>
        <div className="swipehint">Swipe the table sideways to see every column.</div>
        <div className="scroll" tabIndex={0} role="region" aria-label="Year by year">
          <table id={id} ref={ref}>
            <thead><tr><th>{when}</th>{stage ? <th>Stage</th> : null}<th>Start balance</th><th>Contributions</th><th>Growth</th><th>End balance</th><th>Inflation adj.</th></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.key}><td>{r.when}</td>{stage ? <td>{r.stage}</td> : null}<td>{money(r.start)}</td><td>{money(r.contrib)}</td><td className="pos">{money(r.growth)}</td>
                  <td>{money(r.end)}</td><td>{money(r.real)}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
