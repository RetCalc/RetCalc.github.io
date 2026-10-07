"use client";

/* Budget: income against grouped spending lines, what's left, and an
   emergency fund target. Ported from src/js/app/13-budget.js and
   src/main/20-budget.html.

   Laid out as a ledger and its reading (the Budget critique, 2026-10-06):
   the lines take the wide two thirds on the left, and the reading (Left
   over as the one large figure, what the income is split into, and the
   emergency fund) stays beside them, sticky, so every amount typed shows
   its effect. On a phone a compact reading leads and stays pinned under
   the tab rail while the lines are in view. */

import { useRef } from "react";
import { PencilIcon, PlusIcon, TrendingDownIcon, XIcon } from "lucide-react";
import { useHouseholdFill } from "@/components/household/HouseholdProvider";
import { Affixed } from "@/components/fields/Field";
import { MoneyInput, NumberInput } from "@/components/fields/NumberInput";
import { usePopup } from "@/components/shell/Popup";
import { useToast } from "@/components/shell/Toast";
import { Tipped, TipDot } from "@/components/shell/Tooltips";
import { toolInputs, useToolState } from "@/components/tools/ToolState";
import { CsvButton } from "@/components/common/CsvButton";
import { Segmented } from "@/components/common/Readout";
import { CompositionBar, HeroReading, PartKey, PinnedReading } from "@/components/common/Reading";
import { focusLast } from "@/lib/dom";
import { dollarsField, groupDigits, money, parseNum, pctStr } from "@/lib/format";
import { retirementContribs } from "@/lib/retirement-contribs";
import { COLLEGE_DEFAULTS, collegeInput, collegeMonthly } from "@/tools/college/model";
import { TAX_DEFAULTS, runTax, taxInput } from "@/tools/tax/model";
import { BUDGET_DEF, PRESET_DESCS, budgetCompute, budgetHouseholdNet, isSavingsRow, type BudgetRow } from "./model";
import { useShareKit } from "@/components/shell/share";
import { budgetShare } from "./share";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";


export function Budget() {
  const { state: s, set, setState } = useToolState(BUDGET_DEF);
  useShareKit(BUDGET_DEF.id, budgetShare(s));
  const toast = useToast();
  const showPopup = usePopup();
  const listRef = useRef<HTMLDivElement>(null);
  const setRow = (i: number, patch: Partial<BudgetRow>) =>
    setState((c) => ({ ...c, rows: c.rows.map((r, j) => (j === i ? { ...r, ...patch } : r)) }));

  // The household's income, as take-home pay under the same 2026 rules the
  // Income Tax tool uses, before any retirement saving.
  useHouseholdFill("budget", (h) => {
    const net = budgetHouseholdNet(h, () => toolInputs("tax", TAX_DEFAULTS).state);
    if (net == null) return;
    setState((c) => ({ ...c, income: dollarsField(net / c.incomeFreq) }));
  });

  /* Another tool sending a line in: update a row with the same name rather
     than adding a second one. */
  const upsert = (desc: string, monthly: number) =>
    setState((c) => {
      const i = c.rows.findIndex((r) => r.desc === desc);
      const amount = groupDigits(monthly, true);
      return i >= 0
        ? { ...c, rows: c.rows.map((r, j) => (j === i ? { ...r, amount, freq: 12 } : r)) }
        : { ...c, rows: [...c.rows, { group: "Custom", desc, amount, freq: 12, custom: true }] };
    });

  const { incomeYr, spentYr, savedYr, leftYr, pct, ef, efTarget } = budgetCompute(s);
  // The answer's tone: amber while something is left over; over budget it
  // reads as a loss, with a glyph and the words; with no income yet there's
  // no answer to mark, so the figure stays in Text.
  const empty = !(incomeYr > 0), over = !empty && leftYr < 0;
  const tone = empty ? "text" : over ? "loss" : "answer";
  const leftLabel = over ? "Over budget, per year" : "Left over, per year";
  const leftNote = incomeYr > 0 ? (leftYr < 0 ? "Over budget by " : "") + pctStr(Math.abs(pct), 1) + (leftYr < 0 ? " of income" : " of income left") : "Enter your income to begin";
  const vCls = leftYr < 0 ? "v neg" : "v";
  // What the income is split into, as shares of one bar: spending, saving
  // and what's left. Over budget the bar is spending and saving only.
  const whole = Math.max(incomeYr, spentYr + savedYr);
  const parts = !empty && whole > 0 ? [spentYr / whole, savedYr / whole, Math.max(0, leftYr) / whole] : null;

  // Rows grouped as they come, keeping each row's place in the list.
  const groups: { name: string; rows: { r: BudgetRow; i: number }[] }[] = [];
  s.rows.forEach((r, i) => {
    let g = groups.find((x) => x.name === r.group);
    if (!g) groups.push((g = { name: r.group, rows: [] }));
    g.rows.push({ r, i });
  });

  /* The budget isn't a table, so its CSV is built here: each item with an
     amount, then income and the totals as labeled rows. */
  const csvRows = (): string[][] | null => {
    const period = (f: number) => (f === 12 ? "Per month" : "Per year");
    const income = parseNum(s.income);
    if (!(income > 0) && !(spentYr > 0) && !(savedYr > 0)) return null;
    const rows = [["Budget Item", "Amount", "Period"]];
    if (income > 0) rows.push(["Income after taxes", money(income), period(s.incomeFreq)]);
    for (const r of s.rows) if (parseNum(r.amount) > 0) rows.push([r.desc, money(parseNum(r.amount)), period(r.freq)]);
    rows.push(["Total spending", money(spentYr), "Per year"]);
    if (savedYr > 0) rows.push(["Total saving", money(savedYr), "Per year"]);
    rows.push(["Left over", money(leftYr), "Per year"]);
    return rows;
  };

  return (
    <div className="col-span-full grid grid-cols-1 items-start gap-5 max-sm:gap-3.5 lg:grid-cols-3" id="tab-budget">
      <div className="min-w-0 lg:col-span-2">
        {/* Phones and narrow screens: the answer leads, and stays under the
            tab rail while the lines are on screen. */}
        <PinnedReading tone={tone} main={{ label: leftLabel, value: money(leftYr) }} side={{ label: "Spending, per year", value: money(spentYr) }} />

        <Card>
          <CardHeader>
            <CardTitle>Your budget</CardTitle>
            <CardDescription>Enter what comes in and what goes out, each by the month or by the year.</CardDescription>
            <CardAction><CsvButton id="bgCsv" label="budget" title="Download your budget as a CSV" rows={csvRows} filename="retcalc-budget.csv" /></CardAction>
          </CardHeader>
          <CardContent>
            <div>
              <div className="bggroup-h bghead-first">Income</div>
              <Label className="mb-1.5" htmlFor="bgIncomeIn"><span><Tipped text="Income after taxes" k="bgincome" /></span></Label>
              <div className="flex flex-wrap items-center gap-2">
                <Affixed prefix="$" className="max-w-56 flex-auto basis-35"><MoneyInput id="bgIncomeIn" nonNeg value={s.income} onValueChange={set("income")} /></Affixed>
                <Segmented id="bgIncomeFreq" size="compact" attr="data-freq" options={[[1, "/yr"], [12, "/mo"]] as const} value={s.incomeFreq} onChange={set("incomeFreq")} />
                <Button variant="ghost" size="sm" id="bgCopyTax"
                  onClick={() => {
                    // Gross minus taxes only, not minus pre-tax savings: a 401(k)
                    // contribution is saving, entered again as its own line.
                    const R = runTax(taxInput(toolInputs("tax", TAX_DEFAULTS)));
                    const netPay = R.gross - R.total;
                    setState((c) => ({ ...c, income: groupDigits(netPay.toFixed(0), true), incomeFreq: 1 }));
                    toast("Copied net pay of " + money(netPay) + " from the tax tool");
                  }}>Copy from Income Tax</Button>
              </div>
            </div>

            <div id="bgList" ref={listRef}>
              {groups.map((g) => (
                <div className="bggroup" key={g.name}>
                  <div className="bggroup-h">{g.name || "Custom"}</div>
                  {g.rows.map(({ r, i }) => (
                    /* An empty line (no amount) shows its name and its 0 in
                       Muted, so the lines in use stand out; the 0 itself stays. */
                    <div className="bgrow" key={i} data-empty={parseNum(r.amount) > 0 ? undefined : ""}>
                      {r.custom ? (
                        <div className="desc"><Input data-f="desc" data-i={i} value={r.desc} placeholder="Description" aria-label="Item name" onChange={(e) => setRow(i, { desc: e.target.value })} /></div>
                      ) : isSavingsRow(r) ? (
                        <span className="desc"><Tipped text={r.desc} k="bgsavings" /></span>
                      ) : (
                        /* A preset's name is renamed in place: a click selects it to
                           type over, Enter commits, and a blank name falls back to
                           the slot's own. The pencil shows it can be. */
                        <span className="desc group/name">
                          <span key={r.desc} className="bgname" contentEditable suppressContentEditableWarning spellCheck={false} title="Click to rename" aria-label="Item name"
                            onFocus={(e) => {
                              const range = document.createRange();
                              range.selectNodeContents(e.currentTarget);
                              const sel = window.getSelection();
                              sel?.removeAllRanges();
                              sel?.addRange(range);
                            }}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                e.preventDefault();
                                e.currentTarget.blur();
                              }
                            }}
                            onBlur={(e) => {
                              const raw = (e.currentTarget.textContent ?? "").replace(/\s+/g, " ").trim().slice(0, 60);
                              setRow(i, { desc: raw || PRESET_DESCS[i] || r.desc });
                            }}>{r.desc}</span>
                          <PencilIcon className="ml-1.5 inline size-3 shrink-0 align-baseline text-muted-foreground opacity-0 transition-opacity group-hover/name:opacity-100 group-focus-within/name:opacity-100 pointer-coarse:opacity-70" aria-hidden="true" />
                        </span>
                      )}
                      <Affixed prefix="$" className="w-35 flex-none @max-md:w-auto @max-md:flex-1"><MoneyInput nonNeg data-f="amount" data-i={i} value={r.amount} onValueChange={(v) => setRow(i, { amount: v })} aria-label={r.desc + " amount"} /></Affixed>
                      <Segmented size="compact" attr="data-fv" options={[[12, "/mo"], [1, "/yr"]] as const} value={r.freq} onChange={(f) => setRow(i, { freq: f })} />
                      {r.custom ? (
                        <Button variant="ghost" size="icon-sm" title="Remove" aria-label="Remove" onClick={() => setState((c) => ({ ...c, rows: c.rows.filter((_, j) => j !== i) }))}><XIcon aria-hidden="true" /></Button>
                      ) : <span className="delspace"></span>}
                    </div>
                  ))}
                </div>
              ))}
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-border pt-4">
              <Button variant="outline" size="sm" id="bgAdd"
                onClick={() => {
                  setState((c) => ({ ...c, rows: [...c.rows, { group: "Custom", desc: "", amount: "0", freq: 12, custom: true }] }));
                  focusLast(listRef, "input[data-f=\"desc\"]");
                }}><PlusIcon data-icon="inline-start" aria-hidden="true" />Add custom item</Button>
            </div>
            <div className="hint mt-3.5">Pull a number in from another tool:</div>
            <div className="mt-1.5 flex flex-wrap gap-2">
              <Button variant="outline" size="sm" id="bgCopyRetire"
                onClick={async () => {
                  // Every plan that has a contribution is offered, with its
                  // monthly amount, rather than quietly picking one.
                  const sources = retirementContribs();
                  if (!sources.length) {
                    toast("Set a contribution amount in Basic, Advanced, or Stages first");
                    return;
                  }
                  const pick = sources.length === 1 ? 0
                    : await showPopup("Copy from which plan?", sources.map((x) => ({ label: x.label, desc: money(x.value) + "/mo", money: true })));
                  if (pick < 0) return;
                  const monthly = Math.round(sources[pick].value);
                  upsert("Retirement contribution", monthly);
                  toast("Added " + money(monthly) + "/mo from " + sources[pick].label);
                }}><PlusIcon data-icon="inline-start" aria-hidden="true" />Retirement contribution</Button>
              <Button variant="outline" size="sm" id="bgCopyCollege"
                onClick={() => {
                  const inp = collegeInput(toolInputs("college", COLLEGE_DEFAULTS));
                  if (!inp.kids.some((k) => k.annualCost > 0)) {
                    toast("Set up the College Savings tool first");
                    return;
                  }
                  const mo = collegeMonthly(inp);
                  if (!(mo > 0)) {
                    toast("No monthly amount needed there yet");
                    return;
                  }
                  upsert("College savings", Math.round(mo));
                  toast("Added " + money(Math.round(mo)) + "/mo from College Savings");
                }}><PlusIcon data-icon="inline-start" aria-hidden="true" />College savings</Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="min-w-0 lg:col-span-1 lg:self-stretch">
        <aside id="asideBudget" className="max-lg:static max-lg:max-h-none max-lg:overflow-visible">
          <Card size="flush" className="min-w-0">
            <HeroReading tone={tone} under
              hero={{
                label: leftLabel, id: "bgLeft", value: money(leftYr), noteId: "bgLeftNote",
                note: over ? (
                  <span className="inline-flex items-center gap-1.5">
                    <TrendingDownIcon className="size-3.5 shrink-0 text-destructive" aria-hidden="true" />
                    <span>{leftNote}</span>
                  </span>
                ) : leftNote,
              }}
              figures={[
                { label: "Income, after taxes", id: "bgIncome", value: money(incomeYr), noteId: "bgIncomeNote", note: "Per year" },
                { label: "Total spending", id: "bgSpent", value: money(spentYr), noteId: "bgSpentNote", note: "Per year" },
              ]} />

            <div className="border-t border-border px-5.5 pt-4 pb-3 max-sm:px-4">
              {parts ? (
                <CompositionBar parts={[{ share: parts[0], tone: "in" }, { share: parts[1], tone: "sky" }, { share: parts[2], tone: "answer" }]} />
              ) : null}
              <div className="kv"><span className="k"><PartKey tone="in" />Spending, per month</span><span className="v" id="bgTotMo">{money(spentYr / 12)}</span></div>
              <div className="kv" id="bgSaveRow" hidden={!(savedYr > 0)}><span className="k"><PartKey tone="sky" />Saving, per month</span><span className="v" id="bgSaveMo">{savedYr > 0 ? money(savedYr / 12) : ""}</span></div>
              <div className="kv"><span className="k">{over ? null : <PartKey tone="answer" />}{over ? "Over budget" : "Left over"}, per month</span><span className={vCls} id="bgLeftMo">{money(leftYr / 12)}</span></div>
              <div className="kv"><span className="k">Spending, per year</span><span className="v" id="bgTotYr">{money(spentYr)}</span></div>
              <div className="kv"><span className="k">{over ? "Over budget" : "Left over"}, per year</span><span className={vCls} id="bgLeftYr">{money(leftYr)}</span></div>
            </div>

            <div className="border-t border-border px-5.5 pt-4 pb-5 max-sm:px-4">
              <h3 className="m-0 flex items-center gap-2 text-body font-semibold">Emergency fund<TipDot k="emergency" /></h3>
              <div className="efrow mt-2.5">
                <span>Target for</span>{" "}
                <Affixed suffix="mo" className="w-18"><NumberInput id="efMonths" aria-label="Emergency fund target, months of expenses" nonNeg max={36} value={s.efMonths} onValueChange={set("efMonths")} /></Affixed>{" "}
                <span>of monthly expenses</span>
              </div>
              <div className="mt-3.5">
                <span className="block text-label text-muted-foreground" id="efLabel">{ef}-month emergency fund</span>
                <span className="block text-3xl leading-tight font-medium tabular-nums sm:text-display" id="efTarget">{money(efTarget)}</span>
              </div>
            </div>
          </Card>
        </aside>
      </div>
    </div>
  );
}
