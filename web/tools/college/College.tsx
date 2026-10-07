"use client";

/* College Savings: the monthly amount that covers tuition for one child or
   several, from one shared account. Ported from src/js/app/14-college-rentbuy.js
   and src/main/06-college.html.

   Laid out answer-first (the college critique, 2026-10-06), in Basic's
   thirds: the inputs a third, the children as flat rows over "The account";
   then one reading whose hero is the monthly amount, its note saying how
   long it runs (and, for a family, how it steps down), with the total cost
   and what's needed beside it. A family's children follow as a table, then
   the chart (cost as a plain line on screen) and Year by year, folded. A
   child with no cost or no years marks its field; with nothing to plan the
   reading says what's missing and the chart and table fold away. Fully
   funded, the $0 is plain text with a "Covered" badge, not amber. On a phone
   a compact reading leads and stays pinned. */

import { useRef } from "react";
import { ChevronDownIcon, CircleAlertIcon, CircleCheckIcon, InfoIcon, PlusIcon, XIcon } from "lucide-react";
import { BandChart } from "@/components/charts/BandChart";
import { Legend } from "@/components/charts/Legend";
import { Affixed, Field, MoneyField, NumberField, SelectField } from "@/components/fields/Field";
import { NumberInput } from "@/components/fields/NumberInput";
import { Tipped, TipDot } from "@/components/shell/Tooltips";
import { useToolState } from "@/components/tools/ToolState";
import { HeroReading, PinnedReading, type HeroTone, type ReadingFigure } from "@/components/common/Reading";
import { CsvButton } from "@/components/common/CsvButton";
import { collegePlanCalc, collegeSavingsCalc } from "@/lib/engine/typed";
import { DASH, fmtNum, groupDigits, money, parseNum, pctStr } from "@/lib/format";
import { focusLast } from "@/lib/dom";
import { CL_PRESETS, COLLEGE_DEF, collegeInput, phaseNote, type Kid } from "./model";
import { useShareKit } from "@/components/shell/share";
import { collegeShare } from "./share";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { SERIES } from "@/lib/hues";

function GroupHead({ children }: { children: React.ReactNode }) {
  return <h3 className="m-0 mt-1 mb-3 border-t border-border pt-4 text-sm font-semibold">{children}</h3>;
}

/** A line in the reading that isn't a figure: what's missing. */
function Band({ id, children }: { id?: string; children: React.ReactNode }) {
  return (
    <div id={id} className="flex items-start gap-2 border-t border-border px-5.5 py-3.5 text-body text-foreground max-sm:px-4">
      <InfoIcon className="mt-1 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
      <p className="m-0 max-w-copy">{children}</p>
    </div>
  );
}

/** A field's message: the Loss edge is on the field (aria-invalid). */
function FieldWarn({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <div className="-mt-1.5 mb-3 flex items-start gap-2 text-note text-destructive">
      <CircleAlertIcon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      <span id={id}>{children}</span>
    </div>
  );
}

export function College() {
  const { state: s, set, setState } = useToolState(COLLEGE_DEF);
  useShareKit(COLLEGE_DEF.id, collegeShare(s));
  const kidsRef = useRef<HTMLDivElement>(null);
  const tableRef = useRef<HTMLTableElement>(null);
  const setKid = (i: number, patch: Partial<Kid>) =>
    setState((c) => ({ ...c, kids: c.kids.map((k, j) => (j === i ? { ...k, ...patch } : k)) }));

  const inp = collegeInput(s);
  const multi = inp.kids.length > 1;

  // What each part of the page shows; blank until there's something to plan.
  let monthly = DASH, monthlyNote = "", total = DASH, totalNote = "", short = DASH, shortNote = "", savGrow = "";
  let ready = false, funded = false;
  let each: React.ReactNode = null, rows: React.ReactNode = null;
  let chart: { pts: { year: number; base: number; hi: number; lo: number }[]; maxX: number } | null = null;

  if (multi) {
    const P = collegePlanCalc(inp);
    if (P) {
      ready = true;
      funded = P.monthly === 0;
      const n = P.kids.length;
      savGrow = P.pvToday > 0 ? pctStr(Math.min(1, inp.saved / P.pvToday), 0) + " of it" : DASH;
      monthly = money(P.monthly, 0);
      monthlyNote = (n === 1 ? "for 1 child, " : n === 2 ? "for both children, " : "for all " + n + " children, ") + phaseNote(P);
      total = money(P.totalFuture);
      totalNote = fmtNum(P.kids.reduce((a, k) => a + k.yearCosts.length, 0)) + " years of college in all, at " + pctStr(inp.tuitionInfl, 1) + " tuition inflation";
      short = money(P.pvToday);
      shortNote = "A lump sum today that, earning " + pctStr(inp.investRet, 1) + ", would pay every bill as it comes";
      each = (
        <>
          <div className="scroll max-h-none">
            <table>
              <thead><tr><th>Child</th><th>Starts in</th><th>Years of college</th><th>Total cost</th></tr></thead>
              <tbody>
                {P.kids.map((k) => (
                  <tr key={k.index}>
                    <td>Child {k.index + 1}</td>
                    <td>{fmtNum(k.yearsUntil)}{k.yearsUntil === 1 ? " year" : " years"}</td>
                    <td>{fmtNum(k.yearCosts.length)}</td>
                    <td>{money(k.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {P.skipped ? (
            <p className="m-0 mt-3 flex items-start gap-2 px-4.5 text-note text-muted-foreground max-sm:px-3.5">
              <InfoIcon className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
              <span><span className="text-foreground">Left out:</span> {`${P.skipped}${P.skipped === 1 ? " child" : " children"} with no cost or no years until college`}</span>
            </p>
          ) : null}
        </>
      );
      chart = { pts: [{ year: 0, base: inp.saved, hi: P.pvToday, lo: 0 }, ...P.rows.map((r) => ({ year: r.year, base: r.balance, hi: r.needed, lo: 0 }))], maxX: P.rows.length };
      rows = P.rows.map((r) => (
        <tr key={r.year}><td>{fmtNum(r.year)}</td><td>{money(r.balance)}</td><td>{money(r.contribs)}</td><td className="pos">{money(r.growth)}</td><td>{r.paid > 0 ? money(r.paid) : DASH}</td></tr>
      ));
    }
  } else if (inp.annualCost > 0 && inp.yearsUntil > 0) {
    const R = collegeSavingsCalc(inp);
    ready = true;
    funded = R.monthly === 0;
    savGrow = money(R.savingsAtStart);
    monthly = money(R.monthly, 0);
    monthlyNote = "for " + fmtNum(inp.yearsUntil) + " years at " + pctStr(inp.investRet, 1);
    total = money(R.totalFuture);
    totalNote = inp.collegeYrs + " years at " + money(inp.annualCost, 0) + "/yr, " + pctStr(inp.tuitionInfl, 1) + " inflation";
    short = money(R.shortfall);
    shortNote = "Less than the " + money(R.totalFuture) + " total, since what's saved keeps earning " + pctStr(inp.investRet, 1) + " while later years' tuition is paid";
    // The comparison line: the full cost if college started that year,
    // rising with tuition inflation to the real total when it does start.
    const costIfStartingAt = (t: number) => {
      let sum = 0;
      for (let k = 0; k < inp.collegeYrs; k++) sum += inp.annualCost * Math.pow(1 + inp.tuitionInfl, t + k);
      return sum;
    };
    chart = { pts: [{ year: 0, base: inp.saved, hi: costIfStartingAt(0), lo: 0 }, ...R.rows.map((r) => ({ year: r.year, base: r.balance, hi: costIfStartingAt(r.year), lo: 0 }))], maxX: inp.yearsUntil };
    rows = R.rows.map((r) => (
      <tr key={r.year}><td>{fmtNum(r.year)}</td><td>{money(r.balance)}</td><td>{money(r.contribs)}</td><td className="pos">{money(r.growth)}</td><td>{money(r.projCost)}</td></tr>
    ));
  }

  /* The reading: the monthly amount, amber when there's something to save;
     already covered, it's plain text with a badge that says so. */
  // Notes wrap at a short measure, so the two figures sit side by side.
  const fig = (t: string) => (t ? <span className="block max-w-60">{t}</span> : "");
  const tone: HeroTone = ready && !funded ? "answer" : "text";
  const hero: ReadingFigure = { label: "Save per month", id: "clMonthly", value: monthly, noteId: "clMonthlyNote", note: monthlyNote };
  const figures: ReadingFigure[] = [
    { label: "Total projected cost", id: "clTotalOut", value: total, noteId: "clTotalNote", note: fig(totalNote) },
    { id: "clShortOut", value: short, noteId: "clShortNote", note: fig(shortNote),
      label: <span className="tipglue"><span id="clShortK">{multi ? "Needed today" : "Needed when college starts"}</span><TipDot k={multi ? "collegepvall" : "collegepv"} /></span> },
  ];

  return (
    <div className="col-span-full grid grid-cols-1 items-start gap-5 max-sm:gap-3.5 lg:grid-cols-3">
      <div className="min-w-0 lg:col-span-1 lg:self-stretch">
        {/* Phones and narrow screens: the answer leads, and stays under the
            tab rail while the inputs are on screen. */}
        <PinnedReading tone={tone} main={{ label: "Save per month", value: monthly }} side={{ label: "Total projected cost", value: total }} />

        <aside id="asideCollege" className="max-lg:static max-lg:max-h-none max-lg:overflow-visible">
          <Card>
            <CardHeader>
              <CardTitle>College plan</CardTitle>
              <CardDescription>What college will cost, and what to set aside for it each month.</CardDescription>
            </CardHeader>
            <CardContent>
              <div id="clKids" ref={kidsRef}>
                {s.kids.map((k, i) => {
                  const first = i === 0;
                  const name = `Child ${i + 1}`;
                  const k2 = inp.kids[i];
                  const badCost = !(k2.annualCost > 0), badYears = !(k2.yearsUntil > 0);
                  const costWarn = "clCostWarn" + i, yearsWarn = "clYearsWarn" + i;
                  // The select says Custom once a typed cost no longer matches
                  // its preset; what's kept (and calculated from) is unchanged.
                  const presetShown = parseFloat(k.preset) > 0 && parseNum(k.cost) !== parseFloat(k.preset) ? "0" : k.preset;
                  return (
                    <div key={i} className={multi ? "stagecard clkid m-0 rounded-none border-x-0 border-t border-b-0 border-border bg-transparent px-0 pt-3.5 pb-1 first:border-t-0 first:pt-0" : "clkid"}>
                      {multi ? (
                        <div className="stagehead">
                          <span className="text-body font-semibold">{name}</span>
                          <Button variant="quiet" size="icon-sm" className="-my-1.5 -mr-2 ml-auto" aria-label={"Remove " + name.toLowerCase()} title="Remove this child"
                            onClick={() => setState((c) => ({ ...c, kids: c.kids.filter((_, j) => j !== i) }))}>
                            <XIcon aria-hidden="true" />
                          </Button>
                        </div>
                      ) : null}
                      <SelectField id={first ? "clPreset" : undefined} label={first ? <Tipped text="School type" k="schooltype" /> : "School type"}
                        aria-label={`${name} school type`} data-f="preset" data-i={i} value={presetShown}
                        onChange={(v) => setKid(i, parseFloat(v) > 0 ? { preset: v, cost: groupDigits(parseFloat(v), true) } : { preset: v })}>
                        {CL_PRESETS.map(([v, label]) => <option key={v} value={v}>{label}</option>)}
                      </SelectField>
                      <div className="grid grid-cols-2 items-end gap-x-3 sm:grid-cols-3 lg:grid-cols-2 xl:grid-cols-3">
                        <MoneyField id={first ? "clCost" : undefined} className="col-span-2 sm:col-span-1 lg:col-span-2 xl:col-span-1" label="Annual cost today"
                          data-f="cost" data-i={i} value={k.cost} onValueChange={(v) => setKid(i, { cost: v })} aria-label={`${name} annual cost today`}
                          aria-invalid={badCost || undefined} aria-describedby={badCost ? costWarn : undefined} />
                        <Field id={first ? "clYears" : undefined} label="Years until college">
                          <Affixed suffix="yrs"><NumberInput id={first ? "clYears" : undefined} data-f="years" data-i={i} nonNeg max={25} value={k.years}
                            onValueChange={(v) => setKid(i, { years: v })} aria-label={`${name} years until college`}
                            aria-invalid={badYears || undefined} aria-describedby={badYears ? yearsWarn : undefined} /></Affixed>
                        </Field>
                        <NumberField id={first ? "clCollegeYrs" : undefined} label="Years of college" unit="yrs" max={8} data-f="collegeYrs" data-i={i} value={k.collegeYrs}
                          onValueChange={(v) => setKid(i, { collegeYrs: v })} aria-label={`${name} years of college`} />
                      </div>
                      {badCost ? <FieldWarn id={costWarn}>Enter what a year of college costs today{multi ? "; until then this child is left out." : "."}</FieldWarn> : null}
                      {badYears ? <FieldWarn id={yearsWarn}>College has to be at least a year away{multi ? "; until then this child is left out." : "."}</FieldWarn> : null}
                    </div>
                  );
                })}
              </div>
              <Button variant="outline" id="clAddKid" className="mt-1 mb-1"
                onClick={() => {
                  // A new child starts like the last one, two years behind.
                  setState((c) => {
                    const last = c.kids[c.kids.length - 1];
                    return { ...c, kids: [...c.kids, { ...last, years: String(Math.min(25, (parseFloat(last.years) || 0) + 2)) }] };
                  });
                  focusLast(kidsRef, "input[data-f='years']");
                }}><PlusIcon aria-hidden="true" />{multi ? "Add another child" : "Add a child"}</Button>

              <GroupHead>The account</GroupHead>
              <MoneyField id="clSaved" labelId="clSavedLbl" label={multi ? "Currently saved, for all of them" : "Currently saved"} value={s.saved} onValueChange={set("saved")} />
              <div className="two bottomalign max-sm:grid-cols-2">
                <NumberField id="clReturn" label="Investment return" unit="%/yr" step={0.5} value={s.ret} onValueChange={set("ret")} />
                <NumberField id="clInfl" label={<Tipped text="Tuition inflation" k="tuitioninfl" />} unit="%/yr" step={0.5} value={s.infl} onValueChange={set("infl")} />
              </div>
              <div className="derived">
                <div><span id="clSavGrowK">{multi ? "What you've saved covers" : "What you've saved grows to"}</span><span className="num" id="clSavGrow">{savGrow}</span></div>
              </div>
            </CardContent>
          </Card>
        </aside>
      </div>

      <div className="stack min-w-0 lg:col-span-2" id="tab-college">
        <Card size="flush" className="min-w-0" id="clReading">
          <HeroReading tone={tone} sized={ready} hero={hero} figures={figures}>
            {funded ? (
              <Badge variant="positive" className="mt-3"><CircleCheckIcon aria-hidden="true" />Covered by what you&apos;ve saved</Badge>
            ) : null}
          </HeroReading>
          {!ready ? (
            <Band id="clEmpty">{multi ? "Every child is left out. Fill in a marked field to see what to save." : "Fill in the marked " + (!(inp.annualCost > 0) && !(inp.yearsUntil > 0) ? "fields" : "field") + " to see what to save."}</Band>
          ) : null}
        </Card>

        <Card id="clEachPanel" className="min-w-0" hidden={!multi || !ready}>
          <CardHeader><CardTitle>Each child</CardTitle></CardHeader>
          <div id="clEach" className="pb-1">{each}</div>
        </Card>

        <Card className="min-w-0" hidden={!ready}>
          <CardHeader><CardTitle>Savings over time</CardTitle></CardHeader>
          {chart ? (
            <BandChart id="Cl" pts={chart.pts} maxX={chart.maxX} enhanced noLoLine screenOnly={{ noBand: true }} ariaLabel="College savings projection"
              tip={(b) => (
                <>
                  <b>Year {fmtNum(b.year)}</b>
                  <br /><i className="tipsw bg-series-plan"></i>Savings <span className="n">{money(b.base)}</span>
                  {b.hi != null ? <><br /><i className="tipsw bg-series-teal"></i>{multi ? "Still needed" : "Cost of college"} <span className="n">{money(b.hi)}</span></> : null}
                </>
              )} />
          ) : <BandChart id="Cl" pts={[]} maxX={0} ariaLabel="College savings projection" tip={() => null} />}
          <Legend id="legendCl" items={chart ? [[SERIES.plan, "Your savings"], [SERIES.teal, multi ? "Needed then for the bills still ahead" : "Cost of college, that year"]] : []} />
        </Card>

        <div className="min-w-0" hidden={!ready}>
          <Collapsible render={<Card />}>
            <CardHeader>
              <CardTitle><CollapsibleTrigger>Year by year<ChevronDownIcon aria-hidden="true" /></CollapsibleTrigger></CardTitle>
              <CardAction><CsvButton table={tableRef} label="Year by year" /></CardAction>
            </CardHeader>
            <CollapsibleContent keepMounted>
              <div className="swipehint">Swipe the table sideways to see every column.</div>
              <div className="scroll max-h-none">
                <table id="clTable" ref={tableRef}>
                  <thead><tr><th>Year</th><th>Balance</th><th>You added</th><th>Growth</th><th>{multi ? "Paid for college" : "Projected cost"}</th></tr></thead>
                  <tbody>{rows}</tbody>
                </table>
              </div>
            </CollapsibleContent>
          </Collapsible>
        </div>
      </div>
    </div>
  );
}
