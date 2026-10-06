"use client";

/* The Basic calculator (the home page): six questions, a balance at
   retirement in today's dollars, and the income it could pay. Ported from
   src/js/app/20-basic.js and the Basic parts of src/main/02-calculator-inputs.html
   and 03-calculator-results.html.

   Laid out answer-first (the homepage critique, 2026-10-06): the questions
   and the reading share the first screen as one instrument, the value at
   retirement is the one large figure (DESIGN.md's homepage exception to the
   three-figure readout), and the chart sits right under it with the
   milestones marked on the plan line. On a phone a compact reading leads
   and stays pinned under the tab rail while the questions are in view.
   Everything below is depth: milestones, the Advanced hand-off, the
   year-by-year table (folded), and the household offer. */

import { useRef } from "react";
import { ChevronDownIcon, CircleAlertIcon, LockIcon } from "lucide-react";
import { BandChart, type ChartGeometry } from "@/components/charts/BandChart";
import { Legend } from "@/components/charts/Legend";
import { BandTipRows } from "@/components/charts/TipRows";
import { useNarrow } from "@/components/charts/useNarrow";
import { useHouseholdFill } from "@/components/household/HouseholdProvider";
import { HouseholdBar } from "@/components/household/HouseholdBar";
import { MoneyField, NumberField, SelectField } from "@/components/fields/Field";
import { Tipped } from "@/components/shell/Tooltips";
import { useShareKit } from "@/components/shell/share";
import { useToolState } from "@/components/tools/ToolState";
import { BigValue } from "@/components/common/BigValue";
import { CsvButton } from "@/components/common/CsvButton";
import { MS_LADDER, Milestones } from "@/components/common/Milestones";
import { KV } from "@/components/common/Readout";
import { BASIC_BAND, projectBasic } from "@/lib/engine/typed";
import { DASH, dollarsField, fmtNum, fmtYears, money, pctStr } from "@/lib/format";
import { PERIOD_ADV, PeriodOptions } from "@/lib/periods";
import { STATE_OPTIONS } from "@/lib/states";
import { basicShare } from "./share";
import { BASIC_DEF, RISK_OPTIONS, basicInput, type BasicInputs } from "./model";
import { OpenInAdvanced } from "./OpenInAdvanced";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { SERIES } from "@/lib/hues";

type Row = { year: number; end: number; growth: number; contrib: number };

/** The milestones the Milestones panel lists (the crossover and the round
    balances reached), as marks on the plan line: a short tick through the
    line at that year and, where there's room, its name above. */
function milestoneMarks(rows: Row[]): { year: number; end: number; label: string }[] {
  if (!rows.length) return [];
  const final = rows[rows.length - 1].end;
  const marks: { year: number; end: number; label: string }[] = [];
  const cross = rows.find((r) => r.growth > r.contrib && r.contrib > 0);
  if (cross) marks.push({ year: cross.year, end: cross.end, label: "Crossover" });
  for (const v of MS_LADDER.filter((x) => x <= final).slice(-6)) {
    const hit = rows.find((r) => r.end >= v);
    if (hit) marks.push({ year: hit.year, end: hit.end, label: money(v).replace(/,000,000$/, "M").replace(/,000$/, "k") });
  }
  return marks.sort((a, b) => a.year - b.year);
}

function MilestoneMarks({ g, marks }: { g: ChartGeometry; marks: ReturnType<typeof milestoneMarks> }) {
  const fs = g.narrow ? 13 : 11, gap = g.narrow ? 70 : 50;
  // Name a mark only when it's clear of the last named one.
  const placed = marks.reduce<{ x: number; y: number; label: string | null; key: string }[]>((acc, m) => {
    const x = g.X(m.year), lastX = [...acc].reverse().find((a) => a.label)?.x ?? -Infinity;
    acc.push({ x, y: g.Y(m.end), label: x - lastX >= gap ? m.label : null, key: m.label + m.year });
    return acc;
  }, []);
  return (
    <g aria-hidden="true" data-screen-only>
      {placed.map((m) => (
        <g key={m.key}>
          <line x1={m.x} x2={m.x} y1={m.y - 6} y2={m.y + 6} stroke="var(--ds-text)" strokeOpacity={0.7} strokeWidth={g.narrow ? 1.8 : 1.2} />
          {m.label ? <text x={m.x} y={m.y - 11} textAnchor="middle" fontSize={fs} fill="var(--axis)">{m.label}</text> : null}
        </g>
      ))}
    </g>
  );
}

export function Basic() {
  const { state: s, set, setState } = useToolState(BASIC_DEF);
  const tableRef = useRef<HTMLTableElement>(null);
  const narrow = useNarrow();

  /* Retirement can be at most 100 years away; past that, it follows the age. */
  const setAge = (k: "age" | "retire") => (v: string) =>
    setState((c) => {
      const next = { ...c, [k]: v };
      const age = parseFloat(next.age.replace(/,/g, "")), ret = parseFloat(next.retire.replace(/,/g, ""));
      return age > 0 && ret > 0 && ret - age > 100 ? { ...next, retire: String(age + 100) } : next;
    });

  useHouseholdFill("basic", (h) => setState((c) => {
    const age = h.age != null && h.age > 0 && h.age < 120 ? Math.round(h.age) : null;
    const retire = h.retire != null && h.retire > 0 && h.retire < 120 ? Math.round(h.retire) : null;
    const next: BasicInputs = { ...c };
    if (age) next.age = String(age);
    if (retire && (!age || retire > age)) next.retire = String(age ? Math.min(retire, age + 100) : retire);
    if (h.saved != null) next.saved = dollarsField(h.saved);
    if (h.monthly != null) Object.assign(next, { contrib: dollarsField(h.monthly), period: "Monthly" });
    return next;
  }));

  useShareKit(BASIC_DEF.id, basicShare(s));

  const p = basicInput(s);
  const ok = p.years > 0;
  const R = ok ? projectBasic(p) : null;

  // The same plan with returns 1.5 points better and worse, as the band.
  let pts: { year: number; base: number; hi: number; lo: number }[] = [];
  if (R?.years.length) {
    const hiR = projectBasic({ ...p, real: p.real + BASIC_BAND });
    const loR = projectBasic({ ...p, real: Math.max(-0.99, p.real - BASIC_BAND) });
    pts = [{ year: 0, base: p.initial, hi: p.initial, lo: p.initial },
      ...R.years.map((y, i) => ({ year: y.year, base: y.end, hi: hiR.years[i]?.end ?? y.end, lo: loR.years[i]?.end ?? y.end }))];
  }
  const hasAge = p.age > 0 && isFinite(p.age);
  const marks = R ? milestoneMarks(R.years) : [];

  // Which question the warning belongs to: the retirement age when it's at
  // or before today's age, the age when it's missing.
  const warn = ok ? "" : p.retire && p.age ? "Your retirement age needs to be higher than your age today." : "Fill in your age and the age you plan to retire to see a projection.";
  const badRetire = !ok && !!p.retire && !!p.age, badAge = !ok && !badRetire;

  const fv = R ? money(R.fv) : DASH, perMonth = R ? money((R.fv * 0.04) / 12) : DASH;
  // What the balance is made of, as shares of one bar.
  const parts = R && R.fv > 0 ? [p.initial, R.contribTotal, R.growth].map((v) => Math.max(0, v) / R.fv) : null;

  return (
    <div className="col-span-full grid grid-cols-1 items-start gap-5 max-sm:gap-3.5 lg:grid-cols-3" id="tab-simple" role="tabpanel" aria-labelledby="tabbtn-calc">
      <div className="min-w-0 lg:col-span-1 lg:self-stretch">
        {/* Phones and narrow screens: the answer leads, and stays under the
            tab rail while the questions are on screen. It repeats the
            reading below, so screen readers skip it; srLive reads results. */}
        <div className="sticky top-(--navh) z-20 mb-3.5 flex items-end justify-between gap-4 rounded-(--r-panel) border border-border bg-card px-4 py-3 lg:hidden" aria-hidden="true">
          <div className="min-w-0">
            <span className="block text-label text-muted-foreground">Value at retirement</span>
            <b className="block text-2xl leading-tight font-medium whitespace-nowrap text-primary tabular-nums">{fv}</b>
          </div>
          <div className="text-right">
            <span className="block text-label text-muted-foreground">Income, per month</span>
            <span className="block text-body leading-tight font-medium whitespace-nowrap tabular-nums">{perMonth}</span>
          </div>
        </div>

        <aside id="asideSimple">
          <Card>
            <CardHeader>
              <CardTitle>A few questions</CardTitle>
              <CardDescription>Answer a few questions to see what you could have at retirement.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 items-end gap-x-3">
                <NumberField id="qAge" label="How old are you?" unit="age" value={s.age} onValueChange={setAge("age")}
                  aria-invalid={badAge || undefined} aria-describedby={badAge ? "qWarnText" : undefined} />
                <NumberField id="qRetire" label="When do you plan to retire?" unit="age" value={s.retire} onValueChange={setAge("retire")}
                  aria-invalid={badRetire || undefined} aria-describedby={badRetire ? "qWarnText" : undefined} />
              </div>
              <div className="-mt-1 mb-3.5 flex items-start gap-2 text-note text-destructive" id="qWarn" hidden={ok}>
                <CircleAlertIcon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                <span id="qWarnText" role="alert">{warn}</span>
              </div>
              <div className="grid grid-cols-2 items-end gap-x-3 border-t border-border pt-3.5">
                <MoneyField id="qSaved" className="col-span-2" label="How much have you saved so far?" value={s.saved} onValueChange={set("saved")} />
                <MoneyField id="qContrib" label="How much do you save for retirement?" value={s.contrib} onValueChange={set("contrib")} />
                <SelectField id="qPeriod" label="How often?" value={s.period} onChange={set("period")}>
                  <PeriodOptions />
                </SelectField>
                <SelectField id="qRisk" className="col-span-2" label="How is it invested?" value={s.risk} onChange={set("risk")}>
                  {RISK_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </SelectField>
              </div>
              <div className="derived">
                <div><span>Years until retirement</span><span className="num" id="qYears">{ok ? fmtYears(p.years) : DASH}</span></div>
                <div><span><Tipped text="Growth after inflation" k="realreturn" /></span><span className="num" id="qReal">{pctStr(p.real, 2) + " a year"}</span></div>
              </div>
              <p className="mt-3.5 mb-0 flex items-center gap-1.5 text-label text-muted-foreground">
                <LockIcon className="size-3.5 shrink-0" aria-hidden="true" />Nothing leaves your browser.</p>
            </CardContent>
          </Card>
        </aside>
      </div>

      <Card size="flush" className="min-w-0 lg:col-span-2" id="homeReading">
        {/* From 1100px the top is two zones: the value on the left, then,
            behind a hairline, the two incomes side by side across the rest of
            the width. Narrower, they sit under the value. */}
        <div className="px-5.5 pt-6.5 pb-5 max-sm:px-4 max-sm:pt-5 wide:flex wide:items-start wide:gap-8" data-readout>
          <div className="wide:shrink-0" data-pair>
            <div className="mb-2.5 text-label text-muted-foreground" data-k>Value at retirement</div>
            <BigValue className="leading-none font-medium tracking-tight whitespace-nowrap text-primary tabular-nums" id="qFV" text={fv} sized={!!R} scale={narrow ? 1.5 : 2} />
            <div className="mt-2.5 min-h-4 text-label text-muted-foreground" id="qFVnote">{R ? "At age " + fmtNum(p.retire) + ", in today's dollars" : ""}</div>
          </div>
          <div className="mt-5 flex flex-wrap gap-x-12 gap-y-3 border-t border-border pt-4 wide:mt-0 wide:min-w-0 wide:flex-1 wide:items-center wide:justify-evenly wide:gap-x-8 wide:self-stretch wide:border-t-0 wide:border-l wide:pt-0 wide:pl-8">
            <div data-pair>
              <span className="block text-label text-muted-foreground" data-k>Income, per month</span>
              <BigValue className="text-2xl leading-tight font-medium tabular-nums" id="qMonth" text={perMonth} sized={false} />
              <span className="block text-label text-muted-foreground">The same, spread monthly</span>
            </div>
            <div data-pair>
              <span className="block text-label text-muted-foreground" data-k>Income, per year</span>
              <BigValue className="text-2xl leading-tight font-medium tabular-nums" id="qYear" text={R ? money(R.fv * 0.04) : DASH} sized={false} />
              <span className="block text-label text-muted-foreground">Taking 4% a year</span>
            </div>
          </div>
        </div>

        <div className="border-t border-border px-4.5 pt-3.5 pb-4 max-sm:px-3.5">
          {parts ? (
            <div className="mb-2 flex h-2 overflow-hidden rounded-full bg-muted" aria-hidden="true">
              <i className="block h-full w-(--w) bg-input" style={{ "--w": parts[0] * 100 + "%" } as React.CSSProperties} />
              <i className="block h-full w-(--w) bg-muted-foreground" style={{ "--w": parts[1] * 100 + "%" } as React.CSSProperties} />
              <i className="block h-full w-(--w) bg-gain" style={{ "--w": parts[2] * 100 + "%" } as React.CSSProperties} />
            </div>
          ) : null}
          <div className="grid2">
            <div>
              <KV k={<><i className="mr-2 inline-block size-2.5 rounded-xs bg-input" aria-hidden="true" />Starting from</>} id="qStart" v={R ? money(p.initial) : DASH} />
              <KV k={<><i className="mr-2 inline-block size-2.5 rounded-xs bg-muted-foreground" aria-hidden="true" />You put in</>} id="qIn" v={R ? money(R.contribTotal) : DASH} />
            </div>
            <div>
              <KV k={<><i className="mr-2 inline-block size-2.5 rounded-xs bg-gain" aria-hidden="true" />Growth adds</>} cls="pos" id="qGrowth" v={R ? money(R.growth) : DASH} />
              <KV k="You add" id="qSpan" v={R ? money(p.contrib, p.contrib % 1 ? 2 : 0) + " " + PERIOD_ADV[p.period] : DASH} />
            </div>
          </div>
          <div className="hint mt-3 max-w-copy">Every figure here is in today&apos;s dollars,
            so you can compare it to what money is worth now. It assumes you nudge your
            contribution up a little each year to keep pace with inflation.</div>
        </div>

        <div className="border-t border-border pt-4" hidden={!pts.length}>
          <CardHeader><CardTitle>Balance over time</CardTitle><CardDescription>in today&apos;s dollars</CardDescription></CardHeader>
          <BandChart id="Q" pts={pts} maxX={p.years || 1} xOffset={hasAge ? p.age : 0} enhanced ariaLabel="Projected balance in today's dollars"
            extras={(g) => <MilestoneMarks g={g} marks={marks} />}
            tip={(b) => (
              <>
                {hasAge ? <><b>Age {fmtNum(p.age + b.year)}</b> <span className="text-dimmer">{"· year " + fmtNum(b.year)}</span></> : <b>Year {fmtNum(b.year)}</b>}
                <BandTipRows b={b} names={["Better", "Expected", "Worse"]} />
              </>
            )} />
          <Legend id="legendQ" items={pts.length ? [
            [SERIES.teal, "If returns run better (" + pctStr(p.real + BASIC_BAND, 2) + ")"],
            [SERIES.plan, "Your setting (" + pctStr(p.real, 2) + ")"],
            [SERIES.rose, "If returns run worse (" + pctStr(Math.max(0, p.real - BASIC_BAND), 2) + ")"],
          ] : []} />
        </div>
      </Card>

      <div className="grid min-w-0 grid-cols-1 items-start gap-5 max-sm:gap-3.5 lg:col-span-3 lg:grid-cols-2">
        <Card hidden={!R}>
          <CardHeader><CardTitle>Milestones</CardTitle></CardHeader>
          <CardContent id="msBodyQ">{R ? <Milestones rows={R.years} alreadyReal /> : null}</CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Want more detail?</CardTitle></CardHeader>
          <CardContent>
            <p className="hint mt-0">The Advanced tab does everything this does
              plus taxes, fees, contribution growth, and a simulation of good and bad market
              runs. This will carry your answers over so you don&apos;t have to retype them.</p>
            <OpenInAdvanced basic={s} />
          </CardContent>
        </Card>
      </div>

      <Collapsible className="min-w-0 lg:col-span-3" render={<Card />}>
        <CardHeader>
          <CardTitle><CollapsibleTrigger>Year by year<ChevronDownIcon aria-hidden="true" /></CollapsibleTrigger></CardTitle>
          <CardAction><CsvButton table={tableRef} label="Year by year" /></CardAction>
        </CardHeader>
        <CollapsibleContent keepMounted>
          <div className="swipehint">Swipe the table sideways to see every column.</div>
          <div className="scroll">
            <table id="qYearTable" ref={tableRef}>
              <thead><tr><th>Age</th><th>Year</th><th>Start</th><th>You added</th><th>Growth</th><th>Balance</th></tr></thead>
              <tbody>
                {R?.years.map((y) => (
                  <tr key={y.year}><td>{fmtNum(p.age + y.year)}</td><td>{y.year}</td><td>{money(y.start)}</td><td>{money(y.contrib)}</td><td className="pos">{money(y.growth)}</td><td>{money(y.end)}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </CollapsibleContent>
      </Collapsible>

      {/* The household offer, now that there's an answer to carry over. */}
      <div className="min-w-0 lg:col-span-3" id="hhHomeSlot"><HouseholdBar states={STATE_OPTIONS} /></div>
    </div>
  );
}
