"use client";

/* Safe spending: for each start, the most year one could have been while
   meeting the risk target; the highest setting and the portfolio the target
   allows; the success grid around your setting; and how valuations at the
   start lined up with it all. The searches run in the worker. From
   ddSafeRefresh(), ddPaintSafe(), ddPaintHeat() and ddPaintVal() in
   src/js/app/15b-drawdown-views.js. */

import { useState } from "react";
import { MultiChart } from "@/components/charts/MultiChart";
import { Scatter } from "@/components/charts/Scatter";
import { MON } from "@/components/charts/HistNotes";
import { TipDot } from "@/components/shell/Tooltips";
import { Html } from "@/components/common/Html";
import { useJob } from "@/lib/engine/jobs";
import {
  CAPE_NOW, CAPE_NOW_ASOF, DD_ERAS, DD_STRAT, ddEraFor, ddForTarget, ddPrep, ddWithDial, type DdHeat, type DdOpts, type DdPrep, type DdSafe, type DdSafeStart, type DdTarget,
} from "@/lib/engine/typed-drawdown";
import { fmtNum, money, pctStr } from "@/lib/format";
import type { DDView } from "./Drawdown";
import { DD_STRAT_NAMES, critWords, dialFields, dialText, escapeHtml, firstSpend, lineWords, rateOf, targetWords, swatch } from "./text";
import { Button } from "@/components/ui/button";

const work = (t: string) => "<span class='ddwork'>" + t + "</span>";

export function SafeView({ v, T, active }: { v: DDView; T: DdTarget; active: boolean }) {
  const { o, d } = v;
  const [axis, setAxis] = useState<"stock" | "years">("stock");
  const dial = !!DD_STRAT[o.strategy].dial;
  const on = active && o.initial > 0 && dial;
  const key = JSON.stringify([d, T]);
  const safeJob = useJob<DdSafe, { o: DdOpts; T: DdTarget }>("safe", "safe", on ? { o, T } : null, key);
  const heatJob = useJob<DdHeat, { o: DdOpts; T: DdTarget; axis: string }>("heat", "heat", on ? { o, T, axis } : null, key + axis);
  const S = safeJob.res && safeJob.args ? { res: safeJob.res, o: safeJob.args.o, T: safeJob.args.T, P: ddPrep(safeJob.args.o) } : null;
  const Hm = heatJob.res && heatJob.args ? { res: heatJob.res, o: heatJob.args.o, T: heatJob.args.T } : null;

  if (active && o.initial > 0 && !dial) {
    return <NoDial name={DD_STRAT_NAMES[o.strategy]} axis={axis} setAxis={setAxis} />;
  }
  return (
    <>
      <SafePanel v={v} S={S} running={on && (safeJob.stale || !S)} />
      <HeatPanel v={v} Hm={Hm} running={on && (heatJob.stale || !Hm)} axis={axis} setAxis={setAxis} />
      <ValPanel S={S} />
    </>
  );
}

/* A strategy with no setting to turn has nothing to search. */
function NoDial({ name, axis, setAxis }: { name: string; axis: "stock" | "years"; setAxis: (a: "stock" | "years") => void }) {
  return (
    <>
      <div className="panel" id="ddSafePanel" data-ddtabs="safe">
        <SafeTitle />
        <Html className="body ddintro" id="ddSafeIntro" html={"<b>" + escapeHtml(name) + "</b> has no setting to turn: it always takes the share its formula gives. " +
          "Pick a strategy with a rate or a target to see the most it could have started with, or compare them all on the Compare strategies view."} />
        <MultiChart id="DDR" series={[]} maxX={1} ariaLabel="The highest first-year withdrawal that met the target, for each start" />
        <div className="legend" id="legendDDR"></div>
        <div className="solveopts" id="ddSolve" hidden><Solvers /></div>
      </div>
      <div className="panel" id="ddHeatPanel" data-ddtabs="safe">
        <HeatTitle axis={axis} setAxis={setAxis} />
        <div className="body ddintro" id="ddHeatIntro">The grid needs a strategy with a setting to turn.</div>
        <div className="scroll ddheatwrap"><table id="ddHeat" className="ddheat"></table></div>
        <div className="hint ddpad" id="ddHeatNote"></div>
      </div>
      <div className="panel" id="ddValPanel" data-ddtabs="safe">
        <ValTitle />
        <div className="body ddintro" id="ddValIntro">This needs a strategy with a setting to turn.</div>
        <Scatter id="DDV" pts={[]} ariaLabel="Each start's CAPE against the most it could have started with" tip={() => null} />
        <div className="legend" id="legendDDV"></div>
        <div className="hint ddpad" id="ddValNote"></div>
      </div>
    </>
  );
}
const SafeTitle = () => <h2 id="ddSafeTitle">The most you could have started with<TipDot k="ddsafe" /></h2>;
const ValTitle = () => <h2>Valuations at the start<TipDot k="ddvalue" /><span className="h2note">Shiller CAPE</span></h2>;
function HeatTitle({ axis, setAxis }: { axis: "stock" | "years"; setAxis: (a: "stock" | "years") => void }) {
  return (
    <h2>Success grid<TipDot k="ddheat" /><span className="h2ctrl">
      <span className="seg" id="segDDHeat">
        <button type="button" data-heat="stock" className={axis === "stock" ? "on" : undefined} onClick={() => setAxis("stock")}>By stock share</button>
        <button type="button" data-heat="years" className={axis === "years" ? "on" : undefined} onClick={() => setAxis("years")}>By years</button>
      </span>
    </span></h2>
  );
}

type Safe = { res: DdSafe; o: DdOpts; T: DdTarget; P: DdPrep } | null;

function Solvers({ dialK = "Highest setting that meets the target", dialV = "—", dialN = "", dialUse, portK = "Portfolio needed for this spending", portV = "—", portN = "", portUse }: {
  dialK?: string; dialV?: string; dialN?: string; dialUse?: () => void; portK?: string; portV?: string; portN?: string; portUse?: () => void;
}) {
  return (
    <>
      <div className="solveopt">
        <div className="optlabel" id="ddSolveDialK">{dialK}</div>
        <div className="v gold" id="ddSolveDial">{dialV}</div>
        <Html className="note" id="ddSolveDialN" html={dialN} />
        <Button variant="outline" size="sm" className="mt-3.5 self-start max-sm:self-stretch" id="ddSolveDialUse" disabled={!dialUse} onClick={dialUse}>Use it</Button>
      </div>
      <div className="solveopt">
        <div className="optlabel" id="ddSolvePortK">{portK}</div>
        <div className="v gold" id="ddSolvePort">{portV}</div>
        <div className="note" id="ddSolvePortN">{portN}</div>
        <Button variant="outline" size="sm" className="mt-3.5 self-start max-sm:self-stretch" id="ddSolvePortUse" disabled={!portUse} onClick={portUse}>Use it</Button>
      </div>
    </>
  );
}

const startOf = (w: DdSafeStart, monthly: boolean) => (monthly ? MON[w.month - 1] + " " : "") + w.year;

function SafePanel({ v, S, running }: { v: DDView; S: Safe; running: boolean }) {
  const age = v.age;
  let intro = running ? work("Finding each start's edge…") : "", chart: React.ReactNode = null, legend = "";
  const solve: React.ComponentProps<typeof Solvers> = {};
  if (S && !running) {
    const { res, o, T } = S, safe = res.safe || [], mine = rateOf(o, S.P), monthly = !!o.monthly;
    const ok = safe.filter((w) => w.rate != null), nameOf = DD_STRAT_NAMES[o.strategy];
    if (!ok.length) intro = "Under this target, no setting of <b>" + escapeHtml(nameOf) + "</b> works for any start.";
    else {
      const sorted = ok.slice().sort((a, b) => a.rate! - b.rate!), worst = sorted[0], med = sorted[Math.floor(sorted.length / 2)];
      const short = safe.filter((w) => w.rate == null || w.rate < mine - 1e-6).length, capped = safe.filter((w) => w.capped).length;
      intro = "For each " + (monthly ? "month" : "year") + " a retirement could have started, the highest year-one withdrawal, as a share of the portfolio, at which " +
        critWords(T, age) + ", with the " + escapeHtml(nameOf) + " strategy and the rest of your plan. " +
        "The lowest, <b>" + pctStr(worst.rate!, 2) + "</b>, was retiring in " + startOf(worst, monthly) + "; the typical start allowed <b>" + pctStr(med.rate!, 2) + "</b>. " +
        "Your " + pctStr(mine, 2) + " " + (short ? "would have fallen short in <b>" + short + " of " + safe.length + "</b> starts." : "worked in every start.") +
        (capped ? " " + capped + " start" + (capped === 1 ? "" : "s") + " reached the top of the range tested: this strategy can't run out there." : "");
      chart = <MultiChart id="DDR" maxX={Math.max(1, safe.length - 1)} ariaLabel="The highest first-year withdrawal that met the target, for each start"
        series={[
          { name: "Highest that worked", color: "#4fbf95", width: 2, pts: safe.map((w, i) => ({ year: i, value: w.rate == null ? 0 : w.rate * 100 })) },
          { name: "Your year one", color: "#e9b872", dash: "6 5", width: 1.6, pts: [{ year: 0, value: mine * 100 }, { year: safe.length - 1, value: mine * 100 }] },
        ]}
        yFmt={(x) => fmtNum(x) + "%"} xFmt={(i) => { const w = safe[Math.round(i)]; return w ? String(w.year) : ""; }}
        marks={DD_ERAS.map((e) => { const i = safe.findIndex((w) => w.year === e.year && w.month === 1); return i >= 0 ? { x: i, label: String(e.year) } : null; })
          .filter((m): m is { x: number; label: string } => !!m)}
        tip={(i) => {
          const w = safe[Math.round(i)];
          if (!w) return null;
          const era = ddEraFor(w.year);
          return <>
            <b>Retiring in {startOf(w, monthly)}</b>
            <br /><span className="text-jade">Highest that worked</span> <span className="n">{w.rate == null ? "none" : pctStr(w.rate, 2) + (w.capped ? "+" : "")}</span>
            <br />CAPE at the start <span className="n">{w.cape.toFixed(1)}</span>
            {era ? <><br /><span className="ddtip-era">{era.title}</span></> : null}
          </>;
        }} />;
      legend = swatch("#4fbf95", "Highest year-one withdrawal that worked") + swatch("#e9b872", "Yours, " + pctStr(mine, 2));
    }
    // the solvers
    const DK = DD_STRAT[o.strategy].dial!.key, dl = res.dial, port = res.port, spend = firstSpend(o, S.P);
    solve.dialK = DK === "initialPct" ? "Highest starting rate that meets the target" : DK === "rgTarget" ? "Lowest chance target that meets the target" : "Highest setting that meets the target";
    if (dl && dl.v != null) {
      const x = ddWithDial(ddForTarget(o, T), dl.v);
      solve.dialV = dialText(o.strategy, dl.v, o);
      solve.dialN = (dl.met ? "Meets it: " + targetWords(T, age) + "." : "Nothing meets it; this comes closest, in " + pctStr(dl.share!, 0) + " of starts.") +
        " Year one: " + money(firstSpend(x)) + (dl.capped ? ". That's the top of the range tested." : ".") +
        (T.crit === "comfort" && DD_STRAT[o.strategy].limits !== false ? " Held at " + lineWords(Array.isArray(T.comfort) ? T.comfort : Math.max(o.spendFloor || 0, T.comfort), age) + " or more." : "");
      solve.dialUse = () => v.apply(dialFields(o, o.strategy, dl.v!, T), "Set to " + dialText(o.strategy, dl.v, o));
    } else solve.dialN = "Nothing to find for this strategy.";
    solve.portK = "Portfolio needed for " + money(spend) + " in year one";
    if (port && port.portfolio) {
      const need = Math.ceil(port.portfolio / 1000) * 1000;
      solve.portV = money(need);
      solve.portN = "A starting rate of " + pctStr(spend / (port.portfolio * (1 - (S.P.G.share || 0))), 2) + " meets it: " + targetWords(T, age) + "." +
        (port.capped ? " Even a 15% rate does, the top of the range tested." : "");
      solve.portUse = () => {
        const r = spend / (need * (1 - (S.P.G.share || 0))) * 100, f: Record<string, unknown> = { initial: need, rate: Math.round(r * 1e4) / 1e4 };
        if (o.strategy === "yale" && o.initialPct > 0) f.yaleRate = Math.round(o.yaleRate * r / o.initialPct * 1e4) / 1e4;
        if (T.crit === "comfort" && !Array.isArray(T.comfort) && DD_STRAT[o.strategy].limits !== false) f.spendFloor = Math.round(Math.max(o.spendFloor || 0, T.comfort));
        v.apply(f, "Portfolio set to " + money(need));
      };
    } else solve.portN = !port ? "This strategy sets its own year one from the portfolio, so there's no spending amount to hold fixed."
      : "No portfolio size reaches the target with this spending: the rest of the plan rules it out.";
  }
  return (
    <div className="panel" id="ddSafePanel" data-ddtabs="safe">
      <SafeTitle />
      <Html className="body ddintro" id="ddSafeIntro" html={intro} />
      {chart ?? <MultiChart id="DDR" series={[]} maxX={1} ariaLabel="The highest first-year withdrawal that met the target, for each start" />}
      <Html className="legend" id="legendDDR" html={legend} />
      <div className="solveopts" id="ddSolve"><Solvers {...solve} /></div>
    </div>
  );
}

/* The success grid: each cell the share of starts meeting the target. */
function HeatPanel({ v, Hm, running, axis, setAxis }: { v: DDView; Hm: { res: DdHeat; o: DdOpts; T: DdTarget } | null; running: boolean; axis: "stock" | "years"; setAxis: (a: "stock" | "years") => void }) {
  let intro = running ? work("Working out the grid…") : "", note = "", table: React.ReactNode = null;
  if (Hm && !running) {
    const h = Hm.res, o = Hm.o, T = Hm.T, id = o.strategy, D = DD_STRAT[id].dial!;
    const colTitle = h.axis === "years" ? "Years in retirement" : "Stocks";
    const rowName = D.key === "initialPct" ? "Rate" : D.key === "rgTarget" ? "Target" : "Setting";
    const near = (a: number, b: number) => Math.abs(a - b) < 1e-6;
    const curCol = h.axis === "years" ? o.years : o.stockPctEnd == null ? Math.round(o.stockPct + o.svPct) : null;
    const under = h.grid.some((row) => row.some((x) => x != null && x < 0));
    const use = (rv: number, c: number) => {
      const f = dialFields(o, id, rv, T);
      if (h.axis === "years") f.years = c;
      else Object.assign(f, { stock: c, stockEnd: "" });
      v.apply(f, "Using " + dialText(id, rv, o) + (h.axis === "years" ? ", " + c + " years" : ", " + c + "% stocks"));
    };
    table = <>
      <thead><tr><th>{rowName} \ {colTitle}</th>{h.cols.map((c) => <th key={c} className={curCol != null && near(c, curCol) ? "ddh-cur" : undefined}>{c}{h.axis === "years" ? "" : "%"}</th>)}</tr></thead>
      <tbody>
        {h.rows.map((rv, i) => {
          const cur = near(rv, h.cur);
          return (
            <tr key={i} className={cur ? "ddh-cur" : undefined}>
              <th>{dialText(id, rv, o).replace(/ start$/, "")}</th>
              {h.grid[i].map((s, j) => {
                const me = cur && curCol != null && near(h.cols[j], curCol) ? "ddh-me" : undefined;
                if (s == null) return <td key={j} className={["ddh-na", me].filter(Boolean).join(" ")} data-hr={i} data-hc={j} onClick={() => use(rv, h.cols[j])}>—</td>;
                if (s < 0) {
                  return <td key={j} className={["ddh-na ddh-under", me].filter(Boolean).join(" ")} data-hr={i} data-hc={j} title="Year one starts under your comfort line" onClick={() => use(rv, h.cols[j])}>under</td>;
                }
                const hue = s >= 1 ? 158 : s >= 0.95 ? 140 : s >= 0.9 ? 95 : s >= 0.8 ? 45 : s >= 0.7 ? 25 : 8;
                const a = 0.12 + 0.5 * Math.max(0, Math.min(1, s)) * (s >= 0.9 ? 1 : 0.8);
                return <td key={j} data-hr={i} data-hc={j} className={me ? me + " bg-(--heat)" : "bg-(--heat)"} style={{ "--heat": "hsla(" + hue + ",60%,48%," + a.toFixed(2) + ")" } as React.CSSProperties}
                  onClick={() => use(rv, h.cols[j])}>{s >= 1 ? "100" : (s * 100).toFixed(0)}</td>;
              })}
            </tr>
          );
        })}
      </tbody>
    </>;
    intro = "The share of historical starts, in percent, where " + critWords(T, v.age) + ", for " + escapeHtml(DD_STRAT_NAMES[id]) + " at settings around yours (rows) and " +
      (h.axis === "years" ? "retirements of different lengths" : "different stock shares") + " (columns). Tap a cell to use it.";
    note = (under ? "“Under”: a fixed amount at that rate starts below your comfort line, so it can't meet it in any start. " : "") +
      (h.axis === "stock" && o.stockPctEnd != null ? "Your glide path is set aside here: each column holds its stock share the whole way." : "");
  }
  return (
    <div className="panel" id="ddHeatPanel" data-ddtabs="safe">
      <HeatTitle axis={axis} setAxis={setAxis} />
      <Html className="body ddintro" id="ddHeatIntro" html={intro} />
      <div className="scroll ddheatwrap"><table id="ddHeat" className="ddheat">{table}</table></div>
      <div className="hint ddpad" id="ddHeatNote">{note}</div>
    </div>
  );
}

/* Valuations: each start's CAPE against the most it could have started
   with, and where today's market sits. */
function ValPanel({ S }: { S: Safe }) {
  let intro = "", chart: React.ReactNode = null, legend = "", note = "";
  const safe = S ? (S.res.safe || []).filter((w) => w.rate != null) : [];
  if (S && safe.length) {
    const o = S.o, mine = rateOf(o, S.P), monthly = !!o.monthly;
    chart = <Scatter id="DDV" ariaLabel="Each start's CAPE against the most it could have started with"
      pts={safe.map((w) => ({ x: w.cape, y: w.rate! * 100, w, color: w.rate! < mine - 1e-6 ? "#e2795f" : "#4fbf95" }))}
      opt={{ small: safe.length > 150, xMin: 0, yZero: true, xFmt: (x) => fmtNum(x), yFmt: (y) => fmtNum(y) + "%", xLabel: "CAPE at the start →", yLabel: "Highest year one that worked",
        vLine: { x: CAPE_NOW, label: "today, " + CAPE_NOW.toFixed(1) }, hLine: { y: mine * 100, label: "yours, " + pctStr(mine, 2) } }}
      tip={(p) => <><b>Retiring in {startOf(p.w, monthly)}</b><br />CAPE <span className="n">{p.w.cape.toFixed(1)}</span><br />Highest year one <span className="n">{pctStr(p.w.rate!, 2)}</span></>} />;
    legend = swatch("#4fbf95", "A start your year one would have survived") + swatch("#e2795f", "One it wouldn't");
    const maxCape = Math.max(...safe.map((w) => w.cape));
    const hi = safe.filter((w) => w.cape >= 25), lo = safe.filter((w) => w.cape < 15);
    const medOf = (a: DdSafeStart[]) => { const x = a.map((w) => w.rate!).sort((p, q) => p - q); return x[Math.floor(x.length / 2)]; };
    const minOf = (a: DdSafeStart[]) => Math.min(...a.map((w) => w.rate!));
    const unit = monthly ? "starting months" : "starts";
    intro = "Shiller's CAPE is the stock market's price over ten years of its earnings, after inflation: high means stocks were dear. " +
      (hi.length === 1 ? "The one start at a CAPE of 25 or more, " + startOf(hi[0], monthly) + ", allowed <b>" + pctStr(hi[0].rate!, 2) + "</b>, "
        : hi.length ? "The " + hi.length + " " + unit + " at a CAPE of 25 or more allowed a typical <b>" + pctStr(medOf(hi), 2) + "</b> (the lowest " + pctStr(minOf(hi), 2) + "), " : "") +
      (lo.length ? "against <b>" + pctStr(medOf(lo), 2) + "</b> for the " + lo.length + " below 15. " : "") +
      "Today's CAPE is <b>" + CAPE_NOW.toFixed(1) + "</b> (" + CAPE_NOW_ASOF + ")" +
      (CAPE_NOW > maxCape ? ", higher than at any start with a full " + fmtNum(o.years) + " years of history after it, so the record has no direct match." : ".");
    note = "Expensive starts have tended to allow less, but the link is loose: this is what history did, not a forecast. The CAPE-based strategy uses this reading every year.";
  }
  return (
    <div className="panel" id="ddValPanel" data-ddtabs="safe">
      <ValTitle />
      <Html className="body ddintro" id="ddValIntro" html={intro} />
      {chart ?? <Scatter id="DDV" pts={[]} ariaLabel="Each start's CAPE against the most it could have started with" tip={() => null} />}
      <Html className="legend" id="legendDDV" html={legend} />
      <div className="hint ddpad" id="ddValNote">{note}</div>
    </div>
  );
}
