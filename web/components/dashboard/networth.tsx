"use client";

/* Net worth's pictures past today's bars: net worth over time, when the
   savings can be spent, and how they'll be taxed. A couple can narrow every
   picture to one person's things, or to what's shared. */

import { useState } from "react";
import { useScrub } from "@/components/charts/ChartFrame";
import { Segmented, SegmentedItem } from "@/components/ui/segmented";
import { useWidth } from "./charts";
import { longDate, money, shortMoney } from "./format";
import { ownerOf } from "./kinds";
import { sum, type Entry, type Item, type Profile } from "./store";

/** A person's name for a "whose" choice. */
export const whoName = (names: [string, string], i: 0 | 1) => names[i].trim() || (i ? "Your partner" : "You");

/** Whose things the pictures show: everyone's, one person's, or the shared. */
export type Who = "all" | 0 | 1 | "shared";

/** The items that belong to `who` (all of them for one person, or "all"). */
export function only(items: Item[], names: [string, string] | null, who: Who): Item[] {
  if (!names || who === "all") return items;
  return items.filter((i) => { const w = ownerOf(i, names); return who === "shared" ? w == null : w === who; });
}

/** The switch that picks whose things the pictures show. */
export function WhoseFilter({ names, who, onWho }: { names: [string, string]; who: Who; onWho: (w: Who) => void }) {
  const opts: [Who, string][] = [["all", "Everyone"], [0, whoName(names, 0)], [1, whoName(names, 1)], ["shared", "Shared"]];
  return (
    <div className="dsh-whosebar">
      <span className="dsh-label" aria-hidden="true">Show</span>
      <Segmented aria-label="Whose to show">
        {opts.map(([v, l]) => <SegmentedItem key={String(v)} pressed={who === v} onPressedChange={() => onWho(v)}>{l}</SegmentedItem>)}
      </Segmented>
    </div>
  );
}

/** A finger on a picture: what's under it is read out (each part names
    itself in data-read) as it's tapped or dragged sideways, and stays
    until the next touch. A mouse uses the parts' own hover. */
export function touchRead(set: (r: string | null) => void) {
  const at = (e: React.PointerEvent) => {
    if (e.pointerType === "mouse") return;
    const el = document.elementFromPoint(e.clientX, e.clientY)?.closest("[data-read]");
    if (el) set(el.getAttribute("data-read"));
  };
  return { onPointerDown: at, onPointerMove: at };
}

/** The kinds that are savings and investments: everything but the home and "other". */
const SAVINGS = ["workplace", "g457", "ira", "roth", "brokerage", "hsa", "cash"];

/** A date (YYYY-MM-DD) as a year with its fraction. */
const yearOf = (iso: string) => Number(iso.slice(0, 4)) + (Number(iso.slice(5, 7)) - 1) / 12 + (Number(iso.slice(8, 10)) - 1) / 365;
const nowYear = () => { const d = new Date(); return d.getFullYear() + d.getMonth() / 12 + (d.getDate() - 1) / 365; };

function niceStep(span: number) {
  const s = Math.pow(10, Math.floor(Math.log10(Math.max(1, span) / 4)));
  return [1, 2, 2.5, 5, 10].map((k) => k * s).find((k) => span / k <= 5) ?? s * 10;
}

const signed = (v: number) => (v >= 0 ? "+" : "−") + money(Math.abs(v));
const MILESTONES = [100e3, 250e3, 500e3, 750e3, 1e6, 1.5e6, 2e6, 2.5e6, 3e6, 4e6, 5e6, 7.5e6, 10e6, 15e6, 20e6];
const SHORT_MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/* ---------- Net worth over time ---------- */

/** Net worth at each entry, and the savings and investments within it (the
    home and debts aside), with the round numbers passed along the way. */
export function WorthOverTime({ entries, view }: { entries: Entry[]; view: (items: Item[]) => Item[] }) {
  const pts = entries.map((e) => { const it = view(e.items); return { date: e.date, t: yearOf(e.date), nw: sum(it, "asset") - sum(it, "debt"), sav: sum(it, "asset", SAVINGS) }; });
  if (pts.length < 2) return <p className="dsh-cap">Each time you save a new entry, a point joins this chart. You have {pts.length || "no"} so far.</p>;
  const first = pts[0], last = pts[pts.length - 1], span = last.t - first.t;
  // A year back: the latest entry at least 330 days before the last.
  const ago = pts.slice(0, -1).reverse().find((p) => last.t - p.t >= 330 / 365) ?? null;
  const perYear = span >= 1 && first.nw > 0 && last.nw > 0 ? Math.pow(last.nw / first.nw, 1 / span) - 1 : null;
  const chg = (v: number) => <span className={v >= 0 ? "dsh-up" : "dsh-dn"}>{signed(v)}</span>;
  return (
    <>
      <div className="dsh-stats">
        {ago ? <div className="dsh-stat"><div className="dsh-label">In the last 12 months</div><div className="dsh-fig dsh-md">{chg(last.nw - ago.nw)}</div></div> : null}
        <div className="dsh-stat"><div className="dsh-label">Since {longDate(first.date)}</div><div className="dsh-fig dsh-md">{chg(last.nw - first.nw)}</div></div>
        {perYear != null ? <div className="dsh-stat"><div className="dsh-label">Growth per year, on average</div><div className="dsh-fig dsh-md">{(perYear * 100).toFixed(1)}%</div></div> : null}
      </div>
      <WorthLines pts={pts} />
      <div className="dsh-legend dsh-mt6"><span><i />Net worth</span><span><i className="dsh-lsky" />Savings and investments (no home, no debts)</span></div>
    </>
  );
}

type WPt = { date: string; t: number; nw: number; sav: number };

function WorthLines({ pts }: { pts: WPt[] }) {
  const [ref, W] = useWidth(900);
  const [at, setAt] = useState<number | null>(null);
  const H = 260, L = 58, R = 18, T = 26, B = 26;
  const x0 = pts[0].t, x1 = pts[pts.length - 1].t;
  const vals = pts.flatMap((p) => [p.nw, p.sav]);
  const lo0 = Math.min(0, ...vals), hi0 = Math.max(...vals, 1);
  const step = niceStep(hi0 - lo0), lo = Math.floor(lo0 / step) * step, hi = Math.ceil((hi0 * 1.04) / step) * step;
  const X = (t: number) => L + ((t - x0) / (x1 - x0)) * (W - L - R), Y = (v: number) => T + (1 - (v - lo) / (hi - lo)) * (H - T - B);
  const grid: number[] = [];
  for (let v = lo; v <= hi + 1; v += step) grid.push(v);
  // Ticks: years over two years or more, months under.
  const span = x1 - x0, ticks: { t: number; l: string }[] = [];
  if (span >= 2) {
    const every = span > 12 ? 5 : span > 6 ? 2 : 1;
    for (let y = Math.ceil(x0 / every) * every; y <= x1; y += every) ticks.push({ t: y, l: String(y) });
  } else {
    const every = Math.max(1, Math.ceil((span * 12) / 6));
    for (let m = Math.ceil(x0 * 12); m <= x1 * 12; m += every) ticks.push({ t: m / 12, l: SHORT_MONTHS[((m % 12) + 12) % 12] + " ’" + String(Math.floor(m / 12)).slice(2) });
  }
  const line = (k: "nw" | "sav") => pts.map((p, i) => (i ? "L" : "M") + X(p.t).toFixed(1) + " " + Y(p[k]).toFixed(1)).join(" ");
  // Round numbers net worth went past, between two entries: the latest three,
  // kept apart so their names don't run together.
  const passed: { t: number; v: number }[] = [];
  for (const m of MILESTONES) {
    for (let k = 1; k < pts.length; k++) {
      const a = pts[k - 1], b = pts[k];
      if (a.nw < m && b.nw >= m) { passed.push({ t: a.t + ((m - a.nw) / (b.nw - a.nw)) * (b.t - a.t), v: m }); break; }
    }
  }
  const marks = passed.sort((a, b) => b.t - a.t).filter((m, i, arr) => arr.slice(0, i).every((o) => Math.abs(X(o.t) - X(m.t)) > 90)).slice(0, 3);
  const hot = at != null ? pts.reduce((b, p) => (Math.abs(p.t - at) < Math.abs(b.t - at) ? p : b), pts[0]) : null;
  const prev = hot ? pts[pts.indexOf(hot) - 1] : undefined;
  const probe = (clientX: number) => {
    const r = ref.current?.querySelector("svg")?.getBoundingClientRect();
    if (!r) return;
    const x = ((clientX - r.left) / r.width) * W;
    setAt(x < L - 10 || x > W - R + 10 ? null : x0 + ((x - L) / (W - L - R)) * (x1 - x0));
  };
  const move = (e: React.PointerEvent<SVGSVGElement>) => { if (e.pointerType !== "touch") probe(e.clientX); };
  const scrub = useScrub(ref, (x) => probe(x), () => setAt(null));
  const left = hot ? X(hot.t) > W * 0.55 : false;
  const many = pts.length > 30;
  return (
    <div ref={ref} className="dsh-chartwrap dsh-mt" {...scrub}>
      <svg className="dsh-chart" viewBox={`0 0 ${W} ${H}`} width={W} height={H} role="img"
        aria-label={`Net worth from ${money(pts[0].nw)} on ${longDate(pts[0].date)} to ${money(pts[pts.length - 1].nw)} on ${longDate(pts[pts.length - 1].date)}`}
        onPointerMove={move} onPointerDown={move} onPointerLeave={(e) => { if (e.pointerType !== "touch") setAt(null); }}>
        {grid.map((v) => <g key={v}><line className={v === 0 && lo < 0 ? "dsh-gl dsh-zero" : "dsh-gl"} x1={L} x2={W - R} y1={Y(v)} y2={Y(v)} /><text x={L - 8} y={Y(v) + 4} textAnchor="end">{v < 0 ? "−" + shortMoney(-v) : shortMoney(v)}</text></g>)}
        {ticks.map((k) => <text key={k.t} x={X(k.t)} y={H - 6} textAnchor="middle">{k.l}</text>)}
        {marks.map((m) => {
          const x = X(m.t), end = x + 60 > W - R;
          return (
            <g key={m.v} className="dsh-ms">
              <line x1={x} x2={x} y1={T - 12} y2={Y(m.v)} />
              <text x={end ? x - 5 : x + 5} y={T - 4} textAnchor={end ? "end" : "start"}>Passed {shortMoney(m.v)}</text>
            </g>
          );
        })}
        <path className="dsh-l-sav" d={line("sav")} />
        <path className="dsh-l-nw" d={line("nw")} />
        {many ? null : pts.map((p) => <circle key={p.date} className="dsh-p-nw" cx={X(p.t)} cy={Y(p.nw)} r={3.5} />)}
        {hot ? <g><line className="dsh-cursor" x1={X(hot.t)} x2={X(hot.t)} y1={T} y2={H - B} /><circle className="dsh-p-sav" cx={X(hot.t)} cy={Y(hot.sav)} r={4.5} /><circle className="dsh-cdot" cx={X(hot.t)} cy={Y(hot.nw)} r={5} /></g> : null}
      </svg>
      {hot ? (
        <div className={left ? "dsh-tipbox dsh-tip-l" : "dsh-tipbox dsh-tip-r"}>
          <b>{longDate(hot.date)}</b>
          <div className="dsh-tiprow"><span>Net worth</span><span>{money(hot.nw)}</span></div>
          <div className="dsh-tiprow"><span>Savings and investments</span><span>{money(hot.sav)}</span></div>
          {prev ? <div className="dsh-tiprow"><span>Since {longDate(prev.date)}</span><span>{signed(hot.nw - prev.nw)}</span></div> : null}
        </div>
      ) : null}
    </div>
  );
}

/* ---------- When you can spend it ---------- */

type Step = { key: string; t: number | null; when: string; year: number | null; amount: number; what: Set<string> };

/** Each person's year of birth (with the month), retirement age and
    first name, as the steps below need them. */
function people(pr: Profile, names: [string, string] | null) {
  const ps = names ? [pr.p1, pr.p2] : [pr.p1];
  return ps.map((p, i) => ({
    born: p.by != null ? p.by + ((p.bm ?? 7) - 1) / 12 : null,
    retire: p.retire,
    name: names ? whoName(names, i as 0 | 1) : "You",
  }));
}
const turns = (n: string) => (n === "You" ? "turn" : "turns");

/** Where today's savings stand by when they can be spent without a
    penalty: cash, the brokerage and Roth contributions now; a 457(b) when
    its owner leaves that job; other retirement accounts and Roth growth at
    the owner's 59½; an HSA (medical costs any time) for anything at 65. A
    shared account is half each, as the plan counts it. */
export function readyToSpend(items: Item[], pr: Profile, names: [string, string] | null) {
  const P = people(pr, names), now = nowYear(), steps = new Map<string, Step>();
  let estimated = false, undated = false;
  const add = (who: number | null, at: "now" | "leave" | "59" | "65", amount: number, what: string) => {
    if (amount <= 0) return;
    const p = who == null ? null : P[who];
    let t: number | null = 0, when = "Now", year: number | null = null, key = "now";
    if (at !== "now" && p) {
      const age = at === "leave" ? p.retire ?? 59.5 : at === "59" ? 59.5 : 65;
      t = p.born != null ? p.born + age : null;
      if (t == null) undated = true;
      if (t == null || t > now) {
        when = at === "leave" ? `${p.name} ${p.name === "You" ? "leave" : "leaves"} work` : `${p.name} ${turns(p.name)} ${at === "59" ? "59½" : "65"}`;
        year = t == null ? null : Math.floor(t);
        key = at + who;
      } else t = 0;
    }
    const s = steps.get(key) ?? { key, t, when, year, amount: 0, what: new Set<string>() };
    s.amount += amount; s.what.add(what);
    steps.set(key, s);
  };
  let home = 0;
  for (const i of items) {
    if (i.side !== "asset") continue;
    const v = i.value || 0;
    if (i.kind === "home" || i.kind === "other") { home += v; continue; }
    const w = ownerOf(i, names), shares: [number, number][] = !names ? [[0, 1]] : w == null ? [[0, 0.5], [1, 0.5]] : [[w, 1]];
    for (const [who, part] of shares) {
      const x = v * part;
      if (i.kind === "cash") add(null, "now", x, "Cash");
      else if (i.kind === "brokerage") add(null, "now", x, "Brokerage");
      else if (i.kind === "roth") {
        if (i.basis == null) estimated = true;
        const c = Math.min(x, i.basis != null ? i.basis * part : x / 2);
        add(null, "now", c, "Roth contributions");
        add(who, "59", x - c, "Roth growth");
      } else if (i.kind === "g457") add(who, "leave", x, "457(b)");
      else if (i.kind === "hsa") add(who, "65", x, "HSA");
      else add(who, "59", x, i.kind === "ira" ? "IRA" : "401(k) or 403(b)");
    }
  }
  const list = [...steps.values()].sort((a, b) => (a.t ?? Infinity) - (b.t ?? Infinity));
  return { steps: list, total: list.reduce((t, s) => t + s.amount, 0), home, estimated, undated, early: P.some((p) => p.retire != null && p.retire < 59.5) };
}

export function ReadyToSpend({ items, pr, names }: { items: Item[]; pr: Profile; names: [string, string] | null }) {
  const R = readyToSpend(items, pr, names);
  if (R.total <= 0) return <p className="dsh-cap">Nothing in savings{names ? " here" : ""} yet. Add accounts below with Update balances.</p>;
  const now = R.steps.find((s) => s.key === "now")?.amount ?? 0;
  const hsa = R.steps.some((s) => s.what.has("HSA")), work = R.steps.some((s) => s.what.has("401(k) or 403(b)"));
  return (
    <>
      <div className="dsh-stats">
        <div className="dsh-stat"><div className="dsh-label">Can be spent today · {Math.round((now / R.total) * 100)}%</div><div className="dsh-fig dsh-md">{money(now)}</div></div>
        <div className="dsh-stat"><div className="dsh-label">Opens later</div><div className="dsh-fig dsh-md">{money(R.total - now)}</div></div>
      </div>
      {R.undated ? null : <Steps steps={R.steps} total={R.total} />}
      <table className="dsh-tbl dsh-stbl dsh-mt">
        <thead><tr><th>When, and what opens</th><th>Amount</th></tr></thead>
        <tbody>
          {R.steps.map((s) => (
            <tr key={s.key}><td>{s.when}{s.year != null ? <span className="dsh-muted"> · {s.year}</span> : null}<div className="dsh-tnote dsh-tnote0">{[...s.what].join(", ")}</div></td><td>{money(s.amount)}</td></tr>
          ))}
        </tbody>
      </table>
      <p className="dsh-cap dsh-mt6">
        Today&apos;s balances, before any growth.{R.estimated ? " Roth contributions not given are taken as half the balance; add them with Update balances." : ""}
        {hsa ? " An HSA pays medical costs tax-free at any age." : ""}
        {work && R.early ? " A 401(k) opens at 55 if you leave that employer in or after the year you turn 55." : ""}
        {R.home > 0 ? (sum(items, "asset", ["other"]) > 0 ? ` Your home and other assets (${money(R.home)}) aren't counted here.` : ` Your home (${money(R.home)}) isn't counted here.`) : ""}
        {R.undated ? " Add birth years on Profile to see the years." : ""}
      </p>
    </>
  );
}

/** The savings within reach over the years: a step up at each opening. */
function Steps({ steps, total }: { steps: Step[]; total: number }) {
  const [ref, W] = useWidth(600);
  const [hover, setHover] = useState<string | null>(null);
  const H = 190, L = 54, R = 64, T = 22, B = 26;
  const now = nowYear(), dated = steps.map((s) => (s.t || now));
  const x0 = now, x1 = Math.max(...dated, now + 1) + Math.max(1, (Math.max(...dated) - now) * 0.06);
  const step = niceStep(total), top = Math.ceil(total / step) * step;
  const X = (t: number) => L + ((t - x0) / (x1 - x0)) * (W - L - R), Y = (v: number) => T + (1 - v / top) * (H - T - B);
  const grid: number[] = [];
  for (let v = 0; v <= top + 1; v += step) grid.push(v);
  // Running totals, and the path that climbs at each opening.
  const runs = steps.map((_, k) => steps.slice(0, k + 1).reduce((t, s) => t + s.amount, 0));
  const at = steps.map((s, k) => ({ s, x: X(dated[k]), y: Y(runs[k]), run: runs[k] }));
  const d = `M${X(x0).toFixed(1)} ${Y(0).toFixed(1)}` + at.map((p, k) => ` L${p.x.toFixed(1)} ${(k ? at[k - 1].y : Y(0)).toFixed(1)} L${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join("");
  const edge = `${d} L${X(x1).toFixed(1)} ${at[at.length - 1].y.toFixed(1)}`;
  const area = `${edge} L${X(x1).toFixed(1)} ${Y(0).toFixed(1)} Z`;
  // A year under each opening, skipping one too close to the last shown.
  const years = at.filter((p) => p.s.year != null).filter((p, i, arr) => arr.slice(0, i).every((o) => Math.abs(o.x - p.x) > 40));
  const read = (p: (typeof at)[number]) => `${p.s.when}${p.s.year != null ? " (" + p.s.year + ")" : ""}: ${money(p.s.amount)} opens, ${money(p.run)} in reach`;
  return (
    <div ref={ref} className="dsh-mt">
      <svg className="dsh-chart" viewBox={`0 0 ${W} ${H}`} width={W} height={H} role="img" aria-label={at.map(read).join(". ")} {...touchRead(setHover)}>
        {grid.map((v) => <g key={v}><line className="dsh-gl" x1={L} x2={W - R} y1={Y(v)} y2={Y(v)} /><text x={L - 8} y={Y(v) + 4} textAnchor="end">{shortMoney(v)}</text></g>)}
        <text x={X(x0)} y={H - 6} textAnchor="start">Today</text>
        {years.filter((p) => p.x - X(x0) > 44).map((p) => <text key={p.s.key} x={p.x} y={H - 6} textAnchor="middle">{p.s.year}</text>)}
        <path className="dsh-step" d={area} />
        <path className="dsh-stepl" d={edge} />
        {at.map((p) => (
          <g key={p.s.key} onMouseEnter={() => setHover(read(p))} onMouseLeave={() => setHover(null)}>
            <circle className="dsh-hit" cx={p.x} cy={p.y} r={14} data-read={read(p)} />
            <circle className="dsh-stepdot" cx={p.x} cy={p.y} r={4.5} />
          </g>
        ))}
        <text className="dsh-stepv" x={W - R + 8} y={at[at.length - 1].y + 4}>{shortMoney(total)}</text>
      </svg>
      <div className="dsh-cap dsh-hoverline" aria-live="polite">{hover ?? <><span className="dsh-mouse">Point at a step for what opens then.</span><span className="dsh-touch">Tap a step for what opens then.</span></>}</div>
    </div>
  );
}

/* ---------- How it's taxed ---------- */

const TAX = [
  { id: "pre", name: "Pre-tax", how: "Taxed as income when you take it out", kinds: ["workplace", "g457", "ira"] },
  { id: "roth", name: "Roth", how: "Tax-free in retirement", kinds: ["roth"] },
  { id: "brok", name: "Brokerage", how: "Only the gain is taxed, at capital-gains rates", kinds: ["brokerage"] },
  { id: "hsa", name: "HSA", how: "Tax-free for medical costs", kinds: ["hsa"] },
  { id: "cash", name: "Cash", how: "Already taxed", kinds: ["cash"] },
] as const;

export function TaxMix({ items }: { items: Item[] }) {
  const [ref, W] = useWidth(600);
  const [hover, setHover] = useState<string | null>(null);
  const parts = TAX.map((c) => ({ ...c, v: sum(items, "asset", [...c.kinds]) })).filter((c) => c.v > 0);
  const total = parts.reduce((t, c) => t + c.v, 0);
  if (total <= 0) return <p className="dsh-cap">Nothing in savings here yet. Add accounts below with Update balances.</p>;
  const pct = (v: number) => Math.round((v / total) * 100);
  const pre = parts.find((c) => c.id === "pre")?.v ?? 0, free = parts.filter((c) => c.id === "roth" || c.id === "hsa").reduce((t, c) => t + c.v, 0);
  const brok = items.filter((i) => i.side === "asset" && i.kind === "brokerage" && i.value > 0);
  const gain = brok.length && brok.every((i) => i.basis != null) ? brok.reduce((t, i) => t + i.value - (i.basis ?? 0), 0) : null;
  const bh = 34, H = bh;
  const widths = parts.map((c) => (c.v / total) * W), starts = widths.map((_, k) => widths.slice(0, k).reduce((s, w) => s + w, 0));
  const takeaway = pre / total >= 0.6
    ? "Most of it is taxed as income when you spend it. Roth savings, or Roth conversions in low-income years, spread that tax out."
    : free / total >= 0.5
      ? "Most of it comes out tax-free, which keeps your taxable income low in retirement."
      : "A mix like this lets you choose each year which account to draw from, to keep your tax bracket low.";
  return (
    <>
      <div className="dsh-stats">
        <div className="dsh-stat"><div className="dsh-label">Taxed as income when taken out</div><div className="dsh-fig dsh-md">{pct(pre)}%</div></div>
        <div className="dsh-stat"><div className="dsh-label">Tax-free (Roth and HSA)</div><div className="dsh-fig dsh-md">{pct(free)}%</div></div>
      </div>
      <div ref={ref} className="dsh-mt">
        <svg className="dsh-bars" viewBox={`0 0 ${W} ${H}`} width={W} height={H} role="img" aria-label={parts.map((c) => `${c.name} ${money(c.v)}, ${pct(c.v)}%`).join("; ")} {...touchRead(setHover)}>
          {parts.map((c, k) => {
            const label = `${c.name}: ${money(c.v)}, ${pct(c.v)}%. ${c.how}.`;
            return <rect key={c.id} className={"dsh-seg dsh-t-" + c.id} x={starts[k]} y={0} width={Math.max(0, widths[k] - 2)} height={bh} rx={4} onMouseEnter={() => setHover(label)} onMouseLeave={() => setHover(null)} aria-label={label} data-read={label} />;
          })}
        </svg>
        <div className="dsh-cap dsh-hoverline" aria-live="polite">{hover ?? takeaway}</div>
      </div>
      <table className="dsh-tbl dsh-xtbl dsh-mt6">
        <tbody>
          {parts.map((c) => (
            <tr key={c.id}><td><i className={"dsh-sw dsh-t-" + c.id} aria-hidden="true" />{c.name}<div className="dsh-tnote">{c.how}</div></td><td>{money(c.v)}</td><td className="dsh-muted">{pct(c.v)}%</td></tr>
          ))}
        </tbody>
      </table>
      {gain != null ? <p className="dsh-cap dsh-mt6">Of the brokerage&apos;s {money(brok.reduce((t, i) => t + i.value, 0))}, {gain >= 0 ? <>{money(gain)} is gain: the only part taxed when you sell.</> : <>{money(-gain)} is a loss, which can offset gains or some income when you sell.</>}</p> : null}
    </>
  );
}
