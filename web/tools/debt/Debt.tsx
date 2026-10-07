"use client";

/* Debt Payoff: avalanche against snowball against minimums only, with the
   payoff order and the month-by-month schedule. Ported from
   src/js/app/18-debt.js and src/main/15-debt.html.

   Laid out in Basic's thirds (the Debt critique, 2026-10-06): the debts and
   the plan in the left third, sticky from 1024px; the results in the two
   thirds, answer first. The debt-free date is the hero reading, with total
   interest and the saving against minimums beside it; the avalanche /
   snowball race comes next, its verdict leading the comparison. On a phone
   a compact reading leads and stays pinned while the debts are in view. */

import { useRef } from "react";
import { CheckIcon, ChevronDownIcon, CircleAlertIcon, CircleCheckIcon, InfoIcon, PlusIcon, TriangleAlertIcon, XIcon } from "lucide-react";
import { BandChart } from "@/components/charts/BandChart";
import { Legend } from "@/components/charts/Legend";
import { Affixed } from "@/components/fields/Field";
import { MoneyInput, NumberInput } from "@/components/fields/NumberInput";
import { useToast } from "@/components/shell/Toast";
import { Tipped } from "@/components/shell/Tooltips";
import { toolInputs, useToolState } from "@/components/tools/ToolState";
import { Segmented } from "@/components/common/Readout";
import { HeroReading, PinnedReading, type HeroTone } from "@/components/common/Reading";
import { CsvButton } from "@/components/common/CsvButton";
import { DEBT_CAP, debtDate as debtDateOn, debtDur, debtUnderwater } from "@/lib/engine/typed";
import type { DebtResult } from "@/lib/engine/types";
import { DASH, fmtNum, groupDigits, money, parseNum, pctStr } from "@/lib/format";
import { useClient } from "@/lib/useClient";
import { cn } from "@/lib/utils";
import { BUDGET_DEFAULTS, budgetTotals } from "@/tools/budget/model";
import { DEBT_DEF, debtCompute, debtList, type DebtRow } from "./model";
import { useShareKit } from "@/components/shell/share";
import { debtShare } from "./share";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { SERIES } from "@/lib/hues";

function GroupHead({ children }: { children: React.ReactNode }) {
  return <h3 className="m-0 mt-4 mb-3 border-t border-border pt-4 text-sm font-semibold">{children}</h3>;
}

/** A field's label inside a debt's card. */
function RowLabel({ htmlFor, children }: { htmlFor: string; children: React.ReactNode }) {
  return <Label className="mb-1" htmlFor={htmlFor}><span>{children}</span></Label>;
}

/** A line under a debt's fields: a problem (Loss, with an icon) or a hint. */
function RowNote({ id, warn, children }: { id?: string; warn?: boolean; children: React.ReactNode }) {
  return (
    <div className={cn("mt-1.5 flex items-start gap-2 text-note", warn ? "text-destructive" : "text-muted-foreground")}>
      {warn ? <CircleAlertIcon className="mt-0.5 size-4 shrink-0" aria-hidden="true" /> : <InfoIcon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />}
      <span id={id}>{children}</span>
    </div>
  );
}

export function Debt() {
  const { state: s, set, setState } = useToolState(DEBT_DEF);
  useShareKit(DEBT_DEF.id, debtShare(s));
  const toast = useToast();
  const client = useClient();
  // Dates count from today, so they're filled in once in the browser.
  const debtDate = (m: number) => (client ? debtDateOn(m) : "");
  const listRef = useRef<HTMLDivElement>(null);
  const compareRef = useRef<HTMLTableElement>(null), orderRef = useRef<HTMLTableElement>(null), schedRef = useRef<HTMLTableElement>(null);

  const setRow = (i: number, k: keyof DebtRow) => (v: string) =>
    setState((cur) => ({ ...cur, rows: cur.rows.map((r, j) => (j === i ? { ...r, [k]: v } : r)) }));

  const { extra, live, plan } = debtCompute(s);
  // Which rows the warning names, to mark their Minimum field: the same
  // test the warning uses, one debt at a time.
  const underwater = debtList(s.rows).map((d) => debtUnderwater([d]).length > 0);

  let head = { free: DASH, freeNote: "Add a debt to start", interest: DASH, interestNote: "", saved: DASH, savedPos: true, savedNote: "" };
  let body: React.ReactNode = null;
  let warn: string[] = [];
  let verdict = "";
  let tone: HeroTone = "text";
  let cmpRows: React.ReactNode = null, orderRows: React.ReactNode = null, schedRows: React.ReactNode = null;

  if (plan) {
    const { av, sn, mn, pick, saved, sooner, borrowed, dInt, dMon, dFirst, rate, bump } = plan;
    warn = plan.warn;
    head = {
      free: pick.stalled ? "Never" : debtDate(pick.monthsTotal),
      freeNote: pick.stalled ? "Payments never clear the balance" : debtDur(pick.monthsTotal) + " from now",
      interest: money(pick.totalInterest),
      interestNote: "on " + money(borrowed) + " borrowed, " + money(pick.totalPaid) + " paid in all",
      // Minimums that never clear have no total to compare against.
      saved: mn.stalled ? DASH : money(Math.max(0, saved)),
      savedPos: !mn.stalled && saved > 0,
      savedNote: mn.stalled ? "Minimums alone never clear it" : sooner > 0 ? debtDur(sooner) + " sooner" : "Same as minimums",
    };
    // Amber marks the answer; a plan that never clears has no date to
    // mark, so "Never" stays in Text (its words unchanged; see
    // REDESIGN_NOTES, the stalled-plan entry).
    tone = pick.stalled ? "text" : "answer";

    // The verdict: the real trade-off between the two orderings.
    if (Math.abs(dInt) < 1 && dMon === 0) {
      verdict = "With these debts the two orderings land in the same place; pick whichever you'll actually stick to.";
    } else {
      verdict = "Avalanche costs " + money(Math.abs(dInt)) + " less in interest" + (dMon > 0 ? " and finishes " + debtDur(dMon) + " sooner" : "") + ". ";
      verdict += dFirst < 0
        ? "Snowball clears your first debt " + debtDur(-dFirst) + " earlier. That early win is the whole argument for it, and here it costs " + money(Math.abs(dInt)) + "."
        : "Snowball offers nothing in return here: it clears the first debt no sooner.";
    }
    verdict += " Your blended rate is " + pctStr(rate / 100, 1) + " across " + live.length + (live.length === 1 ? " debt" : " debts") +
      ", and you're putting " + money(pick.monthlyPool, 0) + " a month at it.";
    // An extra dollar a month is the most underrated lever in the whole thing.
    if (bump && !bump.stalled && !pick.stalled && bump.monthsTotal < pick.monthsTotal)
      verdict += " Another $100 a month would clear it " + debtDur(pick.monthsTotal - bump.monthsTotal) + " sooner and save " +
        money(pick.totalInterest - bump.totalInterest) + " more.";

    /* The race: your approach marked with a check and Text weight (not
       amber), minimums only quieter, as the reference both are run against. */
    cmpRows = ([["Avalanche, highest rate first", av], ["Snowball, smallest balance first", sn], ["Minimums only, no extra", mn]] as const).map(([label, R]) => (
      <tr key={label} className={R === pick ? "font-medium text-foreground" : R === mn ? "text-muted-foreground" : undefined}>
        <td>
          <span className="inline-flex items-center gap-1.5">
            {label}
            {R === pick ? <CheckIcon className="size-3.5 shrink-0" role="img" aria-label="Your plan" /> : null}
          </span>
        </td>
        {/* Figures stay on one line; on a phone the table scrolls instead. */}
        <td className="whitespace-nowrap">{R.stalled ? "Never" : debtDate(R.monthsTotal)}</td><td className="whitespace-nowrap">{R.stalled ? DASH : debtDur(R.monthsTotal)}</td>
        <td className="whitespace-nowrap">{R === mn && mn.stalled ? "Keeps growing" : money(R.totalInterest)}</td>
        <td className="whitespace-nowrap">{R.firstCleared ? debtDur(R.firstCleared) : DASH}</td>
      </tr>
    ));
    orderRows = pick.order.map((d, i) => (
      <tr key={i}>
        <td>{i + 1}</td><td className="text-left">{d.desc}</td><td>{money(d.start)}</td><td>{pctStr(d.apr, 2)}</td><td>{money(d.min)}</td>
        <td>{money(d.interest)}</td><td>{d.paidMonth ? debtDate(d.paidMonth) : "Not cleared"}</td>
      </tr>
    ));
    // The schedule, thinned so a long plan stays scannable.
    const step = pick.months.length <= 30 ? 1 : pick.months.length <= 72 ? 3 : 6;
    schedRows = pick.months
      .filter((_, i) => i === 0 || i === pick.months.length - 1 || i % step === 0)
      .map((x) => (
        <tr key={x.m}><td>{x.m}</td><td>{debtDate(x.m)}</td><td>{money(x.balance)}</td><td>{money(x.interest)}</td><td>{x.cleared + " of " + live.length}</td></tr>
      ));

    // Minimums that never clear are drawn over the plan's own span: run to
    // the 60-year cap, their growth would flatten everything else.
    const span = mn.stalled ? pick.months.length : Math.max(pick.months.length, Math.min(mn.months.length, DEBT_CAP));
    const at = (R: DebtResult, m: number) => (m >= R.months.length ? 0 : R.months[Math.min(m, R.months.length - 1)].balance);
    const pts = [];
    for (let m = 0; m < span; m++) pts.push({ year: m, base: at(pick, m), hi: at(mn, m), lo: Math.min(at(pick, m), at(mn, m)) });
    /* On screen the plan's line (and its arrowhead) ends where the plan
       does, and the axis counts years; the printed summary copies this
       chart, so the original line and month ticks stay for it. */
    body = (
      <>
        <BandChart id="DT" pts={pts} maxX={span - 1} enhanced ariaLabel="Balance over time"
          screenOnly={{ yearTicks: true, noLoLine: true, baseEnd: pick.stalled ? undefined : pick.months.length - 1 }}
          tip={(b) => (
            <>
              <b>Month {fmtNum(b.year)}</b> <span className="n">{debtDate(b.year)}</span>
              <br /><i className="tipsw bg-series-plan"></i>Your plan <span className="n">{money(b.base)}</span>
              <br /><i className="tipsw bg-series-teal"></i>Minimums <span className="n">{money(b.hi!)}</span>
            </>
          )} />
        <Legend id="legendDT" items={[[SERIES.plan, s.mode === "snowball" ? "Snowball" : "Avalanche"], [SERIES.teal, "Minimums only"]]} />
      </>
    );
  }

  const removable = s.rows.length > 1;

  return (
    <div className="col-span-full grid grid-cols-1 items-start gap-5 max-sm:gap-3.5 lg:grid-cols-3" id="tab-debt">
      <div className="min-w-0 lg:col-span-1 lg:self-stretch">
        {/* Phones and narrow screens: the answer leads, and stays under the
            tab rail while the debts are on screen. */}
        <PinnedReading tone={tone} main={{ label: "Debt-free", value: head.free }} side={{ label: "Total interest", value: head.interest }} />

        <aside id="asideDebt" className="max-lg:static max-lg:max-h-none max-lg:overflow-visible">
          <Card>
            <CardHeader>
              <CardTitle>Your debts</CardTitle>
              <CardDescription>What you owe, at what rate, and the least you pay on each.</CardDescription>
            </CardHeader>
            <CardContent>
              <div id="dtList" ref={listRef} className="@container">
                {s.rows.map((r, i) => {
                  const name = r.desc.trim() || "this debt";
                  const first = i === 0;
                  const minWarn = "dtMinWarn" + i;
                  const under = underwater[i];
                  const unset = !(parseNum(r.balance) > 0);
                  return (
                    <div className="dtrow border-t border-border pt-3.5 pb-3 first:border-t-0 first:pt-0" key={i}>
                      <div className="desc flex items-center gap-2">
                        <Input data-f="desc" data-i={i} value={r.desc} placeholder="Name" aria-label="Debt name"
                          onChange={(e) => setRow(i, "desc")(e.target.value)} />
                        {removable ? (
                          <Button variant="ghost" size="icon" className="-mr-1.5" title={"Remove " + name} aria-label={"Remove " + name}
                            onClick={() => setState((c) => ({ ...c, rows: c.rows.filter((_, j) => j !== i) }))}><XIcon aria-hidden="true" /></Button>
                        ) : null}
                      </div>
                      <div className="mt-2.5 grid grid-cols-2 items-end gap-2 @xs:grid-cols-3">
                        <div className="c1 col-span-2 min-w-0 @xs:col-span-1">
                          <RowLabel htmlFor={"dtBal" + i}>Balance</RowLabel>
                          <Affixed prefix="$"><MoneyInput id={"dtBal" + i} nonNeg data-f="balance" data-i={i} value={r.balance} onValueChange={setRow(i, "balance")} aria-label={name + " balance"} /></Affixed>
                        </div>
                        <div className="c2 min-w-0">
                          <RowLabel htmlFor={"dtApr" + i}>{first ? <Tipped text="Rate" k="dtrate" /> : "Rate"}</RowLabel>
                          <Affixed suffix="%"><NumberInput id={"dtApr" + i} nonNeg step={0.1} data-f="apr" data-i={i} value={r.apr} onValueChange={setRow(i, "apr")} aria-label={name + " rate"} /></Affixed>
                        </div>
                        <div className="c3 min-w-0">
                          <RowLabel htmlFor={"dtMin" + i}>{first ? <Tipped text="Minimum" k="dtmin" /> : "Minimum"}</RowLabel>
                          <Affixed prefix="$"><MoneyInput id={"dtMin" + i} nonNeg data-f="min" data-i={i} value={r.min} onValueChange={setRow(i, "min")} aria-label={name + " minimum payment"}
                            aria-invalid={under || undefined} aria-describedby={under ? minWarn : undefined} /></Affixed>
                        </div>
                      </div>
                      {under ? <RowNote id={minWarn} warn>This minimum doesn&apos;t cover a month&apos;s interest.</RowNote> : null}
                      {unset ? <RowNote>Not counted until it has a balance.</RowNote> : null}
                    </div>
                  );
                })}
              </div>
              <Button variant="outline" className="mt-1" id="dtAdd"
                onClick={() => {
                  setState((c) => ({ ...c, rows: [...c.rows, { desc: "New debt", balance: "0", apr: "0", min: "0" }] }));
                  // Once it's drawn, the new debt's name, selected to type over.
                  setTimeout(() => {
                    const el = [...(listRef.current?.querySelectorAll<HTMLInputElement>(".dtrow .desc input") ?? [])].pop();
                    el?.focus();
                    el?.select();
                  }, 0);
                }}><PlusIcon aria-hidden="true" />Add a debt</Button>

              <GroupHead>Your plan</GroupHead>
              <Label className="mb-1.5" htmlFor="dtExtra"><span>Extra payment, on top of the minimums</span></Label>
              <div className="flex flex-wrap items-center gap-2">
                <Affixed prefix="$" suffix="/mo" className="flex-auto basis-35"><MoneyInput id="dtExtra" nonNeg value={s.extra} onValueChange={set("extra")} /></Affixed>
                <Button variant="outline" id="dtCopyBudget"
                  onClick={() => {
                    const leftMo = budgetTotals(toolInputs("budget", BUDGET_DEFAULTS)).leftYr / 12;
                    if (!(leftMo > 0)) {
                      toast("No money left over in the budget to put at debt");
                      return;
                    }
                    setState((c) => ({ ...c, extra: groupDigits(leftMo.toFixed(0), true) }));
                    toast("Using " + money(leftMo, 0) + "/mo left over from your budget");
                  }}>Copy from Budget</Button>
              </div>
              <div className="mt-4">
                <Segmented id="segDT" size="fill" attr="data-dt" options={[["avalanche", "Avalanche"], ["snowball", "Snowball"]] as const} value={s.mode} onChange={set("mode")} />
                <p className="hint mx-0 mt-2 mb-0" id="dtStratNote">
                  {s.mode === "snowball" ? "Smallest balance first: quicker wins, usually more interest." : "Highest rate first: mathematically cheapest."}
                </p>
              </div>
            </CardContent>
          </Card>
        </aside>
      </div>

      <div className="stack min-w-0 lg:col-span-2">
        <Card size="flush" className="min-w-0" id="dtReading">
          <HeroReading tone={tone} sized={!!plan}
            hero={{ label: "Debt-free", id: "dtFree", value: head.free, noteId: "dtFreeNote", note: head.freeNote }}
            figures={[
              { label: "Total interest", id: "dtInterest", value: head.interest, noteId: "dtInterestNote",
                note: head.interestNote ? <span className="block max-w-60">{head.interestNote}</span> : "" },
              { label: <Tipped text="Saved vs. minimums" k="dtsaved" />, id: "dtSaved", value: head.saved, noteId: "dtSavedNote", tone: head.savedPos ? "gain" : undefined,
                // A real saving: Gain, with a check before its note (the Never Alone Rule).
                note: head.savedPos ? (
                  <span className="inline-flex items-center gap-1.5">
                    <CircleCheckIcon className="size-3.5 shrink-0 text-gain" aria-hidden="true" />
                    <span>{head.savedNote}</span>
                  </span>
                ) : head.savedNote },
            ]} />
          {/* A minimum below a month's interest: the Minimum fields are
              marked in the inputs, and this says what it does to the plan. */}
          <div className="px-5.5 pb-5 max-sm:px-4" hidden={!warn.length}>
            <Alert variant="warning" role="note">
              <TriangleAlertIcon aria-hidden="true" />
              <AlertDescription>
                <div id="dtWarn" className="text-body text-pretty" hidden={!warn.length}>
                  {warn.length ? (
                    <><b>{warn.join(", ")}</b>: the minimum doesn&apos;t cover one month of interest, so that balance grows on its own. The payoff below only works because {extra > 0 ? "of the extra payment" : "each cleared debt's minimum rolls over to the next"}; check the minimum you entered.</>
                  ) : null}
                </div>
              </AlertDescription>
            </Alert>
          </div>
        </Card>

        {/* With nothing owed the reading says so, and what follows folds
            away (kept in the page, empty, for the help tour and e2e). */}
        <Card className="min-w-0" hidden={!plan}>
          <CardHeader>
            <CardTitle>Avalanche vs. snowball</CardTitle>
            <CardDescription>Same money, different order.</CardDescription>
            <CardAction><CsvButton table={compareRef} label="Avalanche vs. snowball" /></CardAction>
          </CardHeader>
          <CardContent>
            <div id="dtVerdict">{verdict ? <p className="m-0 mb-3.5 max-w-copy text-body text-foreground">{verdict}</p> : null}</div>
          </CardContent>
          <div className="scroll">
            <table id="dtCompare" ref={compareRef}>
              <thead><tr><th>Approach</th><th>Debt-free</th><th>How long</th><th>Total interest</th><th>First debt gone</th></tr></thead>
              <tbody>{cmpRows}</tbody>
            </table>
          </div>
        </Card>

        <Card className="min-w-0" hidden={!plan}>
          <CardHeader><CardTitle>What you owe, month by month</CardTitle><CardDescription>Years from now along the bottom.</CardDescription></CardHeader>
          {body ?? <><BandChart id="DT" pts={[]} maxX={0} ariaLabel="Balance over time" tip={() => null} /><Legend id="legendDT" items={[]} /></>}
        </Card>

        <Card className="min-w-0" hidden={!plan}>
          <CardHeader><CardTitle>Payoff order</CardTitle><CardAction><CsvButton table={orderRef} label="Payoff order" /></CardAction></CardHeader>
          <div className="swipehint">Swipe the table sideways to see every column.</div>
          <div className="scroll">
            <table id="dtOrder" ref={orderRef}>
              <thead><tr><th>#</th><th className="text-left">Debt</th><th>Balance</th><th>Rate</th><th>Minimum</th><th>Interest paid</th><th>Cleared</th></tr></thead>
              <tbody>{orderRows}</tbody>
            </table>
          </div>
        </Card>

        <div className="min-w-0" hidden={!plan}>
          <Collapsible render={<Card />}>
            <CardHeader>
              <CardTitle><CollapsibleTrigger>The schedule<ChevronDownIcon aria-hidden="true" /></CollapsibleTrigger></CardTitle>
              <CardAction><CsvButton table={schedRef} label="The schedule" /></CardAction>
            </CardHeader>
            <CollapsibleContent keepMounted>
              <div className="swipehint">Swipe the table sideways to see every column.</div>
              <div className="scroll">
                <table id="dtSched" ref={schedRef}>
                  <thead><tr><th>Month</th><th>Date</th><th>Balance</th><th>Interest to date</th><th>Debts cleared</th></tr></thead>
                  <tbody>{schedRows}</tbody>
                </table>
              </div>
            </CollapsibleContent>
          </Collapsible>
        </div>
      </div>
    </div>
  );
}
