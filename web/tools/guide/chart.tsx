"use client";

/* The plan chart: savings over time in today's dollars, the projection
   while saving, then the median of every historical retirement, with the
   middle 80% shaded for the plan being looked at. One series in jade, or the
   plan as it is (steel) against a proposed change (jade). From gdSeries(),
   gdChartSlot() and gdChartDraw() in src/js/app/28-guide-core.js. */

import { GdChart } from "@/components/charts/GdChart";
import { money } from "@/lib/format";
import { retPath, type Sim } from "./calc";
import { axisCompact } from "@/tools/optimizer/words";

interface Pt { x: number; y: number; save?: boolean; lo?: number; hi?: number }
export interface Series { name: string; cls: string; S: Sim; pts: Pt[]; traces: Pt[][]; retire: number; stop: number | null }

export function series(S: Sim, age: number, name: string, cls: string): Series {
  const a0 = Math.round(age), pts: Pt[] = [];
  S.path.forEach((v, i) => pts.push({ x: a0 + i, y: v, save: true }));
  const R = retPath(S), r0 = Math.round(S.retire);
  R.forEach((r, i) => pts.push({ x: r0 + i + 1, y: r.p50, lo: r.p10, hi: r.p90 }));
  pts[S.path.length - 1].lo = pts[S.path.length - 1].hi = S.fv;
  // Each historical retirement's own path, from the balance at retirement,
  // drawn faintly under the band.
  const traces = S.H.runs.map((run) => {
    const ln: Pt[] = [{ x: r0, y: S.fv }];
    for (let i = 0; i < S.years; i++) ln.push({ x: r0 + i + 1, y: run.path ? run.path[i] : 0 });
    return ln;
  });
  return { name, cls, S, pts, traces, retire: r0, stop: S.stop != null ? Math.round(S.stop) : null };
}

export function PlanDrawing({ id, series: list, caption }: { id: string; series: Series[]; caption: string }) {
  return (
    <GdChart className="gd-chart" minW={280} fallbackW={600} data-chart={id} role="img" aria-label={caption + ". Use the arrow keys to read values by age."} draw={(W) => {
      const H = W < 480 ? 210 : 250, pl = W < 480 ? 44 : 54, pr = 14, pt = 22, pb = 28;
      const all = list.flatMap((x) => x.pts);
      const x0 = Math.min(...all.map((p) => p.x)), x1 = Math.max(...all.map((p) => p.x));
      // A plan with far more than it needs keeps compounding through
      // retirement, and drawn to scale that would flatten the years that
      // matter. The scale stops at a little over twice the largest balance
      // at retirement; anything past it is clipped and said in words.
      const most = Math.max(...list.map((x) => x.S.fv)), high = Math.max(1, ...all.map((p) => p.y));
      const capped = high > most * 2.4;
      const top = (capped ? most * 2.2 : high) * 1.12;
      const mag = Math.pow(10, Math.floor(Math.log10(top / 4)));
      const stepY = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((v) => top / v <= 4.5) || mag * 10;
      const yMax = Math.ceil(top / stepY) * stepY;
      const X = (v: number) => pl + ((v - x0) / Math.max(1, x1 - x0)) * (W - pl - pr);
      const Y = (v: number) => pt + (1 - Math.max(0, v) / yMax) * (H - pt - pb);
      const yc = (v: number) => Y(Math.min(v, yMax * 1.05)).toFixed(1);
      const grid: React.ReactNode[] = [];
      for (let v = 0; v <= yMax + 1e-6; v += stepY)
        grid.push(<g key={"y" + v}><line className="grid" x1={pl} x2={W - pr} y1={Y(v).toFixed(1)} y2={Y(v).toFixed(1)} />
          <text className="ax" x={pl - 8} y={(Y(v) + 4).toFixed(1)} textAnchor="end">{axisCompact(v)}</text></g>);
      const xStep = x1 - x0 > 45 ? 10 : 5;
      for (let v = Math.ceil(x0 / xStep) * xStep; v <= x1; v += xStep)
        grid.push(<text key={"x" + v} className="ax" x={X(v).toFixed(1)} y={H - 8} textAnchor="middle">{v}</text>);
      const main = list[list.length - 1];
      const bp = main.pts.filter((p) => p.lo != null);
      const clip = "gdclip-" + id;
      const peak = main.pts.find((p) => p.x === main.retire);
      const sp = main.stop != null && main.stop > main.pts[0].x ? main.pts.find((p) => p.x === main.stop) : null;
      const over = capped ? list.filter((x) => x.pts.some((p) => p.y > yMax)).map((x) => {
        const endP = x.pts[x.pts.length - 1];
        return (list.length > 1 ? x.name : "Your savings") + " keep" + (list.length > 1 ? "s" : "") + " growing past the top of the chart, to a median of " + axisCompact(endP.y) + " by " + endP.x + ".";
      }) : [];
      return {
        H, n: x1 - x0 + 1, xAt: (i) => X(x0 + i), start: main.retire - x0,
        body: (hover) => (
          <>
            {grid}
            <defs><clipPath id={clip}><rect x={pl} y={pt} width={W - pl - pr} height={H - pt - pb} /></clipPath></defs>
            {main.traces.length ? <g className="tr" clipPath={`url(#${clip})`}>{main.traces.map((ln, i) => <path key={i} d={"M" + ln.map((p) => X(p.x).toFixed(1) + "," + yc(p.y)).join("L")} />)}</g> : null}
            {bp.length > 1 ? <path className={"band " + main.cls} clipPath={`url(#${clip})`} d={"M" + bp.map((p) => X(p.x).toFixed(1) + "," + Y(p.hi!).toFixed(1)).join("L") +
              "L" + bp.slice().reverse().map((p) => X(p.x).toFixed(1) + "," + Y(p.lo!).toFixed(1)).join("L") + "Z"} /> : null}
            {list.map((x) => <line key={"m" + x.name} className="mark" x1={X(x.retire).toFixed(1)} x2={X(x.retire).toFixed(1)} y1={pt} y2={H - pb} />)}
            {list.map((x) => <path key={"l" + x.name} className={"ln " + x.cls} clipPath={`url(#${clip})`} d={"M" + x.pts.map((p) => X(p.x).toFixed(1) + "," + yc(p.y)).join("L")} />)}
            <line className="xh" y1={pt} y2={H - pb} x1={hover == null ? 0 : X(x0 + hover)} x2={hover == null ? 0 : X(x0 + hover)} visibility={hover == null ? "hidden" : "visible"} />
            {/* Direct labels for the plan being looked at: the retirement
                peak, and the age saving stops on a coast plan. */}
            {peak ? (() => {
              const px = X(peak.x), py = Y(peak.y), right = px < W * 0.62;
              return <><circle className={"dot " + main.cls} cx={px.toFixed(1)} cy={py.toFixed(1)} r="4.5" />
                <text className="lab" x={(px + (right ? 9 : -9)).toFixed(1)} y={Math.max(pt + 4, py - 8).toFixed(1)} textAnchor={right ? "start" : "end"}>{"Retire at " + main.retire + ": " + axisCompact(peak.y)}</text></>;
            })() : null}
            {sp ? <><circle className={"dot " + main.cls} cx={X(sp.x).toFixed(1)} cy={Y(sp.y).toFixed(1)} r="4" />
              <text className="lab" x={X(sp.x).toFixed(1)} y={(Y(sp.y) + 18).toFixed(1)} textAnchor="middle">{"Stop saving at " + main.stop}</text></> : null}
          </>
        ),
        tip: (i) => {
          const age = x0 + i;
          return (
            <>
              <div className="h">{"Age " + age}</div>
              {list.slice().reverse().map((x) => {
                const p = x.pts.find((q) => q.x === age);
                const state = p && p.save && age < x.retire ? "saving" : age > x.retire ? "retired, median" : "at retirement";
                return <div className="r" key={x.name}><s className={x.cls}></s><b>{p ? money(p.y) : "—"}</b><span>{list.length > 1 ? (W < 480 ? x.name : x.name + ", " + state) : state}</span></div>;
              })}
            </>
          );
        },
        after: over.length ? <div className="gd-ch-over">{over.join(" ")}</div> : null,
      };
    }} />
  );
}

/** The chart in its figure: a legend for two plans, the caption, and the
    figures by age as a table. */
export function PlanChart({ id, series: list, caption }: { id: string; series: Series[]; caption: string }) {
  const step = 5, first = list[0].pts[0].x, last = Math.max(...list.map((x) => x.pts[x.pts.length - 1].x));
  const ages: number[] = [];
  for (let age = first; age <= last; age += step) ages.push(age);
  return (
    <figure className="gd-chfig">
      {list.length > 1 ? <div className="gd-ch-legend">{list.map((x) => <span key={x.name}><s className={x.cls}></s>{x.name}</span>)}</div> : null}
      <PlanDrawing id={id} series={list} caption={caption} />
      <figcaption className="gd-ch-cap">{caption}. The shaded band is the middle 80% of historical retirements.</figcaption>
      <details className="gd-ch-table"><summary>Show as a table</summary><table><thead><tr><th>Age</th>{list.map((x) => <th key={x.name}>{x.name}</th>)}</tr></thead>
        <tbody>{ages.map((age) => <tr key={age}><td>{age}</td>{list.map((x) => { const p = x.pts.find((q) => q.x === age); return <td key={x.name}>{p ? money(p.y) : "—"}</td>; })}</tr>)}</tbody></table></details>
    </figure>
  );
}
