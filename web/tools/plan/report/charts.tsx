/* The Paycheck to Retirement report's pictures, drawn for a US Letter page
   in the Guide report's print palette (C, axis and ticks from its charts):
   the paycheck as one bar, spending by group, the climb by account with
   the stages and children marked, and the stages to scale. Every figure
   from results.ts. */

import { money } from "@/lib/format";
import { C, axis, ticks } from "@/tools/guide/report/charts";
import type { Acct, PlanSummary } from "../results";

/** Accounts on paper: pre-tax Forest, Roth Woods, taxable Sand, as the
    Guide report's income sources; the HSA Water. */
export const ACCT_PRINT: Record<Acct, string> = { trad: C.forest, roth: C.woods, brok: C.sand, hsa: C.water };
/** Where pay goes: taxes Trail, spending Dusk, saving Forest, unassigned Gray. */
export const PAY_PRINT = { taxes: C.trail, health: C.clay, spend: C.dusk, save: C.forest, left: C.gray };

const T = ({ x, y, children, a = "start", w = 600, s = 11, c = C.ink }: { x: number; y: number; children: React.ReactNode; a?: "start" | "middle" | "end"; w?: number; s?: number; c?: string }) =>
  <text x={x} y={y} textAnchor={a} className="rp-tx" style={{ "--fw": w, "--fs": s + "px" } as React.CSSProperties} fill={c}>{children}</text>;

/** The year's pay as one bar: taxes, premiums, spending, saving, unassigned,
    each part's share written over it where it fits. */
export function PayBar({ S, w = 732, h = 64 }: { S: PlanSummary; w?: number; h?: number }) {
  const y = S.pay, n = S.p, gross = Math.max(1, y.gross);
  const parts = [
    { k: "Taxes", v: y.taxes, c: PAY_PRINT.taxes },
    ...(y.health > 0.004 ? [{ k: "Premiums", v: y.health, c: PAY_PRINT.health }] : []),
    { k: "Spending", v: y.spend, c: PAY_PRINT.spend },
    { k: "Saving", v: S.lines.reduce((t, l) => t + l.v, 0), c: PAY_PRINT.save },
    ...(y.left > 0.5 ? [{ k: "Unassigned", v: y.left, c: PAY_PRINT.left }] : []),
  ];
  const xs = parts.map((_, i) => parts.slice(0, i).reduce((t, q) => t + (q.v / gross) * w, 0));
  return (
    <svg viewBox={`0 0 ${w} ${h}`} width={w} height={h} role="img" aria-label={parts.map((p) => p.k + " " + money(p.v * n)).join(", ")}>
      {parts.map((p, i) => {
        const pw = (p.v / gross) * w, x0 = xs[i];
        return (
          <g key={p.k}>
            <rect x={x0} y={0} width={Math.max(0, pw - 1.5)} height={34} fill={p.c} />
            {pw > 58 ? <T x={x0 + 7} y={21} c={C.white} w={800}>{Math.round((p.v / gross) * 100)}%</T> : null}
            {pw > 58 ? <T x={x0} y={52} s={10.5}>{p.k}</T> : null}
            {pw > 58 ? <T x={x0} y={64} s={10} w={500} c={C.ink2}>{money(p.v * n)}</T> : null}
          </g>
        );
      })}
    </svg>
  );
}

/** Spending by group, a month, as bars: every budget line, premiums
    through work among them. */
export function GroupBars({ S, w = 430, row = 26 }: { S: PlanSummary; w?: number; row?: number }) {
  const sums: Record<string, number> = {};
  for (const l of S.budgetLines) sums[l.group] = (sums[l.group] ?? 0) + l.yr;
  const g = Object.entries(sums).map(([group, yr]) => ({ group, yr })).sort((a, b) => b.yr - a.yr), max = Math.max(1, ...g.map((x) => x.yr)), lw = 112, h = g.length * row + 4;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} width={w} height={h} role="img" aria-label={g.map((x) => x.group + " " + money(x.yr / 12) + " a month").join(", ")}>
      {g.map((x, i) => {
        const bw = ((w - lw - 70) * x.yr) / max;
        return (
          <g key={x.group}>
            <T x={0} y={i * row + 15} s={11}>{x.group}</T>
            <rect x={lw} y={i * row + 4} width={bw} height={15} fill={PAY_PRINT.spend} />
            <T x={lw + bw + 6} y={i * row + 15} s={10.5} w={700}>{money(x.yr / 12)}</T>
          </g>
        );
      })}
    </svg>
  );
}

/** The balance by age, stacked by account, today's dollars: the stages as
    numbered bands, each child's birth a mark on the age axis, the total in
    Trail with the milestones on it. */
export function ClimbChart({ S, w = 732, h = 330 }: { S: PlanSummary; w?: number; h?: number }) {
  const rows = S.climb, a0 = rows[0].age, a1 = rows[rows.length - 1].age;
  const pl = 50, pr = 8, pt = S.stages ? 26 : 10, pb = S.kids.length ? 42 : 22;
  const { top, list } = ticks(Math.max(1, ...rows.map((r) => r.total)));
  const X = (a: number) => pl + ((a - a0) / Math.max(1, a1 - a0)) * (w - pl - pr), Y = (v: number) => pt + (1 - v / top) * (h - pt - pb);
  const accts: Acct[] = ["trad", "roth", "brok", "hsa"], used = accts.filter((a) => rows.some((r) => r[a] > 1));
  const bands = used.map((a, i) => {
    const below = (r: (typeof rows)[number]) => used.slice(0, i).reduce((t, b) => t + r[b], 0);
    return { a, d: "M" + rows.map((r) => X(r.age) + "," + Y(below(r) + r[a])).join(" ") + " L" + rows.slice().reverse().map((r) => X(r.age) + "," + Y(below(r))).join(" ") + " Z" };
  });
  const every = a1 - a0 > 30 ? 5 : a1 - a0 > 14 ? 2 : 1;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} width={w} height={h} role="img" aria-label={"Savings by age, " + money(rows[0].total) + " at " + a0 + " to " + money(rows[rows.length - 1].total) + " at " + a1}>
      {S.stages?.map((s, i) => (
        <g key={s.from}>
          {i % 2 ? <rect x={X(s.from)} y={pt} width={X(s.to) - X(s.from)} height={h - pt - pb} fill={C.land} /> : null}
          <line x1={X(s.from)} x2={X(s.from)} y1={pt - 20} y2={h - pb} stroke={C.grid} strokeWidth={0.8} />
          <circle cx={X(s.from) + 10} cy={pt - 11} r={8} fill={C.band} />
          <T x={X(s.from) + 10} y={pt - 7.5} a="middle" s={9.5} w={800} c={C.white}>{i + 1}</T>
        </g>
      ))}
      {list.map((v) => <g key={v}><line x1={pl} x2={w - pr} y1={Y(v)} y2={Y(v)} stroke={C.grid} strokeWidth={v ? 0.6 : 1} />
        <text x={pl - 6} y={Y(v) + 3.5} textAnchor="end" className="rp-ax">{axis(v)}</text></g>)}
      {bands.map((b) => <path key={b.a} d={b.d} fill={ACCT_PRINT[b.a]} />)}
      <polyline points={rows.map((r) => X(r.age) + "," + Y(r.total)).join(" ")} fill="none" stroke={C.trail} strokeWidth={3} strokeLinejoin="round" />
      {S.milestones.map((m) => {
        const r = rows.find((x) => x.age === m.age)!;
        return <g key={m.label}><circle cx={X(m.age)} cy={Y(r.total)} r={4} fill={C.white} stroke={C.ink} strokeWidth={1.6} />
          <T x={X(m.age) - 7} y={Y(r.total) - 8} a="end" s={10.5} w={700}>{m.label} at {m.age}</T></g>;
      })}
      {rows.filter((r) => (r.age - a0) % every === 0 || r.age === a1).map((r) => <text key={r.age} x={X(r.age)} y={h - pb + 13} textAnchor="middle" className="rp-ax">{r.age}</text>)}
      {S.kids.map((k, i) => k.born > a0 && k.born < a1 ? (
        <g key={i}><path d={`M${X(k.born)},${h - 21} l-4,7 h8 Z`} fill={C.ink} /><T x={X(k.born)} y={h - 2} a="middle" s={9.5} w={700}>Child {i + 1}</T></g>
      ) : null)}
    </svg>
  );
}

/** The stages to scale, numbered, with each one's saving a month. */
export function StageStrip({ S, w = 732, h = 58 }: { S: PlanSummary; w?: number; h?: number }) {
  const st = S.stages ?? [], total = st.reduce((t, s) => t + (s.to - s.from), 0) || 1;
  const x = (s: { from: number }) => ((s.from - (st[0]?.from ?? 0)) / total) * w;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} width={w} height={h} role="img" aria-label={st.map((s, i) => "Stage " + (i + 1) + ", " + s.name + ", ages " + s.from + " to " + (s.to - 1)).join("; ")}>
      {st.map((s, i) => {
        const sw = ((s.to - s.from) / total) * w, x0 = x(s);
        const fill = s.kidCost > 0 ? C.woodsLight : C.land;
        return (
          <g key={s.from}>
            <rect x={x0} y={0} width={sw - 2} height={34} fill={fill} />
            <circle cx={x0 + 12} cy={17} r={8} fill={C.band} />
            <T x={x0 + 12} y={20.5} a="middle" s={9.5} w={800} c={C.white}>{i + 1}</T>
            {sw > 64 ? <T x={x0 + 25} y={21} s={10.5} w={800}>{money(s.monthly)}</T> : null}
            <text x={x0 + 2} y={48} className="rp-ax">{s.from}</text>
          </g>
        );
      })}
      <text x={w - 2} y={48} textAnchor="end" className="rp-ax">{S.retire}</text>
    </svg>
  );
}
