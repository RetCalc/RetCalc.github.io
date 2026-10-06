"use client";

/* Compare strategies: every strategy tuned to spend as much as it can at
   the same risk, side by side, and the ones ticked through one hard start.
   The tuning runs in the worker. From ddShowRefresh(), ddPaintShow() and
   ddPaintSpot() in src/js/app/15b-drawdown-views.js. */

import { useRef, useState } from "react";
import { MultiChart, type Series } from "@/components/charts/MultiChart";
import { Scatter } from "@/components/charts/Scatter";
import { fmtAxisMoney } from "@/components/charts/scale";
import { MON } from "@/components/charts/HistNotes";
import { TipDot } from "@/components/shell/Tooltips";
import { CsvButton } from "@/components/common/CsvButton";
import { Html } from "@/components/common/Html";
import { useJob } from "@/lib/engine/jobs";
import { ddForTarget, ddLineAt, ddWindows, ddWithDial, runDrawdown, type DdShow, type DdShowItem, type DdTarget } from "@/lib/engine/typed-drawdown";
import { fmtNum, money, pctStr } from "@/lib/format";
import { useSort } from "@/lib/useSort";
import { PICKER_IDS, type DDView } from "./Drawdown";
import { DD_STRAT_NAMES, DD_UI, ageVal, dialFields, dialText, escapeHtml, targetWords, swatch } from "./text";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const SPOT_COLORS = ["#e9b872", "#4fbf95", "#7d9fd6", "#e2795f", "#b49be0", "#7fd0d6"];
type Col = "name" | "first" | "life" | "low" | "cuts" | "end";

export function CompareView({ v, T, active }: { v: DDView; T: DdTarget; active: boolean }) {
  const { o, d } = v;
  const on = active && o.initial > 0;
  const job = useJob<DdShow, { o: typeof o; T: DdTarget; ids: string[] }>("show", "showdown", on ? { o, T, ids: PICKER_IDS } : null, JSON.stringify([d, T]));
  // the results, with the plan and target they were tuned for
  const res = job.res, so = job.args?.o ?? o, sT = job.args?.T ?? T;

  const sort = useSort<Col>("life", -1, (c) => (c === "name" || c === "cuts" ? 1 : -1));
  const [charted, setCharted] = useState<Record<string, 1> | null>(null);
  const [yk, setYk] = useState<"end" | "low" | "first">("end");
  const table = useRef<HTMLTableElement>(null);

  let intro = on && (job.stale || !res) ? "<span class='ddwork'>Tuning every strategy to the same risk…</span>" : "";
  let list: DdShowItem[] = [];
  let chartedNow: Record<string, 1> = {};
  if (res) {
    list = res.list.slice();
    chartedNow = charted && Object.keys(charted).length ? charted
      : Object.fromEntries(["fixed", "guardrails", "vpw", so.strategy].filter((id) => list.some((x) => x.id === id)).map((id) => [id, 1 as const]));
    const met = list.filter((x) => x.met);
    const top = met.slice().sort((a, b) => b.life - a.life)[0];
    const steady = met.filter((x) => x.cuts < 0.05).sort((a, b) => b.life - a.life)[0];
    if (!job.stale) intro = "Each strategy is set to spend as much as it can while " + targetWords(sT, v.age) + "." +
      (so.path && so.path !== "flat" ? " All are compared on steady spending; your spending path applies to the steady strategies only." : "") +
      (sT.crit === "comfort" ? " The flexible ones are held at that line or above, as their minimum, so the risk they carry is running out of money while holding it." : "") +
      (top ? " Over a typical retirement, <b>" + escapeHtml(DD_STRAT_NAMES[top.id]) + "</b> spends the most, " + money(top.life) + " in today's dollars" +
        (steady && steady.id !== top.id ? "; the steadiest, <b>" + escapeHtml(DD_STRAT_NAMES[steady.id]) + "</b>, never cuts and spends " + money(steady.life) : "") + "." : "");
    list = sort.order(list, (x, c) => (c === "name" ? DD_UI[x.id].name : x[c] as number));
  }
  const yName = { end: "Typically left at the end", low: "Leanest year", first: "Year one" }[yk];
  const spotLbl = (sp: { year: number; month: number } | null) => (sp ? (sp.month && sp.month !== 1 ? MON[sp.month - 1] + " " : "") + sp.year : "");
  const th = (c: Col, label: string) => <th {...sort.th(c, !!res)} data-ssort={c}>{label}</th>;
  return (
    <>
      <Card id="ddShowPanel" data-ddtabs="compare">
        <CardHeader><CardTitle>Strategy showdown<TipDot k="ddshowdown" /></CardTitle><CardDescription>each tuned to the same risk</CardDescription><CardAction><CsvButton table={table} label="Strategy showdown" /></CardAction></CardHeader>
        <CardContent id="ddShowIntro"><Html className="ddintro" html={intro} /></CardContent>
        <div className="ddchartbar">
          <span>Typical lifetime spending against</span>
          <span className="seg" id="segDDShowY">
            {([["end", "what's left"], ["low", "the leanest year"], ["first", "year one"]] as const).map(([k, label]) => (
              <button key={k} type="button" data-showy={k} className={yk === k ? "on" : undefined} onClick={() => setYk(k)}>{label}</button>
            ))}
          </span>
        </div>
        <Scatter id="DDS" ariaLabel="Each strategy's typical lifetime spending against what it leaves, its leanest year or its year one"
          pts={res ? res.list.map((x) => ({ x: x.life, y: x[yk], label: DD_UI[x.id].short, id: x.id, cur: x.id === so.strategy, miss: !x.met })) : []}
          opt={{ xFmt: fmtAxisMoney, yFmt: fmtAxisMoney, xLabel: "Typical lifetime spending →", yLabel: yName + " →", yZero: true,
            hLine: sT.crit === "comfort" && yk !== "end" ? { y: ddLineAt(sT.comfort, 0), label: "comfort line" } : null }}
          tip={(p) => {
            const x = res!.list.find((q) => q.id === p.id)!;
            return <>
              <b>{DD_UI[x.id].name}</b>
              {x.tuned ? <><br />{dialText(x.id, x.dial, so)}</> : null}
              <br />Year one <span className="n">{money(x.first)}</span>
              <br />Typical lifetime <span className="n">{money(x.life)}</span>
              <br />Leanest year <span className="n">{money(x.low)}</span>
              <br />Typically left <span className="n">{money(x.end)}</span>
              {x.met ? null : <><br /><span className="neg">Closest it gets: {pctStr(x.share, 0)} of starts</span></>}
            </>;
          }} />
        <Html className="legend" id="legendDDS" html={res ? swatch("#e9b872", "Your strategy") + swatch("#4fbf95", "Meets the target") + swatch("#e2795f", "Can't meet it: shown at its closest") : ""} />
        <div className="swipehint">Swipe the table sideways to see every column.</div>
        <div className="scroll">
          <table id="ddShowTable" ref={table}>
            <thead><tr>
              {th("name", "Strategy")}<th>Setting found</th>{th("first", "Year one")}{th("life", "Typical lifetime spending")}
              {th("low", "Leanest year")}{th("cuts", "Cuts per retirement")}{th("end", "Typically left")}<th>Chart</th><th></th>
            </tr></thead>
            <tbody>
              {list.map((x) => (
                <tr key={x.id} className={(x.id === so.strategy ? "ddcur" : "") + (x.met ? "" : " ddmiss")}>
                  <td>{DD_UI[x.id].name}</td>
                  <td className="ddset">{x.tuned ? dialText(x.id, x.dial, so) + (x.capped ? " (top of its range)" : "") : "No setting to tune"}
                    {x.floor > 0 ? <small>never below {money(x.floor)}</small> : null}
                    {!x.met ? <small className="neg">closest: {pctStr(x.share, 0)} of starts</small> : null}</td>
                  <td>{money(x.first)}</td><td>{money(x.life)}</td>
                  <td>{money(x.low)}{x.lowStart ? <small>{spotLbl(x.lowStart)}</small> : null}</td>
                  <td>{(Math.round(x.cuts * 10) / 10).toFixed(1)}</td><td>{money(x.end)}</td>
                  <td><input type="checkbox" data-showchart={x.id} checked={!!chartedNow[x.id]} aria-label={"Chart " + DD_UI[x.id].short}
                    onChange={(e) => {
                      const next = { ...chartedNow };
                      if (e.target.checked) next[x.id] = 1;
                      else delete next[x.id];
                      setCharted(next);
                    }} /></td>
                  <td><Button variant="outline" size="sm" data-showuse={x.id} onClick={() => v.apply(
                    x.tuned ? dialFields(so, x.id, x.dial!, sT) : { strategy: x.id },
                    "Using " + DD_UI[x.id].name + (x.tuned ? ", " + dialText(x.id, x.dial, so) : ""))}>
                    {x.id === so.strategy && x.tuned ? "Use setting" : "Use"}</Button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Html className="hint ddpad" id="ddShowNote" html={res ? "Year one, the leanest year and lifetime spending are what was actually spent: the strategy's spending with " +
          "Social Security, other income and any guaranteed income, in today's dollars, without extra expenses. “Typical” is the median start. " +
          "Use sets the strategy and the setting found" + (sT.crit === "comfort" ? ", with the comfort line as its minimum spending" : "") + "." : ""} />
      </Card>
      <SpotPanel v={v} res={res} o={so} T={sT} charted={chartedNow} />
    </>
  );
}

/* The start drawn: one of the three hard ones or, picked from the list, any
   January the record can run to the end. */
function SpotPanel({ v, res, o, T, charted }: { v: DDView; res: DdShow | null; o: DDView["o"]; T: DdTarget; charted: Record<string, 1> }) {
  const [spot, setSpot] = useState(0);
  const [pickYear, setPick] = useState<number | null>(null);
  const W = res ? ddWindows(o).filter((w) => w.month === 1) : [];
  const spots = res?.spots ?? [];
  const pick = pickYear != null && W.some((w) => w.year === pickYear) ? pickYear : null;
  const sp = spot < spots.length ? spot : 0;
  const year = pick ?? spots[sp];
  const win = W.find((w) => w.year === year);
  const series: Series[] = [];
  if (res && win) {
    let k = 0;
    for (const x of res.list) {
      if (!charted[x.id]) continue;
      let xo = ddForTarget({ ...o, strategy: x.id, path: "flat" }, T);
      if (x.tuned && x.dial != null) xo = ddWithDial(xo, x.dial);
      const vals = runDrawdown(xo, win.seq, null).rows.map((r) => r.realReg);
      series.push({ name: DD_UI[x.id].short, color: x.id === o.strategy ? "#e9b872" : SPOT_COLORS[1 + (k++ % (SPOT_COLORS.length - 1))],
        pts: vals.map((val, y) => ({ year: y + 1, value: val })), width: x.id === o.strategy ? 2.8 : 2 });
    }
    if (T.crit === "comfort")
      series.push({ name: "Comfort line", color: "#8b97ad", dash: "5 5", width: 1.4, pts: Array.from({ length: o.years }, (_, y) => ({ year: y + 1, value: ddLineAt(T.comfort, y) })) });
  }
  const age = v.age;
  return (
    <Card id="ddSpotPanel" data-ddtabs="compare" data-empty={res && !win ? "" : undefined}>
      <CardHeader><CardTitle id="ddSpotTitle">{win ? "Retiring in " + year : "Through a hard start"}<TipDot k="ddspots" /></CardTitle><CardAction>
        <select id="ddSpotYear" aria-label="Retiring in any year" value={pick != null ? String(pick) : ""} onChange={(e) => {
          const n = parseInt(e.target.value, 10);
          setPick(isFinite(n) ? n : null);
        }}>
          {res ? <option value="">Any year…</option> : null}
          {W.map((w) => <option key={w.year}>{w.year}</option>)}
        </select>
        <span className="seg" id="segDDSpot">
          {[0, 1, 2].map((i) => (
            <button key={i} type="button" data-spot={i} hidden={!!res && i >= spots.length} className={pick == null && i === sp ? "on" : undefined}
              onClick={() => { setSpot(i); setPick(null); }}>{spots[i] ?? ["1966", "1929", "1973"][i]}</button>
          ))}
        </span>
      </CardAction></CardHeader>
      <MultiChart id="DDSP" series={series} maxX={o.years} ariaLabel="Each charted strategy's spending through one hard start"
        xFmt={(y) => (age != null ? ageVal(age, y) : y)} head={(y) => <b>{age != null ? "Age " + ageVal(age, y) : "Year " + fmtNum(y)}</b>} />
      <Html className="legend" id="legendDDSP" html={series.map((x) => swatch(x.color!, escapeHtml(x.name))).join("")} />
      <div className="hint ddpad" id="ddSpotNote">{!res || !win ? "" : series.length > 1
        ? "Each charted strategy's spending, year by year, in today's dollars, at the setting it was tuned to above. Tick Chart in the table to add or remove one."
        : "Tick Chart in the table above to draw a strategy here."}</div>
    </Card>
  );
}
