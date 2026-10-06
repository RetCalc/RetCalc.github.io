"use client";

/* The Plan Optimizer's answer: the headline against the usual way, the
   roadmap, what each change brings, where the money comes from, tax and
   balances over time, every year, and other strong plans. The tool page
   draws it in panels; the readiness guide in sections of its card. From
   opResultHTML() and what it calls in src/js/app/31b-plan-optimizer.js. */

import { useEffect, useState } from "react";
import { GdChart } from "@/components/charts/GdChart";
import { STATES } from "@/lib/engine/typed";
import { PL_HEIR, plMix } from "@/lib/engine/typed-plan";
import type { PlRow, PlStats } from "@/lib/engine/types";
import { groupDigits, money, pctStr } from "@/lib/format";
import { seen, type Host, type Result } from "./run";
import { axisCompact, lowerFirst, opClaims, opCompact, opConvUntil, opFillName, opFillShort, opSigned, opTacticsLine, type PlanWho } from "./words";
import { SERIES } from "@/lib/hues";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const OP_COLORS = { ss: SERIES.sky, pension: SERIES.gray, trad: SERIES.rose, brok: SERIES.lavender, roth: SERIES.teal };
type Src = keyof typeof OP_COLORS;
const SRC_NAMES: Record<Src, string> = { ss: "Social Security", pension: "Pension", trad: "Traditional", brok: "Brokerage", roth: "Roth" };

const who = (res: Result): PlanWho => ({ married: res.married, gap: res.age2 == null ? 0 : res.age2 - res.age1, rmdAge: res.rmdAge });
const avg = (rows: PlRow[], f: (r: PlRow) => number) => (rows.length ? rows.reduce((s, r) => s + f(r), 0) / rows.length : 0);
const heir = (res: Result) => (res.P.heirRate == null ? PL_HEIR : res.P.heirRate);

/* ---- the headline ---- */
function Hero({ res }: { res: Result }) {
  const b = res.base.stats, x = res.best.stats, goal = res.goal, C = { married: res.married };
  let big: React.ReactNode, lab: string, was: string, delta: string;
  if (goal === "spend") {
    big = <>{money(x.maxSpend!)}<small>/yr</small></>;
    lab = "You can spend, after tax, and still last in " + pctStr(res.target, 0) + " of markets";
    was = money(b.maxSpend!) + "/yr the usual way";
    delta = opSigned((x.maxSpend || 0) - (b.maxSpend || 0)) + " a year";
  } else if (goal === "last") {
    big = <>{x.survived}<small> of {x.total}</small></>;
    lab = "Historical retirements where the money lasted";
    was = b.survived + " of " + b.total + " the usual way";
    delta = x.survived > b.survived ? "+" + (x.survived - b.survived) + " more" : "Worst 10%: " + opSigned(x.p10Legacy - b.p10Legacy, opCompact) + " left";
  } else {
    big = opCompact(x.medLegacy);
    lab = "Left for you and your heirs after tax, in a typical market";
    was = opCompact(b.medLegacy) + " the usual way";
    delta = opSigned(x.medLegacy - b.medLegacy, opCompact);
  }
  const tile = (k: string, v0: string, v1: string, good: boolean | null) => (
    <div className="op-tile"><div className="k">{k}</div><div className="v">{v1}</div><div className={"n" + (good == null ? "" : good ? " pos" : " neg")}>was {v0}</div></div>
  );
  const near = (a: number, c: number) => (a > c + 1 ? true : a < c - 1 ? false : null);
  return (
    <div className="op-hero">
      <div className="op-big"><div className="k">{lab}</div><div className="v">{big}</div>
        <div className="op-delta"><em>{delta}</em><span>vs. {was}</span></div></div>
      <div className="op-tiles">
        {tile("Lifetime tax", money(b.medTax), money(x.medTax), x.medTax < b.medTax - 1 ? true : x.medTax > b.medTax + 1 ? false : null)}
        {tile("Lasted in", pctStr(b.successRate, 0), pctStr(x.successRate, 0), x.survived > b.survived ? true : x.survived < b.survived ? false : null)}
        {goal !== "legacy" ? tile("Left after tax", opCompact(b.medLegacy), opCompact(x.medLegacy), near(x.medLegacy, b.medLegacy))
          : tile("Social Security at", opClaims(res.base.T, C, true), opClaims(res.best.T, C, true), null)}
      </div>
    </div>
  );
}

/* ---- the roadmap ----
   The years grouped into stretches where the plan does the same things:
   before 59½, before Medicare, converting, each Social Security start,
   required distributions. */
function phases(rows: PlRow[]) {
  const sig = (r: PlRow) => [r.age < 59 ? 1 : 0, r.fplPct != null ? 1 : 0, r.conv > 50 ? 1 : 0, r.rmd > 50 ? 1 : 0, Math.round(r.ss / 100), r.age >= 65 ? 1 : 0].join(",");
  const out: { k: string; rows: PlRow[] }[] = [];
  rows.forEach((r) => {
    const k = sig(r), cur = out[out.length - 1];
    if (cur && cur.k === k) cur.rows.push(r);
    else out.push({ k, rows: [r] });
  });
  return out;
}
function Roadmap({ res }: { res: Result }) {
  const C = who(res), T = res.best.T, rows = res.best.detail.rows, ph = phases(rows);
  const last = rows[rows.length - 1], claimAge2 = C.married ? T.c2 : null, gap = C.gap!;
  return (
    <ol className="op-road">
      {ph.map((p, i) => {
        const R = p.rows, a0 = R[0].age, a1 = R[R.length - 1].age, r0 = R[0];
        const conv = avg(R, (r) => r.conv), ss = avg(R, (r) => r.ss), pen = avg(R, (r) => r.pension);
        const tr = avg(R, (r) => r.trad), bk = avg(R, (r) => r.brok), ro = avg(R, (r) => r.roth);
        const tax = avg(R, (r) => r.tax + r.pen), hl = avg(R, (r) => r.health), ir = avg(R, (r) => r.irmaa);
        const early = r0.age < 59, aca = r0.fplPct != null, rmd = r0.rmd > 50, spouseOnly = aca && r0.age >= 65;
        const tag = conv > 50 ? (aca ? "Convert, and keep the subsidy" : "Roth conversion years")
          : early ? "Before 59½" : aca ? (spouseOnly ? "Until your spouse's Medicare" : "Before Medicare") : rmd ? "Required distributions" : ss > 0 ? "Social Security years" : "Living on savings";
        // What happens as this stretch begins.
        const ev: string[] = [], prev = rows[rows.indexOf(r0) - 1], rise = r0.ss - (prev ? prev.ss : 0);
        if (i === 0) ev.push("You retire at " + a0);
        if (rise > 1) {
          const mine = a0 === T.c1, theirs = C.married && a0 + gap === claimAge2;
          ev.push((mine && theirs ? "Social Security starts for both of you" : mine ? "Your Social Security starts" : theirs ? "Your spouse's Social Security starts" : "The spousal benefit starts") +
            ": +" + money(rise / 12) + "/mo");
        }
        const me65 = a0 === 65 && i > 0, sp65 = C.married && res.age2 != null && i > 0 && a0 + gap === 65;
        if (me65 && sp65) ev.push("Medicare starts for both of you");
        else if (me65) ev.push(C.married ? "Your Medicare starts" : "Medicare starts");
        else if (sp65) ev.push("Your spouse's Medicare starts");
        if (a0 === 59 && i > 0) ev.push("59½: traditional money opens up penalty-free");
        if (rmd && (i === 0 || !(ph[i - 1].rows[0].rmd > 50))) ev.push("Required distributions begin");
        if (i > 0 && ph[i - 1].rows.some((r) => r.conv > 50) && !(conv > 50)) ev.push("Conversions stop");
        const items: [string, string][] = [];
        if (ss > 0 || pen > 0) items.push(["Income", (ss > 0 ? "Social Security " + money(ss) + "/yr" : "") + (pen > 0 ? (ss > 0 ? ", pension " : "Pension ") + money(pen) + "/yr" : "")]);
        const draws = [];
        if (tr > 50) draws.push(money(tr) + " traditional" + (rmd ? " (the required distribution" + (tr > avg(R, (r) => r.rmd) + 50 ? " and more" : "") + ")" : ""));
        if (bk > 50) draws.push(money(bk) + " brokerage");
        if (ro > 50) draws.push(money(ro) + " Roth");
        items.push(["Spend from", draws.length ? draws.join(", ") + " a year" : "Nothing: income covers it"]);
        if (conv > 50) items.push(["Convert", money(conv) + " a year to Roth" + (T.f > 0 ? ", filling " + opFillName(T.f) : "")]);
        items.push(["Tax", "About " + money(tax) + " a year" + (ir > 50 ? ", plus " + money(ir) + " Medicare surcharge" : "")]);
        if (aca) items.push(["Health", "About " + money(hl) + " a year after the subsidy" + (r0.fplPct != null ? " (income at " + Math.round(avg(R, (r) => r.fplPct!) * 100) + "% of the poverty line)" : "")]);
        return (
          <li key={a0} className={"op-ph" + (conv > 50 ? " conv" : "")}><div className="op-ph-age">{a0 === a1 ? "Age " + a0 : a0 + "–" + a1}</div>
            <div className="op-ph-body"><div className="op-ph-tag">{tag}</div>
              {ev.length ? <div className="op-ph-ev">{ev.map((e) => <span key={e}>{e}</span>)}</div> : null}
              <dl>{items.map(([k, v]) => [<dt key={k + "t"}>{k}</dt>, <dd key={k + "d"}>{v}</dd>])}</dl></div></li>
        );
      })}
      <li className="op-ph end"><div className="op-ph-age">{last.age + 1}</div><div className="op-ph-body"><div className="op-ph-tag">The plan&apos;s end
        {C.married && res.age2 != null ? ", when your spouse is " + (last.age + 1 + gap) : ""}</div>
        <dl><dt>Left</dt><dd>{money(last.endTrad) + " traditional, " + money(last.endRoth) + " Roth, " + money(last.endBrok) + " brokerage, on the average path"}</dd></dl></div></li>
    </ol>
  );
}

/* ---- what makes the difference ---- */
function Moves({ res }: { res: Result }) {
  const C = who(res), T0 = res.base.T, goal = res.goal;
  const val = (s: PlStats) => (goal === "spend" ? s.maxSpend || 0 : goal === "last" ? s.survived : s.medLegacy);
  const fmt = (d: number) => (goal === "spend" ? opSigned(d) + " a year"
    : goal === "last" ? (d >= 0 ? "+" : "−") + Math.abs(d) + " more " + (Math.abs(d) === 1 ? "market" : "markets") + " lasted" : opSigned(d, opCompact) + " left");
  const total = val(res.best.stats) - val(res.base.stats);
  const big = Math.max(1, Math.abs(total), ...res.steps.map((x) => Math.abs(val(x.to) - val(x.from))));
  return (
    <div className="op-moves">
      {res.steps.map((st) => {
        const d = val(st.to) - val(st.from), t = st.T;
        let h: string, p: string;
        if (st.key === "ss") {
          h = "Claim Social Security at " + opClaims(t, C) + ", instead of " + opClaims(T0, C);
          const later = t.c1 > T0.c1 || t.c2 > T0.c2;
          p = d < 0 && total > 0
            ? "On its own this leaves less. It earns its place alongside the next change: " + (later
              ? "with the check starting later, the years before it have low income, and that's where the conversions below get done cheaply."
              : "with the check covering more of each year's spending, more of the low tax brackets are free for the conversions below.")
            : later
              ? "Every year you wait past 67 adds 8% to the check, for life, and it rises with inflation. Your savings carry the years in between, which usually costs less than the bigger check pays back over a long retirement."
              : "Claiming sooner means drawing less from savings early on, so more of it stays invested. In your plan that outweighs the bigger check waiting would bring.";
        } else {
          const until = opConvUntil(t, C);
          h = t.f > 0 ? "Draw traditional money first, up to " + opFillName(t.f) + (until != null ? ", and convert what you don't spend to Roth until " + until : "")
            : "Brokerage first, then traditional, then Roth";
          const g = [];
          if (t.ac) g.push("keep income under the ACA subsidy cliff before 65");
          if (t.im) g.push("stay under Medicare's first income surcharge line");
          if (g.length) h += ", and " + g.join(" and ");
          p = t.f > 0 ? "Traditional money is taxed whenever it comes out. Taking it in the lower-income years, at " + (t.f === 1 ? "0%" : opFillShort(t.f)) +
            ", beats taking it later, when required distributions and Social Security stack up and push it into higher brackets. Roth money then grows tax-free for you and your heirs." : "";
        }
        const w = Math.round((Math.abs(d) / big) * 100), cls = d >= 0 ? "pos" : "neg";
        return (
          <div className="op-move" key={st.key}><div className="op-move-t"><b>{h}</b>{p ? <p>{p}</p> : null}</div>
            <div className="op-move-v"><em className={cls}>{fmt(d)}</em><i className="op-bar"><b className={cls + " w-(--w)"} style={{ "--w": w + "%" } as React.CSSProperties}></b></i></div></div>
        );
      })}
    </div>
  );
}

/* ---- charts ---- */
/* A step on the value axis that gives four or so lines up to the top. */
function yScale(top: number) {
  const mag = Math.pow(10, Math.floor(Math.log10(top / 4)));
  const stepY = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((v) => top / v <= 4.5) || mag * 10;
  return { stepY, yMax: Math.ceil(top / stepY) * stepY };
}
function Grid({ yMax, stepY, Y, pl, W, pr }: { yMax: number; stepY: number; Y: (v: number) => number; pl: number; W: number; pr: number }) {
  const out = [];
  for (let v = 0; v <= yMax + 1e-6; v += stepY)
    out.push(<g key={v}><line className="grid" x1={pl} x2={W - pr} y1={Y(v).toFixed(1)} y2={Y(v).toFixed(1)} />
      <text className="ax" x={pl - 7} y={(Y(v) + 4).toFixed(1)} textAnchor="end">{axisCompact(v)}</text></g>);
  return <>{out}</>;
}
const TipRow = ({ color, cls, v, label }: { color?: string; cls?: string; v: string; label: string }) => (
  <div className="r"><s className={color ? "bg-(--swatch)" : cls} style={color ? { "--swatch": color } as React.CSSProperties : undefined}></s><b>{v}</b><span>{label}</span></div>
);

/* Where each year's money comes from, stacked, with what's converted to
   Roth drawn hollow on top and what you live on as a line: the gap between
   the bars and the line is the year's tax and premiums. */
function FlowChart({ host, rows: raw }: { host: Host; rows: PlRow[] }) {
  const keys: Src[] = ["ss", "pension", "trad", "brok", "roth"];
  // Income or a required distribution beyond the year's needs is reinvested
  // in the brokerage: drawn apart, so the bars stop at what was used.
  const rows = raw.map((r) => {
    const o = { ...r, reinv: 0 };
    let extra = r.surplus > 1 ? r.surplus : 0;
    (["trad", "pension", "ss"] as const).forEach((k) => { const t = Math.min(extra, o[k]); o[k] -= t; extra -= t; });
    o.reinv = r.surplus > 1 ? r.surplus - extra : 0;
    return o;
  });
  return (
    <GdChart className="gd-chart op-chart" data-opchart="flow" data-host={host} role="img" aria-label="Where each year's money comes from, by age" draw={(W) => {
      const H = W < 520 ? 230 : 280, pl = W < 520 ? 46 : 56, pr = 10, pt = 14, pb = 26;
      const tot = rows.map((r) => r.ss + r.pension + r.trad + r.brok + r.roth + r.reinv);
      const { stepY, yMax } = yScale(Math.max(1, ...rows.map((r, i) => tot[i] + r.conv), ...rows.map((r) => r.spend)) * 1.08);
      const n = rows.length, slot = (W - pl - pr) / n;
      const X = (i: number) => pl + slot * (i + 0.5), Y = (v: number) => pt + (1 - v / yMax) * (H - pt - pb);
      const bw = Math.max(2, Math.min(slot * 0.74, 26)), every = Math.max(1, Math.ceil(n / (W < 520 ? 6 : 12)));
      return {
        H, n, xAt: X,
        body: (hover) => (
          <>
            <Grid yMax={yMax} stepY={stepY} Y={Y} pl={pl} W={W} pr={pr} />
            {rows.map((r, i) => (i % every === 0 ? <text key={"a" + i} className="ax" x={X(i).toFixed(1)} y={H - 7} textAnchor="middle">{r.age}</text> : null))}
            {rows.map((r, i) => {
              let acc = 0;
              const bars = keys.filter((k) => r[k] > 1).map((k) => {
                const el = <rect key={k} x={(X(i) - bw / 2).toFixed(1)} y={Y(acc + r[k]).toFixed(1)} width={bw.toFixed(1)} height={Math.max(0.6, Y(acc) - Y(acc + r[k])).toFixed(1)} fill={OP_COLORS[k]} />;
                acc += r[k];
                return el;
              });
              const hollow = (cls: string, v: number) => {
                const el = <rect key={cls} className={cls} x={(X(i) - bw / 2 + 0.75).toFixed(1)} y={Y(acc + v).toFixed(1)} width={(bw - 1.5).toFixed(1)} height={Math.max(0.6, Y(acc) - Y(acc + v) - 0.75).toFixed(1)} />;
                acc += v;
                return el;
              };
              return <g key={i}>{bars}{r.reinv > 1 ? hollow("op-reinv", r.reinv) : null}{r.conv > 1 ? hollow("op-conv", r.conv) : null}</g>;
            })}
            <path className="op-live" d={"M" + rows.map((r, i) => (X(i) - slot / 2).toFixed(1) + "," + Y(r.spend).toFixed(1) + "L" + (X(i) + slot / 2).toFixed(1) + "," + Y(r.spend).toFixed(1)).join("L")} />
            <rect className="op-hl" y={pt} height={H - pt - pb} width={slot.toFixed(1)} x={hover == null ? 0 : (X(hover) - slot / 2).toFixed(1)} visibility={hover == null ? "hidden" : "visible"} />
          </>
        ),
        tip: (i) => {
          const r = rows[i];
          return (
            <>
              <div className="h">Age {r.age}</div>
              {keys.filter((k) => r[k] > 1).map((k) => <TipRow key={k} color={OP_COLORS[k]} v={money(r[k])} label={SRC_NAMES[k]} />)}
              {r.reinv > 1 ? <TipRow cls="rei" v={money(r.reinv)} label="not needed, reinvested" /> : null}
              {r.conv > 1 ? <TipRow cls="hol" v={money(r.conv)} label="converted to Roth" /> : null}
              <TipRow cls="liv" v={money(r.spend)} label="lived on" />
              <TipRow color="transparent" v={money(r.tax + r.pen + r.health + r.irmaa)} label={"tax" + (r.health > 1 ? " and premiums" : "")} />
            </>
          );
        },
      };
    }} />
  );
}

interface Line { name: string; color: string; w?: number; dash?: string; pts: { x: number; y: number }[] }
/* Lines, one per series, with a shared tooltip. */
function LinesChart({ host, kind, label, series }: { host: Host; kind: string; label: string; series: Line[] }) {
  return (
    <GdChart className="gd-chart op-chart" data-opchart={kind} data-host={host} role="img" aria-label={label} draw={(W) => {
      const H = W < 520 ? 210 : 250, pl = W < 520 ? 46 : 56, pr = 12, pt = 16, pb = 26;
      const xs = series[0].pts.map((p) => p.x), x0 = xs[0], x1 = xs[xs.length - 1];
      const { stepY, yMax } = yScale(Math.max(1, ...series.map((s) => Math.max(...s.pts.map((p) => p.y)))) * 1.1);
      const X = (v: number) => pl + ((v - x0) / Math.max(1, x1 - x0)) * (W - pl - pr), Y = (v: number) => pt + (1 - Math.max(0, v) / yMax) * (H - pt - pb);
      const xStep = x1 - x0 > 40 ? 10 : 5, ticks: number[] = [];
      for (let v = Math.ceil(x0 / xStep) * xStep; v <= x1; v += xStep) ticks.push(v);
      return {
        H, n: xs.length, xAt: (i) => X(xs[i]),
        body: (hover) => (
          <>
            <Grid yMax={yMax} stepY={stepY} Y={Y} pl={pl} W={W} pr={pr} />
            {ticks.map((v) => <text key={v} className="ax" x={X(v).toFixed(1)} y={H - 7} textAnchor="middle">{v}</text>)}
            {series.map((s) => <path key={s.name} fill="none" stroke={s.color} strokeWidth={s.w || 2} strokeLinejoin="round" strokeLinecap="round" strokeDasharray={s.dash}
              d={"M" + s.pts.map((p) => X(p.x).toFixed(1) + "," + Y(p.y).toFixed(1)).join("L")} />)}
            <line className="xh" y1={pt} y2={H - pb} x1={hover == null ? 0 : X(xs[hover])} x2={hover == null ? 0 : X(xs[hover])} visibility={hover == null ? "hidden" : "visible"} />
          </>
        ),
        tip: (i) => (
          <>
            <div className="h">Age {xs[i]}</div>
            {series.map((s) => <TipRow key={s.name} color={s.color} v={money(s.pts[i].y)} label={s.name} />)}
          </>
        ),
      };
    }} />
  );
}

function YearTable({ rows }: { rows: PlRow[] }) {
  const m = (v: number) => (v > 1 ? money(v) : "—");
  const pension = rows.some((r) => r.pension > 1), health = rows.some((r) => r.health > 1 || r.irmaa > 1);
  return (
    <details className="op-table"><summary>Show every year</summary><div className="scroll"><table>
      <thead><tr><th>Age</th><th>Live on</th><th>Social Security</th>{pension ? <th>Pension</th> : null}<th>Traditional</th><th>Converted</th><th>Brokerage</th><th>Roth</th><th>Tax</th>
        {health ? <th>Health / IRMAA</th> : null}<th>Taxable income</th><th>Left, all accounts</th></tr></thead>
      <tbody>{rows.map((r) => (
        <tr key={r.age} className={r.short > 1 ? "short" : undefined}><td>{r.age}</td><td>{money(r.spend)}</td><td>{m(r.ss)}</td>{pension ? <td>{m(r.pension)}</td> : null}
          <td>{m(r.trad)}</td><td>{m(r.conv)}</td><td>{m(r.brok)}</td><td>{m(r.roth)}</td><td>{m(r.tax + r.pen)}</td>{health ? <td>{m(r.health + r.irmaa)}</td> : null}
          <td>{money(r.taxable)}</td><td>{money(r.end)}</td></tr>
      ))}</tbody>
    </table></div></details>
  );
}

/* ---- the whole result ---- */
export function OptimizerResult({ host, res, fresh }: { host: Host; res: Result; fresh: boolean }) {
  // reveals itself the first time it's shown, and not after
  const [reveal] = useState(fresh);
  useEffect(() => seen(host), [host]);
  const wrap = (title: string, note: string, inner: React.ReactNode, cls = "") => host === "tool"
    ? <Card><CardHeader><CardTitle>{title}</CardTitle>{note ? <CardDescription>{note}</CardDescription> : null}</CardHeader><CardContent>{inner}</CardContent></Card>
    : <section className={"op-sec" + (cls ? " " + cls : "")}><div className="gd-h3">{title}{note ? <> <span className="op-note">{note}</span></> : null}</div>{inner}</section>;
  const sw = (k: string, cls: string | null, label: string) => <span key={k}><s className={cls ?? "bg-(--swatch)"} style={cls ? undefined : { "--swatch": OP_COLORS[k as Src] } as React.CSSProperties}></s>{label}</span>;
  const rb = res.best.detail.rows, r0 = res.base.detail.rows, used = (Object.keys(SRC_NAMES) as Src[]).filter((k) => rb.some((r) => r[k] > 1));
  const h = heir(res), net = (r: PlRow) => r.endRoth + r.endBrok + r.endTrad * (1 - h);
  const spent = (r: PlRow) => r.tax + r.pen + r.irmaa + r.health;
  const C = who(res);
  const state = (STATES as Record<string, { n: string }>)[res.P.state];
  return (
    <div className={"op-res" + (reveal ? " op-reveal" : "")}>
      <p className="op-brag">Tried <b>every one of {groupDigits(res.of, true)} plans</b> in all <b>{res.windows} historical retirements</b> since {res.first}: {groupDigits(res.runs, true)} retirements simulated.</p>
      {res.same ? (
        <>
          <div className="gd-callout ok"><b>The way you&apos;d run it is already the best plan we found</b> for this goal. Nothing we tried did better, which usually means Social Security
            {res.married ? " at " + opClaims(res.base.T, { married: true }) : ""} and drawing brokerage, then traditional, then Roth already suits your numbers.</div>
          <Hero res={res} />
        </>
      ) : (
        <>
          <Hero res={res} />
          {wrap("Your roadmap", "on the average path, in today's dollars", <Roadmap res={res} />, "op-roadsec")}
          {wrap("What makes the difference", { legacy: "median left after tax", last: "markets lasted", spend: "safe spending" }[res.goal], <Moves res={res} />)}
        </>
      )}
      {wrap("Where each year's money comes from", "your roadmap, average path", <>
        <div className="gd-ch-legend">{[...used.map((k) => sw(k, null, SRC_NAMES[k])), ...(rb.some((r) => r.surplus > 1) ? [sw("reinv", "rei", "Not needed, reinvested")] : []),
          ...(rb.some((r) => r.conv > 1) ? [sw("conv", "hol", "Converted to Roth")] : []), sw("live", "liv", "What you live on")]}</div>
        <FlowChart host={host} rows={rb} />
        <p className="op-cap">The space between the bars and the line is each year&apos;s tax{rb.some((r) => r.health > 1) ? " and health premiums" : ""}.</p>
      </>)}
      {!res.same ? wrap("Tax and premiums each year", "the usual way against your roadmap", <>
        <div className="gd-ch-legend"><span><s className="bg-series-gray"></s>The usual way</span><span><s className="bg-series-plan"></s>Your roadmap</span></div>
        <LinesChart host={host} kind="tax" label="Tax and premiums each year, the usual way and with the roadmap" series={[
          { name: "The usual way", color: SERIES.gray, dash: "5 4", pts: r0.map((r) => ({ x: r.age, y: spent(r) })) },
          { name: "Your roadmap", color: SERIES.plan, w: 2.4, pts: rb.map((r) => ({ x: r.age, y: spent(r) })) }]} />
        <p className="op-cap">Paying some tax early, in the low-income years, to pay much less later is usually the whole trick.</p>
      </>) : null}
      {wrap("Your accounts over time", "average path", <>
        <div className="gd-ch-legend"><span><s className="bg-series-plan"></s>After tax, your roadmap</span><span><s className="bg-series-gray"></s>After tax, the usual way</span>
          <span><s className="bg-series-rose"></s>Traditional</span><span><s className="bg-series-teal"></s>Roth</span><span><s className="bg-series-lavender"></s>Brokerage</span></div>
        <LinesChart host={host} kind="bal" label="Account balances by age, and what they are worth after tax" series={[
          { name: "Traditional", color: OP_COLORS.trad, w: 1.6, pts: rb.map((r) => ({ x: r.age, y: r.endTrad })) },
          { name: "Roth", color: OP_COLORS.roth, w: 1.6, pts: rb.map((r) => ({ x: r.age, y: r.endRoth })) },
          { name: "Brokerage", color: OP_COLORS.brok, w: 1.6, pts: rb.map((r) => ({ x: r.age, y: r.endBrok })) },
          { name: "After tax, the usual way", color: SERIES.gray, dash: "5 4", w: 2, pts: r0.map((r) => ({ x: r.age, y: net(r) })) },
          { name: "After tax, your roadmap", color: SERIES.plan, w: 2.8, pts: rb.map((r) => ({ x: r.age, y: net(r) })) }]} />
        <p className="op-cap">After tax counts traditional money at {pctStr(1 - h, 0)} of its value: it still owes income tax, whoever takes it out.</p>
      </>)}
      {wrap("Year by year", "average path, today's dollars", <YearTable rows={rb} />, "op-tablesec")}
      {res.alts.length && !res.same ? wrap("Other strong plans", "close behind, and different", (
        <ul className="op-alts">{res.alts.map((a, i) => (
          <li key={i}><b>Social Security at {opClaims(a.T, C, true)}</b> · {lowerFirst(opTacticsLine(a.T, C))}
            <span>{opCompact(a.medLegacy) + " left · lasted in " + pctStr(a.successRate, 0)}</span></li>
        ))}</ul>
      )) : null}
      <p className="op-fine">{(res.goal === "spend" && res.best.spend ? "The best plan lives on " + money(res.best.spend) + " a year after tax and the usual way on " + money(res.base.spend) +
        ", each the most it can in " + pctStr(res.target, 0) + " of markets (the roadmap, charts and table show each at that spending),"
        : "Every plan lives on the same " + money(res.P.spend) + " a year after tax") + " and runs to age " + (res.age1 + res.years) +
        ". Typical means the median of all " + res.windows + " historical retirements; the roadmap's yearly figures follow the average path, " + pctStr(plMix(res.P.mix).real, 1) + " a year after inflation with " + res.P.mix + "% in stocks. " +
        "Left after tax counts traditional money at " + pctStr(1 - h, 0) + " of its value, for the income tax whoever inherits it will owe; Roth and brokerage count in full. " +
        "Tax is 2026 federal and " + (state ? state.n : "state") + " law, held in today's dollars. Both of you are assumed to live to the end of the plan, which favors claiming later. This is a model to plan with, not financial advice."}</p>
    </div>
  );
}
