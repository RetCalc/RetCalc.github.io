"use client";

/* The FIRE calculator: when the portfolio reaches financial independence,
   or, in Coast FIRE mode, when contributions could stop and growth alone
   would get there. Ported from src/js/app/35-fire.js and
   src/main/23-fire-inputs.html, 25-fire.html. */

import { useRef, useState } from "react";
import { BandChart, type ChartGeometry } from "@/components/charts/BandChart";
import { HistBarNote } from "@/components/charts/HistNotes";
import { HistLegend, Legend } from "@/components/charts/Legend";
import { BandTipRows, FanTipRows } from "@/components/charts/TipRows";
import { useHouseholdFill } from "@/components/household/HouseholdProvider";
import { Affixed, Field, MoneyField, NumberField, SelectField } from "@/components/fields/Field";
import { NumberInput } from "@/components/fields/NumberInput";
import { Tipped } from "@/components/shell/Tooltips";
import { useToolState } from "@/components/tools/ToolState";
import { CsvButton } from "@/components/common/CsvButton";
import { KV, Segmented } from "@/components/common/Readout";
import { BigValue } from "@/components/common/BigValue";
import { fiComputeCoastCrossings, fiComputeCrossings, fiYearsFromCrossings, historicalRuns, project } from "@/lib/engine/typed";
import type { HistRuns } from "@/lib/engine/types";
import { DASH, dollarsField, fmtNum, money, pctStr } from "@/lib/format";
import { FIRE_DEF, fireInput, fireSolve, type FireInputs, type FirePlan } from "./model";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type Pt = { year: number; base: number; hi: number; lo: number; p25?: number; p75?: number };
const trim1 = (v: number) => v.toFixed(1).replace(/\.0$/, "");

/* The rate band: your return, and the band's width above and below it, in
   today's dollars. Coast FIRE stops contributing at the coast year. */
function bandPoints(p: FirePlan, displayYear: number | null, maxYears: number) {
  const isCoast = p.mode === "coast";
  const retYrs = isCoast ? Math.max(1, p.retireAge - p.curAge) : maxYears;
  const rates = [p.nominal, p.nominal + p.band, Math.max(0.001, p.nominal - p.band)];
  const run = (nominal: number, initial: number, contrib: number, years: number) =>
    project({ initial, contrib, period: p.period, growth: p.growth, nominal, inflation: p.inflation, years, withdrawal: 0, taxRate: 0 });
  const real = (end: number | undefined, year: number) => (end || 0) / Math.pow(1 + p.inflation, year);
  const pts: Pt[] = [{ year: 0, base: p.initial, hi: p.initial, lo: p.initial }];
  let maxX = maxYears;
  if (isCoast && displayYear !== null && displayYear > 0 && displayYear < retYrs) {
    const coastYrs = Math.round(displayYear);
    const [b, h, l] = rates.map((r) => run(r, p.initial, p.contrib, coastYrs));
    b.years.forEach((y, i) => pts.push({ year: y.year, base: real(y.end, y.year), hi: real((h.years[i] || y).end, y.year), lo: real((l.years[i] || y).end, y.year) }));
    const rest = retYrs - coastYrs;
    if (rest > 0) {
      // Each line coasts on from its own balance, at its own rate.
      const [b2, h2, l2] = [run(rates[0], b.fv, 0, rest), run(rates[1], h.fv, 0, rest), run(rates[2], l.fv, 0, rest)];
      b2.years.forEach((y, i) => pts.push({ year: coastYrs + y.year, base: real(y.end, coastYrs + y.year),
        hi: real((h2.years[i] || y).end, coastYrs + y.year), lo: real((l2.years[i] || y).end, coastYrs + y.year) }));
    }
    maxX = retYrs;
  } else {
    const years = p.mode === "fire" && displayYear !== null && displayYear > 0 ? displayYear : isCoast ? retYrs : maxYears;
    const [b, h, l] = rates.map((r) => run(r, p.initial, p.contrib, years));
    b.years.forEach((y, i) => pts.push({ year: y.year, base: real(y.end, y.year), hi: real((h.years[i] || y).end, y.year), lo: real((l.years[i] || y).end, y.year) }));
    if (b.years.length) maxX = b.years[b.years.length - 1].year;
  }
  return { pts, maxX };
}

/* Every rolling window since 1926: to the FIRE year, or to retirement with
   contributions stopping at the coast year. */
function histRuns(p: FirePlan, displayYear: number | null, maxYears: number): HistRuns {
  const retYrs = p.mode === "coast" ? Math.max(1, p.retireAge - p.curAge) : maxYears;
  const st = (years: number, contrib = p.contrib) => ({ years, contrib, period: contrib ? p.period : "Monthly", growth: contrib ? p.growth : 0, mix: p.histMix });
  const stages = p.mode === "coast"
    ? displayYear !== null && displayYear > 0 && displayYear < retYrs ? [st(displayYear), st(retYrs - displayYear, 0)] : [st(retYrs)]
    : [st(displayYear !== null && displayYear > 0 ? displayYear : maxYears)];
  return historicalRuns({ initial: p.initial, fees: 0 }, stages);
}

export function Fire() {
  const { state: s, set, setState } = useToolState(FIRE_DEF);
  const [tracesOn, setTracesOn] = useState(true);
  const tableRef = useRef<HTMLTableElement>(null);

  useHouseholdFill("fire", (h) => setState((c) => {
    const next: FireInputs = { ...c };
    const age = h.age != null && h.age > 0 && h.age < 120 ? Math.round(h.age) : null;
    const retire = h.retire != null && h.retire > 0 && h.retire < 120 ? Math.round(h.retire) : null;
    if (age) next.curAge = String(Math.max(18, Math.min(70, age)));
    if (retire) next.retireAge = String(retire);
    if (h.saved != null) next.initial = dollarsField(h.saved);
    if (h.monthly != null) Object.assign(next, { contrib: dollarsField(h.monthly), period: "Monthly" });
    if (h.spend != null && h.spend > 0) Object.assign(next, { target: dollarsField(h.spend), solveFor: "withdrawal" });
    return next;
  }));

  const p = fireInput(s);
  const coast = p.mode === "coast";
  const hist = s.chart === "hist";
  const modeLabel = coast ? "Coast FIRE" : "FIRE";
  const S = p.target > 0 ? fireSolve(p) : null;

  // ---- the success-rate slider (market history only)
  let displayYear = S?.fireYear ?? null;
  let successAge = DASH, sliderNote = "Enter a target to see results.";
  if (S && hist) {
    const cr = coast ? fiComputeCoastCrossings(p) : fiComputeCrossings(p, S.maxYears);
    if (cr) {
      const y = fiYearsFromCrossings(cr.crossings, cr.total, p.successRate);
      if (y !== null && y >= 0) {
        const ageNum = p.curAge + y;
        const ageFmt = ageNum % 1 ? ageNum.toFixed(1) : String(ageNum), yFmt = y % 1 ? y.toFixed(1) : String(y);
        successAge = "Age " + ageFmt + " (" + yFmt + (parseFloat(yFmt) === 1 ? " year" : " years") + " from now)";
        sliderNote = p.successRate + "% of historical windows since 1926 show the portfolio reaching the " + (coast ? "coast " : "") + "target by age " + ageFmt + ".";
        displayYear = y;
      } else {
        successAge = "Not in range";
        sliderNote = p.successRate + "% success rate not achievable within the projected window.";
      }
    } else sliderNote = "History too short for this horizon.";
  }

  // ---- the chart
  let chart: { pts: Pt[]; maxX: number; mode: "band" | "mc"; H?: HistRuns; note: string } = { pts: [], maxX: 1, mode: "band", note: "" };
  if (S) {
    if (hist) {
      const H = histRuns(p, displayYear, S.maxYears);
      chart = H.tooLong || !H.bands?.length
        ? { pts: [], maxX: 1, mode: "mc", H, note: H.tooLong ? "History too short for this horizon" : "" }
        : (() => {
          const pts = H.bands.map((b) => ({ year: Math.round(b.year), base: b.p50, hi: b.p90, lo: b.p10, p25: b.p25, p75: b.p75 }));
          return { pts, maxX: pts[pts.length - 1].year, mode: "mc" as const, H, note: "" };
        })();
    } else chart = { ...bandPoints(p, displayYear, S.maxYears), mode: "band", note: "" };
  }
  const lbl = (p.band * 100).toFixed(1).replace(/\.0$/, "");

  /* The target as a dashed line, and the FIRE year as a dashed upright with a
     dot where it meets the target. */
  const marks = (g: ChartGeometry) => {
    if (!(p.target > 0)) return null;
    const tY = g.Y(p.target), inside = tY >= g.T && tY <= g.T + g.ph;
    const fX = displayYear !== null && displayYear >= 0 && displayYear <= chart.maxX ? g.X(displayYear) : null;
    return (
      <>
        {inside ? (
          <>
            <line x1={0} x2={g.W} y1={tY} y2={tY} stroke="var(--jade)" strokeWidth="1.5" strokeDasharray="6 4" opacity="0.65" />
            <text x={g.W - (g.narrow ? 14 : 16)} y={tY - 4} textAnchor="end" fontSize={g.narrow ? "13" : "10"} fill="var(--jade)" fontFamily="ui-monospace,SF Mono,Menlo,monospace">target</text>
          </>
        ) : null}
        {fX !== null ? <line x1={fX} x2={fX} y1={g.T} y2={g.T + g.ph} stroke="var(--jade)" strokeWidth="1.5" strokeDasharray="4 3" opacity="0.55" /> : null}
        {fX !== null && !coast && inside ? <circle cx={fX} cy={tY} r={g.narrow ? "6" : "4.5"} fill="var(--jade)" stroke="var(--bg)" strokeWidth="2" /> : null}
      </>
    );
  };

  const kvs = S ? {
    target: money(p.target), withdrawal: money(p.target * p.withdrawal), contribs: money(S.contribs),
    gains: money(Math.max(0, S.nominal - p.initial - S.contribs)), nominal: pctStr(p.nominal, 2), real: pctStr(S.realRate, 2),
  } : null;
  let keepSaving = "", coastGap = "";
  if (S && coast && S.fireYear !== null) {
    const retYears = p.retireAge - p.curAge;
    const full = project({ initial: p.initial, contrib: p.contrib, period: p.period, growth: p.growth, nominal: p.nominal, inflation: p.inflation, years: retYears, withdrawal: 0, taxRate: 0 });
    const keep = ((full.years[full.years.length - 1] || { end: 0 }).end || 0) / Math.pow(1 + p.inflation, retYears);
    keepSaving = money(keep);
    coastGap = money(Math.max(0, keep - S.real * Math.pow(1 + S.realRate, retYears - S.fireYear)));
  }

  return (
    <>
      <aside id="asideFire">
        <Card>
          <CardHeader><CardTitle>Your plan</CardTitle></CardHeader>
          <CardContent>
            <div className="field mb-3.5">
              <Segmented id="segFireMode" attr="data-firemode" options={[["fire", "FIRE"], ["coast", "Coast FIRE"]] as const} value={s.mode} onChange={set("mode")} />
            </div>
            <NumberField id="fiCurAge" label="Current age" unit="age" max={70} negative value={s.curAge} onValueChange={set("curAge")} />
            <NumberField id="fiRetireAge" wrapId="fiRetireAgeWrap" hidden={!coast} label="Planned retirement age" unit="age" max={100} negative value={s.retireAge} onValueChange={set("retireAge")} />
            <MoneyField id="fiInitial" label="Current savings" value={s.initial} onValueChange={set("initial")} />
            <div className="two">
              <MoneyField id="fiContrib" label="Contribution" value={s.contrib} onValueChange={set("contrib")} />
              <SelectField id="fiPeriod" label="Frequency" value={s.period} onChange={set("period")}>
                <option>Monthly</option><option>Quarterly</option><option>Annually</option>
              </SelectField>
            </div>
            <NumberField id="fiGrowth" label={<Tipped text="Contribution growth" k="figrowth" />} unit="%/yr" step={0.5} negative value={s.growth} onValueChange={set("growth")} />
            <div className="two">
              <NumberField id="fiNominal" label="Rate of return" unit="%" step={0.5} negative value={s.nominal} onValueChange={set("nominal")} />
              <NumberField id="fiInflation" label="Inflation" unit="%" step={0.5} negative value={s.inflation} onValueChange={set("inflation")} />
            </div>
            <SelectField id="fiSolveFor" label="Target type" value={s.solveFor} onChange={set("solveFor")}>
              <option value="withdrawal">Annual withdrawal</option>
              <option value="portfolio">Portfolio value</option>
            </SelectField>
            <MoneyField id="fiTarget" label={<Tipped text="Target (today's dollars)" k="fitarget" />} value={s.target} onValueChange={set("target")} />
            <NumberField id="fiWithdrawal" label={<Tipped text="Withdrawal rate" k="withdrawal" />} unit="%" step={0.25} negative value={s.withdrawal} onValueChange={set("withdrawal")} />
          </CardContent>
        </Card>
      </aside>

      <div className="stack" id="tab-fire">
        <Card size="flush">
          <div className="headline">
            <div>
              <div className="k" id="fiAgeLabel">{S ? modeLabel + " age" : "FIRE age"}</div>
              <BigValue className="v gold" id="fiAge" sized={false} text={S ? (S.fireYear !== null ? trim1(p.curAge + S.fireYear) : "Not in range") : DASH} />
              <div className="note" id="fiAgeNote">{S && S.fireYear === null ? "Won't reach it by age 100" : "At your current pace"}</div>
            </div>
            <div>
              <div className="k" id="fiPortfolioLabel">{S ? (coast ? "Portfolio at coast" : "Portfolio at FIRE") : "Portfolio at FIRE"}</div>
              <BigValue id="fiPortfolio" sized={false} text={S && S.fireYear !== null ? money(S.real) : DASH} />
              <div className="note">In today&apos;s dollars</div>
            </div>
            <div>
              <div className="k" id="fiYearsLabel">{S ? "Years until " + modeLabel : "Years until FIRE"}</div>
              <BigValue id="fiYears" sized={false} text={S ? (S.fireYear === null ? "Not in range" : S.fireYear === 0 ? "Already there!" : trim1(S.fireYear)) : DASH} />
              <div className="note" id="fiYearsNote">{S ? (S.fireYear ? "From age " + fmtNum(p.curAge) : "") : "\u00a0"}</div>
            </div>
          </div>
          <CardContent>
            <div className="grid2">
              <div>
                <KV k="Target portfolio" id="fiKVTarget" v={kvs?.target ?? DASH} />
                <KV k="Annual withdrawal" id="fiKVWithdrawal" v={kvs?.withdrawal ?? DASH} />
                <KV k="Contributions, future dollars" id="fiKVContribs" v={kvs?.contribs ?? DASH} />
                <KV k="Investment gains, future dollars" cls="pos" id="fiKVGains" v={kvs?.gains ?? DASH} />
              </div>
              <div>
                <div id="fiCoastExtra" hidden={!coast}>
                  <KV k="Portfolio if you kept saving" id="fiKeepSaving" v={keepSaving || DASH} />
                  <KV k="Extra vs. coasting" id="fiCoastGap" v={coastGap || DASH} />
                </div>
                <KV k="Nominal return" id="fiKVNominal" v={kvs?.nominal ?? DASH} />
                <KV k="Real return" id="fiKVRealReturn" v={kvs?.real ?? DASH} />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Portfolio growth{"\n        "}
            {"\n        "}
            <span className="float-right inline-flex items-center gap-2 -mt-0.5">
              <Segmented id="segFireChart" attr="data-mode" options={[["band", "Rate band"], ["hist", "Historical"]] as const} value={s.chart} onChange={set("chart")} />{" "}
              <span id="fiOptBand" className={hist ? "hidden" : "inline-flex items-center"}>
                <Affixed prefix="&plusmn;" suffix="%" className="w-24 max-sm:w-27.5">
                  <NumberInput id="fiBand" nonNeg step={0.5} value={s.band} onValueChange={set("band")} aria-label="Return band" />
                </Affixed>
              </span>
            </span></CardTitle><CardDescription id="fiChartNote">{chart.note}</CardDescription></CardHeader>
          <div className="mcbar" id="fiHistBar" hidden={!hist}>
            <Field id="fiHistMix" label="Stock mix"><Affixed suffix="%" className="w-26"><NumberInput id="fiHistMix" nonNeg step={5} max={100} value={s.histMix} onValueChange={set("histMix")} /></Affixed></Field>
            <div className="hint m-0" id="fiHistNote">{chart.H ? <HistBarNote H={chart.H} /> : null}</div>
          </div>
          <BandChart id="Fire" pts={chart.pts} maxX={chart.maxX} mode={chart.mode} xOffset={p.curAge} ariaLabel="Portfolio growth to FIRE"
            traces={hist && tracesOn && chart.H?.traces ? { xs: chart.pts.map((a) => a.year), lines: chart.H.traces } : undefined}
            extras={marks}
            tip={(b) => (
              <>
                <b>Year {b.year} Age {p.curAge + b.year}</b>
                {hist ? <FanTipRows b={b} /> : <BandTipRows b={b} />}
              </>
            )} />
          {!chart.pts.length ? <Legend id="legendFire" items={[]} />
            : hist ? <HistLegend id="legendFire" tracesOn={tracesOn} onToggleTraces={() => setTracesOn((v) => !v)} />
            : <Legend id="legendFire" items={[
              ["#4fbf95", p.band > 0 ? "At " + pctStr(p.nominal + p.band, 2) + " (+" + lbl + "%)" : "Higher"],
              ["#e9b872", "At " + pctStr(p.nominal, 2) + " (your rate)"],
              ["#e2795f", p.band > 0 ? "At " + pctStr(Math.max(0.001, p.nominal - p.band), 2) + " (−" + lbl + "%)" : "Lower"],
            ]} />}
          <CardContent id="fiSliderWrap" className="pt-0 pb-3.5" hidden={!hist}>
            <div className="fire-slider-section">
              <div className="fire-slider-row">
                <span className="fire-slider-lbl">Historical success rate</span>{" "}
                <span className="fire-slider-val"><b id="fiSuccessPct">{p.successRate}%</b></span>
              </div>
              <input type="range" id="fiSuccessSlider" className="fire-slider" min="1" max="99" value={s.successRate} onChange={(e) => set("successRate")(e.target.value)} />
              <div className="fire-slider-ends"><span>1% (aggressive)</span><span>99% (conservative)</span></div>
              <div className="fire-slider-result" id="fiSuccessAge">{successAge}</div>
              <div className="hint mcnote pt-1 px-0 pb-0" id="fiSliderNote">{sliderNote}</div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Year by year</CardTitle><CardAction><CsvButton table={tableRef} label="Year by year" /></CardAction></CardHeader>
          <div className="swipehint">Swipe the table sideways to see every column.</div>
          <div className="scroll">
            <table id="fiTable" ref={tableRef}>
              <thead><tr><th>Age</th><th>Start balance</th><th>Contributions</th><th>Growth</th><th>End balance</th><th>Inflation adj.</th></tr></thead>
              <tbody id="fiTableBody">
                {S?.pp.years.map((y) => (
                  <tr key={y.year} className={S.fireYear !== null && y.year === Math.ceil(S.fireYear) ? "firow-fire" : undefined}>
                    <td>{p.curAge + y.year}</td><td>{money(y.start || 0)}</td><td>{money(y.contrib || 0)}</td><td className="pos">{money(y.growth || 0)}</td>
                    <td>{money(y.end || 0)}</td><td>{money((y.end || 0) / Math.pow(1 + p.inflation, y.year))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </>
  );
}
