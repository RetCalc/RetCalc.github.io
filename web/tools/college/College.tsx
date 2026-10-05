"use client";

/* College Savings: the monthly amount that covers tuition for one child or
   several, from one shared account. Ported from src/js/app/14-college-rentbuy.js
   and src/main/06-college.html. */

import { Fragment, useRef } from "react";
import { BandChart } from "@/components/charts/BandChart";
import { Legend } from "@/components/charts/Legend";
import { MoneyInput, NumberInput } from "@/components/fields/NumberInput";
import { Tipped, TipDot } from "@/components/shell/Tooltips";
import { useToolState } from "@/components/tools/ToolState";
import { BigValue } from "@/components/ui/BigValue";
import { CsvButton } from "@/components/ui/CsvButton";
import { collegePlanCalc as planJs, collegeSavingsCalc as savingsJs } from "@/lib/engine";
import type { CollegePlan, CollegeResult } from "@/lib/engine/types";
import { fmtNum, groupDigits, money, pctStr } from "@/lib/format";
import { CL_PRESETS, COLLEGE_DEF, collegeInput, type CollegeInput, type Kid } from "./model";

const collegeSavingsCalc = savingsJs as unknown as (i: CollegeInput) => CollegeResult;
const collegePlanCalc = planJs as unknown as (i: CollegeInput) => CollegePlan | null;
const DASH = "—";

/* How the monthly amount runs: one figure, or one that steps down once an
   older child's college has started. */
function phaseNote(P: CollegePlan): string {
  const yrs = (m: number) => fmtNum(Math.round((m / 12) * 10) / 10);
  let s = "for " + yrs(P.phases[0].to) + " years";
  for (const x of P.phases.slice(1))
    s += x.monthly > 0 ? ", then " + money(x.monthly, 0) + "/mo for " + yrs(x.to - x.from) + " more" : ", then nothing more";
  return s;
}

export function College() {
  const { state: s, setState } = useToolState(COLLEGE_DEF);
  const kidsRef = useRef<HTMLDivElement>(null);
  const tableRef = useRef<HTMLTableElement>(null);
  const set = (k: "saved" | "ret" | "infl") => (v: string) => setState((c) => ({ ...c, [k]: v }));
  const setKid = (i: number, patch: Partial<Kid>) =>
    setState((c) => ({ ...c, kids: c.kids.map((k, j) => (j === i ? { ...k, ...patch } : k)) }));

  const inp = collegeInput(s);
  const multi = inp.kids.length > 1;

  // What each part of the page shows; blank until there's something to plan.
  let monthly = DASH, monthlyNote = "", total = DASH, totalNote = "", short = DASH, shortNote = "", savGrow = "";
  let each: React.ReactNode = null, rows: React.ReactNode = null;
  let chart: { pts: { year: number; base: number; hi: number; lo: number }[]; maxX: number } | null = null;

  if (multi) {
    const P = collegePlanCalc(inp);
    if (P) {
      const n = P.kids.length;
      savGrow = P.pvToday > 0 ? pctStr(Math.min(1, inp.saved / P.pvToday), 0) + " of it" : DASH;
      monthly = money(P.monthly, 0);
      monthlyNote = (n === 2 ? "for both children, " : "for all " + n + " children, ") + phaseNote(P);
      total = money(P.totalFuture);
      totalNote = fmtNum(P.kids.reduce((a, k) => a + k.yearCosts.length, 0)) + " years of college in all, at " + pctStr(inp.tuitionInfl, 1) + " tuition inflation";
      short = money(P.pvToday);
      shortNote = "A lump sum today that, earning " + pctStr(inp.investRet, 1) + ", would pay every bill as it comes";
      each = (
        <>
          {P.kids.map((k) => (
            <div className="kv" key={k.index}>
              <span className="k">{`Child ${k.index + 1}: ${fmtNum(k.yearCosts.length)} years, starting in ${fmtNum(k.yearsUntil)}${k.yearsUntil === 1 ? " year" : " years"}`}</span>
              <span className="v">{money(k.total)}</span>
            </div>
          ))}
          {P.skipped ? (
            <div className="kv"><span className="k">Left out</span><span className="v">{P.skipped + (P.skipped === 1 ? " child" : " children")} with no cost or no years until college</span></div>
          ) : null}
        </>
      );
      chart = { pts: [{ year: 0, base: inp.saved, hi: P.pvToday, lo: 0 }, ...P.rows.map((r) => ({ year: r.year, base: r.balance, hi: r.needed, lo: 0 }))], maxX: P.rows.length };
      rows = P.rows.map((r) => (
        <tr key={r.year}><td>{fmtNum(r.year)}</td><td>{money(r.balance)}</td><td className="pos">{money(r.contribs)}</td><td className="pos">{money(r.growth)}</td><td>{r.paid > 0 ? money(r.paid) : DASH}</td></tr>
      ));
    }
  } else if (inp.annualCost > 0 && inp.yearsUntil > 0) {
    const R = collegeSavingsCalc(inp);
    savGrow = money(R.savingsAtStart);
    monthly = money(R.monthly, 0);
    monthlyNote = "for " + fmtNum(inp.yearsUntil) + " years at " + pctStr(inp.investRet, 1);
    total = money(R.totalFuture);
    totalNote = inp.collegeYrs + " years at " + money(inp.annualCost, 0) + "/yr, " + pctStr(inp.tuitionInfl, 1) + " inflation";
    short = money(R.shortfall);
    shortNote = "Less than the " + money(R.totalFuture) + " total, since what's saved keeps earning " + pctStr(inp.investRet, 1) + " while later years' tuition is paid";
    // The comparison line: the full cost if college started that year,
    // rising with tuition inflation to the real total when it does start.
    const costIfStartingAt = (t: number) => {
      let sum = 0;
      for (let k = 0; k < inp.collegeYrs; k++) sum += inp.annualCost * Math.pow(1 + inp.tuitionInfl, t + k);
      return sum;
    };
    chart = { pts: [{ year: 0, base: inp.saved, hi: costIfStartingAt(0), lo: 0 }, ...R.rows.map((r) => ({ year: r.year, base: r.balance, hi: costIfStartingAt(r.year), lo: 0 }))], maxX: inp.yearsUntil };
    rows = R.rows.map((r) => (
      <tr key={r.year}><td>{fmtNum(r.year)}</td><td>{money(r.balance)}</td><td className="pos">{money(r.contribs)}</td><td className="pos">{money(r.growth)}</td><td>{money(r.projCost)}</td></tr>
    ));
  }

  return (
    <>
      <aside id="asideCollege">
        <div className="panel inputs">
          <h2>College plan</h2>
          <div className="body">
            <div id="clKids" ref={kidsRef}>
              {s.kids.map((k, i) => {
                const first = i === 0;
                const fields = (
                  <>
                    <div className="field">
                      <label htmlFor={first ? "clPreset" : undefined}>{first ? <Tipped text="School type" k="schooltype" /> : "School type"}</label>
                      <select id={first ? "clPreset" : undefined} aria-label={`Child ${i + 1} school type`} value={k.preset}
                        onChange={(e) => {
                          const v = parseFloat(e.target.value);
                          setKid(i, v > 0 ? { preset: e.target.value, cost: groupDigits(v, true) } : { preset: e.target.value });
                        }}>
                        {CL_PRESETS.map(([v, label]) => <option key={v} value={v}>{label}</option>)}
                      </select>
                    </div>
                    <div className="field">
                      <label htmlFor={first ? "clCost" : undefined}>Annual cost today</label>
                      <div className="inputwrap"><span className="affix">$</span><MoneyInput id={first ? "clCost" : undefined} nonNeg value={k.cost} onValueChange={(v) => setKid(i, { cost: v })} aria-label={`Child ${i + 1} annual cost today`} /></div>
                    </div>
                    <div className="two">
                      <div className="field">
                        <label htmlFor={first ? "clYears" : undefined}>Years until college</label>
                        <div className="inputwrap"><NumberInput id={first ? "clYears" : undefined} data-f="years" nonNeg max={25} value={k.years} onValueChange={(v) => setKid(i, { years: v })} aria-label={`Child ${i + 1} years until college`} /><span className="affix">yrs</span></div>
                      </div>
                      <div className="field">
                        <label htmlFor={first ? "clCollegeYrs" : undefined}>Years of college</label>
                        <div className="inputwrap"><NumberInput id={first ? "clCollegeYrs" : undefined} nonNeg max={8} value={k.collegeYrs} onValueChange={(v) => setKid(i, { collegeYrs: v })} aria-label={`Child ${i + 1} years of college`} /><span className="affix">yrs</span></div>
                      </div>
                    </div>
                  </>
                );
                return multi ? (
                  <div className="stagecard clkid" key={i}>
                    <div className="stagehead"><span className="clkid-name">Child {i + 1}</span>
                      <button className="btn mini" type="button" onClick={() => setState((c) => ({ ...c, kids: c.kids.filter((_, j) => j !== i) }))}>Remove</button>
                    </div>
                    {fields}
                  </div>
                ) : <Fragment key={i}>{fields}</Fragment>;
              })}
            </div>
            <button className="btn" type="button" id="clAddKid"
              onClick={() => {
                // A new child starts like the last one, two years behind.
                setState((c) => {
                  const last = c.kids[c.kids.length - 1];
                  return { ...c, kids: [...c.kids, { ...last, years: String(Math.min(25, (parseFloat(last.years) || 0) + 2)) }] };
                });
                setTimeout(() => [...(kidsRef.current?.querySelectorAll<HTMLInputElement>("input[data-f='years']") ?? [])].pop()?.focus(), 0);
              }}>{multi ? "Add another child" : "Add a child"}</button>
            <div className="field">
              <label htmlFor="clSaved" id="clSavedLbl">{multi ? "Currently saved, for all of them" : "Currently saved"}</label>
              <div className="inputwrap"><span className="affix">$</span><MoneyInput id="clSaved" nonNeg value={s.saved} onValueChange={set("saved")} /></div>
            </div>
            <div className="two">
              <div className="field">
                <label htmlFor="clReturn">Investment return</label>
                <div className="inputwrap"><NumberInput id="clReturn" nonNeg step={0.5} value={s.ret} onValueChange={set("ret")} /><span className="affix">%/yr</span></div>
              </div>
              <div className="field">
                <label htmlFor="clInfl"><Tipped text="Tuition inflation" k="tuitioninfl" /></label>
                <div className="inputwrap"><NumberInput id="clInfl" nonNeg step={0.5} value={s.infl} onValueChange={set("infl")} /><span className="affix">%/yr</span></div>
              </div>
            </div>
            <div className="derived">
              <div><span id="clSavGrowK">{multi ? "What you've saved covers" : "What you've saved grows to"}</span><span className="num" id="clSavGrow">{savGrow}</span></div>
            </div>
          </div>
        </div>
      </aside>
      <div className="stack" id="tab-college">
        <div className="panel">
          <div className="headline">
            <div><div className="k">Save per month</div><BigValue className="v gold" id="clMonthly" text={monthly} /><div className="note" id="clMonthlyNote">{monthlyNote}</div></div>
            <div><div className="k">Total projected cost</div><BigValue id="clTotalOut" text={total} /><div className="note" id="clTotalNote">{totalNote}</div></div>
            <div><div className="k"><span className="tipglue"><span id="clShortK">{multi ? "Needed today" : "Needed when college starts"}</span><TipDot k={multi ? "collegepvall" : "collegepv"} /></span></div>
              <BigValue id="clShortOut" text={short} /><div className="note" id="clShortNote">{shortNote}</div></div>
          </div>
        </div>
        <div className="panel" id="clEachPanel" hidden={!multi}>
          <h2>Each child</h2>
          <div className="body"><div className="gd-kvs" id="clEach">{each}</div></div>
        </div>
        <div className="panel">
          <h2>Savings over time</h2>
          {chart ? (
            <BandChart id="Cl" pts={chart.pts} maxX={chart.maxX} enhanced noLoLine ariaLabel="College savings projection"
              tip={(b) => (
                <>
                  <b>Year {fmtNum(b.year)}</b>
                  <br /><span style={{ color: "#e9b872" }}>Savings</span> <span className="n">{money(b.base)}</span>
                  {b.hi != null ? <><br /><span style={{ color: "#4fbf95" }}>{multi ? "Still needed" : "Cost of college"}</span> <span className="n">{money(b.hi)}</span></> : null}
                </>
              )} />
          ) : (
            <div className="chartwrap" id="chartWrapCl"><svg id="chartCl" viewBox="0 0 900 340" preserveAspectRatio="none" role="img" aria-label="College savings projection" /><div className="tip" /></div>
          )}
          <Legend id="legendCl" items={chart ? [["#e9b872", "Your savings"], ["#4fbf95", multi ? "Needed then for the bills still ahead" : "Cost of college, that year"]] : []} />
        </div>
        <div className="panel">
          <h2>Year by year<span className="h2ctrl"><CsvButton table={tableRef} label="Year by year" /></span></h2>
          <div className="swipehint">Swipe the table sideways to see every column.</div>
          <div className="scroll">
            <table id="clTable" ref={tableRef}>
              <thead><tr><th>Year</th><th>Balance</th><th>You added</th><th>Growth</th><th>{multi ? "Paid for college" : "Projected cost"}</th></tr></thead>
              <tbody>{rows}</tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  );
}
