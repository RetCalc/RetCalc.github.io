"use client";

/* Debt Payoff: avalanche against snowball against minimums only, with the
   payoff order and the month-by-month schedule. Ported from
   src/js/app/18-debt.js and src/main/15-debt.html. */

import { useRef } from "react";
import { BandChart } from "@/components/charts/BandChart";
import { Legend } from "@/components/charts/Legend";
import { Affixed } from "@/components/fields/Field";
import { MoneyInput, NumberInput } from "@/components/fields/NumberInput";
import { useToast } from "@/components/shell/Toast";
import { Tipped } from "@/components/shell/Tooltips";
import { toolInputs, useToolState } from "@/components/tools/ToolState";
import { Figure, Segmented } from "@/components/common/Readout";
import { CsvButton } from "@/components/common/CsvButton";
import { DEBT_CAP, debtDate as debtDateOn, debtDur, debtRun, debtUnderwater } from "@/lib/engine/typed";
import type { DebtResult } from "@/lib/engine/types";
import { DASH, fmtNum, groupDigits, money, parseNum, pctStr } from "@/lib/format";
import { focusLast } from "@/lib/dom";
import { useClient } from "@/lib/useClient";
import { BUDGET_DEFAULTS, budgetTotals } from "@/tools/budget/model";
import { DEBT_DEF, debtList, type DebtRow } from "./model";
import { useShareKit } from "@/components/shell/share";
import { debtShare } from "./share";
import { Button } from "@/components/ui/button";


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

  const debts = debtList(s.rows);
  const extra = Math.max(0, parseNum(s.extra) || 0);
  const live = debts.filter((d) => d.balance > 0);

  let head = { free: DASH, freeNote: "Add a debt to start", interest: DASH, interestNote: "", saved: DASH, savedPos: true, savedNote: "" };
  let body: React.ReactNode = null;
  let warn: string[] = [];
  let verdict = "";
  let cmpRows: React.ReactNode = null, orderRows: React.ReactNode = null, schedRows: React.ReactNode = null;

  if (live.length) {
    const av = debtRun(debts, extra, "avalanche")!, sn = debtRun(debts, extra, "snowball")!, mn = debtRun(debts, 0, "min")!;
    const pick = s.mode === "snowball" ? sn : av;
    // A minimum that doesn't cover interest invalidates every number below it.
    warn = debtUnderwater(debts).map((u) => u.desc);

    const saved = mn.totalInterest - pick.totalInterest;
    const sooner = mn.monthsTotal - pick.monthsTotal;
    head = {
      free: pick.stalled ? "Never" : debtDate(pick.monthsTotal),
      freeNote: pick.stalled ? "Payments never clear the balance" : debtDur(pick.monthsTotal) + " from now",
      interest: money(pick.totalInterest),
      interestNote: "on " + money(live.reduce((a, d) => a + d.balance, 0)) + " borrowed, " + money(pick.totalPaid) + " paid in all",
      saved: money(Math.max(0, saved)),
      savedPos: saved > 0,
      savedNote: mn.stalled ? "Minimums alone never clear it" : sooner > 0 ? debtDur(sooner) + " sooner" : "Same as minimums",
    };

    // The verdict: the real trade-off between the two orderings.
    const dInt = sn.totalInterest - av.totalInterest, dMon = sn.monthsTotal - av.monthsTotal, dFirst = sn.firstCleared - av.firstCleared;
    if (Math.abs(dInt) < 1 && dMon === 0) {
      verdict = "With these debts the two orderings land in the same place; pick whichever you'll actually stick to.";
    } else {
      verdict = "Avalanche costs " + money(Math.abs(dInt)) + " less in interest" + (dMon > 0 ? " and finishes " + debtDur(dMon) + " sooner" : "") + ". ";
      verdict += dFirst < 0
        ? "Snowball clears your first debt " + debtDur(-dFirst) + " earlier. That early win is the whole argument for it, and here it costs " + money(Math.abs(dInt)) + "."
        : "Snowball offers nothing in return here: it clears the first debt no sooner.";
    }
    const rate = live.reduce((a, d) => a + d.balance * d.apr, 0) / live.reduce((a, d) => a + d.balance, 0);
    verdict += " Your blended rate is " + pctStr(rate / 100, 1) + " across " + live.length + (live.length === 1 ? " debt" : " debts") +
      ", and you're putting " + money(pick.monthlyPool, 0) + " a month at it.";
    // An extra dollar a month is the most underrated lever in the whole thing.
    const bump = debtRun(debts, extra + 100, s.mode);
    if (bump && !bump.stalled && !pick.stalled && bump.monthsTotal < pick.monthsTotal)
      verdict += " Another $100 a month would clear it " + debtDur(pick.monthsTotal - bump.monthsTotal) + " sooner and save " +
        money(pick.totalInterest - bump.totalInterest) + " more.";

    cmpRows = ([["Avalanche, highest rate first", av], ["Snowball, smallest balance first", sn], ["Minimums only, no extra", mn]] as const).map(([label, R]) => (
      <tr key={label}>
        <td>{label}</td><td>{R.stalled ? "Never" : debtDate(R.monthsTotal)}</td><td>{R.stalled ? DASH : debtDur(R.monthsTotal)}</td>
        <td className={R === av && av.totalInterest <= sn.totalInterest ? "pos" : undefined}>{money(R.totalInterest)}</td>
        <td>{R.firstCleared ? debtDur(R.firstCleared) : DASH}</td>
      </tr>
    ));
    orderRows = pick.order.map((d, i) => (
      <tr key={i}>
        <td>{i + 1}</td><td>{d.desc}</td><td>{money(d.start)}</td><td>{pctStr(d.apr, 2)}</td><td>{money(d.min)}</td>
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

    const span = Math.max(pick.months.length, Math.min(mn.months.length, DEBT_CAP));
    const at = (R: DebtResult, m: number) => (m >= R.months.length ? 0 : R.months[Math.min(m, R.months.length - 1)].balance);
    const pts = [];
    for (let m = 0; m < span; m++) pts.push({ year: m, base: at(pick, m), hi: at(mn, m), lo: Math.min(at(pick, m), at(mn, m)) });
    body = (
      <>
        <BandChart id="DT" pts={pts} maxX={span - 1} enhanced ariaLabel="Balance over time"
          tip={(b) => (
            <>
              <b>Month {fmtNum(b.year)}</b> <span className="n">{debtDate(b.year)}</span>
              <br /><span className="text-gold">Your plan</span> <span className="n">{money(b.base)}</span>
              <br /><span className="text-jade">Minimums</span> <span className="n">{money(b.hi!)}</span>
            </>
          )} />
        <Legend id="legendDT" items={[["#e9b872", s.mode === "snowball" ? "Snowball" : "Avalanche"], ["#4fbf95", "Minimums only"]]} />
      </>
    );
  }

  return (
    <div className="stack solo" id="tab-debt">
      <div className="panel">
        <div className="headline">
          <Figure label="Debt-free" id="dtFree" className="v gold" value={head.free} noteId="dtFreeNote" note={head.freeNote} />
          <Figure label="Total interest" id="dtInterest" value={head.interest} noteId="dtInterestNote" note={head.interestNote} />
          <Figure label={<Tipped text="Saved vs. minimums" k="dtsaved" />} id="dtSaved" className={head.savedPos ? "v pos" : "v "}
            value={head.saved} noteId="dtSavedNote" note={head.savedNote} />
        </div>
        <div className="body">
          <div className="bgincome">
            <label htmlFor="dtExtra">Extra payment, on top of the minimums</label>
            <div className="bgincome-row">
              <Affixed prefix="$" suffix="/mo"><MoneyInput id="dtExtra" nonNeg value={s.extra} onValueChange={set("extra")} /></Affixed>{" "}
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
          </div>
          <div className="dtstrat">
            <Segmented id="segDT" attr="data-dt" options={[["avalanche", "Avalanche"], ["snowball", "Snowball"]] as const} value={s.mode} onChange={set("mode")} />{" "}
            <span className="hint m-0" id="dtStratNote">
              {s.mode === "snowball" ? "Smallest balance first: quicker wins, usually more interest." : "Highest rate first: mathematically cheapest."}
            </span>
          </div>
          <div id="dtWarn" className="dtwarn" hidden={!warn.length}>
            {warn.length ? (
              <><b>{warn.join(", ")}</b>: the minimum doesn&apos;t cover one month of interest, so that balance grows on its own. The payoff below only works because of the extra payment; check the minimum you entered.</>
            ) : null}
          </div>
        </div>
      </div>

      <div className="panel">
        <h2>Your debts</h2>
        <div className="body">
          <div className="dthead"><span className="desc">Debt</span><span className="c1">Balance</span><span className="c2"><Tipped text="Rate" k="dtrate" /></span><span className="c3"><Tipped text="Minimum" k="dtmin" /></span><span className="delspace"></span></div>
          <div id="dtList" ref={listRef}>
            {s.rows.map((r, i) => (
              <div className="dtrow" key={i}>
                <input className="desc" data-f="desc" data-i={i} value={r.desc} placeholder="Name" aria-label="Debt name" onChange={(e) => setRow(i, "desc")(e.target.value)} />
                <Affixed className="c1" prefix="$"><MoneyInput nonNeg data-f="balance" data-i={i} value={r.balance} onValueChange={setRow(i, "balance")} aria-label="Balance" /></Affixed>
                <Affixed className="c2" suffix="%"><NumberInput nonNeg step={0.1} data-f="apr" data-i={i} value={r.apr} onValueChange={setRow(i, "apr")} aria-label="Rate" /></Affixed>
                <Affixed className="c3" prefix="$"><MoneyInput nonNeg data-f="min" data-i={i} value={r.min} onValueChange={setRow(i, "min")} aria-label="Minimum payment" /></Affixed>
                {s.rows.length > 1 ? (
                  <Button variant="ghost" size="icon-sm" title="Remove" aria-label="Remove"
                    onClick={() => setState((c) => ({ ...c, rows: c.rows.filter((_, j) => j !== i) }))}>{"×"}</Button>
                ) : <span className="delspace"></span>}
              </div>
            ))}
          </div>
          <Button variant="outline" className="mt-1.5" id="dtAdd"
            onClick={() => {
              setState((c) => ({ ...c, rows: [...c.rows, { desc: "New debt", balance: "0", apr: "0", min: "0" }] }));
              focusLast(listRef, ".dtrow input.desc");
            }}>Add a debt</Button>
        </div>
      </div>

      <div className="panel">
        <h2>Avalanche vs. snowball<span className="h2note">same money, different order</span><span className="h2ctrl"><CsvButton table={compareRef} label="Avalanche vs. snowball" /></span></h2>
        <div className="body">
          <div id="dtVerdict">{verdict ? <div className="hint mt-0 mx-0 mb-3">{verdict}</div> : null}</div>
        </div>
        <div className="scroll">
          <table id="dtCompare" ref={compareRef}>
            <thead><tr><th>Approach</th><th>Debt-free</th><th>How long</th><th>Total interest</th><th>First debt gone</th></tr></thead>
            <tbody>{cmpRows}</tbody>
          </table>
        </div>
      </div>

      <div className="panel">
        <h2>What you owe, month by month<span className="h2note">months from now</span></h2>
        {body ?? <><BandChart id="DT" pts={[]} maxX={0} ariaLabel="Balance over time" tip={() => null} /><Legend id="legendDT" items={[]} /></>}
      </div>

      <div className="panel">
        <h2>Payoff order<span className="h2ctrl"><CsvButton table={orderRef} label="Payoff order" /></span></h2>
        <div className="swipehint">Swipe the table sideways to see every column.</div>
        <div className="scroll">
          <table id="dtOrder" ref={orderRef}>
            <thead><tr><th>#</th><th>Debt</th><th>Balance</th><th>Rate</th><th>Minimum</th><th>Interest paid</th><th>Cleared</th></tr></thead>
            <tbody>{orderRows}</tbody>
          </table>
        </div>
      </div>

      <div className="panel">
        <h2>The schedule<span className="h2ctrl"><CsvButton table={schedRef} label="The schedule" /></span></h2>
        <div className="swipehint">Swipe the table sideways to see every column.</div>
        <div className="scroll">
          <table id="dtSched" ref={schedRef}>
            <thead><tr><th>Month</th><th>Date</th><th>Balance</th><th>Interest to date</th><th>Debts cleared</th></tr></thead>
            <tbody>{schedRows}</tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
