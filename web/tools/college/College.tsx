"use client";

/* College Savings: the monthly amount that covers tuition for one child or
   several, from one shared account. Ported from src/js/app/14-college-rentbuy.js
   and src/main/06-college.html. */

import { Fragment, useRef } from "react";
import { BandChart } from "@/components/charts/BandChart";
import { Legend } from "@/components/charts/Legend";
import { Affixed, Field, MoneyField, NumberField, SelectField } from "@/components/fields/Field";
import { NumberInput } from "@/components/fields/NumberInput";
import { Tipped, TipDot } from "@/components/shell/Tooltips";
import { useToolState } from "@/components/tools/ToolState";
import { Figure, KV } from "@/components/common/Readout";
import { CsvButton } from "@/components/common/CsvButton";
import { collegePlanCalc, collegeSavingsCalc } from "@/lib/engine/typed";
import { DASH, fmtNum, groupDigits, money, pctStr } from "@/lib/format";
import { focusLast } from "@/lib/dom";
import { CL_PRESETS, COLLEGE_DEF, collegeInput, phaseNote, type Kid } from "./model";
import { useShareKit } from "@/components/shell/share";
import { collegeShare } from "./share";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SERIES } from "@/lib/hues";


export function College() {
  const { state: s, set, setState } = useToolState(COLLEGE_DEF);
  useShareKit(COLLEGE_DEF.id, collegeShare(s));
  const kidsRef = useRef<HTMLDivElement>(null);
  const tableRef = useRef<HTMLTableElement>(null);
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
            <KV key={k.index} k={`Child ${k.index + 1}: ${fmtNum(k.yearCosts.length)} years, starting in ${fmtNum(k.yearsUntil)}${k.yearsUntil === 1 ? " year" : " years"}`} v={money(k.total)} />
          ))}
          {P.skipped ? (
            <KV k="Left out" v={`${P.skipped}${P.skipped === 1 ? " child" : " children"} with no cost or no years until college`} />
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
        <Card>
          <CardHeader><CardTitle>College plan</CardTitle></CardHeader>
          <CardContent>
            <div id="clKids" ref={kidsRef}>
              {s.kids.map((k, i) => {
                const first = i === 0;
                const fields = (
                  <>
                    <SelectField id={first ? "clPreset" : undefined} label={first ? <Tipped text="School type" k="schooltype" /> : "School type"}
                      aria-label={`Child ${i + 1} school type`} data-f="preset" data-i={i} value={k.preset}
                      onChange={(v) => setKid(i, parseFloat(v) > 0 ? { preset: v, cost: groupDigits(parseFloat(v), true) } : { preset: v })}>
                      {CL_PRESETS.map(([v, label]) => <option key={v} value={v}>{label}</option>)}
                    </SelectField>
                    <MoneyField id={first ? "clCost" : undefined} label="Annual cost today" data-f="cost" data-i={i} value={k.cost} onValueChange={(v) => setKid(i, { cost: v })} aria-label={`Child ${i + 1} annual cost today`} />
                    <div className="two">
                      <Field id={first ? "clYears" : undefined} label="Years until college">
                        <Affixed suffix="yrs"><NumberInput id={first ? "clYears" : undefined} data-f="years" data-i={i} nonNeg max={25} value={k.years} onValueChange={(v) => setKid(i, { years: v })} aria-label={`Child ${i + 1} years until college`} /></Affixed>
                      </Field>
                      <NumberField id={first ? "clCollegeYrs" : undefined} label="Years of college" unit="yrs" max={8} data-f="collegeYrs" data-i={i} value={k.collegeYrs} onValueChange={(v) => setKid(i, { collegeYrs: v })} aria-label={`Child ${i + 1} years of college`} />
                    </div>
                  </>
                );
                return multi ? (
                  <div className="stagecard clkid" key={i}>
                    <div className="stagehead"><span className="clkid-name">Child {i + 1}</span>
                      <Button variant="outline" size="sm" onClick={() => setState((c) => ({ ...c, kids: c.kids.filter((_, j) => j !== i) }))}>Remove</Button>
                    </div>
                    {fields}
                  </div>
                ) : <Fragment key={i}>{fields}</Fragment>;
              })}
            </div>
            <Button variant="outline" id="clAddKid"
              onClick={() => {
                // A new child starts like the last one, two years behind.
                setState((c) => {
                  const last = c.kids[c.kids.length - 1];
                  return { ...c, kids: [...c.kids, { ...last, years: String(Math.min(25, (parseFloat(last.years) || 0) + 2)) }] };
                });
                focusLast(kidsRef, "input[data-f='years']");
              }}>{multi ? "Add another child" : "Add a child"}</Button>
            <MoneyField id="clSaved" labelId="clSavedLbl" label={multi ? "Currently saved, for all of them" : "Currently saved"} value={s.saved} onValueChange={set("saved")} />
            <div className="two">
              <NumberField id="clReturn" label="Investment return" unit="%/yr" step={0.5} value={s.ret} onValueChange={set("ret")} />
              <NumberField id="clInfl" label={<Tipped text="Tuition inflation" k="tuitioninfl" />} unit="%/yr" step={0.5} value={s.infl} onValueChange={set("infl")} />
            </div>
            <div className="derived">
              <div><span id="clSavGrowK">{multi ? "What you've saved covers" : "What you've saved grows to"}</span><span className="num" id="clSavGrow">{savGrow}</span></div>
            </div>
          </CardContent>
        </Card>
      </aside>
      <div className="stack" id="tab-college">
        <Card size="flush">
          <div className="headline">
            <Figure label="Save per month" id="clMonthly" className="v gold" value={monthly} noteId="clMonthlyNote" note={monthlyNote} />
            <Figure label="Total projected cost" id="clTotalOut" value={total} noteId="clTotalNote" note={totalNote} />
            <Figure id="clShortOut" value={short} noteId="clShortNote" note={shortNote}
              label={<span className="tipglue"><span id="clShortK">{multi ? "Needed today" : "Needed when college starts"}</span><TipDot k={multi ? "collegepvall" : "collegepv"} /></span>} />
          </div>
        </Card>
        <Card id="clEachPanel" hidden={!multi}>
          <CardHeader><CardTitle>Each child</CardTitle></CardHeader>
          <CardContent><div className="gd-kvs" id="clEach">{each}</div></CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Savings over time</CardTitle></CardHeader>
          {chart ? (
            <BandChart id="Cl" pts={chart.pts} maxX={chart.maxX} enhanced noLoLine ariaLabel="College savings projection"
              tip={(b) => (
                <>
                  <b>Year {fmtNum(b.year)}</b>
                  <br /><i className="tipsw bg-series-plan"></i>Savings <span className="n">{money(b.base)}</span>
                  {b.hi != null ? <><br /><i className="tipsw bg-series-teal"></i>{multi ? "Still needed" : "Cost of college"} <span className="n">{money(b.hi)}</span></> : null}
                </>
              )} />
          ) : <BandChart id="Cl" pts={[]} maxX={0} ariaLabel="College savings projection" tip={() => null} />}
          <Legend id="legendCl" items={chart ? [[SERIES.plan, "Your savings"], [SERIES.teal, multi ? "Needed then for the bills still ahead" : "Cost of college, that year"]] : []} />
        </Card>
        <Card>
          <CardHeader><CardTitle>Year by year</CardTitle><CardAction><CsvButton table={tableRef} label="Year by year" /></CardAction></CardHeader>
          <div className="swipehint">Swipe the table sideways to see every column.</div>
          <div className="scroll">
            <table id="clTable" ref={tableRef}>
              <thead><tr><th>Year</th><th>Balance</th><th>You added</th><th>Growth</th><th>{multi ? "Paid for college" : "Projected cost"}</th></tr></thead>
              <tbody>{rows}</tbody>
            </table>
          </div>
        </Card>
      </div>
    </>
  );
}
