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
import { HeroReading } from "@/components/common/Reading";
import { Segmented } from "@/components/common/Readout";
import { fmtAxisMoney, niceAxis } from "@/components/charts/scale";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { money, pctStr } from "@/lib/format";
import { SERIES } from "@/lib/hues";
import { cn } from "@/lib/utils";
import { copyToTools } from "./copy";
import { PLAN_DEFAULTS, loadPlan, type PlanState, type StepId } from "./model";
import { ACCT_NAMES, planSummary, type Acct, type PlanSummary } from "./results";

const ACCT_COLOR: Record<Acct, string> = { trad: SERIES.sky, roth: SERIES.teal, brok: SERIES.lavender, hsa: SERIES.gray };
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
      {S.stages ? <StageLine S={S} /> : null}
      <Actions plan={plan} goTo={goTo} />
    </>
  );
}

/* ---- the answer ---- */
function Hero({ S, stages }: { S: PlanSummary; stages: boolean }) {
  const A = S.atRetire, perYr = S.p, savedYr = (S.inflow.trad + S.inflow.roth + S.inflow.brok + S.inflow.hsa) * perYr;
  const want = S.target.solveFor === "After-Tax Withdrawal" ? S.target.target : null;
  const meets = want != null ? A.afterTax >= want - 0.5 : null;
  return (
    <Card size="flush" className="col-span-full">
      <HeroReading tone="answer"
        hero={{ label: "At " + S.retire + ", in today's dollars", id: "ppTotal", value: money(A.total),
          note: (stages ? "With your life stages, " : "") + money(A.fv) + " in the dollars of the day, after " + Math.round(S.years) + " years of saving" }}
        figures={[
          { label: "A year to spend, after tax", id: "ppSpend", value: money(A.afterTax), note: "A " + pctStr(A.withdrawal, 1) + " withdrawal, taxed at " + pctStr(A.taxRate, 1) },
          ...(want != null ? [{ label: "What you spend today", id: "ppWant", value: money(want), tone: meets ? "gain" as const : "loss" as const,
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
        <CardDescription>{money(k(y.gross))} of gross pay {unit === "year" ? "a year" : unit === "month" ? "a month" : "a paycheck"}, every dollar of it.
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
  const per = S.per === "check" ? "a paycheck" : "a month";
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
                {a === "trad" && S.inflow.match > 0 ? <div className="flex justify-between gap-2"><span className="text-muted-foreground">Of it, the match</span><span>{money(S.inflow.match * S.p)}</span></div> : null}
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

/* ---- the climb: the balance by age, stacked by account ---- */
function Climb({ S }: { S: PlanSummary }) {
  const W = 960, H = 340, pl = 58, pr = 18, pt = S.stages ? 30 : 14, pb = S.kids.length ? 44 : 30;
  const rows = S.climb, a0 = rows[0].age, a1 = rows[rows.length - 1].age;
  const ax = niceAxis(0, Math.max(1, ...rows.map((r) => r.total)));
  const X = (age: number) => pl + ((age - a0) / Math.max(1, a1 - a0)) * (W - pl - pr), Y = (v: number) => pt + (1 - v / ax.max) * (H - pt - pb);
  const used = ACCTS.filter((a) => rows.some((r) => r[a] > 1));
  // Each account's band, stacked in order.
  const bands = used.map((a, i) => {
    const below = (r: (typeof rows)[number]) => used.slice(0, i).reduce((t, b) => t + r[b], 0);
    const top = rows.map((r) => X(r.age) + "," + Y(below(r) + r[a])).join(" ");
    const bottom = rows.slice().reverse().map((r) => X(r.age) + "," + Y(below(r))).join(" ");
    return { a, d: "M" + top + " L" + bottom + " Z" };
  });
  const line = rows.map((r) => X(r.age) + "," + Y(r.total)).join(" ");
  const ticks = ax.ticks;
  const ageTicks = rows.filter((r) => (r.age - a0) % 5 === 0 || r.age === a1).map((r) => r.age);
  return (
    <Card className="col-span-full">
      <CardHeader><CardTitle>The climb</CardTitle>
        <CardDescription>Your balance at each age, in today&apos;s dollars, by account.{S.stages ? " Shaded bands are your life stages." : ""}</CardDescription></CardHeader>
      <CardContent>
        <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full" role="img" aria-label={"Balance by age, from " + money(rows[0].total) + " at " + a0 + " to " + money(rows[rows.length - 1].total) + " at " + a1}>
          {/* Each stage a band, numbered as in Your life stages below, its
              name too where the band has room for it. */}
          {S.stages?.map((s, i) => {
            const w = X(s.to) - X(s.from), fits = s.name.length * 6.4 + 30 < w;
            return (
              <g key={s.from}>
                {i % 2 === 1 ? <rect x={X(s.from)} y={pt} width={w} height={H - pt - pb} fill="var(--ds-raised)" /> : null}
                <line x1={X(s.from)} x2={X(s.from)} y1={pt - 24} y2={H - pb} stroke="var(--ds-rule)" />
                <circle cx={X(s.from) + 11} cy={pt - 13} r={8} fill="none" stroke="var(--ds-muted)" />
                <text x={X(s.from) + 11} y={pt - 9.2} fontSize="10.5" textAnchor="middle" fill="var(--ds-muted)" className="tabular-nums">{i + 1}</text>
                {fits ? <text x={X(s.from) + 24} y={pt - 9} fontSize="11.5" fill="var(--ds-muted)">{s.name}</text> : null}
              </g>
            );
          })}
          {ticks.map((t) => (
            <g key={t}><line x1={pl} x2={W - pr} y1={Y(t)} y2={Y(t)} stroke="var(--grid, var(--ds-rule))" strokeWidth={t === 0 ? 1.2 : 0.6} />
              <text x={pl - 8} y={Y(t) + 4} fontSize="11.5" textAnchor="end" fill="var(--ds-muted)" className="tabular-nums">{fmtAxisMoney(t)}</text></g>
          ))}
          {bands.map((b) => <path key={b.a} d={b.d} fill={ACCT_COLOR[b.a]} fillOpacity={0.55} />)}
          <polyline points={line} fill="none" stroke={SERIES.plan} strokeWidth={2.5} strokeLinejoin="round" />
          <circle cx={X(a1)} cy={Y(rows[rows.length - 1].total)} r={4} fill={SERIES.plan} />
          {S.milestones.map((m) => {
            const r = rows.find((x) => x.age === m.age)!;
            return <g key={m.label}><circle cx={X(m.age)} cy={Y(r.total)} r={3.5} fill="var(--ds-surface)" stroke="var(--ds-text)" strokeWidth={1.5} />
              <text x={X(m.age) - 6} y={Y(r.total) - 9} fontSize="11.5" textAnchor="end" fill="var(--ds-text)" className="tabular-nums">{m.label} at {m.age}</text></g>;
          })}
          {/* Each child's birth: a mark on the age axis, named under it. */}
          {S.kids.map((k, i) => k.born > a0 && k.born < a1 ? (
            <g key={i}><path d={`M${X(k.born)},${H - pb + 1} l-4,7 h8 Z`} fill="var(--ds-text)" />
              <text x={X(k.born)} y={H - 4} fontSize="11" textAnchor="middle" fill="var(--ds-text)">Child {i + 1}</text></g>
          ) : null)}
          {ageTicks.map((a) => <text key={a} x={X(a)} y={H - pb + 20} fontSize="11.5" textAnchor="middle" fill="var(--ds-muted)" className="tabular-nums">{a}</text>)}
        </svg>
        <div className="stacklegend">
          {used.map((a) => <span key={a}><i className="bg-(--c) opacity-75" style={{ "--c": ACCT_COLOR[a] } as React.CSSProperties}></i>{ACCT_NAMES[a]}</span>)}
          <span><i className="h-0.75! bg-series-plan"></i>Total</span>
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
      <CardHeader><CardTitle>Your life stages</CardTitle><CardDescription>Each stretch of years and what you save in it, a month in today&apos;s dollars.</CardDescription></CardHeader>
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
              <div className="text-label text-muted-foreground tabular-nums">Ages {s.from} to {s.to - 1}, {s.to - s.from} {s.to - s.from === 1 ? "year" : "years"}</div>
              <div className="mt-2 text-xl font-medium tabular-nums">{money(s.monthly)}<span className="text-label font-normal text-muted-foreground"> saved a month</span></div>
              <div className="text-label text-muted-foreground tabular-nums">{s.kidCost > 0 ? "Children " + money(s.kidCost) + " a month" : "No child costs"}</div>
            </li>
          ))}
        </ol>
      </CardContent>
    </Card>
  );
}

/* ---- what next ---- */
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
