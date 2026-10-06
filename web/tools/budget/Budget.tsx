"use client";

/* Budget: income against grouped spending lines, what's left, and an
   emergency fund target. Ported from src/js/app/13-budget.js and
   src/main/20-budget.html. */

import { useRef } from "react";
import { useHouseholdFill } from "@/components/household/HouseholdProvider";
import { Affixed } from "@/components/fields/Field";
import { MoneyInput, NumberInput } from "@/components/fields/NumberInput";
import { usePopup } from "@/components/shell/Popup";
import { useToast } from "@/components/shell/Toast";
import { Tipped, TipDot } from "@/components/shell/Tooltips";
import { toolInputs, useToolState } from "@/components/tools/ToolState";
import { CsvButton } from "@/components/common/CsvButton";
import { Figure, Segmented } from "@/components/common/Readout";
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
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";


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
  const sign = leftYr < 0 ? "v neg" : "v pos";

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
    <div className="stack" id="tab-budget">
      <Card size="flush">
        <div className="headline">
          <Figure label="Income, after taxes" id="bgIncome" value={money(incomeYr)} noteId="bgIncomeNote" note="Per year" />
          <Figure label="Total spending" id="bgSpent" value={money(spentYr)} noteId="bgSpentNote" note="Per year" />
          <Figure label="Left over" id="bgLeft" className={sign} value={money(leftYr)} noteId="bgLeftNote"
            note={incomeYr > 0 ? (leftYr < 0 ? "Over budget by " : "") + pctStr(Math.abs(pct), 1) + (leftYr < 0 ? " of income" : " of income left") : "Enter your income to begin"} />
        </div>
        <CardContent>
          <div className="bgincome">
            <Label className="mb-1.5" htmlFor="bgIncomeIn"><span><Tipped text="Income after taxes" k="bgincome" /></span></Label>
            <div className="bgincome-row">
              <Affixed prefix="$" className="flex-auto basis-35"><MoneyInput id="bgIncomeIn" nonNeg value={s.income} onValueChange={set("income")} /></Affixed>{" "}
              <Segmented id="bgIncomeFreq" size="compact" attr="data-freq" options={[[1, "/yr"], [12, "/mo"]] as const} value={s.incomeFreq} onChange={set("incomeFreq")} />{" "}
              <Button variant="outline" id="bgCopyTax"
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
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Your budget</CardTitle><CardAction><CsvButton id="bgCsv" label="budget" title="Download your budget as a CSV" rows={csvRows} filename="retcalc-budget.csv" /></CardAction></CardHeader>
        <CardContent>
          <div id="bgList" ref={listRef}>
            {groups.map((g) => (
              <div className="bggroup" key={g.name}>
                <div className="bggroup-h">{g.name || "Custom"}</div>
                {g.rows.map(({ r, i }) => (
                  <div className="bgrow" key={i}>
                    {r.custom ? (
                      <div className="desc"><Input data-f="desc" data-i={i} value={r.desc} placeholder="Description" aria-label="Item name" onChange={(e) => setRow(i, { desc: e.target.value })} /></div>
                    ) : isSavingsRow(r) ? (
                      <span className="desc"><Tipped text={r.desc} k="bgsavings" /></span>
                    ) : (
                      /* A preset's name is renamed in place: a click selects it to
                         type over, Enter commits, and a blank name falls back to
                         the slot's own. */
                      <span key={r.desc} className="desc" contentEditable suppressContentEditableWarning spellCheck={false} title="Click to rename" aria-label="Item name"
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
                    )}
                    <Affixed prefix="$" className="w-32.5 flex-none sm:w-35"><MoneyInput nonNeg data-f="amount" data-i={i} value={r.amount} onValueChange={(v) => setRow(i, { amount: v })} aria-label={r.desc + " amount"} /></Affixed>
                    <Segmented size="compact" attr="data-fv" options={[[12, "/mo"], [1, "/yr"]] as const} value={r.freq} onChange={(f) => setRow(i, { freq: f })} />
                    {r.custom ? (
                      <Button variant="ghost" size="icon-sm" title="Remove" aria-label="Remove" onClick={() => setState((c) => ({ ...c, rows: c.rows.filter((_, j) => j !== i) }))}>{"×"}</Button>
                    ) : <span className="delspace"></span>}
                  </div>
                ))}
              </div>
            ))}
          </div>
          <Button variant="outline" className="mt-1.5" id="bgAdd"
            onClick={() => {
              setState((c) => ({ ...c, rows: [...c.rows, { group: "Custom", desc: "", amount: "0", freq: 12, custom: true }] }));
              focusLast(listRef, "input.desc");
            }}>Add custom item</Button>
          <div className="hint mt-2.5">Pull a number in from another tool:</div>
          <div className="flex gap-2 flex-wrap mt-1.5">
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
              }}>+ Retirement contribution</Button>
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
              }}>+ College savings</Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <div className="kv total text-body"><span className="k">Total spending, per year</span><span className="v" id="bgTotYr">{money(spentYr)}</span></div>
          <div className="kv total text-body"><span className="k">Total spending, per month</span><span className="v" id="bgTotMo">{money(spentYr / 12)}</span></div>
          <div className="kv total text-body" id="bgSaveRow" hidden={!(savedYr > 0)}><span className="k">Total saving, per month</span><span className="v" id="bgSaveMo">{savedYr > 0 ? money(savedYr / 12) : ""}</span></div>
          <div className="kv total text-body-lg"><span className="k">Left over, per year</span><span className={sign} id="bgLeftYr">{money(leftYr)}</span></div>
          <div className="kv total text-body-lg"><span className="k">Left over, per month</span><span className={sign} id="bgLeftMo">{money(leftYr / 12)}</span></div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>Emergency fund<TipDot k="emergency" /></CardTitle></CardHeader>
        <CardContent>
          <div className="efrow">
            <span>Target for</span>{" "}
            <Affixed suffix="mo" className="w-18"><NumberInput id="efMonths" nonNeg max={36} value={s.efMonths} onValueChange={set("efMonths")} /></Affixed>{" "}
            <span>of monthly expenses</span>
          </div>
          <div className="kv total mt-3"><span className="k" id="efLabel">{ef}-month emergency fund</span><span className="v gold" id="efTarget">{money(efTarget)}</span></div>
        </CardContent>
      </Card>
    </div>
  );
}

