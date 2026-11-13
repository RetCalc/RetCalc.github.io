"use client";

/* Retirement's Taxes view: which accounts each year's withdrawal comes from
   and how much traditional money to convert to Roth, on the plan's own
   withdrawals (taxes.ts says how it fits the plan). The choices are tried
   in every past market against no conversions; "Use this tax plan" saves
   them, and later changes are saved to it. */

import { useEffect, useMemo, useState } from "react";
import { ChevronDownIcon, ReceiptTextIcon, SparklesIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { SelectField } from "@/components/fields/Field";
import { CheckToggle } from "@/components/fields/CheckToggle";
import { CsvButton } from "@/components/common/CsvButton";
import { useScrub } from "@/components/charts/ChartFrame";
import type { PlBudgetRow } from "@/lib/engine/typed-plan";
import { useWidth } from "./charts";
import { longDate, money, shortMoney } from "./format";
import { couple, results, type Results } from "./model";
import { today, useDashboard, type Entry, type Profile } from "./store";
import { earlyRetirees } from "./bridge";
import {
  FILL_NAMES, MARKETS, NO_PLAN, UNTIL_NAMES, bestPlan, rateAbove, bracketLines, compare, incomeParts, marketYear, planOf, planWords, samePlan, taxDetail, taxSetup,
  type MarketKey, type TaxPlan, type TaxSetup,
} from "./taxes";
import { Note, Tile, Tip, TipLabel, To } from "./ui";

const round = (v: number) => Math.round(v / 1000) * 1000;

export function TaxesTile() {
  const { data, setProfile: set } = useDashboard();
  const pr = data.profile, entries = data.entries;
  const R = useMemo(() => results(pr, entries), [pr, entries]);
  const s = useMemo(() => taxSetup(pr, entries, R), [pr, entries, R]);
  const saved = pr.taxPlan ?? null;
  // The plan on screen: the saved one, or what's being tried.
  const [draft, setDraft] = useState<TaxPlan>(() => planOf(pr));
  const T = saved ? planOf(pr) : draft;
  const change = (t: TaxPlan) => {
    setDraft(t);
    if (saved) set((p) => ({ ...p, taxPlan: { ...t, at: p.taxPlan?.at ?? today() } }));
  };
  const use = () => set((p) => ({ ...p, taxPlan: { ...draft, at: today() } }));
  const [market, setMarket] = useState<MarketKey>("p50");
  // The best plan takes a moment (every choice in every market): worked out after paint.
  const [best, setBest] = useState<{ s: TaxSetup; T: TaxPlan } | null>(null);
  useEffect(() => {
    if (!s) return;
    const id = window.setTimeout(() => setBest({ s, T: bestPlan(s).T }), 30);
    return () => window.clearTimeout(id);
  }, [s]);
  const bestT = best && best.s === s ? best.T : null;

  if (!s) {
    return <div className="dsh-r4"><Note>{R.abroad ? "Outside the US, your plan doesn't figure taxes." : "Taxes in retirement open once your profile has your ages, savings, retirement age and spending."}</Note></div>;
  }
  const year = marketYear(s, market), run = taxDetail(s, T, year)!, base = taxDetail(s, NO_PLAN, year)!;
  const all = compare(s, T), shown = all.gains.get(year) ?? null;
  const isBase = samePlan(T, NO_PLAN);
  const early = earlyRetirees(pr)[0];
  const delta = (a: number, b: number, good: "up" | "down") => {
    const d = round(a - b);
    if (isBase || Math.abs(d) < 1000) return null;
    const better = good === "up" ? d > 0 : d < 0;
    return <div className={"dsh-cap dsh-mt6 " + (better ? "dsh-chg dsh-up" : "dsh-chg dsh-dn")}>{d > 0 ? "+" : "−"}{money(Math.abs(d))} vs no conversions</div>;
  };
  const conv = run.rows.filter((r) => r.conv > 1), convYears = conv.length ? `${conv[0].age} to ${conv[conv.length - 1].age}` : null;

  return (
    <div className="dsh-r4">
      <Tile id="taxes" icon={ReceiptTextIcon} title="Taxes in retirement" tip="taxPlan"
        right={<span className="dsh-cap">{s.year0} to {s.year0 + s.years - 1}{s.bridged ? ", after the bridge" : ""}</span>}>
        {saved ? (
          <p className="dsh-cap dsh-mt6">Your tax plan, saved {longDate(saved.at)}: <b>{planWords(T)}</b>. Changes below are saved to it.{" "}
            <Button variant="link" size="inline" onClick={() => set((p) => ({ ...p, taxPlan: undefined }))}>Remove it</Button></p>
        ) : (
          <div className="dsh-mt6 dsh-tip">
            <span>Your withdrawal strategy sets how much comes out each year. Choose which accounts it comes from, and how much to convert to Roth while your tax is low{early ? "; the bridge plans the years before 59½" : ""}.</span>
            <Button size="sm" onClick={use}>Use this tax plan</Button>
          </div>
        )}

        <div className="dsh-tx">
          <div className="dsh-tx-in dsh-fields dsh-fields-sm">
            <SelectField id="txFill" label={<TipLabel text="Draw traditional money up to" id="taxFill" />} value={String(T.f)} onChange={(v) => change({ ...T, f: Number(v) })}>
              {FILL_NAMES.map((n, i) => <option key={i} value={i}>{n}</option>)}
            </SelectField>
            <SelectField id="txUntil" label={<TipLabel text="The rest of that room" id="taxUntil" />} value={String(T.u)} onChange={(v) => change({ ...T, u: Number(v) })} hidden={!T.f}>
              {UNTIL_NAMES.map((n, i) => <option key={i} value={i}>{i ? "Convert it to Roth, " + n.toLowerCase() : n}</option>)}
            </SelectField>
            {T.f && s.hasIrmaa ? <CheckToggle on={!!T.im} onToggle={() => change({ ...T, im: T.im ? 0 : 1 })} tip={<Tip id="taxIrmaa" title="Medicare's surcharge" />}>Stay under Medicare&apos;s surcharge from 63</CheckToggle> : null}
            {T.f && s.hasAca ? <CheckToggle on={!!T.ac} onToggle={() => change({ ...T, ac: T.ac ? 0 : 1 })} tip={<Tip id="taxAca" title="Marketplace credit" />}>Keep the marketplace credit before 65</CheckToggle> : null}
            <SelectField id="txMarket" label={<TipLabel text="Market to follow" id="taxMarket" />} value={market} onChange={(v) => setMarket(v as MarketKey)}>
              {MARKETS.map((m) => <option key={m.k} value={m.k}>{m.k === "p50" ? "Median" : m.name + " percentile"}, like retiring in {marketYear(s, m.k)}</option>)}
            </SelectField>
            <div className="dsh-tx-best">
              {bestT == null ? <span className="dsh-cap">Finding the plan that leaves you the most…</span>
                : samePlan(bestT, T) ? <span className="dsh-cap"><SparklesIcon aria-hidden="true" /> This is the plan that leaves you the most <Tip id="taxBest" title="The plan that leaves you the most" /></span>
                : <>
                    <span className="dsh-cap">Leaves you the most: <b>{planWords(bestT)}</b> <Tip id="taxBest" title="The plan that leaves you the most" /></span>
                    <Button size="sm" variant="outline" onClick={() => change(bestT)}><SparklesIcon aria-hidden="true" />Try it</Button>
                  </>}
            </div>
          </div>

          <div className="dsh-tx-out">
            <div className="dsh-stats">
              <div className="dsh-stat"><div className="dsh-label"><TipLabel text="Tax over retirement" id="taxTotal" /></div><div className="dsh-fig dsh-md">{money(round(run.res.tax))}</div>{delta(run.res.tax, base.res.tax, "down")}{run.res.overN > 0 ? <div className="dsh-cap dsh-mt6">{money(round(run.res.over))} of it from savings, in {run.res.overN} {run.res.overN === 1 ? "year" : "years"} <Tip id="taxOver" title="Tax from savings" /></div> : null}</div>
              <div className="dsh-stat"><div className="dsh-label"><TipLabel text="Spent over retirement" id="taxSpent" /></div><div className="dsh-fig dsh-md">{money(round(run.res.spent))}</div>{delta(run.res.spent, base.res.spent, "up")}</div>
              <div className="dsh-stat"><div className="dsh-label"><TipLabel text="Left for heirs, after their tax" id="taxHeirs" /></div><div className="dsh-fig dsh-md">{money(round(run.res.legacy))}</div>{delta(run.res.legacy, base.res.legacy, "up")}</div>
              <div className="dsh-stat"><div className="dsh-label"><TipLabel text="Converted to Roth" id="taxConv" /></div><div className="dsh-fig dsh-md">{money(round(run.res.conv))}</div>{convYears ? <div className="dsh-cap dsh-mt6">Ages {convYears}{run.res.cappedN > 0 ? <>, limited by your tax budget in {run.res.cappedN} {run.res.cappedN === 1 ? "year" : "years"} <Tip id="taxCapped" title="Limited by your tax budget" /></> : null}</div> : null}</div>
            </div>
            {!isBase ? (
              <p className="dsh-cap dsh-mt">Valued at the start of retirement <Tip id="taxAhead" title="Valued at the start of retirement" />, this plan comes out ahead of no conversions in <b>{all.ahead} of {all.of}</b> past markets{shown != null ? <>, and {Math.abs(shown) < 1000 ? "about even" : <>{money(round(Math.abs(shown)))} {shown >= 0 ? "ahead" : "behind"}</>} in the one shown</> : null}.</p>
            ) : null}
            <TaxMap s={s} rows={run.rows} />
          </div>
        </div>

        <YearTable s={s} rows={run.rows} names={couple(pr)} />
        <p className="dsh-cap dsh-mt">In today&apos;s dollars. Each year&apos;s withdrawal is your strategy&apos;s, from <To href="/dashboard/retirement">Drawdown</To>; Social Security and the ages you claim it come from <To href="/dashboard/income#social-security">Income</To>.</p>
      </Tile>
    </div>
  );
}

const PARTS = [
  { k: "pay", name: "Pay and pensions", cls: "dsh-tx-pay" },
  { k: "tss", name: "Social Security, the taxed part", cls: "dsh-tx-ss" },
  { k: "rmd", name: "Required withdrawals", cls: "dsh-tx-rmd" },
  { k: "other", name: "Other traditional withdrawals", cls: "dsh-tx-trad" },
  { k: "conv", name: "Roth conversions", cls: "dsh-tx-conv" },
  { k: "gain", name: "Capital gains", cls: "dsh-tx-gain" },
] as const;

/** Each year's income as the tax sees it, stacked, under the lines where the
    deduction and each bracket end: the room left under a line is income
    that year could take at that rate. */
function TaxMap({ s, rows }: { s: TaxSetup; rows: PlBudgetRow[] }) {
  const [ref, W] = useWidth(640);
  const [at, setAt] = useState<number | null>(null);
  const [hi, setHi] = useState<string | null>(null);
  const H = 260, L = 54, R = 40, T = 12, B = 24;
  const parts = rows.map(incomeParts), lines = rows.map((r) => bracketLines(s, r));
  const tot = (i: number) => PARTS.reduce((t, p) => t + parts[i][p.k], 0);
  const maxBar = Math.max(1, ...rows.map((_, i) => tot(i)));
  // Show the lines up to the first one above every bar.
  const shown = [0, 1, 2, 3, 4].filter((k) => k <= 1 || lines.some((l) => l[k - 1].at < maxBar * 1.02));
  const max = Math.max(maxBar, ...lines.map((l) => l[shown[shown.length - 1]].at)) * 1.04;
  const step = (() => { const sz = Math.pow(10, Math.floor(Math.log10(max / 4))); return [1, 2, 2.5, 5, 10].map((x) => x * sz).find((x) => max / x <= 5) ?? sz * 10; })();
  const top = Math.ceil(max / step) * step;
  const n = rows.length, slot = (W - L - R) / n, bw = Math.max(2, Math.min(22, slot * 0.72));
  const X = (i: number) => L + i * slot + slot / 2, Y = (v: number) => T + (1 - v / top) * (H - T - B);
  const grid: number[] = [];
  for (let v = 0; v <= top + 1; v += step) grid.push(v);
  const every = n > 30 ? 10 : n > 14 ? 5 : n > 7 ? 2 : 1;
  const probe = (clientX: number) => {
    const r = ref.current?.querySelector("svg")?.getBoundingClientRect();
    if (!r) return;
    const x = ((clientX - r.left) / r.width) * W, i = Math.floor((x - L) / slot);
    setAt(i >= 0 && i < n ? i : null);
  };
  const move = (e: React.PointerEvent<SVGSVGElement>) => { if (e.pointerType !== "touch") probe(e.clientX); };
  const scrub = useScrub(ref, (x) => probe(x), () => setAt(null));
  const step2 = (k: number) => lines.map((l, i) => `${i ? "L" : "M"}${(X(i) - slot / 2).toFixed(1)} ${Y(l[k].at).toFixed(1)} L${(X(i) + slot / 2).toFixed(1)} ${Y(l[k].at).toFixed(1)}`).join(" ");
  const hot = at != null ? rows[at] : null;
  const used = PARTS.filter((p) => parts.some((x) => x[p.k] > 1));
  return (
    <div ref={ref} className="dsh-chartwrap dsh-mt dsh-tx-map" {...scrub}>
      <svg className="dsh-chart" viewBox={`0 0 ${W} ${H}`} width={W} height={H} role="img" aria-label="Each year's taxable income by source, with the lines where the deduction and each tax bracket end"
        onPointerMove={move} onPointerDown={move} onPointerLeave={(e) => { if (e.pointerType !== "touch") setAt(null); }}>
        {grid.map((v) => <g key={v}><line className="dsh-gl" x1={L} x2={W - R} y1={Y(v)} y2={Y(v)} /><text x={L - 8} y={Y(v) + 4} textAnchor="end">{shortMoney(v)}</text></g>)}
        {rows.map((r, i) => (i % every === 0 ? <text key={i} x={X(i)} y={H - 6} textAnchor="middle">{r.age}</text> : null))}
        {at != null ? <rect className="dsh-yby-hot" x={X(at) - slot / 2} y={T} width={slot} height={H - T - B} /> : null}
        {rows.map((_, i) => {
          let base = 0;
          return (
            <g key={i}>
              {PARTS.map((p) => {
                const v = parts[i][p.k], y1 = Y(base + v), y0 = Y(base);
                base += v;
                return v > 1 ? <rect key={p.k} className={"dsh-seg " + p.cls} data-dim={hi && hi !== p.k ? "" : undefined} x={X(i) - bw / 2} y={y1} width={bw} height={Math.max(0, y0 - y1 - (y1 > T ? 1 : 0))} rx={2} /> : null;
              })}
            </g>
          );
        })}
        {shown.map((k) => <g key={k} className={k === 0 ? "dsh-tx-line dsh-tx-ded" : "dsh-tx-line"}><path d={step2(k)} /></g>)}
        {/* Each band's rate at the right, in the middle of the band (left out where it's too thin to read). */}
        {[...shown, shown.length].map((k) => {
          const lo = k === 0 ? 0 : lines[n - 1][shown[k - 1]].at, hi = k < shown.length ? lines[n - 1][shown[k]].at : top;
          if (Y(lo) - Y(hi) < 13) return null;
          return <text key={"r" + k} className="dsh-tx-rate" x={W - R + 6} y={(Y(lo) + Y(hi)) / 2 + 4}>{k < shown.length ? lines[n - 1][shown[k]].name : rateAbove(s, shown[shown.length - 1])}</text>;
        })}
      </svg>
      {hot ? (
        <div className={at! > n / 2 ? "dsh-tipbox dsh-tip-l" : "dsh-tipbox dsh-tip-r"}>
          <b>{s.year0 + at!}, age {hot.age}{hot.age2 != null ? " and " + hot.age2 : ""}</b>
          {used.map((p) => <div key={p.k} className="dsh-tiprow"><span><i className={"dsh-sw " + p.cls} aria-hidden="true" />{p.name}</span><span>{money(Math.round(parts[at!][p.k]))}</span></div>)}
          <div className="dsh-tiprow"><span>No tax up to</span><span>{money(Math.round(lines[at!][0].at))}</span></div>
          <div className="dsh-tiprow"><span>Tax that year</span><span>{money(Math.round(hot.tax + hot.pen))}</span></div>
        </div>
      ) : null}
      <div className="dsh-legend dsh-yby-legend dsh-mt6">
        {used.map((p) => <span key={p.k} onPointerEnter={() => setHi(p.k)} onPointerLeave={() => setHi(null)}><i className={"dsh-sw " + p.cls} aria-hidden="true" />{p.name}</span>)}
        <span><i className="dsh-yby-lsw dsh-tx-lsw" aria-hidden="true" />Where each bracket ends <Tip id="taxLines" title="The bracket lines" /></span>
      </div>
    </div>
  );
}

/** Year by year: where each withdrawal came from, what was converted, the
    tax, and what was left to spend. */
function YearTable({ s, rows, names }: { s: TaxSetup; rows: PlBudgetRow[]; names: boolean }) {
  const [open, setOpen] = useState(false);
  const m = (v: number) => (Math.abs(v) < 1 ? "—" : money(Math.round(v)));
  const sum = (g: (r: PlBudgetRow) => number) => rows.reduce((t, r) => t + g(r), 0);
  const prem = (r: PlBudgetRow) => r.irmaa + r.aca;
  const csv = () => [["Year", names ? "Ages" : "Age", "Withdrawal", "From brokerage", "From traditional", "From Roth", "Converted to Roth", "Tax", "Income-linked premiums", "Spending"],
    ...rows.map((r, i) => [String(s.year0 + i), r.age2 != null ? `${r.age} and ${r.age2}` : String(r.age), ...[r.out, r.brok, r.trad, r.roth, r.conv, r.tax + r.pen, prem(r), r.left].map((v) => String(Math.round(v)))])];
  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <div className="dsh-tx-th">
        <CollapsibleTrigger>{open ? "Hide" : "Show"} year by year<ChevronDownIcon aria-hidden="true" /></CollapsibleTrigger>
        {open ? <CsvButton label="Taxes year by year" filename="retcalc-retirement-taxes.csv" rows={csv} /> : null}
      </div>
      <CollapsibleContent variant="plain">
        <div className="dsh-scrollx dsh-mt">
          <table className="dsh-tbl dsh-yby dsh-tx-tbl">
            <thead>
              <tr>
                <th>Year</th><th>{names ? "Ages" : "Age"}</th><th>Withdrawal</th><th>Brokerage</th><th>Traditional</th><th>Roth</th><th>Converted</th><th>Tax</th>
                <th><TipLabel text="Premiums" id="taxPrem" /></th><th>Spending</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i}>
                  <td>{s.year0 + i}</td><td>{r.age}{r.age2 != null ? " · " + r.age2 : ""}</td>
                  <td className="dsh-yby-strong">{m(r.out)}</td><td>{m(r.brok)}</td><td>{m(r.trad)}</td><td>{m(r.roth)}</td>
                  <td>{m(r.conv)}</td><td>{m(r.tax + r.pen)}</td><td>{m(prem(r))}</td><td className="dsh-yby-strong">{m(r.left)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={2}>All {rows.length} years</td>
                <td>{money(sum((r) => r.out))}</td><td>{money(sum((r) => r.brok))}</td><td>{money(sum((r) => r.trad))}</td><td>{money(sum((r) => r.roth))}</td>
                <td>{money(sum((r) => r.conv))}</td><td>{money(sum((r) => r.tax + r.pen))}</td><td>{money(sum(prem))}</td><td>{money(sum((r) => r.left))}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

/** Plan summary's card: the tax plan (or none yet), and what it does
    against no conversions across past markets. */
export function TaxesCard({ pr, entries, R }: { pr: Profile; entries: Entry[]; R: Results }) {
  const s = useMemo(() => taxSetup(pr, entries, R), [pr, entries, R]);
  // With no tax plan yet, what the best one would do (worked out after paint).
  const [best, setBest] = useState<{ s: TaxSetup; c: ReturnType<typeof compare>; T: TaxPlan } | null>(null);
  const needBest = !!s && !pr.taxPlan;
  useEffect(() => {
    if (!s || !needBest) return;
    const id = window.setTimeout(() => { const T = bestPlan(s).T; setBest({ s, T, c: compare(s, T) }); }, 60);
    return () => window.clearTimeout(id);
  }, [s, needBest]);
  if (!s) return null;
  const T = planOf(pr), c = compare(s, T), conv = !samePlan(T, NO_PLAN);
  const B = best && best.s === s && !samePlan(best.T, NO_PLAN) ? best : null;
  return (
    <div className="dsh-r4">
      <Tile icon={ReceiptTextIcon} title="Taxes in retirement" tip="taxPlan" right={<To href="/dashboard/retirement#taxes">{pr.taxPlan ? "See your tax plan" : "Plan your taxes"}</To>}>
        <div className="dsh-stats">
          <div className="dsh-stat"><div className="dsh-label">Tax over retirement</div><div className="dsh-fig dsh-md">{money(round(c.tax))}</div>{conv ? <div className="dsh-cap dsh-mt6">{money(round(c.base.tax))} with no conversions</div> : null}</div>
          {conv ? <div className="dsh-stat"><div className="dsh-label">Converted to Roth</div><div className="dsh-fig dsh-md">{money(round(c.conv))}</div></div> : null}
          {conv ? <div className="dsh-stat"><div className="dsh-label">Ahead of no conversions</div><div className="dsh-fig dsh-md">{c.ahead} of {c.of}<small>past markets</small></div></div> : null}
          {!conv && B ? <div className="dsh-stat"><div className="dsh-label">With the plan that leaves the most</div><div className="dsh-fig dsh-md">{money(round(B.c.tax))}</div><div className="dsh-cap dsh-mt6">tax; worth about {money(round(B.c.gain))} more at the start of retirement, ahead in {B.c.ahead} of {B.c.of} past markets</div></div> : null}
        </div>
        <p className="dsh-cap dsh-mt">{pr.taxPlan ? <>Your tax plan: {planWords(T)}.</> : <>No tax plan yet: your plan draws the brokerage first, then traditional, then Roth, with no conversions.</>} Figures are the median past market, in today&apos;s dollars.</p>
      </Tile>
    </div>
  );
}
