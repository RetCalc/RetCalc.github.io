"use client";

/* Roth Conversion & RMDs (also the /rmd page): required distributions to
   the end of the plan, and a conversion schedule scored against doing
   nothing. Ported from src/js/app/17-roth.js and src/main/12-roth-inputs.html,
   13-roth.html. */

import { useRef, useState, type ReactNode } from "react";
import { BandChart } from "@/components/charts/BandChart";
import { Legend } from "@/components/charts/Legend";
import { useHouseholdFill } from "@/components/household/HouseholdProvider";
import { Affixed, Field, MoneyField, NumberField, SelectField } from "@/components/fields/Field";
import { MoneyInput } from "@/components/fields/NumberInput";
import { useToast } from "@/components/shell/Toast";
import { Tipped } from "@/components/shell/Tooltips";
import { toolInputs, useToolState } from "@/components/tools/ToolState";
import { CsvButton } from "@/components/common/CsvButton";
import { BigValue } from "@/components/common/BigValue";
import { KV, Segmented } from "@/components/common/Readout";
import { PinnedReading, type HeroTone } from "@/components/common/Reading";
import { runRoth } from "@/lib/engine/typed";
import type { RothResult } from "@/lib/engine/types";
import { DASH, fmtNum, groupDigits, money, parseNum, pctStr } from "@/lib/format";
import { STATE_OPTIONS } from "@/lib/states";
import { DRAWDOWN_DEFAULTS } from "@/tools/drawdown/fields";
import { ROTH_DEF, rothInput, type RothInputs } from "./model";
import { useShareKit } from "@/components/shell/share";
import { rothShare } from "./share";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardAction } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { SERIES } from "@/lib/hues";
import { ArrowDownIcon, ArrowUpIcon, ChevronDownIcon, CircleAlertIcon, CircleCheckIcon, CircleXIcon, InfoIcon, MinusIcon } from "lucide-react";
import { cn } from "@/lib/utils";

const TONE: Record<HeroTone, string> = { answer: "text-primary", gain: "text-gain", loss: "text-destructive", text: "text-foreground" };

/* The verdict, as the reading's headline: a glyph for each of its states, so
   the color never says it alone. */
const VERDICT = {
  win: { Icon: CircleCheckIcon, cls: "text-gain" },
  lose: { Icon: CircleXIcon, cls: "text-destructive" },
  mixed: { Icon: CircleAlertIcon, cls: "text-muted-foreground" },
  none: { Icon: MinusIcon, cls: "text-muted-foreground" },
} as const;

interface Fig { label: ReactNode; id: string; value: string; note: ReactNode; noteId: string; tone: HeroTone }

/** `variant="rmd"`: the /rmd page, the same tool led by its required
    distributions (Peak RMD first and in amber, the year table open on
    doing nothing with the RMD column first). Same figures, inputs and
    default plan as /roth. */
export function Roth({ variant }: { variant?: "rmd" } = {}) {
  const rmdPage = variant === "rmd";
  const { state: s, set, setState } = useToolState(ROTH_DEF);
  useShareKit(ROTH_DEF.id, rothShare(s));
  const toast = useToast();
  const [view, setView] = useState<"bal" | "tax">("bal");
  const [tableView, setTableView] = useState<"plan" | "base">(rmdPage ? "base" : "plan");
  const tableRef = useRef<HTMLTableElement>(null);

  useHouseholdFill("roth", (h) => setState((c) => {
    const next: RothInputs = { ...c, status: h.status === "m" ? "m" : "s" };
    const age = h.age != null && h.age > 0 && h.age < 120 ? Math.round(h.age) : null;
    if (age) next.age = String(age);
    if (h.status === "m" && h.spouseAge != null && h.spouseAge > 0) next.spouseAge = String(Math.round(h.spouseAge));
    if (h.state) next.state = h.state;
    if (h.spend != null && h.spend > 0) next.spend = groupDigits(h.spend, true);
    return next;
  }));

  const married = s.status === "m";
  const strat = s.strategy;
  const inp = rothInput(s);
  const any = inp.trad > 0 || inp.roth > 0 || inp.brokerage > 0;
  /* Plan through has to come after your age. Both entered and the wrong way
     round, the field says so and the results wait (blank still reads as 0). */
  const ageN = parseNum(s.age), endN = parseNum(s.endAge);
  const badRange = s.age.trim() !== "" && s.endAge.trim() !== "" && isFinite(ageN) && isFinite(endN) && endN <= ageN;
  const ok = any && !badRange;
  const plan = ok ? runRoth(inp, true) : null;
  const base = ok ? runRoth(inp, false) : null;

  /* Everything that compares converting with doing nothing. */
  function compare(plan: RothResult, base: RothResult) {
    const taxSaved = base.lifeTaxPV - plan.lifeTaxPV;
    const nwDelta = plan.endAfterTax - base.endAfterTax;
    // Break-even: the first year converting catches doing nothing and stays
    // ahead. Early years look worse: the tax is paid now, the benefit later.
    let be = 0;
    for (let i = 0; i < plan.rows.length && !be; i++)
      if (plan.rows.slice(i).every((x, k) => x.afterTax >= base.rows[i + k].afterTax)) be = plan.rows[i].age;
    const wRow = plan.rows.find((x) => x.widowed);
    let widow = "";
    if (wRow) {
      const before = plan.rows[Math.max(0, wRow.i - 1)];
      // Say "moves from X to Y" only where something moved.
      const rateTxt = Math.abs(before.marginal - wRow.marginal) < 0.0005 ? "the marginal rate stays at " + pctStr(wRow.marginal, 1)
        : "the marginal rate moves from " + pctStr(before.marginal, 1) + " to " + pctStr(wRow.marginal, 1);
      const taxTxt = Math.abs(before.tax - wRow.tax) < 0.5 ? "tax that year stays at " + money(wRow.tax)
        : "tax that year goes from " + money(before.tax) + " to " + money(wRow.tax);
      widow = "Filing switches to single at age " + wRow.age + ". The same income now meets single brackets and a single standard deduction: " + rateTxt + ", and " + taxTxt + ".";
    }
    const verdict = taxSaved >= 0 && nwDelta >= 0 ? "Converting wins on both measures."
      : taxSaved < 0 && nwDelta < 0 ? "Converting loses on both measures here." : "The two measures disagree; read them together, not separately.";
    // A plan that converts nothing is doing nothing: there's no contest to call.
    const kind: keyof typeof VERDICT = !(plan.totalConv > 0) ? "none" : taxSaved >= 0 && nwDelta >= 0 ? "win" : taxSaved < 0 && nwDelta < 0 ? "lose" : "mixed";
    const pts = plan.rows.map((p, i) => {
      const b = base.rows[i];
      const x = view === "bal" ? p.trad : p.tax + p.irmaa, y = view === "bal" ? b.trad : b.tax + b.irmaa;
      return { year: p.age - inp.age, base: x, hi: y, lo: Math.min(x, y) };
    });
    return { taxSaved, nwDelta, be, wRow, widow, verdict, kind, pts, T: tableView === "plan" ? plan : base };
  }
  const R = plan && base ? compare(plan, base) : null;
  const firstRMD = plan?.rows.find((x) => x.rmd > 0);
  const convYears = plan ? plan.rows.filter((x) => x.conv > 0).length : 0;

  /* ---- the reading's three figures: each answers its own question ---- */
  const savedVal = R ? (R.taxSaved >= 0 ? "" : "−") + money(Math.abs(R.taxSaved)) : DASH;
  const nwVal = R ? (R.nwDelta >= 0 ? "+" : "−") + money(Math.abs(R.nwDelta)) : DASH;
  const peakVal = plan && base ? money(base.peakRMD, 0) : DASH;
  const savedTone: HeroTone = !R ? "text" : R.taxSaved < 0 ? "loss" : rmdPage ? "text" : "answer";
  const NwIcon = R ? (R.nwDelta >= 0 ? ArrowUpIcon : ArrowDownIcon) : null;
  const saved: Fig = {
    label: <Tipped text="Lifetime tax saved" k="rcpv" />, id: "rcSaved", value: savedVal, noteId: "rcSavedNote", tone: savedTone,
    note: R ? "Lifetime tax + IRMAA, discounted at " + pctStr(inp.disc, 1) + " real" : "",
  };
  const nw: Fig = {
    label: "After-tax net worth vs doing nothing", id: "rcNW", value: nwVal, noteId: "rcNWNote", tone: R ? (R.nwDelta >= 0 ? "gain" : "loss") : "text",
    note: R && NwIcon ? (
      <span className="inline-flex items-start gap-1">
        <NwIcon className={cn("mt-px size-3.5 shrink-0", R.nwDelta >= 0 ? "text-gain" : "text-destructive")} aria-hidden="true" />
        <span>After-tax, at age {inp.endAge}</span>
      </span>
    ) : "",
  };
  const peak: Fig = {
    label: <Tipped text="Peak RMD, doing nothing" k="rcpeak" />, id: "rcPeak", value: peakVal, noteId: "rcPeakNote", tone: rmdPage && plan ? "answer" : "text",
    note: plan && base ? (plan.peakRMD < base.peakRMD ? "Converting trims it to " + money(plan.peakRMD, 0) : "Unchanged by this plan") : "",
  };
  const figs = rmdPage ? [peak, saved, nw] : [saved, nw, peak];
  const V = R ? VERDICT[R.kind] : null;

  const two = "two bottomalign max-sm:grid-cols-2";
  const widowRows = !!R?.T.rows.some((y) => y.widowed);
  const cols: [string, (y: RothResult["rows"][number]) => ReactNode][] = [
    ["Converted", (y) => (y.conv > 0 ? money(y.conv, 0) : DASH)],
    ["RMD", (y) => (y.rmd > 0 ? money(y.rmd, 0) : DASH)],
  ];
  if (rmdPage) cols.reverse();

  return (
    <div className="col-span-full grid grid-cols-1 items-start gap-5 max-sm:gap-3.5 lg:grid-cols-3">
      <div className="min-w-0 lg:col-span-1 lg:self-stretch">
        {/* Phones and narrow screens: the answer leads, and stays under the
            tab rail while the inputs are on screen. */}
        {rmdPage ? (
          <PinnedReading tone={peak.tone} main={{ label: "Peak RMD, doing nothing", value: peakVal }} side={{ label: "Lifetime tax saved", value: savedVal }} />
        ) : (
          <PinnedReading tone={savedTone} main={{ label: "Lifetime tax saved", value: savedVal }} side={{ label: "Net worth vs doing nothing", value: nwVal }} />
        )}

        <aside id="asideRC" className="max-lg:static max-lg:max-h-none max-lg:overflow-visible">
          <Card>
            <CardHeader>
              <CardTitle>Your situation</CardTitle>
              <CardDescription>Where you stand today. The conversion plan to test sits with the results.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className={two}>
                <NumberField id="rcAge" label="Your age" unit="age" max={95} value={s.age} onValueChange={set("age")} />
                <NumberField id="rcEndAge" label="Plan through" unit="age" max={100} value={s.endAge} onValueChange={set("endAge")}
                  aria-invalid={badRange || undefined} aria-describedby={badRange ? "rcEndWarnText" : undefined} />
              </div>
              <div className="-mt-1 mb-3.5 flex items-start gap-2 text-note text-destructive" id="rcEndWarn" hidden={!badRange}>
                <CircleAlertIcon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                <span id="rcEndWarnText" role="alert">{badRange ? "Plan through has to be later than your age." : ""}</span>
              </div>
              <SelectField id="rcStatus" label="Filing status" value={s.status} onChange={set("status")}>
                <option value="m">Married filing jointly</option>
                <option value="s">Single</option>
              </SelectField>
              <NumberField id="rcSpouseAge" wrapId="rcSpouseWrap" hidden={!married} label="Spouse's age" unit="age" max={105} value={s.spouseAge} onValueChange={set("spouseAge")} />
              <SelectField id="rcState" label="State" value={s.state} onChange={set("state")}>
                {STATE_OPTIONS.map((o) => <option key={o.code} value={o.code}>{o.name}</option>)}
              </SelectField>

              <div className="mt-1 mb-3 flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-border pt-4">
                <h3 className="m-0 mr-auto text-sm font-semibold">What you have</h3>
                <Button variant="outline" size="sm" id="rcCopyDD"
                  onClick={() => {
                    const v = parseNum(toolInputs("drawdown", DRAWDOWN_DEFAULTS).initial as string);
                    if (!(v > 0)) {
                      toast("Set a portfolio value in the Drawdown Simulator first");
                      return;
                    }
                    // Split across the accounts in the proportions already here,
                    // rather than inventing a tax profile.
                    setState((c) => {
                      const t = parseNum(c.trad), r = parseNum(c.roth), b = parseNum(c.brok), cur = t + r + b;
                      const share = (x: number) => groupDigits(((v * x) / cur).toFixed(0), true);
                      return cur > 0 ? { ...c, trad: share(t), roth: share(r), brok: share(b) } : { ...c, trad: groupDigits(v.toFixed(0), true) };
                    });
                    toast("Copied " + money(v) + ", split across your current account mix");
                  }}>Copy from Drawdown</Button>
              </div>
              <Field id="rcTrad" label={<Tipped text="Traditional 401(k) / IRA" k="rctrad" />}>
                <Affixed prefix="$"><MoneyInput id="rcTrad" nonNeg value={s.trad} onValueChange={set("trad")} /></Affixed>
              </Field>
              <div className={two}>
                <MoneyField id="rcRoth" label="Roth" value={s.roth} onValueChange={set("roth")} />
                <MoneyField id="rcBrok" label="Brokerage" value={s.brok} onValueChange={set("brok")} />
              </div>
              <div className={two}>
                <NumberField id="rcBasis" label={<Tipped text="Cost basis" k="rcbasis" />} unit="% of balance" step={5} max={100} value={s.basis} onValueChange={set("basis")} />
                <NumberField id="rcReturn" label={<Tipped text="Real return" k="realreturn" />} unit="%/yr" step={0.5} value={s.ret} onValueChange={set("ret")} />
              </div>

              <GroupHead>Income and spending</GroupHead>
              <MoneyField id="rcSpend" label={<Tipped text="Annual spending" k="rcspend" />} value={s.spend} onValueChange={set("spend")} />
              <div className={two}>
                <MoneyField id="rcSS" label="Your Social Security" unit="/yr" value={s.ss} onValueChange={set("ss")} />
                <NumberField id="rcSSAge" label="Claim at" unit="age" max={70} value={s.ssAge} onValueChange={set("ssAge")} />
              </div>
              <div className={two} id="rcSpouseSSWrap" hidden={!married}>
                <MoneyField id="rcSpSS" label="Spouse's benefit" unit="/yr" value={s.spSS} onValueChange={set("spSS")} />
                <NumberField id="rcSpSSAge" label="Claim at" unit="age" max={70} value={s.spSSAge} onValueChange={set("spSSAge")} />
              </div>
              <div className={two}>
                <MoneyField id="rcOther" label={<Tipped text="Other income" k="rcother" />} unit="/yr" value={s.other} onValueChange={set("other")} />
                <NumberField id="rcOtherStart" label="Starting at" unit="age" max={100} value={s.otherStart} onValueChange={set("otherStart")} />
              </div>
              <NumberField id="rcDeath" wrapId="rcDeathWrap" hidden={!married} label={<Tipped text="Survivor transition" k="rcwidow" />} unit="yrs from now" max={45} value={s.death} onValueChange={set("death")} />

              <GroupHead>How to score it</GroupHead>
              <SelectField id="rcIrmaaOn" label={<Tipped text="Medicare IRMAA" k="irmaa" />} value={s.irmaaOn} onChange={set("irmaaOn")}>
                <option value="1">Include the surcharge</option>
                <option value="0">Ignore it</option>
              </SelectField>
              <div className={two}>
                <NumberField id="rcHeir" label={<Tipped text="Rate on what's left" k="rcheir" />} unit="%" max={60} value={s.heir} onValueChange={set("heir")} />
                <NumberField id="rcDisc" label={<Tipped text="Discount rate" k="rcdisc" />} unit="%" step={0.5} max={15} value={s.disc} onValueChange={set("disc")} />
              </div>
            </CardContent>
          </Card>
        </aside>
      </div>

      <div className="stack min-w-0 lg:col-span-2" id="tab-roth">
        <Card size="flush" className="min-w-0">
          {/* The verdict is the answer; the figures are its evidence. */}
          <div className="border-b border-border px-5.5 py-4.5 max-sm:px-4">
            {R && V ? (
              <div id="rcVerdict" className="flex items-start gap-2.5">
                <V.Icon className={cn("mt-1 size-5 shrink-0", V.cls)} aria-hidden="true" />
                <p className="m-0 text-2xl leading-tight font-semibold tracking-tight text-balance text-foreground">
                  {R.kind === "none" ? "This plan converts nothing, so there is nothing to compare." : R.verdict}
                </p>
              </div>
            ) : (
              <div id="rcVerdict" className="flex items-start gap-2 text-body text-foreground">
                <InfoIcon className="mt-1 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                <p className="m-0">{badRange ? "Set Plan through to an age after yours to compare converting with doing nothing."
                  : "Enter a traditional, Roth or brokerage balance to compare converting with doing nothing."}</p>
              </div>
            )}
          </div>
          <div className="grid grid-cols-1 gap-x-8 gap-y-4 px-5.5 pt-5 pb-4.5 max-sm:px-4 sm:grid-cols-3" data-readout>
            {figs.map((f) => (
              <div key={f.id} className="min-w-0" data-pair>
                <span className="block text-label text-muted-foreground" data-k>{f.label}</span>
                <BigValue className={cn("text-3xl leading-tight font-medium whitespace-nowrap tabular-nums sm:text-display lg:text-3xl wide:text-display", TONE[f.tone])}
                  id={f.id} text={f.value} sized={false} />
                <span className="block min-h-4 text-label text-muted-foreground" id={f.noteId}>{f.note}</span>
              </div>
            ))}
          </div>
          {R ? (
            <p className="m-0 max-w-copy px-5.5 pb-4.5 text-note text-muted-foreground max-sm:px-4" id="rcVerdictNote">
              Lifetime tax is what you and your heirs hand over; after-tax net worth is what is left standing at age {inp.endAge}, with traditional dollars discounted at {pctStr(inp.heirRate, 0)} because they are still owed to the IRS.
            </p>
          ) : null}
          {/* What the plan settles about required distributions and the
              conversions themselves. */}
          <dl className="m-0 grid grid-cols-2 gap-x-6 gap-y-3 border-t border-border px-5.5 py-3.5 max-sm:px-4 sm:grid-cols-4">
            <Fact k={<Tipped text="RMDs begin" k="rcrmdage" />} id="rcRmdAge">{plan ? "Age " + plan.rmdStart : DASH}</Fact>
            <Fact k="First RMD, converting" id="rcFirstRMD">{plan ? (firstRMD ? money(firstRMD.rmd, 0) + " at " + firstRMD.age : "None in this window") : DASH}</Fact>
            <Fact k="Years converting" id="rcConvYears">{plan ? (convYears ? fmtNum(convYears) + (convYears === 1 ? " year" : " years") : "None") : DASH}</Fact>
            <Fact k="Average conversion" id="rcAvgConv">{plan ? (convYears ? money(plan.totalConv / convYears, 0) + "/yr" : DASH) : DASH}</Fact>
          </dl>
          <div className="border-t border-border px-5.5 py-3.5 max-sm:px-4" id="rcWidow" hidden={!R?.wRow}>
            <p className="m-0 max-w-copy text-note text-muted-foreground">
              <b className="font-semibold text-foreground">The survivor&apos;s bracket.</b>{" "}
              <span id="rcWidowText">{R?.widow}</span>
            </p>
          </div>
        </Card>

        {/* The levers this page tests, next to their effect. */}
        <Card>
          <CardHeader>
            <CardTitle>The conversion plan</CardTitle>
            <CardDescription>What to test against doing nothing.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 items-end gap-x-3 sm:grid-cols-2">
              <SelectField id="rcStrategy" label={<Tipped text="Strategy" k="rcstrategy" />} value={s.strategy} onChange={set("strategy")}>
                <option value="brk">Fill to the top of a bracket</option>
                <option value="irm">Fill to an IRMAA threshold</option>
                <option value="fix">A fixed amount each year</option>
                <option value="pct">A share of the balance each year</option>
                <option value="none">No conversions</option>
              </SelectField>
              <SelectField id="rcBracket" wrapId="rcBracketWrap" hidden={strat !== "brk"} label="Fill to the top of" value={s.bracket} onChange={set("bracket")}>
                <option value="0.12">the 12% bracket</option>
                <option value="0.22">the 22% bracket</option>
                <option value="0.24">the 24% bracket</option>
                <option value="0.32">the 32% bracket</option>
              </SelectField>
              <SelectField id="rcIrmaaTier" wrapId="rcIrmaaTierWrap" hidden={strat !== "irm"} label={<Tipped text="Stay within" k="irmaa" />} value={s.irmaaTarget} onChange={set("irmaaTarget")}>
                <option value="0">No surcharge at all</option>
                <option value="1">The first surcharge tier</option>
                <option value="2">The second tier</option>
                <option value="3">The third tier</option>
              </SelectField>
              <MoneyField id="rcFixed" wrapId="rcFixedWrap" hidden={strat !== "fix"} label="Convert each year" value={s.fixed} onValueChange={set("fixed")} />
              <NumberField id="rcPct" wrapId="rcPctWrap" hidden={strat !== "pct"} label="Convert each year" unit="% of the balance" max={100} value={s.pct} onValueChange={set("pct")} />
              <div className={two} id="rcWindowWrap" hidden={strat === "none"}>
                <NumberField id="rcStartAge" label="Convert from" unit="age" max={100} value={s.startAge} onValueChange={set("startAge")} />
                <NumberField id="rcStopAge" label="Through" unit="age" max={100} value={s.stopAge} onValueChange={set("stopAge")} />
              </div>
              <SelectField id="rcPayFrom" wrapId="rcPayWrap" hidden={strat === "none"} label={<Tipped text="Conversion tax paid from" k="rcpayfrom" />} value={s.payFrom} onChange={set("payFrom")}>
                <option value="taxable">Taxable account</option>
                <option value="withhold">Withheld from the conversion</option>
              </SelectField>
            </div>
          </CardContent>
        </Card>

        {/* Nothing to draw or compare until there's a plan. */}
        <div className="stack" hidden={!R}>
          <Card className="min-w-0">
            <CardHeader>
              <CardTitle id="rcChartTitle">{view === "bal" ? "Traditional balance" : "Tax paid each year"}</CardTitle>
              <CardDescription>In today&apos;s dollars, by age.</CardDescription>
            </CardHeader>
            <div className="px-(--card-spacing)">
              <Segmented id="segRC" size="chart" attr="data-rc" options={[["bal", "Balance"], ["tax", "Tax"]] as const} value={view} onChange={setView} />
            </div>
            <BandChart id="RC" pts={R?.pts ?? []} maxX={inp.endAge - inp.age} enhanced ariaLabel="Converting versus not converting"
              screenOnly={{ xOffset: inp.age, noLoLine: true, flatBand: true }}
              tip={(b) => (
                <>
                  <b>Age {fmtNum(inp.age + b.year)}</b>
                  <br /><i className="tipsw bg-series-plan"></i>Converting <span className="n">{money(b.base)}</span>
                  <br /><i className="tipsw bg-series-teal"></i>No conversions <span className="n">{money(b.hi!)}</span>
                </>
              )} />
            <Legend id="legendRC" items={R ? [
              [SERIES.plan, view === "bal" ? "Traditional balance, converting" : "Tax paid, converting"],
              [SERIES.teal, view === "bal" ? "Traditional balance, no conversions" : "Tax paid, no conversions"],
            ] : []} />
          </Card>

          <Card>
            <CardHeader><CardTitle>Converting vs. not</CardTitle></CardHeader>
            <CardContent>
              <div className="grid2">
                <div>
                  <KV k="Lifetime income tax, converting" id="rcTaxPlan" v={plan ? money(plan.lifeTax) : ""} />
                  <KV k="Lifetime income tax, doing nothing" id="rcTaxBase" v={base ? money(base.lifeTax) : ""} />
                  <KV k={<Tipped text="Present value, tax + IRMAA" k="rcpv" />} id="rcTaxPV" v={plan && base ? money(plan.lifeTaxPV) + " vs " + money(base.lifeTaxPV) : ""} />
                  <KV k="Lifetime IRMAA" id="rcIrmPlan" v={plan && base ? (inp.irmaaOn ? money(plan.lifeIrmaa) + " vs " + money(base.lifeIrmaa) : "Not included") : ""} />
                </div>
                <div>
                  <KV k="Total converted" id="rcConvTotal" v={plan ? money(plan.totalConv) : ""} />
                  <KV k={<Tipped text="Break-even" k="rcbreakeven" />} id="rcBreakEven" v={R ? (R.be ? "Age " + R.be + (R.be === inp.age ? ", ahead from the start" : "") : "Never, within this horizon") : ""} />
                  <KV k="Traditional at the end" id="rcEndTrad" v={plan && base ? money(plan.endTrad) + " vs " + money(base.endTrad) : ""} />
                  <KV k="Roth at the end" id="rcEndRoth" v={plan && base ? money(plan.endRoth) + " vs " + money(base.endRoth) : ""} />
                </div>
              </div>
              <p className="mt-3.5 mb-0 text-label text-muted-foreground">Pairs read converting first, then doing nothing.</p>
              <div className="hint mt-1.5">Every figure is in today&apos;s dollars.
                Brackets, the standard deduction and the IRMAA thresholds are held fixed in
                real terms, which is what indexing does to them in practice.</div>
            </CardContent>
          </Card>

          <Collapsible className="min-w-0" defaultOpen={rmdPage} render={<Card />}>
            <CardHeader>
              <CardTitle><CollapsibleTrigger>Year by year<ChevronDownIcon aria-hidden="true" /></CollapsibleTrigger></CardTitle>
              <CardAction><CsvButton table={tableRef} label="Year by year" /></CardAction>
            </CardHeader>
            <CollapsibleContent keepMounted>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-(--card-spacing) pb-3">
                <Segmented id="segRCTab" size="chart" attr="data-rct" options={[["plan", "Converting"], ["base", "Doing nothing"]] as const} value={tableView} onChange={setTableView} />
                {widowRows ? (
                  <span className="inline-flex items-center gap-2 text-label text-muted-foreground" id="rcTableKey">
                    <i className="inline-block h-3 w-5 border-t border-input bg-muted dark:bg-border" aria-hidden="true" />
                    Shaded rows: after the survivor transition
                  </span>
                ) : null}
              </div>
              <div className="swipehint">Swipe the table sideways to see every column.</div>
              <div className="scroll lg:max-h-none">
                <table id="rcTable" ref={tableRef}>
                  <thead><tr><th>Age</th>{cols.map(([h]) => <th key={h}>{h}</th>)}<th>Ordinary income</th><th>MAGI</th><th>Tax</th><th>IRMAA</th><th>Marginal</th><th>Traditional</th><th>Roth</th></tr></thead>
                  <tbody>
                    {R?.T.rows.map((y) => (
                      <tr key={y.age} className={y.widowed ? "rc-widow" : undefined}>
                        <td>{fmtNum(y.age)}</td>{cols.map(([h, f]) => <td key={h}>{f(y)}</td>)}
                        <td>{money(y.ordinary, 0)}</td><td>{money(y.magi, 0)}</td><td>{money(y.tax, 0)}</td>
                        <td>{inp.irmaaOn && y.irmaa > 0 ? <>{money(y.irmaa, 0)} <Badge variant="outline" className="ml-1 align-middle">Tier {y.irmaaTier}</Badge></> : DASH}</td>
                        <td>{pctStr(y.marginal, 1)}</td><td>{money(y.trad, 0)}</td><td>{money(y.roth, 0)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CollapsibleContent>
          </Collapsible>
        </div>
      </div>
    </div>
  );
}

function GroupHead({ children }: { children: ReactNode }) {
  return <h3 className="m-0 mt-1 mb-3 border-t border-border pt-4 text-sm font-semibold">{children}</h3>;
}

function Fact({ k, id, children }: { k: ReactNode; id: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-label text-muted-foreground">{k}</dt>
      <dd className="m-0 text-note font-medium text-foreground tabular-nums" id={id}>{children}</dd>
    </div>
  );
}
