"use client";

/* The Basic calculator (the home page): six questions, a balance at
   retirement in today's dollars, and the income it could pay. Ported from
   src/js/app/20-basic.js and the Basic parts of src/main/02-calculator-inputs.html
   and 03-calculator-results.html. */

import { useRef } from "react";
import { BandChart } from "@/components/charts/BandChart";
import { Legend } from "@/components/charts/Legend";
import { BandTipRows } from "@/components/charts/TipRows";
import { useHouseholdFill } from "@/components/household/HouseholdProvider";
import { MoneyField, NumberField, SelectField } from "@/components/fields/Field";
import { Tipped } from "@/components/shell/Tooltips";
import { useShareKit } from "@/components/shell/share";
import { useToolState } from "@/components/tools/ToolState";
import { CsvButton } from "@/components/common/CsvButton";
import { Milestones } from "@/components/common/Milestones";
import { Figure, KV } from "@/components/common/Readout";
import { BASIC_BAND, projectBasic } from "@/lib/engine/typed";
import { DASH, dollarsField, fmtNum, fmtYears, money, pctStr } from "@/lib/format";
import { PERIOD_ADV, PeriodOptions } from "@/lib/periods";
import { basicShare } from "./share";
import { BASIC_DEF, RISK_OPTIONS, basicInput, type BasicInputs } from "./model";
import { OpenInAdvanced } from "./OpenInAdvanced";


export function Basic() {
  const { state: s, set, setState } = useToolState(BASIC_DEF);
  const tableRef = useRef<HTMLTableElement>(null);

  /* Retirement can be at most 100 years away; past that, it follows the age. */
  const setAge = (k: "age" | "retire") => (v: string) =>
    setState((c) => {
      const next = { ...c, [k]: v };
      const age = parseFloat(next.age.replace(/,/g, "")), ret = parseFloat(next.retire.replace(/,/g, ""));
      return age > 0 && ret > 0 && ret - age > 100 ? { ...next, retire: String(age + 100) } : next;
    });

  useHouseholdFill("basic", (h) => setState((c) => {
    const age = h.age != null && h.age > 0 && h.age < 120 ? Math.round(h.age) : null;
    const retire = h.retire != null && h.retire > 0 && h.retire < 120 ? Math.round(h.retire) : null;
    const next: BasicInputs = { ...c };
    if (age) next.age = String(age);
    if (retire && (!age || retire > age)) next.retire = String(age ? Math.min(retire, age + 100) : retire);
    if (h.saved != null) next.saved = dollarsField(h.saved);
    if (h.monthly != null) Object.assign(next, { contrib: dollarsField(h.monthly), period: "Monthly" });
    return next;
  }));

  useShareKit(BASIC_DEF.id, basicShare(s));

  const p = basicInput(s);
  const ok = p.years > 0;
  const R = ok ? projectBasic(p) : null;

  // The same plan with returns 1.5 points better and worse, as the band.
  let pts: { year: number; base: number; hi: number; lo: number }[] = [];
  if (R?.years.length) {
    const hiR = projectBasic({ ...p, real: p.real + BASIC_BAND });
    const loR = projectBasic({ ...p, real: Math.max(-0.99, p.real - BASIC_BAND) });
    pts = [{ year: 0, base: p.initial, hi: p.initial, lo: p.initial },
      ...R.years.map((y, i) => ({ year: y.year, base: y.end, hi: hiR.years[i]?.end ?? y.end, lo: loR.years[i]?.end ?? y.end }))];
  }
  const hasAge = p.age > 0 && isFinite(p.age);

  return (
    <>
      <aside id="asideSimple">
        <div className="panel inputs">
          <h2>A few questions</h2>
          <div className="body">
            <NumberField id="qAge" label="How old are you?" unit="age" value={s.age} onValueChange={setAge("age")} />
            <NumberField id="qRetire" label="When do you plan to retire?" unit="age" value={s.retire} onValueChange={setAge("retire")} />
            <MoneyField id="qSaved" label="How much have you saved so far?" value={s.saved} onValueChange={set("saved")} />
            <MoneyField id="qContrib" label="How much do you save for retirement?" value={s.contrib} onValueChange={set("contrib")} />
            <SelectField id="qPeriod" label="How often?" value={s.period} onChange={set("period")}>
              <PeriodOptions />
            </SelectField>
            <SelectField id="qRisk" label="How is it invested?" value={s.risk} onChange={set("risk")}>
              {RISK_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </SelectField>
            <div className="derived">
              <div><span>Years until retirement</span><span className="num" id="qYears">{ok ? fmtYears(p.years) : DASH}</span></div>
              <div><span><Tipped text="Growth after inflation" k="realreturn" /></span><span className="num" id="qReal">{pctStr(p.real, 2) + " a year"}</span></div>
            </div>
          </div>
        </div>
      </aside>

      <div className="stack" role="tabpanel" aria-labelledby="tabbtn-calc" id="tab-simple">
        <div className="panel" id="qWarn" hidden={ok}>
          <div className="body"><div className="hint" id="qWarnText">
            {ok ? "" : p.retire && p.age ? "Your retirement age needs to be higher than your age today." : "Fill in your age and the age you plan to retire to see a projection."}
          </div></div>
        </div>

        <div className="panel">
          <div className="headline">
            <Figure label="Value at retirement" id="qFV" className="v gold" sized={!!R} value={R ? money(R.fv) : DASH} noteId="qFVnote"
              note={R ? "At age " + fmtNum(p.retire) + ", in today's dollars" : ""} />
            <Figure label="Income, per year" id="qYear" sized={!!R} value={R ? money(R.fv * 0.04) : DASH} note="Taking 4% a year" />
            <Figure label="Income, per month" id="qMonth" sized={!!R} value={R ? money((R.fv * 0.04) / 12) : DASH} note="The same, spread monthly" />
          </div>
          <div className="body">
            <div className="grid2">
              <div>
                <KV k="You put in" id="qIn" v={R ? money(R.contribTotal) : DASH} />
                <KV k="Growth adds" cls="pos" id="qGrowth" v={R ? money(R.growth) : DASH} />
              </div>
              <div>
                <KV k="Starting from" id="qStart" v={R ? money(p.initial) : DASH} />
                <KV k="You add" id="qSpan" v={R ? money(p.contrib, p.contrib % 1 ? 2 : 0) + " " + PERIOD_ADV[p.period] : DASH} />
              </div>
            </div>
            <div className="hint mt-3.5">Every figure here is in today&apos;s dollars,
              so you can compare it to what money is worth now. It assumes you nudge your
              contribution up a little each year to keep pace with inflation.</div>
          </div>
        </div>

        <div className="panel">
          <h2>Balance over time<span className="h2note">in today&apos;s dollars</span></h2>
          <BandChart id="Q" pts={pts} maxX={p.years || 1} xOffset={hasAge ? p.age : 0} enhanced ariaLabel="Projected balance in today's dollars"
            tip={(b) => (
              <>
                {hasAge ? <><b>Age {fmtNum(p.age + b.year)}</b> <span className="text-dimmer">{"· year " + fmtNum(b.year)}</span></> : <b>Year {fmtNum(b.year)}</b>}
                <BandTipRows b={b} names={["Better", "Expected", "Worse"]} />
              </>
            )} />
          <Legend id="legendQ" items={pts.length ? [
            ["#4fbf95", "If returns run better (" + pctStr(p.real + BASIC_BAND, 2) + ")"],
            ["#e9b872", "Your setting (" + pctStr(p.real, 2) + ")"],
            ["#e2795f", "If returns run worse (" + pctStr(Math.max(0, p.real - BASIC_BAND), 2) + ")"],
          ] : []} />
        </div>

        <div className="panel">
          <h2>Year by year<span className="h2ctrl"><CsvButton table={tableRef} label="Year by year" /></span></h2>
          <div className="swipehint">Swipe the table sideways to see every column.</div>
          <div className="scroll">
            <table id="qYearTable" ref={tableRef}>
              <thead><tr><th>Age</th><th>Year</th><th>Start</th><th>You added</th><th>Growth</th><th>Balance</th></tr></thead>
              <tbody>
                {R?.years.map((y) => (
                  <tr key={y.year}><td>{fmtNum(p.age + y.year)}</td><td>{y.year}</td><td>{money(y.start)}</td><td>{money(y.contrib)}</td><td className="pos">{money(y.growth)}</td><td>{money(y.end)}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="panel">
          <h2>Milestones</h2>
          <div className="body" id="msBodyQ">{R ? <Milestones rows={R.years} alreadyReal /> : null}</div>
        </div>

        <div className="panel">
          <h2>Want more detail?</h2>
          <div className="body">
            <p className="hint mt-0">The Advanced tab does everything this does
              plus taxes, fees, contribution growth, and a simulation of good and bad market
              runs. This will carry your answers over so you don&apos;t have to retype them.</p>
            <OpenInAdvanced basic={s} />
          </div>
        </div>
      </div>
    </>
  );
}
