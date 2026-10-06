"use client";

/* The "Your plan" view: the spending scorecard, how each start fared, when
   you retire, the balance and spending through retirement, the spread of
   outcomes, one retirement year by year, and how the result moves with
   returns and Social Security claiming ages. From ddPaintHist(),
   ddPaintMC(), ddPlanExtras(), ddPaintScore(), ddPaintDist(), ddPaintSeq()
   and the tables in src/js/app/15-drawdown.js, 15b and 15d. */

import { useRef, useState } from "react";
import { BandChart, type BandPoint } from "@/components/charts/BandChart";
import { Histogram, roundBins } from "@/components/charts/Histogram";
import { HistLegend, McLegend } from "@/components/charts/Legend";
import { Scatter } from "@/components/charts/Scatter";
import { FanTipRows } from "@/components/charts/TipRows";
import { fmtAxisMoney } from "@/components/charts/scale";
import { TipDot } from "@/components/shell/Tooltips";
import { CsvButton } from "@/components/common/CsvButton";
import { Html } from "@/components/common/Html";
import { KV } from "@/components/common/Readout";
import {
  DD_ERAS, ddEraFor, ddLineAt, ddQuick, ssDrawdownStreams, type DdHist, type DdHistRun, type DdMC, type DdOpts, type DdRun, type DdScore,
} from "@/lib/engine/typed-drawdown";
import { fmtNum, money, pctStr } from "@/lib/format";
import { useSort } from "@/lib/useSort";
import type { DDView } from "./Drawdown";
import type { DdItem } from "./fields";
import { ageVal, lineWords, outcomeText, pct1, rateClass, seqMeasure, seqPair, startLabel, whyText, swatch } from "./text";
import { badgeVariants } from "@/components/ui/badge";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { SERIES } from "@/lib/hues";
import { cn } from "@/lib/utils";
import { NativeSelect } from "@/components/ui/native-select";
import { Segmented as SegmentedGroup, SegmentedItem } from "@/components/ui/segmented";

/** The return assumptions the sensitivity table tries: history less 2 and 1
    points a year, as it was, and 1 point better. */
export const DD_DRAGS = [2, 1, 0, -1];

const BASE_COLOR: string = SERIES.gray;
const baseLine = (pts: { year: number; value: number }[]) => [{ pts, color: BASE_COLOR, dash: "6 5", width: 1.6 }];

/* ---- a change against the pinned baseline ---- */
export function deltaHtml(cur: number | null, base: number | null, kind: "pts" | "money" | "n", lowBetter?: boolean): string {
  if (base == null || cur == null || !isFinite(cur) || !isFinite(base)) return "";
  const d = cur - base, tiny = kind === "pts" ? 0.0005 : kind === "money" ? 0.5 : 0.05;
  /* Built as markup for the tiles, so the badge's classes are used directly. */
  const badge = (variant: "outline" | "positive" | "destructive", text: string) =>
    "<span data-slot='badge' class='" + badgeVariants({ variant }) + "'>" + text + "</span>";
  if (Math.abs(d) < tiny) return badge("outline", "same as baseline");
  const good = lowBetter ? d < 0 : d > 0;
  const txt = kind === "pts" ? (d > 0 ? "+" : "−") + (Math.abs(d) * 100).toFixed(1) + " pts"
    : kind === "money" ? (d > 0 ? "+" : "−") + money(Math.abs(d))
      : (d > 0 ? "+" : "−") + (Math.abs(d) % 1 ? (Math.round(Math.abs(d) * 10) / 10).toFixed(1) : String(Math.abs(d)));
  return badge(good ? "positive" : "destructive", txt);
}

/** The Social Security claiming ages the comparison tries, each with every
    stream rebuilt. Null unless benefits are estimated. */
export function ssRows(o: DdOpts, d: Record<string, unknown>) {
  if (d.ssMode !== "est" || !((d.ssIncome as number) > 0)) return null;
  const ages = [62, 64, 67, 70], both = d.ssWho === "couple";
  const ov = (st: ReturnType<typeof ssDrawdownStreams>) => ({
    ssAnnual: st.annual, ssDelayYears: st.delay, ssAnnual2: st.annual2, ssDelayYears2: st.delay2, ssAnnual3: st.annual3, ssDelayYears3: st.delay3,
  });
  const n = (k: string) => d[k] as number;
  const mk = (who: 1 | 2) => ages.map((a) => {
    const st = who === 1
      ? ssDrawdownStreams(n("ssIncome"), a, n("ssIncome2"), n("ssClaim2"), both, o.retireAge, n("ssDelay"))
      : ssDrawdownStreams(n("ssIncome"), n("ssClaim"), n("ssIncome2"), a, true, o.retireAge, n("ssDelay"));
    return { age: a, annual: who === 1 ? st.own1 + st.top1 : st.own2 + st.top2, ov: ov(st), current: a === Math.round(who === 1 ? n("ssClaim") : n("ssClaim2")) };
  });
  const rows1 = mk(1), rows2 = both ? mk(2) : null;
  return { rows1, rows2, flat: [...rows1, ...(rows2 || [])].map((r) => r.ov) };
}

export type PlanResult =
  | { kind: "hist"; H: DdHist; B: { o: DdOpts; H: DdHist; sc: DdScore } | null; sc: DdScore; sens: { rate: number; median: number }[]; ss: { rate: number; median: number }[] | null }
  | { kind: "mc"; M: DdMC; Mb: DdMC | null; baseInitial: number };

/** The selection and view shared by the table, the history chart and the
    balance chart. */
export interface PlanSel {
  sel: number | null; setSel: (i: number) => void;
  view: "all" | "year"; setView: (v: "all" | "year") => void;
}

export function PlanView({ v, R, ps }: { v: DDView; R: PlanResult | null; ps: PlanSel }) {
  const { o, age } = v;
  const hist = R?.kind === "hist" ? R : null, mc = R?.kind === "mc" ? R : null;
  const H = hist?.H ?? null;
  const show = H?.runs.find((r) => r.startIdx === ps.sel) || H?.runs[0] || null;
  const showLabel = show && H ? startLabel(show, H.monthly) : "";
  const view = mc ? "year" : ps.view;
  const run: DdRun | null = mc ? mc.M.med : show;
  const sensRows = hist ? hist.sens : mc ? mc.M.sens : null, ssRes = hist ? hist.ss : mc ? mc.M.ss : null;
  const sensOn = !!sensRows, ssOn = !!(ssRows(o, v.d) && ssRes);
  /* A story, in order: the balance through retirement, when you retire,
     what spending was like, then every start and the finer detail. */
  return (
    <>
      <BalancePanel v={v} R={R} ps={ps} show={show} showLabel={showLabel} />
      <SeqPanel v={v} H={H} ps={ps} />
      <IncomePanel v={v} R={R} view={view} show={show} showLabel={showLabel} />
      {/* What living on it was like: the scorecard beside the spending
          figures, two lists of the same weight. */}
      <div className="grid min-w-0 grid-cols-1 items-start gap-5 max-sm:gap-3.5 wide:grid-cols-2" data-ddtabs="plan">
        <ScorePanel v={v} R={R} monthly={!!v.lastMonthly} />
        <Card className="min-w-0" data-ddtabs="plan">
          <CardHeader><CardTitle id="ddIncomeSectionTitle">{hist && view === "year" ? "What your income looked like starting in " + showLabel : "What your income looked like"}
            <TipDot k="sequence" /></CardTitle><CardDescription>in today&apos;s dollars</CardDescription></CardHeader>
          <CardContent>
            <div id="ddSpendYearView" hidden={view !== "year"}><SpendStats run={run} /></div>
            <div id="ddSpendAllView" hidden={view !== "all"}><SpendStatsAll H={H} o={o} /></div>
            <Html className="hint mt-1" id="ddSpendNote" html={!R ? "" : view === "all" && H ? spendAllNote(H, o)
              : run ? spendNote(run, mc ? "Showing the same run as the table below." : "Showing the period selected above.") : ""} />
          </CardContent>
        </Card>
      </div>
      <YearsPanel v={v} H={H} ps={ps} />
      <Card data-ddtabs="plan">
        <CardHeader><CardTitle id="ddDetailTitle">{mc ? "Year by year, a median run" : show ? "Year by year, retiring in " + showLabel : "Year by year"}</CardTitle><CardAction><CsvButton table={v.detailTable} label="Year by year" /></CardAction></CardHeader>
        <Html className="hint py-0 px-4.5" id="ddDetailNote" html={mc ? "One representative simulation from the middle of the range."
          : show && H ? "Click any row in the table above to see that period's detail here. " +
            (show.depleted ? "This one ran out of money " + (age != null ? "at age " + ageVal(age, show.depletedYear!) : "in year " + show.depletedYear) + "."
              : "This one survived the full " + o.years + " years.") + whyText(o, show, H, age) : ""} />
        <div className="swipehint">Swipe the table sideways to see every column.</div>
        <div className="scroll"><DetailTable run={run} age={age} items={v.s.incomeItems as DdItem[]} tableRef={v.detailTable} /></div>
      </Card>
      <DistPanel v={v} R={R} />
      <div className={cn("grid min-w-0 grid-cols-1 items-start gap-5 max-sm:gap-3.5", sensOn && ssOn && "wide:grid-cols-2")} data-ddtabs="plan" hidden={!sensOn && !ssOn}>
        <Sensitivity rows={sensRows} label={mc ? "Baseline (sampled)" : "Baseline (historical)"} />
        <SSCompare v={v} res={ssRes} />
      </div>
    </>
  );
}

/* ---- the spending scorecard ---- */
function ScorePanel({ v, R, monthly }: { v: DDView; R: PlanResult | null; monthly: boolean }) {
  const sc = R?.kind === "hist" ? R.sc : R?.kind === "mc" ? R.M.sc : null;
  const base = R?.kind === "hist" ? R.B?.sc ?? null : R?.kind === "mc" ? R.Mb?.sc ?? null : null;
  const isMc = R?.kind === "mc";
  let rows: { k: string; v: string; note: string; delta: string }[] = [], counts = "";
  if (sc) {
    const n = sc.n, unit = isMc ? " runs" : " retirements";
    const who = (r: DdHistRun | null) => (r && r.startYear != null ? startLabel(r, monthly) : "");
    const stayed = n ? (n - sc.dipped) / n : 0, bStayed = base ? (base.n - base.dipped) / base.n : null;
    rows = [
      { k: "Never below the comfort line", v: pctStr(stayed, 1), note: (n - sc.dipped).toLocaleString("en-US") + " of " + n.toLocaleString("en-US") + unit,
        delta: base ? deltaHtml(stayed, bStayed, "pts") : "" },
      { k: "Years spent below it", v: pctStr(sc.years ? sc.below / sc.years : 0, 1), note: "of every year of every" + (isMc ? " run" : " retirement"),
        delta: base ? deltaHtml(sc.years ? sc.below / sc.years : 0, base.years ? base.below / base.years : 0, "pts", true) : "" },
      { k: "Longest stretch below", v: sc.longest ? sc.longest + (sc.longest === 1 ? " year" : " years") : "None",
        note: sc.longest && who(sc.longRun) ? "retiring in " + who(sc.longRun) : "never under the line", delta: base ? deltaHtml(sc.longest, base.longest, "n", true) : "" },
      { k: "Leanest year", v: money(sc.low), note: pctStr(sc.lowRatio, 0) + " of year one" + (who(sc.lowRun) ? ", retiring in " + who(sc.lowRun) : ""),
        delta: base ? deltaHtml(sc.low, base.low, "money") : "" },
      { k: "Typical lifetime spending", v: fmtAxisMoney(sc.lifeMed), note: "the median, in today's dollars", delta: base ? deltaHtml(sc.lifeMed, base.lifeMed, "money") : "" },
      { k: "Cuts per" + (isMc ? " run" : " retirement"), v: (Math.round(sc.cutsAvg * 10) / 10).toFixed(1),
        note: sc.maxCut > 0 ? "the biggest, " + pctStr(sc.maxCut, 0) + " in one year" : "never a cut", delta: base ? deltaHtml(sc.cutsAvg, base.cutsAvg, "n", true) : "" },
    ];
    const cnt = (k: string, val: number, tip: string) =>
      "<span class='ddcount'><span class='tipglue'>" + k + "<span class='tipdot' data-tip='" + tip + "' role='button' tabindex='0' aria-label='What is this?'>?</span></span><b>" +
      val.toLocaleString("en-US") + "</b></span>";
    counts = cnt("Big swings", sc.volatile, "ddswing") + cnt("50%+ above year one", sc.large, "ddlarge") + cnt("Half of year one or less", sc.small, "ddsmall") +
      cnt("Ended at twice the start", sc.bigEnd, "ddbigend") + cnt("Ended under half, not empty", sc.smallEnd, "ddsmallend") +
      "<span class='ddcount-of'>of " + n.toLocaleString("en-US") + unit + "</span>";
  }
  return (
    <Card id="ddScorePanel" className="min-w-0" data-ddtabs="plan">
      <CardHeader><CardTitle>Spending scorecard<TipDot k="ddscore" /></CardTitle><CardDescription id="ddScoreH2">{sc ? "comfort line " + lineWords(sc.comfort, v.age, " a year") : ""}</CardDescription></CardHeader>
      <CardContent>
        <div id="ddScore">
          {rows.map((r) => (
            <div className="kv" key={r.k}>
              <span className="k">{r.k}<span className="mssub">{r.note}</span></span>
              <span className="v flex flex-col items-end gap-1">{r.v}{r.delta ? <Html as="span" html={r.delta} /> : null}</span>
            </div>
          ))}
        </div>
        <Html className="ddcounts" id="ddCounts" html={counts} />
      </CardContent>
    </Card>
  );
}

/* ---- how each start fared ---- */
const SORT_COLS: [key: string, label: string, title?: string][] = [
  ["year", "Retired in"], ["outcome", "Outcome"], ["end", "Ending balance"], ["med", "Median year spending"], ["low", "Lowest year's spending"],
  ["stock", "Stocks / yr", "Stocks' yearly return over this retirement, compounded, before inflation"],
  ["bond", "Bonds / yr", "Bonds' yearly return over this retirement, compounded, before inflation"],
  ["infl", "Inflation / yr", "Inflation a year over this retirement, compounded"],
  ["cape", "CAPE at start", "Shiller's CAPE the month this retirement began: the S&P 500's price over ten years of its earnings, after inflation"],
];
function sortValue(r: DdHistRun, col: string, age: number | null): number | string {
  switch (col) {
    case "outcome": return outcomeText(r, age);
    case "end": return r.endReal;
    case "med": return r.medRealSpend;
    case "low": return r.minRealSpend;
    case "stock": return r.avgStock;
    case "bond": return r.avgBond;
    case "infl": return r.avgInfl;
    case "cape": return r.cape0;
    default: return r.startIdx;
  }
}
function YearsPanel({ v, H, ps }: { v: DDView; H: DdHist | null; ps: PlanSel }) {
  const sort = useSort<string>("year", 1);
  const table = useRef<HTMLTableElement>(null);
  const age = v.age;
  const runs = H ? sort.order(H.runs, (r, c) => sortValue(r, c, age)) : [];
  const pick = (r: DdHistRun) => {
    ps.setSel(r.startIdx);
    ps.setView("year");
  };
  return (
    <Card id="ddYearsPanel" data-ddtabs="plan" hidden={v.mode === "mc"}>
      <CardHeader><CardTitle id="ddYearsTitle">{H?.monthly ? "How each starting month fared" : "How each starting year fared"}</CardTitle><CardAction><CsvButton table={table} label="How each starting year fared" /></CardAction></CardHeader>
      <div className="swipehint">Swipe the table sideways to see every column.</div>
      <div className="scroll">
        <table id="ddStartTable" ref={table}>
          <thead><tr>
            {SORT_COLS.map(([k, label, title]) => (
              <th key={k} {...sort.th(k)} data-sort={k} title={title}>{label}</th>
            ))}
          </tr></thead>
          <tbody>
            {runs.map((r) => (
              <tr key={r.startIdx} className={"ddrow" + (r.startIdx === ps.sel ? " sel" : "")} data-start={r.startIdx} tabIndex={0}
                onClick={() => pick(r)}
                onKeyDown={(e) => {
                  if (e.key !== "Enter" && e.key !== " ") return;
                  e.preventDefault();
                  pick(r);
                }}>
                <td>{startLabel(r, H!.monthly)}</td><td className={r.depleted ? "neg" : "pos"}>{outcomeText(r, age)}</td>
                <td>{money(r.endReal)}</td><td>{money(r.medRealSpend)}</td><td>{money(r.minRealSpend)}</td>
                <td>{pctStr(r.avgStock, 1)}</td><td>{pctStr(r.avgBond, 1)}</td><td>{pctStr(r.avgInfl, 1)}</td><td>{r.cape0.toFixed(1)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

/* ---- when you retire: sequence risk ---- */
function SeqPanel({ v, H, ps }: { v: DDView; H: DdHist | null; ps: PlanSel }) {
  const [kind, setKind] = useState<"decade" | "year">("decade");
  const { o } = v;
  if (!H || !H.runs.length) return <Card id="ddSeqPanel" data-ddtabs="plan" hidden />;
  const M = seqMeasure(o), mo = H.monthly, n = H.runs[0].dec1.years, dec = kind === "decade";
  const eraYear = new Set(DD_ERAS.map((e) => e.year));
  const pts = H.runs.map((r) => ({
    x: dec ? r.dec1.port * 100 : r.startYear + (r.startMonth - 1) / 12, y: M.of(r), run: r, miss: r.depleted, cur: r.startIdx === ps.sel,
    label: dec && r.startMonth === 1 && eraYear.has(r.startYear) ? String(r.startYear) : null,
  }));
  const lo = H.runs[0].startYear, hi = H.runs[H.runs.length - 1].startYear;
  // The story: the weakest and strongest thirds of first decades, and a pair
  // whose whole retirements averaged alike.
  const by = H.runs.slice().sort((a, b) => a.dec1.port - b.dec1.port);
  const t = Math.max(1, Math.floor(by.length / 3)), low = by.slice(0, t), top = by.slice(by.length - t);
  const med = (a: DdHistRun[]) => { const x = a.map(M.of).sort((p, q) => p - q); return x[Math.floor(x.length / 2)]; };
  const failLow = low.filter((r) => r.depleted).length, failTop = top.filter((r) => r.depleted).length;
  const unit = mo ? "starting months" : "starts";
  let txt = "The first " + n + " years decide most retirements: that's when withdrawals are largest against the balance, " +
    "so losses then are locked in. The third of " + unit + " with the weakest first " + n + " years (under " +
    pct1(low[low.length - 1].dec1.port) + " a year after inflation, at your mix) " +
    (failLow ? "ran out in <b>" + failLow + " of " + low.length + "</b>, and " : "") + "left a typical <b>" + money(med(low)) + "</b>" +
    (M.name === "what was left" ? "" : " a year") + "; the strongest third (over " + pct1(top[0].dec1.port) + ") " +
    (failTop ? "ran out in " + failTop + " and " : "") + "left <b>" + money(med(top)) + "</b>. ";
  const pr = seqPair(H, M);
  if (pr && pr.kind === "beat")
    txt += "Retiring in " + startLabel(pr.a, mo) + " ran out though its " + o.years + " years averaged " + pct1(pr.a.full.port) +
      " a year after inflation, while " + startLabel(pr.b, mo) + " lasted on " + pct1(pr.b.full.port) +
      ": their first decades returned " + pct1(pr.a.dec1.port) + " and " + pct1(pr.b.dec1.port) + ".";
  else if (pr)
    txt += "Retiring in " + startLabel(pr.a, mo) + " and in " + startLabel(pr.b, mo) + " both averaged about " + pct1(pr.a.full.port) +
      " a year after inflation over " + o.years + " years, yet one left " + money(M.of(pr.a)) + " and the other " + money(M.of(pr.b)) +
      ": their first decades returned " + pct1(pr.a.dec1.port) + " and " + pct1(pr.b.dec1.port) + ".";
  const eras = DD_ERAS.filter((e) => e.to >= lo && e.from <= hi);
  return (
    <Card id="ddSeqPanel" data-ddtabs="plan">
      <CardHeader><CardTitle>When you retire<TipDot k="ddseq" /></CardTitle><CardAction>
        <SegmentedGroup id="segDDSeq">
          <SegmentedItem data-ddseq="decade" pressed={dec} onClick={() => setKind("decade")}>By first decade</SegmentedItem>
          <SegmentedItem data-ddseq="year" pressed={!dec} onClick={() => setKind("year")}>By start year</SegmentedItem>
        </SegmentedGroup>
      </CardAction></CardHeader>
      <CardContent id="ddSeqIntro"><Html className="ddintro" html={txt + (dec ? "" : " The dashed lines mark the eras below.")} /></CardContent>
      <Scatter id="DDQ" pts={pts} ariaLabel="Each start's first ten years against how its retirement ended"
        opt={{
          small: pts.length > 150, yZero: true, yFmt: fmtAxisMoney,
          xFmt: dec ? (x) => fmtNum(x) + "%" : (x) => String(Math.round(x)),
          xLabel: dec ? "First " + n + " years' return a year, after inflation →" : "Retired in →",
          yLabel: dec ? M.axis : null,
          marks: dec ? null : DD_ERAS.filter((e) => e.year >= lo && e.year <= hi).map((e) => ({ x: e.year, label: String(e.year) })),
        }}
        onPick={(p) => {
          ps.setSel(p.run.startIdx);
          ps.setView("year");
        }}
        tip={(p) => {
          const r = p.run, era = ddEraFor(r.startYear);
          return <>
            <b>Retiring in {startLabel(r, mo)}</b>
            <br />First {r.dec1.years} years <span className="n">{pct1(r.dec1.port)}/yr</span>
            <br />All {o.years} years <span className="n">{pct1(r.full.port)}/yr</span>
            <br />{r.depleted ? <span className="neg">{outcomeText(r, v.age)}</span> : <>Left <span className="n">{money(r.endReal)}</span></>}
            {era ? <><br /><span className="ddtip-era">{era.title}</span></> : null}
            <br /><span className="ddtip-era">Tap to see it year by year</span>
          </>;
        }} />
      <Html className="legend" id="legendDDQ" html={(dec ? "" : "<span class='ddleg-k'>" + M.axis + ":</span> ") + swatch(SERIES.gain, "Lasted") + swatch(SERIES.loss, "Ran out") +
        (ps.sel != null ? swatch(SERIES.plan, "The start picked in the table") : "")} />
      <details className="dderas" id="ddEras" hidden={!eras.length}><summary>What happened in the marked years</summary>
        <div id="ddEraList">{eras.map((e) => <p key={e.year}><b>{e.year}: {e.title}.</b> {e.note}</p>)}</div>
      </details>
    </Card>
  );
}

/* ---- the balance through retirement ---- */
function medLine(H: DdHist, field: "realEnd" | "realSpend", from0: boolean, initial: number) {
  const out = from0 ? [{ year: 0, value: initial }] : [], n = H.runs[0] ? H.runs[0].rows.length : 0;
  for (let y = 0; y < n; y++) {
    const vals = H.runs.map((r) => (r.rows[y] ? r.rows[y][field] : 0)).sort((a, b) => a - b);
    out.push({ year: y + 1, value: vals[Math.floor(vals.length / 2)] });
  }
  return out;
}
function baseOverlay(B: { o: DdOpts; H: DdHist } | null, field: "realEnd" | "realSpend", from0: boolean, startIdx: number | null) {
  if (!B) return null;
  if (startIdx != null) {
    const r = B.H.runs.find((x) => x.startIdx === startIdx);
    if (!r) return null;
    return baseLine([...(from0 ? [{ year: 0, value: B.o.initial }] : []), ...r.rows.map((w) => ({ year: w.year, value: w[field] }))]);
  }
  return baseLine(medLine(B.H, field, from0, B.o.initial));
}
/** Percentiles at each year across runs, and each run as a faint line. */
function fanOf(runs: DdHistRun[], years: number, first: number | null, val: (r: DdHistRun, y: number) => number) {
  const pts: BandPoint[] = [];
  for (let y = first == null ? 1 : 0; y <= years; y++) {
    const vals = runs.map((r) => (y === 0 ? first! : val(r, y))).sort((a, b) => a - b);
    const at = (q: number) => vals[Math.min(vals.length - 1, Math.floor(vals.length * q))];
    pts.push({ year: y, base: at(0.5), hi: at(0.9), lo: at(0.1), p25: at(0.25), p75: at(0.75) });
  }
  return { pts, traces: { xs: pts.map((a) => a.year), lines: runs.map((r) => pts.map((a) => (a.year === 0 ? first! : val(r, a.year)))) } };
}
const lbl = (age: number | null, year: number, point: boolean) => (age != null ? "Age " + (point ? age + year : ageVal(age, year)) : "Year " + fmtNum(year));

function BalancePanel({ v, R, ps, show, showLabel }: { v: DDView; R: PlanResult | null; ps: PlanSel; show: DdHistRun | null; showLabel: string }) {
  const { o, age } = v;
  const xOff = age != null ? age : 0;
  let title = "Every historical starting year", chart: React.ReactNode = null, legend = "", note = "";
  if (R?.kind === "hist") {
    const H = R.H, B = R.B;
    if (ps.view === "all") {
      title = H.monthly ? "Every historical starting month" : "Every historical starting year";
      const f = fanOf(H.runs, o.years, o.initial, (r, y) => (r.rows[y - 1] ? r.rows[y - 1].realEnd : 0));
      const ov = baseOverlay(B, "realEnd", true, null);
      chart = <BandChart id="DD" pts={f.pts} maxX={o.years} mode="mc" xOffset={xOff} enhanced ariaLabel="Portfolio balance through retirement"
        traces={v.tracesOn ? f.traces : undefined} overlay={ov ?? undefined}
        tip={(b) => <><b>{lbl(age, b.year, true)}</b><FanTipRows b={b} /></>} />;
      legend = "hist";
      note = "Each band covers the range of outcomes across all " + H.total + " historical retirements, in today's dollars. The <b>median</b> line is the middle outcome.";
    } else if (show) {
      title = "Starting in " + showLabel;
      const pts: BandPoint[] = [{ year: 0, base: o.initial, hi: o.initial, lo: 0 }, ...show.rows.map((r) => ({ year: r.year, base: r.realEnd, hi: r.realEnd, lo: 0 }))];
      const ov = baseOverlay(B, "realEnd", true, show.startIdx);
      chart = <BandChart id="DD" pts={pts} maxX={o.years} xOffset={xOff} enhanced noLoLine overlay={ov ?? undefined} ariaLabel="Portfolio balance through retirement"
        tip={(b) => <><b>{lbl(age, b.year, true)}</b><br /><span className="n">{money(b.base)}</span></>} />;
      legend = swatch(SERIES.plan, "Portfolio balance, in today’s dollars") + (ov ? swatch(BASE_COLOR, "Baseline, same start") : "");
      note = "Balance in today’s dollars, retiring in " + showLabel + ".";
    }
  } else if (R?.kind === "mc") {
    const M = R.M, Mb = R.Mb;
    title = "Range of outcomes";
    const pts: BandPoint[] = [{ year: 0, base: o.initial, hi: o.initial, lo: o.initial, p25: o.initial, p75: o.initial },
      ...M.bands.map((b) => ({ year: b.year, base: b.p50, hi: b.p90, lo: b.p10, p25: b.p25, p75: b.p75 }))];
    const ov = Mb ? baseLine([{ year: 0, value: R.baseInitial }, ...Mb.bands.map((b) => ({ year: b.year, value: b.p50 }))]) : undefined;
    chart = <BandChart id="DD" pts={pts} maxX={o.years} mode="mc" xOffset={xOff} enhanced overlay={ov} ariaLabel="Portfolio balance through retirement"
      tip={(b) => <><b>{lbl(age, b.year, true)}</b><FanTipRows b={b} /></>} />;
    legend = "mc";
    note = "Balance in today's dollars across " + M.trials.toLocaleString("en-US") + " simulated retirements.";
  }
  const hasBase = R?.kind === "hist" ? !!R.B : R?.kind === "mc" ? !!R.Mb : false;
  return (
    <Card data-ddtabs="plan">
      <CardHeader><CardTitle id="ddChartTitle">{title}</CardTitle><CardAction id="ddViewWrap" hidden={R?.kind !== "hist"}>
        <SegmentedGroup id="segDDView">
          <SegmentedItem data-ddview="year" pressed={ps.view === "year"} onClick={() => ps.setView("year")}>Selected year</SegmentedItem>
          <SegmentedItem data-ddview="all" pressed={ps.view === "all"} onClick={() => ps.setView("all")}>All years</SegmentedItem>
        </SegmentedGroup>
      </CardAction></CardHeader>
      {chart ?? <BandChart id="DD" pts={[]} maxX={1} ariaLabel="Portfolio balance through retirement" tip={() => null} />}
      {legend === "hist" ? <HistLegend id="legendDD" tracesOn={v.tracesOn} onToggleTraces={v.toggleTraces}>{hasBase ? <BaseSwatch /> : null}</HistLegend>
        : legend === "mc" ? <McLegend id="legendDD" noDet>{hasBase ? <BaseSwatch /> : null}</McLegend>
          : <Html className="legend" id="legendDD" html={legend} />}
      <Html className="mcnote" id="ddChartNote" html={note} />
    </Card>
  );
}
const BaseSwatch = () => <span><i className="bg-series-gray"></i>Baseline median</span>;

/* ---- spending ---- */
const realOf = (r: { realSpend?: number; realWithdrawal: number }) => (r.realSpend != null ? r.realSpend : r.realWithdrawal);
function spendFacts(run: DdRun) {
  const real = run.rows.map(realOf), sorted = real.slice().sort((a, b) => a - b);
  let cuts = 0, maxCut = 0;
  for (let i = 1; i < real.length; i++) {
    const chg = real[i] - real[i - 1];
    if (chg < -0.5) { cuts++; if (-chg > maxCut) maxCut = -chg; }
  }
  return { real, high: sorted[sorted.length - 1], low: sorted[0], med: sorted[Math.floor(sorted.length / 2)], total: real.reduce((a, x) => a + x, 0), cuts, maxCut };
}
function SpendStats({ run }: { run: DdRun | null }) {
  const f = run && run.rows.length ? spendFacts(run) : null;
  return (
    <div>
      <div>
        <KV k="Highest year" id="ddSpendHigh" v={f ? money(f.high) : ""} />
        <KV k="Lowest year" id="ddSpendLow" v={f ? money(f.low) : ""} />
        <KV k="Median year" id="ddSpendMed" v={f ? money(f.med) : ""} />
      </div>
      <div>
        <KV k="Years spending was cut" id="ddSpendCuts" v={f ? f.cuts + " of " + f.real.length + " years" : ""} />
        <KV k="Biggest single-year cut" id="ddSpendMaxCut" v={f ? (f.maxCut > 0 ? "−" + money(f.maxCut) + " in one year" : "None") : ""} />
        <KV k="Total spent over retirement" id="ddSpendTotal" v={f ? money(f.total) : ""} />
      </div>
    </div>
  );
}
function spendNote(run: DdRun, label: string): string {
  if (!run.rows.length) return label;
  const f = spendFacts(run), swing = f.high > 0 ? (f.high - f.low) / f.high : 0;
  return label + " Spending in today's dollars ranged from " + money(f.low) + " to " + money(f.high) +
    (swing > 0.01 ? ", a swing of " + pctStr(swing, 0) + " between the best and worst year." : ", essentially flat throughout.");
}
/* Every year of every start pooled: the best and worst years ever seen, and
   how the total over a retirement varied with when it began. */
function spendAll(H: DdHist) {
  const all: number[] = [], totals: number[] = [], cuts: number[] = [];
  let maxCut = 0;
  for (const r of H.runs) {
    const real = r.rows.map(realOf);
    all.push(...real);
    totals.push(real.reduce((a, x) => a + x, 0));
    let c = 0;
    for (let i = 1; i < real.length; i++) {
      const chg = real[i] - real[i - 1];
      if (chg < -0.5) { c++; if (-chg > maxCut) maxCut = -chg; }
    }
    cuts.push(c);
  }
  const sv = all.slice().sort((a, b) => a - b), st = totals.slice().sort((a, b) => a - b);
  return {
    high: sv[sv.length - 1], low: sv[0], med: sv[Math.floor(sv.length / 2)], avg: all.reduce((a, x) => a + x, 0) / all.length,
    totalMed: st[Math.floor(st.length / 2)], totalMin: st[0], totalMax: st[st.length - 1], cutsAvg: cuts.reduce((a, x) => a + x, 0) / H.runs.length, maxCut,
  };
}
function SpendStatsAll({ H, o }: { H: DdHist | null; o: DdOpts }) {
  const f = H?.runs.length ? spendAll(H) : null;
  return (
    <div>
      <div>
        <KV k="Best single year" id="ddAggHigh" v={f ? money(f.high) : ""} />
        <KV k="Worst single year" id="ddAggLow" v={f ? money(f.low) : ""} />
        <KV k="Median single year" id="ddAggMed" v={f ? money(f.med) : ""} />
        <KV k="Average single year" id="ddAggAvg" v={f ? money(f.avg) : ""} />
      </div>
      <div>
        <KV k="Median total spent over retirement" id="ddAggTotalMed" v={f ? money(f.totalMed) : ""} />
        <KV k="Total spent, lowest to highest scenario" id="ddAggTotalRange" v={f ? (Math.round(f.totalMax - f.totalMin) < 1 ? money(f.totalMin) + " in every one" : money(f.totalMin) + " – " + money(f.totalMax)) : ""} />
        <KV k="Years spending was cut, on average" id="ddAggCutsAvg" v={f ? f.cutsAvg.toFixed(1) + " of " + o.years + " years" : ""} />
        <KV k="Biggest single-year cut, ever" id="ddAggMaxCut" v={f ? (f.maxCut > 0 ? "−" + money(f.maxCut) + " in one year" : "None") : ""} />
      </div>
    </div>
  );
}
function spendAllNote(H: DdHist, o: DdOpts): string {
  const f = spendAll(H), n = H.runs.length;
  return Math.round(f.high - f.low) < 1
    ? "Across all " + n + " historical starting years, spending held at " + money(f.low) + " a year in today's dollars, " + money(f.totalMin) + " over a full " + o.years + "-year retirement."
    : "Across all " + n + " historical starting years. A single year's spending ranged from " + money(f.low) + " to " + money(f.high) +
      " in today's dollars, and a full " + o.years + "-year retirement totaled anywhere from " + money(f.totalMin) + " to " + money(f.totalMax) + " depending on when it began.";
}

function IncomePanel({ v, R, view, show, showLabel }: { v: DDView; R: PlanResult | null; view: "all" | "year"; show: DdHistRun | null; showLabel: string }) {
  const { o, age } = v;
  const xOff = age != null ? age - 1 : 0;
  let title = "Spending through retirement", chart: React.ReactNode = null, legend: React.ReactNode = null, note = "";
  const single = (run: DdRun, ov: ReturnType<typeof baseLine> | null) => {
    const pts: BandPoint[] = run.rows.map((r) => { const x = realOf(r); return { year: r.year, base: x, hi: x, lo: x }; });
    chart = pts.length ? <BandChart id="DDI" pts={pts} maxX={pts.length} xOffset={xOff} enhanced overlay={ov ?? undefined} ariaLabel="Withdrawal amount over time"
      tip={(b) => <><b>{lbl(age, b.year, false)}</b><br /><i className="tipsw bg-series-plan"></i>Spending <span className="n">{money(b.base)}</span></>} /> : null;
    legend = <Html className="legend" id="legendDDI" html={swatch(SERIES.plan, "Total spending, in today's dollars") + (ov ? swatch(BASE_COLOR, "Baseline") : "")} />;
  };
  if (R?.kind === "hist") {
    if (view === "all") {
      const f = fanOf(R.H.runs, o.years, null, (r, y) => (r.rows[y - 1] ? realOf(r.rows[y - 1]) : 0));
      const ov = baseOverlay(R.B, "realSpend", false, null);
      chart = <BandChart id="DDI" pts={f.pts} maxX={o.years} mode="mc" xOffset={xOff} enhanced overlay={ov ?? undefined} ariaLabel="Withdrawal amount over time"
        traces={v.tracesOn ? f.traces : undefined}
        tip={(b) => <><b>{lbl(age, b.year, false)}</b><FanTipRows b={b} /></>} />;
      legend = <HistLegend id="legendDDI" tracesOn={v.tracesOn} onToggleTraces={v.toggleTraces}>{ov ? <BaseSwatch /> : null}</HistLegend>;
      note = "Median, 10th–90th and 25th–75th percentile spending by year of retirement, across all " + R.H.total + " historical " + (R.H.monthly ? "starting months." : "starting years.");
    } else if (show) {
      title = "Spending through retirement, retiring in " + showLabel;
      single(show, baseOverlay(R.B, "realSpend", false, show.startIdx));
    }
  } else if (R?.kind === "mc") {
    title = "Spending through retirement, a median run";
    single(R.M.med, R.Mb ? baseLine(R.Mb.med.rows.map((w) => ({ year: w.year, value: w.realSpend }))) : null);
  }
  return (
    <Card data-ddtabs="plan">
      <CardHeader><CardTitle id="ddIncomeChartTitle">{title}</CardTitle></CardHeader>
      {chart ?? <BandChart id="DDI" pts={[]} maxX={1} ariaLabel="Withdrawal amount over time" tip={() => null} />}
      {legend ?? <div className="legend" id="legendDDI"></div>}
      <div className="hint pt-0 px-4.5 pb-3.5" id="ddIncomeNote">{note}</div>
    </Card>
  );
}

/* ---- the spread of outcomes ---- */
function DistPanel({ v, R }: { v: DDView; R: PlanResult | null }) {
  const [kind, setKind] = useState<"bal" | "spend">("bal");
  const [atPick, setAt] = useState<number | null>(null);
  const { o, age, comfort } = v;
  const years = o.years;
  // The year shown stays put as the plan's length changes, until it no
  // longer fits; it starts on the final year.
  if (R && (atPick == null || atPick > years)) setAt(years);
  const at = atPick == null || atPick > years ? years : atPick;
  let vals: number[] = [];
  if (R?.kind === "hist") vals = R.H.runs.map((r) => { const w = r.rows[at - 1]; return w ? (kind === "bal" ? w.realEnd : w.realSpend) : 0; });
  else if (R?.kind === "mc") {
    const M = R.M, src = kind === "bal" ? M.bal : M.spend;
    vals = Array.from({ length: M.n }, (_, i) => src[i * M.years + at - 1]);
  }
  vals.sort((a, b) => a - b);
  const n = vals.length, bal = kind === "bal";
  const line = ddLineAt(comfort, at - 1);
  let stats = "";
  if (n) {
    let sum = 0, sq = 0, zeros = 0, below = 0;
    for (const x of vals) { sum += x; sq += x * x; if (x < 0.5) zeros++; if (!bal && line > 0 && x < line - 0.5) below++; }
    const avg = sum / n, sd = Math.sqrt(Math.max(0, sq / n - avg * avg));
    const stat = (k: string, val: string) => "<div><span>" + k + "</span><b>" + val + "</b></div>";
    stats = stat("Median", money(vals[Math.floor(n / 2)])) + stat("Average", money(avg)) + stat("Spread (std. dev.)", money(sd)) +
      stat("Largest", money(vals[n - 1])) + stat("Smallest", money(vals[0])) +
      (bal ? stat("Empty", zeros.toLocaleString("en-US") + " (" + pctStr(zeros / n, 1) + ")")
        : stat("Under the comfort line", below.toLocaleString("en-US") + " (" + pctStr(below / n, 1) + ")"));
  }
  const isMc = R?.kind === "mc";
  return (
    <Card id="ddDistPanel" data-ddtabs="plan">
      <CardHeader><CardTitle id="ddDistTitle">{!R || bal ? "Spread of ending balances" : "Spread of spending"}</CardTitle><CardAction>
        <SegmentedGroup id="segDDDist">
          <SegmentedItem data-dddist="bal" pressed={bal} onClick={() => setKind("bal")}>Balance</SegmentedItem>
          <SegmentedItem data-dddist="spend" pressed={!bal} onClick={() => setKind("spend")}>Spending</SegmentedItem>
        </SegmentedGroup>
        <NativeSelect className="w-auto" id="ddDistYear" aria-label="Which year" value={String(at)} onChange={(e) => setAt(parseInt(e.target.value, 10) || null)}>
          {Array.from({ length: years }, (_, k) => k + 1).map((y) => (
            <option key={y} value={y}>{y === years ? "Final year" : age != null ? "Age " + fmtNum(ageVal(age, y)) : "Year " + y}</option>
          ))}
        </NativeSelect>
      </CardAction></CardHeader>
      <Histogram id="DDH" bins={n ? roundBins(vals) : []} mark={!bal && line > 0 ? line : null} ariaLabel="How the outcomes spread"
        tip={(b) => <><b>{money(b.lo)} – {money(b.hi)}</b><br /><span className="n">{b.n.toLocaleString("en-US")}</span> {isMc ? "runs" : "retirements"}</>} />
      <Html className="ddstats" id="ddDistStats" html={stats} />
    </Card>
  );
}

/* ---- one retirement, year by year ---- */
function DetailTable({ run, age, items, tableRef }: { run: DdRun | null; age: number | null; items: DdItem[]; tableRef: React.RefObject<HTMLTableElement | null> }) {
  const other = items.some((it) => it.on !== false), hasG = !!run?.rows.some((r) => r.guaranteed > 0);
  return (
    <table id="ddTable" ref={tableRef}>
      <thead><tr><th id="ddTableYearHeader">{age != null ? "Age" : "Year"}</th><th>Start, today&apos;s $</th><th>Social Security</th>
        <th id="ddOtherIncomeHeader" hidden={!other}>Other Income</th><th id="ddGuarHeader" hidden={!hasG}>Guaranteed</th>
        <th>From portfolio</th><th>Total spend</th><th>Spend, today&apos;s $</th><th>Return</th><th>End balance, today&apos;s $</th></tr></thead>
      <tbody>
        {run?.rows.map((r, i) => (
          <tr key={r.year}>
            <td>{ageVal(age, r.year)}</td><td>{money(i === 0 ? r.start : run.rows[i - 1].realEnd)}</td><td>{r.ss > 0 ? money(r.ss) : "—"}</td>
            {other ? <td>{r.customIncome > 0 ? money(r.customIncome) : "—"}</td> : null}
            {hasG ? <td>{r.guaranteed > 0 ? money(r.guaranteed) : "—"}</td> : null}
            <td>{money(r.withdrawal)}</td><td>{money(r.spend)}</td><td>{money(realOf(r))}</td>
            <td className={r.ret >= 0 ? "pos" : "neg"}>{r.ret.toFixed(1)}%</td><td>{money(r.realEnd)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/* ---- return sensitivity and claiming ages ---- */
/* The headers once named a --rule color that doesn't exist, which left them
   with no bottom border; border-b-0 keeps them that way. */
const TH = "text-left py-1.25 px-2 border-b-0", THR = "text-right py-1.25 px-2 border-b-0";
const TD = "py-1.25 px-2", TDR = "text-right py-1.25 px-2";

function Sensitivity({ rows, label }: { rows: { rate: number; median: number }[] | null; label: string }) {
  return (
    <Card id="ddSensPanel" className="min-w-0" data-ddtabs="plan" hidden={!rows}>
      <CardHeader><CardTitle>Return sensitivity</CardTitle></CardHeader>
      <div className="hint pt-0 px-4.5 pb-2.5">How your plan holds up if returns run higher or lower than history suggests.</div>
      <div className="pt-0 px-4.5 pb-3.5" id="ddSensTable">
        {rows ? <table className="w-full border-collapse">
          <thead><tr><th className={TH}>Return assumption</th><th className={THR}>Success rate</th><th className={THR}>Median ending balance</th></tr></thead>
          <tbody>
            {rows.map((r, i) => {
              const drag = DD_DRAGS[i];
              return (
                <tr key={i} className={drag === 0 ? "font-semibold" : undefined}>
                  <td className={TD}>{drag === 0 ? label : drag > 0 ? "-" + drag + "% / yr" : "+" + -drag + "% / yr"}</td>
                  <td className={TDR + " " + rateClass(r.rate)}>{pctStr(r.rate, 1)}</td><td className={TDR}>{money(r.median)}</td>
                </tr>
              );
            })}
          </tbody>
        </table> : null}
      </div>
    </Card>
  );
}

function SSCompare({ v, res }: { v: DDView; res: { rate: number; median: number }[] | null }) {
  const ssx = ssRows(v.o, v.d);
  const on = !!(ssx && res);
  const build = (rows: NonNullable<typeof ssx>["rows1"], off: number) => (
    <table className="w-full border-collapse">
      <thead><tr><th className={TH}>Claim age</th><th className={THR}>Annual benefit</th><th className={THR}>Success rate</th><th className={THR}>Median ending balance</th></tr></thead>
      <tbody>
        {rows.map((r, i) => {
          const R = res![off + i];
          return (
            <tr key={r.age} className={r.current ? "font-semibold" : undefined}>
              <td className={TD}>Age {r.age}{r.current ? " ◄" : ""}</td><td className={TDR}>{money(r.annual)}/yr</td>
              <td className={TDR + " " + rateClass(R.rate)}>{pctStr(R.rate, 1)}</td><td className={TDR}>{money(R.median)}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
  return (
    <Card id="ddSSBreakEvenPanel" className="min-w-0" data-ddtabs="plan" hidden={!on}>
      <CardHeader><CardTitle>Social Security claiming age comparison</CardTitle></CardHeader>
      <div className="hint pt-0 px-4.5 pb-2.5">How your claiming age affects success rate and ending balance. All other inputs held constant.</div>
      <div className="pt-0 px-4.5 pb-3.5" id="ddSSBreakEvenTable">
        {on ? ssx!.rows2 ? <>
          <p className="font-semibold mt-0 mx-0 mb-1.5">Your claiming age (spouse held constant)</p>{build(ssx!.rows1, 0)}
          <p className="font-semibold mt-3 mx-0 mb-1.5">Spouse&apos;s claiming age (yours held constant)</p>{build(ssx!.rows2, ssx!.rows1.length)}
        </> : build(ssx!.rows1, 0) : null}
      </div>
    </Card>
  );
}

/** The historical extras worked out once per run: the sensitivity rows and
    the claiming-age rows. */
export function histExtras(o: DdOpts, d: Record<string, unknown>) {
  const sens = DD_DRAGS.map((drag) => { const S = ddQuick({ ...o, returnDrag: drag }); return { rate: S.successRate, median: S.medianEnd }; });
  const ssx = ssRows(o, d);
  const ss = ssx ? ssx.flat.map((ov) => { const S = ddQuick({ ...o, ...ov }); return { rate: S.successRate, median: S.medianEnd }; }) : null;
  return { sens, ss };
}
