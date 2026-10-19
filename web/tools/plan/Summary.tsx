"use client";

/* The walkthrough's last step: the plan on one page, to show someone. The
   answer at the top, then where every dollar of pay goes, each account,
   the balance climbing by age (with the stages and children marked), the
   stages themselves, and the way out: the report, copying it all into the
   tools, or starting over. Every figure from results.ts. */

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useHousehold } from "@/components/household/HouseholdProvider";
import { useToast } from "@/components/shell/Toast";
import { CompositionBar, HeroReading, PartKey, type PartTone } from "@/components/common/Reading";
import { Segmented } from "@/components/common/Readout";
import { ChartFrame, HoverMarks, XAxis, YAxis, pathD, useChartSize } from "@/components/charts/ChartFrame";
import { LegendToggle } from "@/components/charts/Legend";
import { TipRow } from "@/components/charts/TipRows";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { money, pctStr } from "@/lib/format";
import { SERIES } from "@/lib/hues";
import { cn } from "@/lib/utils";
import { sendToDrawdown } from "@/tools/drawdown/fields";
import { copyToTools } from "./copy";
import { ageSpan, ageText } from "./kids";
import { PLAN_DEFAULTS, loadPlan, type PlanState, type StepId } from "./model";
import { ACCT_NAMES, planSummary, type Acct, type PlanSummary } from "./results";

/* One blue-gray in four shades: the accounts read as one calm shape, and
   amber is the plan line alone. */
const ACCT_COLOR: Record<Acct, string> = { trad: "var(--ds-acct-1)", roth: "var(--ds-acct-2)", brok: "var(--ds-acct-3)", hsa: "var(--ds-acct-4)" };
const ACCTS: Acct[] = ["trad", "roth", "brok", "hsa"];
/** A family's shades: the series color, then lighter. */
const shade = (c: string, i: number) => (i === 0 ? c : `color-mix(in srgb, ${c} ${Math.max(35, 100 - i * 22)}%, transparent)`);

export function Summary({ plan, goTo }: { plan: PlanState; goTo: (s: StepId) => void }) {
  const { profile } = useHousehold();
  const S = useMemo(() => planSummary(plan, profile), [plan, profile]);
  if (!S) return (
    <Card className="col-span-full"><CardContent>
      <p className="m-0">The summary needs your age and retirement age, your pay and your plan. <Button variant="link" size="inline" onClick={() => goTo("start")}>Go back to the start</Button></p>
    </CardContent></Card>
  );
  return (
    <>
      <Hero S={S} stages={!!S.stages} />
      <PayCard S={S} />
      <Accounts S={S} />
      <Climb S={S} />
      {S.children ? <ChildrenCost S={S} /> : null}
      {S.stages ? <StageLine S={S} /> : null}
      <WhatNext S={S} />
      <Actions plan={plan} goTo={goTo} />
    </>
  );
}

/* ---- the answer ---- */
function Hero({ S, stages }: { S: PlanSummary; stages: boolean }) {
  const A = S.atRetire, perYr = S.p, savedYr = (S.inflow.trad + S.inflow.roth + S.inflow.brok + S.inflow.hsa) * perYr;
  const want = S.goal.v > 0 ? S.goal.v : null;
  const meets = want != null ? A.afterTax >= want - 0.5 : null;
  return (
    <Card size="flush" className="col-span-full">
      <HeroReading tone="answer"
        hero={{ label: "At " + S.retire + ", in today's dollars", id: "ppTotal", value: money(A.total),
          note: (stages ? "With your life stages, " : "") + money(A.fv) + " in future dollars, after " + Math.round(S.years) + " years of saving" }}
        figures={[
          { label: "A year to spend, after tax", id: "ppSpend", value: money(A.afterTax), note: "A " + pctStr(A.withdrawal, 1) + " withdrawal, taxed at " + pctStr(A.taxRate, 1) },
          ...(want != null ? [{ label: S.goal.fromBudget ? "Your budget, a year" : "Your spending goal", id: "ppWant", value: money(want), tone: meets ? "gain" as const : "loss" as const,
            note: meets ? "✓ Covered, with " + money(A.afterTax - want) + " to spare" : "✗ Short by " + money(want - A.afterTax) + " a year" }] : []),
          { label: "Saved each year", id: "ppSaved", value: money(savedYr), note: S.inflow.match > 0 ? money(S.inflow.match * perYr) + " of it your employer's match" : "Into your accounts, at today's pay" },
        ]} />
    </Card>
  );
}

/* ---- where every dollar of pay goes ---- */
type Part = { label: string; v: number; c: string };
function PayCard({ S }: { S: PlanSummary }) {
  const [unit, setUnit] = useState<"year" | "month" | "check">("year");

  const y = S.pay, mult = unit === "year" ? S.p : unit === "month" ? S.p / 12 : 1;
  const k = (v: number) => v * mult;
  const taxes: Part[] = [
    { label: "Federal income tax", v: y.fed, c: shade(SERIES.rose, 0) },
    { label: (y.stateName || "State") + " income tax", v: y.state, c: shade(SERIES.rose, 1) },
    { label: "Social Security and Medicare", v: y.fica, c: shade(SERIES.rose, 2) },
  ].filter((x) => x.v > 0.004);
  const yearTotal = S.groups.reduce((t, g) => t + g.yr, 0) || 1;
  const spend: Part[] = [
    ...(y.health > 0.004 ? [{ label: "Health premiums, through work", v: y.health, c: shade(SERIES.lavender, 0) }] : []),
    ...S.groups.map((g, i) => ({ label: g.group, v: (g.yr / yearTotal) * y.spend, c: shade(SERIES.lavender, i + (y.health > 0.004 ? 1 : 0)) })),
  ].filter((x) => x.v > 0.004);
  const save: Part[] = S.lines.map((l, i) => ({ label: l.name + (l.id === "rothIra" ? (l.roth ? " (Roth)" : " (traditional)") : l.id === "match" || l.id === "k401max" ? (l.roth ? ", Roth" : "") : ""), v: l.v, c: shade(SERIES.teal, i) }));
  const left: Part[] = y.left > 0.004 ? [{ label: "Not yet assigned", v: y.left, c: SERIES.gray }] : [];
  const all = [...taxes, ...spend, ...save, ...left], gross = y.gross || 1;
  const sum = (l: Part[]) => l.reduce((t, x) => t + x.v, 0);
  const cols = [
    { h: "Taxes", parts: taxes }, { h: "Spending", parts: spend }, { h: "Saving and investing", parts: save },
    ...(left.length ? [{ h: "Left over", parts: left }] : []),
  ];
  const units = S.per === "check" ? [["year", "Year"], ["month", "Month"], ["check", "Paycheck"]] as const : [["year", "Year"], ["month", "Month"]] as const;
  return (
    <Card className="col-span-full">
      <CardHeader>
        <CardTitle>Where your pay goes</CardTitle>
        <CardDescription>{money(k(y.gross))} of gross pay {unit === "year" ? "a year" : unit === "month" ? "per month" : "a paycheck"}, every dollar of it.
          {y.match > 0 ? " Your employer adds " + money(k(y.match)) + " on top." : ""}</CardDescription>
        <CardAction><Segmented size="compact" attr="data-ppunit" options={units} value={unit} onChange={setUnit} /></CardAction>
      </CardHeader>
      <CardContent>
        <div className="flex h-9 w-full overflow-hidden rounded-md" role="img"
          aria-label={cols.map((c) => c.h + " " + money(k(sum(c.parts)))).join(", ")}>
          {all.map((x) => <div key={x.label} title={x.label + ": " + money(k(x.v))} className="h-full w-(--w) border-r border-card bg-(--c) last:border-r-0" style={{ "--w": (x.v / gross) * 100 + "%", "--c": x.c } as React.CSSProperties}></div>)}
        </div>
        <div className="mt-1.5 flex w-full text-label text-muted-foreground tabular-nums" aria-hidden="true">
          {cols.map((c) => <div key={c.h} className="w-(--w) min-w-0 truncate pr-2" style={{ "--w": (sum(c.parts) / gross) * 100 + "%" } as React.CSSProperties}>{pctStr(sum(c.parts) / gross, 0)}</div>)}
        </div>
        <div className={cn("mt-5 grid gap-x-8 gap-y-5 max-sm:grid-cols-1", cols.length === 4 ? "sm:grid-cols-2 lg:grid-cols-4" : "sm:grid-cols-3")}>
          {cols.map((c) => (
            <div key={c.h} className="min-w-0">
              <div className="flex items-baseline justify-between gap-2 border-b border-border pb-1.5">
                <span className="font-semibold">{c.h}</span><span className="text-xl font-medium tabular-nums">{money(k(sum(c.parts)))}</span>
              </div>
              <ul className="m-0 list-none p-0 text-note">
                {c.parts.map((x) => (
                  <li key={x.label} className="flex items-baseline gap-2 py-1">
                    <i className="size-2.5 flex-none translate-y-px rounded-xs bg-(--c)" style={{ "--c": x.c } as React.CSSProperties} aria-hidden="true"></i>
                    <span className="min-w-0 flex-1">{x.label}</span><span className="tabular-nums">{money(k(x.v))}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

/* ---- each account ---- */
function Accounts({ S }: { S: PlanSummary }) {
  const per = S.per === "check" ? "a paycheck" : "per month";
  const shown = ACCTS.filter((a) => S.inflow[a] > 0.004 || (S.atRetire.byAcct?.[a] ?? 0) > 1);
  return (
    <Card className="col-span-full">
      <CardHeader><CardTitle>Your accounts</CardTitle>
        <CardDescription>What goes into each, and what each holds at {S.retire} in today&apos;s dollars.{S.inflow.ef > 0 ? " The emergency fund (" + money(S.inflow.ef) + " " + per + ") is cash, kept out of the plan." : ""}</CardDescription></CardHeader>
      <CardContent className={cn("grid gap-4 max-sm:grid-cols-1", shown.length >= 4 ? "sm:grid-cols-2 lg:grid-cols-4" : shown.length === 3 ? "sm:grid-cols-3" : "sm:grid-cols-2")}>
        {shown.map((a) => {
          const at = S.atRetire.byAcct?.[a] ?? 0, share = S.atRetire.total > 0 ? at / S.atRetire.total : 0;
          return (
            <div key={a} className="rounded-xl border border-border bg-muted p-4">
              <div className="flex items-center gap-2"><i className="size-3 rounded-xs bg-(--c)" style={{ "--c": ACCT_COLOR[a] } as React.CSSProperties} aria-hidden="true"></i><b className="font-semibold">{ACCT_NAMES[a]}</b></div>
              <div className="mt-3 text-label text-muted-foreground">At {S.retire}</div>
              <div className="text-3xl font-medium tabular-nums">{money(at)}</div>
              <div className="text-label text-muted-foreground">{pctStr(share, 0)} of the total</div>
              <div className="mt-3 border-t border-border pt-2.5 text-note tabular-nums">
                <div className="flex justify-between gap-2"><span className="text-muted-foreground">In {per}</span><span>{money(S.inflow[a], 2)}</span></div>
                <div className="flex justify-between gap-2"><span className="text-muted-foreground">In a year</span><span>{money(S.inflow[a] * S.p)}</span></div>
                {a === "trad" && S.inflow.match > 0 ? <div className="flex justify-between gap-2"><span className="text-muted-foreground">Employer match</span><span>{money(S.inflow.match * S.p)}</span></div> : null}
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

/* ---- the climb: the balance by age, stacked by account ---- */

/** Gridlines that stop just past the top: the smallest 1, 2, 2.5 or 5 step
    that needs seven lines or fewer. */
function tightTicks(max: number): number[] {
  const m = Math.max(1, max), mag = Math.pow(10, Math.floor(Math.log10(m / 7)));
  const step = [1, 2, 2.5, 5, 10].map((k) => k * mag).find((st) => Math.ceil(m / st) <= 7) ?? mag * 10;
  const out: number[] = [];
  for (let v = 0; v <= Math.ceil(m / step) * step + 1e-6; v += step) out.push(v);
  return out;
}

function Climb({ S }: { S: PlanSummary }) {
  // Drawn for the full width of the card, and taller than the tools' charts.
  const base = useChartSize();
  const size = base.narrow ? base : { ...base, W: 1240, H: 460, L: 74, fs: 12.5, pw: 1240 - 74 - base.Rp, ph: 460 - base.T - base.B };
  const { L, pw, sw, fs } = size;
  const [off, setOff] = useState<Acct[]>([]);
  const [future, setFuture] = useState(false);
  const infl = S.assumptions.inflation, a0 = S.climb[0].age, a1 = S.climb[S.climb.length - 1].age;
  // Today's dollars, or the dollars of each year.
  const rows = S.climb.map((r) => {
    const k = future ? Math.pow(1 + infl, r.year) : 1;
    return { ...r, trad: r.trad * k, roth: r.roth * k, brok: r.brok * k, hsa: r.hsa * k, total: r.total * k };
  });
  const used = ACCTS.filter((a) => S.climb.some((r) => r[a] > 1)), shown = used.filter((a) => !off.includes(a));
  const tot = rows.map((r) => shown.reduce((t, a) => t + r[a], 0));
  const ticks = tightTicks(Math.max(...tot)), top = ticks[ticks.length - 1] || 1;
  // Room along the top for the stage numbers.
  const T = size.T + (S.stages ? 26 * sw : 4), ph = size.T + size.ph - T;
  const X = (age: number) => L + ((age - a0) / Math.max(1, a1 - a0)) * pw, Y = (v: number) => T + ph - (v / top) * ph;
  const bands = shown.map((a, i) => {
    const below = (j: number) => shown.slice(0, i).reduce((t, b) => t + rows[j][b], 0);
    return { a, d: pathD([...rows.map((r, j) => [X(r.age), Y(below(j) + r[a])] as [number, number]), ...rows.map((r, j) => [X(r.age), Y(below(j))] as [number, number]).reverse()]) + "Z" };
  });
  // Milestones still ahead, on the line as shown; labels that would
  // collide step up out of each other's way.
  const marks: { label: string; i: number; dy: number }[] = [];
  for (const [v, label] of [[100e3, "$100K"], [250e3, "$250K"], [500e3, "$500K"], [1e6, "$1M"], [2e6, "$2M"], [5e6, "$5M"]] as const) {
    const i = tot.findIndex((t) => t >= v);
    if (i > 0) {
      const prev = marks[marks.length - 1];
      const near = prev && Math.abs(X(rows[i].age) - X(rows[prev.i].age)) < 110 * sw && Math.abs(Y(tot[i]) - Y(tot[prev.i])) < 26 * sw;
      marks.push({ label, i, dy: near ? prev.dy + 17 * sw : 0 });
    }
  }
  const stageAt = (age: number) => S.stages?.findIndex((s) => age >= s.from && age < s.to) ?? -1;
  const kidsBorn = (age: number) => S.kids.map((k, i) => (Math.floor(k.born) === age ? i + 1 : 0)).filter(Boolean);
  const label = (i: number) => (rows[i] ? rows[i].age : "");
  return (
    <Card className="col-span-full">
      <CardHeader><CardTitle>The climb</CardTitle>
        <CardDescription>Your balance at each age{future ? ", in the dollars of each year" : ", in today's dollars"}, by account. Point at any age for the figures.
          {S.stages ? " Numbers along the top are your life stages." : ""}</CardDescription>
        <CardAction><Segmented size="compact" attr="data-ppreal" options={[["today", "Today's dollars"], ["future", "Future dollars"]] as const} value={future ? "future" : "today"} onChange={(v) => setFuture(v === "future")} /></CardAction>
      </CardHeader>
      <CardContent>
        <ChartFrame id="ppClimb" size={size} wide xs={rows.map((r) => X(r.age))}
          ariaLabel={"Balance by age, from " + money(tot[0]) + " at " + a0 + " to " + money(tot[tot.length - 1]) + " at " + a1}
          tip={(i) => {
            const st = stageAt(rows[i].age), born = kidsBorn(rows[i].age);
            return (
              <>
                <b>Age {rows[i].age}</b>{st >= 0 ? <span className="block text-label text-muted-foreground">Stage {st + 1}: {S.stages![st].name}</span> : null}
                {born.length ? <span className="block text-label text-muted-foreground">Child {born.join(" and ")} born</span> : null}
                {shown.slice().reverse().map((a) => <TipRow key={a} color={ACCT_COLOR[a]} label={ACCT_NAMES[a]} value={rows[i][a]} />)}
                <TipRow color={SERIES.plan} label="Total" value={tot[i]} />
              </>
            );
          }}>
          {(hi) => (
            <>
              {S.stages?.map((s, i) => (
                <g key={s.from}>
                  {i % 2 === 1 ? <rect x={X(s.from)} y={T} width={X(Math.min(s.to, a1)) - X(s.from)} height={ph} fill="var(--ds-raised)" /> : null}
                  <line x1={X(s.from)} x2={X(s.from)} y1={T - 22 * sw} y2={T + ph} stroke="var(--grid)" strokeWidth={sw} />
                  <circle cx={X(s.from) + 10 * sw} cy={T - 12 * sw} r={8 * sw} fill="none" stroke="var(--axis)" strokeWidth={sw} />
                  <text x={X(s.from) + 10 * sw} y={T - 12 * sw + fs / 3} fontSize={fs * 0.92} textAnchor="middle" fill="var(--axis)">{i + 1}</text>
                </g>
              ))}
              <YAxis size={size} ticks={ticks} Y={Y} />
              <XAxis size={size} count={rows.length - 1} X={(i) => X(a0 + i)} label={label} />
              {bands.map((b) => <path key={b.a} d={b.d} fill={ACCT_COLOR[b.a]} stroke="var(--ds-surface)" strokeWidth={0.75 * sw} />)}
              <path d={pathD(rows.map((r, j) => [X(r.age), Y(tot[j])]))} fill="none" stroke={SERIES.plan} strokeWidth={2.5 * sw} strokeLinejoin="round" />
              {marks.map((m) => (
                <g key={m.label}>
                  <circle cx={X(rows[m.i].age)} cy={Y(tot[m.i])} r={3.5 * sw} fill="var(--ds-surface)" stroke="var(--ds-text)" strokeWidth={1.5 * sw} />
                  {/* Left of its point, unless that runs into the axis. */}
                  {X(rows[m.i].age) - L < 100 * sw
                    ? <text x={X(rows[m.i].age) + 7 * sw} y={Y(tot[m.i]) - 9 * sw - m.dy} fontSize={fs} textAnchor="start" fill="var(--ds-text)">{m.label} at {rows[m.i].age}</text>
                    : <text x={X(rows[m.i].age) - 7 * sw} y={Y(tot[m.i]) - 9 * sw - m.dy} fontSize={fs} textAnchor="end" fill="var(--ds-text)">{m.label} at {rows[m.i].age}</text>}
                </g>
              ))}
              {S.kids.map((k, i) => k.born > a0 && k.born < a1 ? (
                <path key={i} d={`M${X(k.born)},${T + ph - 9 * sw} l${-5 * sw},${9 * sw} h${10 * sw} Z`} fill="var(--ds-text)" />
              ) : null)}
              <HoverMarks size={size} x={hi != null ? X(rows[hi].age) : null} y={hi != null ? Y(tot[hi]) : null} />
            </>
          )}
        </ChartFrame>
        <div className="legend">
          {used.map((a) => <LegendToggle key={a} color={ACCT_COLOR[a]} label={ACCT_NAMES[a]} on={!off.includes(a)}
            onToggle={() => setOff((o) => (o.includes(a) ? o.filter((x) => x !== a) : o.length + 1 < used.length ? [...o, a] : o))} />)}
          <span><i className="h-0.75! bg-series-plan"></i>Total</span>
          {S.kids.some((k) => k.born > a0) ? <span>▲ A child is born</span> : null}
        </div>
        {/* Under the chart: the end of the climb by account, the
            milestones, and what each numbered stage is. */}
        <div className={cn("mt-2 grid grid-cols-1 gap-x-10 gap-y-5 border-t border-border pt-4 text-note", S.stages ? "md:grid-cols-3" : "md:grid-cols-2")}>
        <div className="min-w-0">
          <div className="text-label text-muted-foreground">At {a1}{future ? ", future dollars" : ", today's dollars"}</div>
          <div className="text-3xl font-medium tabular-nums">{money(tot[tot.length - 1])}</div>
          <dl className="m-0 mt-2">
            {shown.map((a) => <div key={a} className="flex items-baseline gap-2 border-b border-border py-1.5">
              <i className="size-2.5 flex-none rounded-xs bg-(--c)" style={{ "--c": ACCT_COLOR[a] } as React.CSSProperties} aria-hidden="true"></i>
              <dt className="flex-1 text-muted-foreground">{ACCT_NAMES[a]}</dt><dd className="m-0 tabular-nums">{money(rows[rows.length - 1][a])}</dd></div>)}
          </dl>
        </div>
        <div className="min-w-0">
          <MadeOf S={S} future={future} />
        </div>
        <div className="min-w-0">
          {S.stages ? <>
            <div className="text-label text-muted-foreground">Life stages</div>
            <ol className="m-0 mt-1 list-none p-0">{S.stages.map((st, i) => (
              <li key={st.from} className="flex gap-2 py-0.5"><span className="w-4 flex-none text-muted-foreground tabular-nums">{i + 1}</span><span className="flex-1">{st.name}</span>
                <span className="text-muted-foreground tabular-nums">{ageSpan(st.from, st.to).replace(" to ", "–")}</span></li>))}</ol>
          </> : null}
        </div>
        </div>
      </CardContent>
    </Card>
  );
}

/* ---- what the balance is made of: today's savings, what you put in,
   the match, and growth, in the dollars the chart shows ---- */
function MadeOf({ S, future }: { S: PlanSummary; future: boolean }) {
  // Today's dollars: each part brought back on its own (today's savings
  // are already in them); the dollars of the day: as they'll be.
  const M = future ? S.made : S.madeReal;
  const parts: { tone: PartTone; label: string; v: number }[] = [
    { tone: "start" as PartTone, label: "What you have today", v: M.start },
    { tone: "in" as PartTone, label: "What you'll put in", v: M.own },
    { tone: "teal" as PartTone, label: "Your employer's match", v: M.match },
    { tone: "gain" as PartTone, label: "Growth on all of it", v: M.growth },
  ].filter((x) => x.v > 0.5);
  const all = parts.reduce((t, x) => t + x.v, 0) || 1, grow = M.growth / all;
  return (
    <>
      <div className="text-label text-muted-foreground">Where it comes from</div>
      <div className="text-3xl font-medium tabular-nums">{pctStr(grow, 0)} growth</div>
      <div className="mb-2 text-label text-muted-foreground">{grow >= 0.5 ? "Most of it is what your saving earns, not what you put in" : "What you put in, and what it earns"}</div>
      <CompositionBar parts={parts.map((x) => ({ tone: x.tone, share: x.v / all }))} />
      <dl className="m-0">
        {parts.map((x) => (
          <div key={x.label} className="flex items-baseline gap-2 border-b border-border py-1.5">
            <dt className="flex-1 text-muted-foreground"><PartKey tone={x.tone} />{x.label}</dt>
            <dd className="m-0 tabular-nums">{money(x.v)}</dd>
            <dd className="m-0 w-10 text-right text-muted-foreground tabular-nums">{pctStr(x.v / all, 0)}</dd>
          </div>
        ))}
      </dl>
    </>
  );
}

/* ---- what the children cost: each child along the years, then together ---- */
const CARE = SERIES.rose, SCHOOL = SERIES.lavender;
function ChildrenCost({ S }: { S: PlanSummary }) {
  const K = S.children!, a0 = S.age, a1 = S.retire, span = Math.max(1, a1 - a0);
  const at = (age: number) => ((age - a0) / span) * 100 + "%";
  const ticks = Array.from({ length: Math.floor(span / 5) + 1 }, (_, i) => a0 + i * 5).filter((t) => t < a1 - 1).concat(a1);
  const gone = K.without - S.atRetire.total;
  /** One stretch along the years: a tinted bar with its edge in the
      color, and the monthly cost written in where it fits. */
  const Seg = ({ from, to, monthly, c, title }: { from: number; to: number; monthly: number; c: string; title: string }) => (
    <div title={title} className="absolute inset-y-0 left-(--l) flex w-(--w) items-center overflow-hidden rounded-sm border-l-3 border-l-(--c) px-1.5 text-label whitespace-nowrap tabular-nums"
      style={{ "--l": at(from), "--w": ((to - from) / span) * 100 + "%", "--c": c } as React.CSSProperties}>
      <span className="absolute inset-0 bg-(--c) opacity-25" aria-hidden="true"></span>
      <span className="relative">{(to - from) / span > 0.09 ? money(monthly) + "/mo" : ""}</span>
    </div>
  );
  return (
    <Card className="col-span-full">
      <CardHeader><CardTitle>What the children cost</CardTitle>
        <CardDescription>Each child from birth to 18, in today&apos;s dollars: childcare costs the most, then the school years, and each later child a little less.
          {S.kids.some((k) => !k.planned) ? " Children you have now are already in your budget; only the change from today comes out of saving." : ""}</CardDescription></CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 gap-x-12 gap-y-4 border-b border-border pb-5 sm:grid-cols-3">
          <div><div className="text-label text-muted-foreground">Until you retire at {a1}</div>
            <div className="text-3xl font-medium tabular-nums">{money(K.total)}</div>
            <div className="text-label text-muted-foreground">At the most {money(K.peak.monthly)} per month, at {K.peak.age}</div></div>
          <div><div className="text-label text-muted-foreground">Paid for by saving less</div>
            <div className="text-3xl font-medium tabular-nums">{money(K.fromSaving)}</div>
            <div className="text-label text-muted-foreground">{K.fromSpending > 0.5 ? "and " + money(K.fromSpending) + " cut from spending, when saving ran out" : "Saving covered all of it"}</div></div>
          <div><div className="text-label text-muted-foreground">Less in your balance at {a1}</div>
            <div className="text-3xl font-medium tabular-nums">{money(Math.max(0, gone))}</div>
            <div className="text-label text-muted-foreground">{money(S.atRetire.total)} with them, {money(K.without)} saving today&apos;s amounts all the way</div></div>
        </div>
        {/* Along the years: each child, then all of them together. */}
        <div className="mt-5 space-y-2">
          {K.rows.map((r) => (
            <div key={r.label} className="flex items-center gap-3">
              <div className="w-30 flex-none text-note max-sm:w-20"><b className="font-medium">{r.label}</b><span className="block text-label text-muted-foreground">{r.born >= a0 ? "Born at " + ageText(r.born) : "Age " + ageText(a0 - r.born) + " now"}</span></div>
              <div className="relative h-9 min-w-0 flex-1">
                {r.bands.map((b) => <Seg key={b.from} {...b} c={b.early ? CARE : SCHOOL} title={r.label + ", your ages " + ageSpan(b.from, b.to) + ": " + money(b.monthly) + " per month, " + (b.early ? "before school" : "at school")} />)}
              </div>
            </div>
          ))}
          <div className="flex items-center gap-3 border-t border-border pt-2">
            <div className="w-30 flex-none text-note max-sm:w-20"><b className="font-medium">Together</b><span className="block text-label text-muted-foreground">A month</span></div>
            <div className="relative h-9 min-w-0 flex-1">
              {K.together.map((t) => <Seg key={t.from} {...t} c={SERIES.sky} title={"Your ages " + ageSpan(t.from, t.to) + ": " + money(t.monthly) + " per month"} />)}
            </div>
          </div>
          <div className="flex gap-3">
            <div className="w-30 flex-none max-sm:w-20"></div>
            <div className="relative h-5 min-w-0 flex-1 text-label text-muted-foreground tabular-nums">
              {ticks.map((t) => <span key={t} className="absolute left-(--l) -translate-x-1/2" style={{ "--l": at(t) } as React.CSSProperties}>{t}</span>)}
            </div>
          </div>
        </div>
        <div className="legend mt-2 px-0!">
          <span><i className="bg-series-rose"></i>Before school (childcare)</span><span><i className="bg-series-lavender"></i>At school</span>
          <span><i className="bg-series-sky"></i>All the children, per month</span><span>Ages are yours</span>
        </div>
      </CardContent>
    </Card>
  );
}

/* ---- the stages, side by side along the years ---- */
function StageLine({ S }: { S: PlanSummary }) {
  const st = S.stages!, total = st.reduce((t, s) => t + (s.to - s.from), 0) || 1;
  return (
    <Card className="col-span-full">
      <CardHeader><CardTitle>Your life stages</CardTitle><CardDescription>Each stretch of years and what you save in it, per month in today&apos;s dollars.</CardDescription></CardHeader>
      <CardContent>
        {/* The years to scale, then each stage in full. */}
        <div className="flex h-7 w-full overflow-hidden rounded-md" aria-hidden="true">
          {st.map((s, i) => (
            <div key={s.from} className={cn("grid w-(--w) place-items-center border-r border-card text-label tabular-nums last:border-r-0", i % 2 ? "bg-muted" : "bg-secondary")}
              style={{ "--w": ((s.to - s.from) / total) * 100 + "%" } as React.CSSProperties}>{i + 1}</div>
          ))}
        </div>
        <ol className="m-0 mt-4 grid list-none grid-cols-2 max-sm:grid-cols-1 lg:grid-cols-4 gap-3 p-0">
          {st.map((s, i) => (
            <li key={s.from} className="min-w-0 rounded-lg border border-border bg-muted px-3.5 py-3">
              <div className="flex items-baseline gap-2"><span className="text-label text-muted-foreground tabular-nums">{i + 1}</span><b className="font-semibold">{s.name}</b></div>
              <div className="text-label text-muted-foreground tabular-nums">Ages {ageSpan(s.from, s.to)}, {s.to - s.from} {s.to - s.from === 1 ? "year" : "years"}</div>
              <div className="mt-2 text-xl font-medium tabular-nums">{money(s.monthly)}<span className="text-label font-normal text-muted-foreground"> saved per month</span></div>
              <div className="text-label text-muted-foreground tabular-nums">{s.kidCost > 0 ? "Children cost " + money(s.kidCost) + " per month" : "No child costs"}</div>
            </li>
          ))}
        </ol>
      </CardContent>
    </Card>
  );
}

/* ---- what next ---- */
/* ---- what next: how long it lasts, in the Drawdown Simulator ---- */
function WhatNext({ S }: { S: PlanSummary }) {
  const router = useRouter();
  return (
    <Card className="col-span-full">
      <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
        <div className="min-w-0">
          <CardTitle>What next: will it last?</CardTitle>
          <p className="hint mt-1 mb-0 max-w-copy">See how long {money(S.atRetire.total)} lasts once you start spending it, tested against every market since 1926.
            The Drawdown Simulator opens with your balance at {S.retire} filled in.</p>
        </div>
        <Button variant="outline" className="self-start sm:self-center" onClick={() => {
          sendToDrawdown({ initial: Math.round(S.atRetire.total) });
          router.push("/drawdown");
        }}>Open the Drawdown Simulator<i className="arw" aria-hidden="true"></i></Button>
      </CardContent>
    </Card>
  );
}

function Actions({ plan, goTo }: { plan: PlanState; goTo: (s: StepId) => void }) {
  const router = useRouter(), toast = useToast();
  return (
    <Card className="col-span-full">
      <CardHeader><CardTitle>Keep it</CardTitle>
        <CardDescription>Your plan is saved in this browser (and your account, if you&apos;re signed in). Share it with the Share button above.</CardDescription></CardHeader>
      <CardContent className="flex flex-wrap items-center gap-3">
        <Button size="lg" onClick={() => router.push("/guide/paycheck/report")}>Print or save the report<i className="arw" aria-hidden="true"></i></Button>
        <Button variant="outline" size="lg" onClick={() => {
          const done = copyToTools(plan);
          toast(done.length ? "Copied into " + done.join(", ") : "Nothing to copy yet");
        }}>Copy into my tools</Button>
        <Button variant="outline" size="lg" onClick={() => goTo(plan.stagesOn ? "stages" : "plan")}>Change something</Button>
        <span className="flex-1"></span>
        <Button variant="quiet" size="inline" onClick={() => { if (confirm("Start over? Your answers here are cleared; your other tools aren't touched.")) loadPlan(PLAN_DEFAULTS); }}>Start over</Button>
      </CardContent>
    </Card>
  );
}
