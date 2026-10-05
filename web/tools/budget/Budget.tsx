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
import { CsvButton } from "@/components/ui/CsvButton";
import { Figure, Segmented } from "@/components/ui/Readout";
import { computeTax } from "@/lib/engine/typed";
import { focusLast } from "@/lib/dom";
import { groupDigits, money, parseNum, pctStr } from "@/lib/format";
import { retirementContribs } from "@/lib/retirement-contribs";
import { COLLEGE_DEFAULTS, collegeInput, collegeMonthly } from "@/tools/college/model";
import { TAX_DEFAULTS, runTax, taxInput } from "@/tools/tax/model";
import { BUDGET_DEF, PRESET_DESCS, budgetTotals, isSavingsRow, type BudgetRow } from "./model";


export function Budget() {
  const { state: s, set, setState } = useToolState(BUDGET_DEF);
  const toast = useToast();
  const showPopup = usePopup();
  const listRef = useRef<HTMLDivElement>(null);
  const setRow = (i: number, patch: Partial<BudgetRow>) =>
    setState((c) => ({ ...c, rows: c.rows.map((r, j) => (j === i ? { ...r, ...patch } : r)) }));

  // The household's income, as take-home pay under the same 2026 rules the
  // Income Tax tool uses, before any retirement saving.
  useHouseholdFill("budget", (h) => {
    const married = h.status === "m";
    const inc2 = married && h.income2 != null ? h.income2 : 0;
    if (h.income == null || !(h.income + inc2 > 0)) return;
    const T = computeTax({ status: married ? "m" : "s", gross: h.income, gross2: inc2, pre: 0, dedType: "std", item: 0,
      state: h.state || toolInputs("tax", TAX_DEFAULTS).state }) as { net: number };
    setState((c) => ({ ...c, income: groupDigits(Math.round(T.net / c.incomeFreq), true) }));
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

  const { incomeYr, spentYr, savedYr, leftYr } = budgetTotals(s);
  const pct = incomeYr > 0 ? leftYr / incomeYr : 0;
  const ef = Math.max(1, Math.round(parseNum(s.efMonths)) || 6);
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
      <div className="panel">
        <div className="headline">
          <Figure label="Income, after taxes" id="bgIncome" value={money(incomeYr)} noteId="bgIncomeNote" note="Per year" />
          <Figure label="Total spending" id="bgSpent" value={money(spentYr)} noteId="bgSpentNote" note="Per year" />
          <Figure label="Left over" id="bgLeft" className={sign} value={money(leftYr)} noteId="bgLeftNote"
            note={incomeYr > 0 ? (leftYr < 0 ? "Over budget by " : "") + pctStr(Math.abs(pct), 1) + (leftYr < 0 ? " of income" : " of income left") : "Enter your income to begin"} />
        </div>
        <div className="body">
          <div className="bgincome">
            <label htmlFor="bgIncomeIn"><Tipped text="Income after taxes" k="bgincome" /></label>
            <div className="bgincome-row">
              <Affixed prefix="$"><MoneyInput id="bgIncomeIn" nonNeg value={s.income} onValueChange={set("income")} /></Affixed>{" "}
              <Segmented id="bgIncomeFreq" className="seg bgseg" attr="data-freq" options={[[1, "/yr"], [12, "/mo"]] as const} value={s.incomeFreq} onChange={set("incomeFreq")} />{" "}
              <button className="btn" type="button" id="bgCopyTax"
                onClick={() => {
                  // Gross minus taxes only, not minus pre-tax savings: a 401(k)
                  // contribution is saving, entered again as its own line.
                  const R = runTax(taxInput(toolInputs("tax", TAX_DEFAULTS)));
                  const netPay = R.gross - R.total;
                  setState((c) => ({ ...c, income: groupDigits(netPay.toFixed(0), true), incomeFreq: 1 }));
                  toast("Copied net pay of " + money(netPay) + " from the tax tool");
                }}>Copy from Income Tax</button>
            </div>
          </div>
        </div>
      </div>

      <div className="panel">
        <h2>Your budget<span className="h2ctrl"><CsvButton id="bgCsv" label="budget" title="Download your budget as a CSV" rows={csvRows} filename="retcalc-budget.csv" /></span></h2>
        <div className="body">
          <div id="bgList" ref={listRef}>
            {groups.map((g) => (
              <div className="bggroup" key={g.name}>
                <div className="bggroup-h">{g.name || "Custom"}</div>
                {g.rows.map(({ r, i }) => (
                  <div className="bgrow" key={i}>
                    {r.custom ? (
                      <input className="desc" data-f="desc" data-i={i} value={r.desc} placeholder="Description" aria-label="Item name" onChange={(e) => setRow(i, { desc: e.target.value })} />
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
                    <Affixed prefix="$"><MoneyInput nonNeg data-f="amount" data-i={i} value={r.amount} onValueChange={(v) => setRow(i, { amount: v })} aria-label={r.desc + " amount"} /></Affixed>
                    <Segmented className="seg bgseg" attr="data-fv" options={[[12, "/mo"], [1, "/yr"]] as const} value={r.freq} onChange={(f) => setRow(i, { freq: f })} />
                    {r.custom ? (
                      <button className="del" type="button" title="Remove" aria-label="Remove" onClick={() => setState((c) => ({ ...c, rows: c.rows.filter((_, j) => j !== i) }))}>{"×"}</button>
                    ) : <span className="delspace"></span>}
                  </div>
                ))}
              </div>
            ))}
          </div>
          <button className="btn" type="button" id="bgAdd" style={{ marginTop: "6px" }}
            onClick={() => {
              setState((c) => ({ ...c, rows: [...c.rows, { group: "Custom", desc: "", amount: "0", freq: 12, custom: true }] }));
              focusLast(listRef, "input.desc");
            }}>Add custom item</button>
          <div className="hint" style={{ marginTop: "10px" }}>Pull a number in from another tool:</div>
          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginTop: "6px" }}>
            <button className="btn mini" type="button" id="bgCopyRetire"
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
              }}>+ Retirement contribution</button>
            <button className="btn mini" type="button" id="bgCopyCollege"
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
              }}>+ College savings</button>
          </div>
        </div>
      </div>

      <div className="panel">
        <div className="body">
          <div className="kv total" style={{ fontSize: "15px" }}><span className="k">Total spending, per year</span><span className="v" id="bgTotYr">{money(spentYr)}</span></div>
          <div className="kv total" style={{ fontSize: "15px" }}><span className="k">Total spending, per month</span><span className="v" id="bgTotMo">{money(spentYr / 12)}</span></div>
          <div className="kv total" style={{ fontSize: "15px" }} id="bgSaveRow" hidden={!(savedYr > 0)}><span className="k">Total saving, per month</span><span className="v pos" id="bgSaveMo">{savedYr > 0 ? money(savedYr / 12) : ""}</span></div>
          <div className="kv total" style={{ fontSize: "16px" }}><span className="k">Left over, per year</span><span className={sign} id="bgLeftYr">{money(leftYr)}</span></div>
          <div className="kv total" style={{ fontSize: "16px" }}><span className="k">Left over, per month</span><span className={sign} id="bgLeftMo">{money(leftYr / 12)}</span></div>
        </div>
      </div>
      <div className="panel">
        <h2>Emergency fund<TipDot k="emergency" /></h2>
        <div className="body">
          <div className="efrow">
            <span>Target for</span>{" "}
            <Affixed suffix="mo" style={{ width: "72px" }}><NumberInput id="efMonths" nonNeg max={36} value={s.efMonths} onValueChange={set("efMonths")} /></Affixed>{" "}
            <span>of monthly expenses</span>
          </div>
          <div className="kv total" style={{ marginTop: "12px" }}><span className="k" id="efLabel">{ef}-month emergency fund</span><span className="v gold" id="efTarget">{money((spentYr / 12) * ef)}</span></div>
        </div>
      </div>
    </div>
  );
}

