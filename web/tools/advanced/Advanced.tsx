"use client";

/* The Advanced calculator: one plan with inflation, fees, taxes, a glide
   path and account types, worked backwards from a target, and charted
   against a rate band, market history or Monte Carlo runs. Ported from
   src/js/app/01-inputs.js, 02-accounts-advanced.js, 03-projection.js,
   04-charts.js, 06-solve.js and 07-converter.js, and the Advanced parts of
   src/main/02-calculator-inputs.html and 03-calculator-results.html. */

import { useDeferredValue, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckToggle, SignFlip } from "@/components/fields/CheckToggle";
import { Affixed, Field, MoneyField, NumberField, SelectField } from "@/components/fields/Field";
import { MoneyInput, NumberInput } from "@/components/fields/NumberInput";
import { useHousehold, useHouseholdFill } from "@/components/household/HouseholdProvider";
import { useToast } from "@/components/shell/Toast";
import { TipDot, Tipped } from "@/components/shell/Tooltips";
import { AccountTable } from "@/components/tools/AccountTable";
import { ConvertIcon, ConverterDialog, GrowthRatesDialog } from "@/components/tools/ContribDialogs";
import { ProjectionChart, ProjectionReading, SolveOption, bandLabel, emptyChart, fanPoints, histChart, type ChartData, type ChartMode } from "@/components/tools/Projection";
import { toolInputs, useToolState } from "@/components/tools/ToolState";
import { CsvButton } from "@/components/common/CsvButton";
import { Milestones } from "@/components/common/Milestones";
import { KV } from "@/components/common/Readout";
import { growthBlend, matchPer, spreadTotal, type GrowthRates } from "@/lib/accounts";
import { goalSolve, historicalRuns, monteCarlo, project, PER_YEAR } from "@/lib/engine/typed";
import { DASH, dollarsField, fmtNum, fmtYears, fraction, groupDigits, money, parseNum, pctStr } from "@/lib/format";
import { MC_RUNS, useMcSeed } from "@/lib/mc-seed";
import { PERIOD_ADV, PERIOD_SHORT, PeriodOptions } from "@/lib/periods";
import { has } from "@/lib/household";
import { STATE_OPTIONS } from "@/lib/states";
import { sendToDrawdown } from "@/tools/drawdown/fields";
import { TAX_DEFAULTS } from "@/tools/tax/model";
import { useShareKit } from "@/components/shell/share";
import { projectionShare } from "./share";
import { ADVANCED_DEF, advancedCompute, advancedPlan, glideNote, glideYearsFor, solvePlan, type AdvancedInputs } from "./model";
import { toStages } from "./toStages";
import { useBusy } from "@/lib/busy";
import { Button } from "@/components/ui/button";
import { InputGroupInput } from "@/components/ui/input-group";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { PinnedReading } from "@/components/common/Reading";
import { cn } from "@/lib/utils";
import { ChevronDownIcon, CircleCheckIcon, CircleXIcon, LockIcon } from "lucide-react";
import { SERIES } from "@/lib/hues";
import { NativeSelect } from "@/components/ui/native-select";

const TARGET_LABEL = "(the portfolio behind your target above)";

export function Advanced() {
  const { state: s, set, setState } = useToolState(ADVANCED_DEF);
  const { profile } = useHousehold();
  const router = useRouter();
  const toast = useToast();
  const seed = useMcSeed();
  const [mode, setMode] = useState<ChartMode>("band");
  const [band, setBand] = useState("2");
  const [dialog, setDialog] = useState<"conv" | "growth" | null>(null);
  const tableRef = useRef<HTMLTableElement>(null);

  useHouseholdFill("advanced", (h) => setState((c) => {
    const age = has(h.age) && h.age! > 0 && h.age! < 120 ? Math.round(h.age!) : null;
    const retire = has(h.retire) && h.retire! > 0 && h.retire! < 120 ? Math.round(h.retire!) : null;
    const yrs = age && retire && retire > age ? Math.min(100, retire - age) : null;
    const next = { ...c };
    if (yrs) next.years = String(yrs);
    if (c.acOn) {
      // the split is the tool's own; only the facts about you carry in
      if (has(h.income)) next.salary = dollarsField(h.income!);
      next.acStatus = h.status === "m" ? "m" : "s";
      if (h.state) next.acState = h.state;
    } else {
      if (has(h.saved)) next.initial = dollarsField(h.saved!);
      if (has(h.monthly)) Object.assign(next, { contrib: dollarsField(h.monthly!), period: "Monthly" });
    }
    if (h.spend != null && h.spend > 0) Object.assign(next, { solveFor: "After-Tax Withdrawal", target: dollarsField(h.spend) });
    if (next.glideOn) next.glideYears = glideYearsFor(next.years, next.glideYears);
    return next;
  }));

  /* The glide can't run longer than the plan; its field follows the years. */
  const setTiming = (k: "years" | "glideYears") => (v: string) => setState((c) => {
    const next = { ...c, [k]: v };
    return next.glideOn ? { ...next, glideYears: glideYearsFor(next.years, next.glideYears) } : next;
  });

  const typed = useDeferredValue(s);
  useBusy(typed !== s);
  const V = useMemo(() => advancedCompute(typed, profile), [typed, profile]);
  const { P, p, R, S, C, Y } = V;
  useShareKit(ADVANCED_DEF.id, projectionShare({ kind: "advanced", P, R, target: typed.target, solveFor: typed.solveFor, mode }));
  const chart = useMemo(() => chartData(typed, V, mode, parseNum(band) / 100, seed), [typed, V, mode, band, seed]);

  const acOn = s.acOn;
  const blended = acOn && !!s.gRates;
  const per = PERIOD_SHORT[s.period] || "";

  /* ---- account split on and off ---- */
  const toggleAccounts = () => {
    if (!acOn) {
      // Seed from what's on screen, so switching modes doesn't change the
      // answer until you start splitting it up.
      const blank = (["tradBal", "tradC", "rothBal", "rothC", "brokBal", "brokC"] as const).every((k) => !(parseNum(s[k]) > 0));
      if (blank) {
        const tax = toolInputs("tax", TAX_DEFAULTS), H = profile;
        setState((c) => ({
          ...c, acOn: true, tradBal: dollarsField(parseNum(c.initial)), tradC: dollarsField(parseNum(c.contrib)), rothBal: "0", rothC: "0", brokBal: "0", brokC: "0",
          brokBasis: "", salary: dollarsField(H?.income || 0), matchPct: "0", matchCap: "6",
          acStatus: H?.status || tax.status, acState: H?.state || tax.state, gRates: null,
        }));
      } else setState((c) => ({ ...c, acOn: true }));
      toast("Tax is now worked out from each account type");
    } else {
      // Carry the totals and the rate it worked out back into the single
      // fields, so the answer doesn't jump when you switch back.
      const now = advancedPlan(s, profile).p;
      setState((c) => ({
        ...c, acOn: false, initial: dollarsField(now.initial), contrib: dollarsField(now.contrib), taxRate: String(+(now.taxRate * 100).toFixed(2)),
        growth: c.gRates ? String(+(now.growth * 100).toFixed(2)) : c.growth,
      }));
      toast("Back to one total, with a " + pctStr(now.taxRate, 1) + " tax rate");
    }
  };

  /* Defaults to 3 points below the current rate over the final 5 years, the
     first time it's turned on. */
  const toggleGlide = () => setState((c) => {
    if (c.glideOn) return { ...c, glideOn: false };
    const next = { ...c, glideOn: true };
    if (c.glideEnd === "") {
      next.glideEnd = String(+Math.max(0, parseNum(c.nominal) - 3).toFixed(2));
      next.glideYears = String(Math.min(5, Math.max(1, Math.round(parseNum(c.years)) || 5)));
    }
    return { ...next, glideYears: glideYearsFor(next.years, next.glideYears) };
  });

  /* A total per period, from a solve or the converter. Split by account it's
     spread over the accounts you pay into, with the match following. */
  const withTotal = (c: AdvancedInputs, total: number): AdvancedInputs => {
    if (!c.acOn) return { ...c, contrib: groupDigits(total, true) };
    const t = spreadTotal(advancedPlan(c, profile).a!, PER_YEAR[c.period], total);
    return { ...c, tradC: dollarsField(t.trad), rothC: dollarsField(t.roth), brokC: dollarsField(t.brok) };
  };

  const applyContribution = () => {
    // Split by account, the new contribution shifts the tax the target
    // needs, so a few passes settle it.
    let c = s, rounded = 0;
    for (let pass = 0; pass < (c.acOn ? 5 : 1); pass++) {
      const P1 = advancedPlan(c, profile), t = parseNum(c.target);
      rounded = Math.round(goalSolve(solvePlan(P1, c.solveFor, t), c.solveFor, t).perPeriod);
      c = withTotal(c, rounded);
    }
    setState(() => c);
    toast("Contribution set to " + money(rounded) + " " + PERIOD_ADV[s.period]);
  };
  const applyYears = () => {
    if (!Y.reached) {
      toast("That target isn't reachable within 100 years");
      return;
    }
    setState((c) => ({ ...c, years: String(Y.years) }));
    toast("Timeline set to " + fmtYears(Y.years));
  };

  const handToStages = (coast: boolean) => {
    const now = advancedCompute(s, profile);
    const out = toStages(now.P, s, coast ? now.C.years : null);
    if (!out) return;
    router.push("/stages");
    toast(out);
  };

  const growthDialog = dialog === "growth" && acOn ? (
    <GrowthRatesDialog title="Contribution growth by account" onClose={() => setDialog(null)}
      init={s.gRates || { t: parseNum(s.growth) / 100, r: parseNum(s.growth) / 100, b: parseNum(s.growth) / 100 }}
      blend={(rates) => { const a = P.a!; return growthBlend(p, p.years, { t: a.tradC, r: a.rothC, b: a.brokC }, rates); }}
      note={parseNum(s.matchPct) > 0 ? "Your employer match rises at the blended rate." : ""}
      apply={(rates: GrowthRates | null) => {
        setState((c) => ({ ...c, gRates: rates, growth: rates ? c.growth : String(+(p.growth * 100).toFixed(2)) }));
        toast(rates ? "Contribution growth set by account" : "One contribution growth rate for every account");
      }} />
  ) : null;

  /* ---- the fields that move into the account block when it's on ---- */
  const periodField = (
    <div className="field" id="periodField">
      <Label className="mb-1.5" htmlFor="period"><span>How often</span></Label>
      <NativeSelect id="period" value={s.period} onChange={(e) => set("period")(e.target.value)}><PeriodOptions /></NativeSelect>
      <Button variant="link" size="inline-xs" className="mt-1.75" id="convOpen" onClick={() => setDialog("conv")}>
        {ConvertIcon}
        Convert frequency
      </Button>
    </div>
  );
  const growthField = (
    <div className="field" id="growthField">
      <Label className="mb-1.5" htmlFor="growth"><span><Tipped text="Contribution growth" k="contribgrowth" /></span></Label>
      <Affixed suffix="%/yr">
        <NumberInput id="growth" value={blended ? String(+(p.growth * 100).toFixed(2)) : s.growth} onValueChange={set("growth")}
          readOnly={blended} title={blended ? "Blended from your per-account rates. Click to edit." : ""}
          onClick={() => blended && setDialog("growth")} />
      </Affixed>
      <Button variant="link" size="inline-xs" className="mt-1.75" id="acGrowthBtn" hidden={!acOn} onClick={() => setDialog("growth")}>{blended ? "Edit rates by account" : "Set by account"}</Button>
    </div>
  );
  const acMoney = (id: "tradBal" | "tradC" | "rothBal" | "rothC" | "brokBal" | "brokC", label: string, contrib?: boolean) => (
    <div className="field">
      <Label className="mb-1.5" htmlFor={"ac" + id[0].toUpperCase() + id.slice(1)}><span>{label}</span></Label>
      <Affixed prefix="$" suffix={contrib ? per : undefined}>
        <MoneyInput id={"ac" + id[0].toUpperCase() + id.slice(1)} nonNeg value={s[id]} onValueChange={set(id)} />
      </Affixed>
    </div>
  );
  const a = P.a, B = P.B;
  const mine = a ? a.tradC + a.rothC + a.brokC : 0;
  // The calculated rate stays in its (hidden) field after the split is
  // turned off, as it did on the old site.
  const acRate = B ? B.effRate : s.tradBal !== "" ? advancedPlan({ ...typed, acOn: true }, profile).B!.effRate : null;

  // The target beside the answer, with the plan's verdict on it (the Coast
  // FIRE state below says the same in full).
  const target = parseNum(typed.target);
  const income = typed.solveFor === "After-Tax Withdrawal";
  const onTrack = C.state !== "never";
  const VerdictIcon = onTrack ? CircleCheckIcon : CircleXIcon;

  const toDrawdown = () => {
    sendToDrawdown({ initial: Math.round(R.fvReal) });
    router.push("/drawdown");
    toast("Portfolio set to " + money(R.fvReal) + ", your balance in today's dollars");
  };

  return (
    <div className="col-span-full grid grid-cols-1 items-start gap-5 max-sm:gap-3.5 lg:grid-cols-3">
      <div className="min-w-0 lg:col-span-1 lg:self-stretch">
        {/* Phones and narrow screens: the answer leads, and stays under the
            tab rail while the inputs are on screen. */}
        <PinnedReading main={{ label: "After-tax income, per year", value: money(R.afterTax) }} side={{ label: "Inflation adjusted", value: money(R.fvReal) }} />

        <aside id="asideSingle" className="max-lg:static max-lg:max-h-none max-lg:overflow-visible">
          <Card>
            <CardHeader>
              <CardTitle>Your plan</CardTitle>
              <CardDescription>Inflation, fees, taxes and account types, worked back from a target.</CardDescription>
            </CardHeader>
            <CardContent>
              <GroupHead first>Your savings</GroupHead>
              <div className="glidewrap acwrap mt-0" id="acWrap">
                <CheckToggle id="acToggle" on={acOn} onToggle={toggleAccounts} controls="acFields">Split by account type<TipDot k="accttypes" /></CheckToggle>
                <div className="acfields" id="acFields" hidden={!acOn}>
                  <AcHead note="pre-tax">Traditional 401(k) / IRA</AcHead>
                  <div className="two max-sm:grid-cols-2">{acMoney("tradBal", "Balance")}{acMoney("tradC", "You add", true)}</div>
                  <AcHead note="after-tax, grows tax-free">Roth 401(k) / IRA</AcHead>
                  <div className="two max-sm:grid-cols-2">{acMoney("rothBal", "Balance")}{acMoney("rothC", "You add", true)}</div>
                  <AcHead note="gains taxed when sold">Taxable brokerage</AcHead>
                  <div className="two max-sm:grid-cols-2">{acMoney("brokBal", "Balance")}{acMoney("brokC", "You add", true)}</div>
                  <MoneyField id="acBrokBasis" label={<Tipped text="Cost basis" k="acbasis" />} value={s.brokBasis} onValueChange={set("brokBasis")} />
                  <div className="mb-3.5 grid grid-cols-2 gap-x-2.5 border-t border-border pt-2.5" aria-live="polite">
                    <div className="actot"><span className="k">Total balance</span><span className="v" id="acTotBal">{a ? money(a.tradBal + a.rothBal + a.brokBal) : ""}</span></div>
                    <div className="actot"><span className="k">Total added</span><span className="v" id="acTotAdd">{a ? money(mine) + per : ""}</span>
                      <span className="actsub" id="acTotSub">{B?.match ? "+ " + money(B.match) + per + " match" : ""}</span></div>
                  </div>
                  <div className="two max-sm:grid-cols-2 border-t border-border pt-3.5" id="acSchedule">{acOn ? <>{periodField}{growthField}</> : null}</div>
                  <AcHead note="paid into traditional" rule>Employer match</AcHead>
                  <MoneyField id="acSalary" label="Your salary" unit="/yr" value={s.salary} onValueChange={set("salary")} />
                  <div className="two max-sm:grid-cols-2 bottomalign">
                    <NumberField id="acMatchPct" label="Match rate" unit="%" step={10} value={s.matchPct} onValueChange={set("matchPct")} />
                    <NumberField id="acMatchCap" label="On the first" unit="% of salary" value={s.matchCap} onValueChange={set("matchCap")} />
                  </div>
                  <AcHead rule>Taxes in retirement</AcHead>
                  <div className="two max-sm:grid-cols-2">
                    <SelectField id="acStatus" label="Filing status" value={s.acStatus} onChange={set("acStatus")}>
                      <option value="s">Single</option>
                      <option value="m">Married filing jointly</option>
                    </SelectField>
                    <SelectField id="acState" label="State" value={s.acState} onChange={set("acState")}>
                      {STATE_OPTIONS.map((o) => <option key={o.code} value={o.code}>{o.name}</option>)}
                    </SelectField>
                  </div>
                </div>
              </div>
              <MoneyField id="initial" wrapId="initialField" hidden={acOn} label="Starting value" value={s.initial} onValueChange={set("initial")} />
              <div className="two max-sm:grid-cols-2">
                <Field id="contrib" wrapId="contribField" hidden={acOn} label="Contribution">
                  <Affixed prefix="$"><MoneyInput id="contrib" value={s.contrib} onValueChange={set("contrib")} /></Affixed>
                </Field>
                {acOn ? null : periodField}
              </div>
              <div className="two bottomalign max-sm:grid-cols-2">
                {acOn ? null : growthField}
                <NumberField id="years" className={acOn ? "col-span-2" : undefined} label="Time period" unit="yrs" max={100} negative value={s.years} onValueChange={setTiming("years")} />
              </div>

              <GroupHead>Markets</GroupHead>
              <Field id="nominal" label={<Tipped text="Rate of return" k="nominalreturn" />}>
                <Affixed suffix="%"><SignFlip value={s.nominal} onFlip={set("nominal")} /><NumberInput id="nominal" value={s.nominal} onValueChange={set("nominal")} /></Affixed>
              </Field>
              <div className="glidewrap -mt-1" id="glideWrap">
                <CheckToggle id="glideToggle" on={s.glideOn} onToggle={toggleGlide}>Glide path<TipDot k="glide" /></CheckToggle>
                <div className="glidefields" id="glideFields" hidden={!s.glideOn}>
                  <div className="two max-sm:grid-cols-2">
                    <NumberField id="glideEnd" label="End at" unit="%" negative value={s.glideEnd} onValueChange={set("glideEnd")} />
                    <NumberField id="glideYears" label="Over final" unit="yrs" value={s.glideYears} onValueChange={setTiming("glideYears")} />
                  </div>
                  <div className="hint m-0" id="glideNote">{s.glideOn ? glideNote(parseNum(s.nominal) / 100, parseNum(s.glideEnd) / 100, parseNum(s.years), parseNum(s.glideYears) || 1) : ""}</div>
                </div>
              </div>
              <div className="two max-sm:grid-cols-2">
                <NumberField id="inflation" label={<Tipped text="Inflation" k="inflation" />} unit="%" value={s.inflation} onValueChange={set("inflation")} />
                <NumberField id="fees" label={<>Fees <span className="tipglue"><Badge variant="outline" className="ml-1.25">optional</Badge><TipDot k="fees" /></span></>} unit="%/yr" step={0.1} value={s.fees} onValueChange={set("fees")} />
              </div>
              <div className="derived mt-0 mb-1">
                <div><span>Return net of fees</span><span className="num" id="dNetRate">{pctStr(p.nominal, 2) + (p.fees > 0 ? "  (" + pctStr(p.gross, 2) + " − " + pctStr(p.fees, 2) + ")" : "")}</span></div>
                <div><span><Tipped text="Real rate of return" k="realreturn" /></span><span className="num" id="dRealRate">{pctStr(R.realReturn)}</span></div>
                <details className="calcdetails">
                  <summary>Calculation details</summary>
                  <div><span>Periods per year</span><span className="num" id="dPPY">{R.ppy}</span></div>
                  <div><span>Rate per period</span><span className="num" id="dPeriodic">{pctStr(R.periodicRate, 4)}</span></div>
                  <div><span>Periods modeled</span><span className="num" id="dPeriods">{R.periods.toLocaleString("en-US")}</span></div>
                </details>
              </div>

              <GroupHead>Your goal</GroupHead>
              <div className="two bottomalign">
                <SelectField id="solveFor" label="Solve for" value={s.solveFor} onChange={set("solveFor")}>
                  <option value="After-Tax Withdrawal">After-tax income</option>
                  <option value="Portfolio Value">Portfolio value</option>
                </SelectField>
                <Field id="target" label="Target, inflation adjusted">
                  <Affixed prefix="$"><MoneyInput id="target" value={s.target} onValueChange={set("target")} /></Affixed>
                </Field>
              </div>
              <div className="hint -mt-2 mb-3.5" id="targetHint">{s.solveFor === "After-Tax Withdrawal"
                ? "The after-tax income you want each year, in today's spending power."
                : "The portfolio balance you want, in today's spending power."}</div>
              <div className="two bottomalign max-sm:grid-cols-2">
                <NumberField id="withdrawal" label={<Tipped text="Withdrawal rate" k="withdrawal" />} unit="%" value={s.withdrawal} onValueChange={set("withdrawal")} />
                <NumberField id="taxrate" wrapId="taxrateField" hidden={acOn} label={<Tipped text="Effective tax rate" k="efftaxrate" />} unit="%" value={s.taxRate} onValueChange={set("taxRate")} />
                <div className="field" id="acTaxField" hidden={!acOn}>
                  <Label className="mb-1.5"><span><Tipped text="Tax on withdrawals" k="actax" /></span></Label>
                  <Affixed suffix="calc">
                    <InputGroupInput variant="numeric" id="acTaxOut" type="text" readOnly tabIndex={-1} aria-label="Tax on withdrawals, calculated" value={acRate != null ? pctStr(acRate, 1) : ""} /></Affixed>
                </div>
              </div>
              <p className="mt-0.5 mb-0 flex items-center gap-1.5 text-label text-muted-foreground">
                <LockIcon className="size-3.5 shrink-0" aria-hidden="true" />Nothing leaves your browser.</p>
            </CardContent>
          </Card>
        </aside>
      </div>

      <div className="stack min-w-0 lg:col-span-2" role="tabpanel" aria-labelledby="tabbtn-calc" id="tab-single">
        <ProjectionReading p="r" R={R} lastPeriod={p.period} fvNote={"After " + p.years + " years at " + pctStr(p.nominal, 2)}
          realNote={"Inflation of " + pctStr(p.inflation, 2) + " over " + R.inflYears + " years"}>
          {target > 0 ? (
            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5 text-note">
              <span className="text-muted-foreground">Your target</span>
              <span className="font-medium whitespace-nowrap tabular-nums">{money(target) + (income ? " a year, after tax" : " portfolio, in today's dollars")}</span>
              <Badge variant={onTrack ? "positive" : "destructive"}><VerdictIcon aria-hidden="true" />{C.state === "already" ? "Already there" : onTrack ? "On track" : "Not on track"}</Badge>
            </div>
          ) : null}
        </ProjectionReading>

        <Card id="acPanel" hidden={!acOn}>
          {B ? <AccountTable id="acResults" B={B} years={p.years} /> : null}
        </Card>

        <Card>
          <CardHeader><CardTitle>Reach your target</CardTitle>
            <CardDescription>Two ways to get there: change what you put in, or how long you save.</CardDescription></CardHeader>
          <div className="grid grid-cols-1 border-t border-border sm:grid-cols-2">
            <SolveOption label="Change your contribution" id="sPerPeriod" value={money(S.perPeriod, 2)} noteId="sPerPeriodNote"
              note={"Paid " + p.period.toLowerCase() + " for " + fmtYears(p.years) + ", growing " + pctStr(p.growth, 1) + " a year"}>
              <KV k="Per year" id="sPerYear" v={money(S.perYear)} />
              <KV k="Change from current" id="sChange" v={(S.change >= 0 ? "+" : "") + money(S.change, 2)} />
              <Button variant="outline" className="mt-3.5 self-start max-sm:self-stretch" id="btnApply" onClick={applyContribution}>Use this contribution</Button>
            </SolveOption>
            <SolveOption label="Change your timeline" id="sYears" value={Y.reached ? fmtYears(Y.years) : "Out of reach"} noteId="sYearsNote" className="max-sm:border-t sm:border-l"
              note={Y.reached
                ? "Keeping " + money(p.contrib, 2) + " " + p.period.toLowerCase() + ", growing " + pctStr(p.growth, 1) + " a year"
                : "Not reached within 100 years at " + money(p.contrib, 2) + " " + p.period.toLowerCase() + "."}>
              <KV k="Your plan now" id="sYearsNow" v={fmtYears(p.years)} />
              <YearsDiff Y={Y} years={p.years} />
              <Button variant="outline" className="mt-3.5 self-start max-sm:self-stretch" id="btnApplyYears" disabled={!Y.reached} onClick={applyYears}>Use this timeline</Button>
            </SolveOption>
          </div>
          <div className="-mb-1 border-t border-border px-4.5 pt-1 max-sm:px-3.5">
            <div className="flex flex-col gap-x-5 sm:flex-row sm:items-center">
              <div className="kv min-w-0 flex-1 border-b-0">
                <span className="k text-foreground"><Tipped text="Coast FIRE" k="coast" /><span className="mssub" id="sCoastNote">{
                  C.state === "already" ? "Your starting value alone reaches the target by year " + fmtNum(p.years) + "."
                    : C.state === "reachable" ? "Stop contributing then and growth alone still reaches " + money(S.portToday) + " by year " + fmtNum(p.years) + "."
                      : "This plan doesn't reach the target by year " + fmtNum(p.years) + ", so there's nothing to coast on yet."}</span></span>
                <span className={cn("v inline-flex items-center gap-1.5 self-center font-semibold", onTrack && "pos")} id="sCoast">
                  <VerdictIcon className="size-4" aria-hidden="true" />{C.state === "already" ? "Already there" : C.state === "reachable" ? fmtYears(C.years) : "Not on track"}</span>
              </div>
              <div id="sCoastAction" className="empty:hidden max-sm:mb-1">{C.state === "reachable"
                ? <Button variant="outline" className="w-full sm:w-auto" id="btnCoast" onClick={() => handToStages(true)}>Model this as a staged plan</Button> : null}</div>
            </div>
            <div className="grid2 mt-1 border-t border-border pt-1">
              <div>
                <KV k="Portfolio needed, inflation adjusted" id="sPortToday" v={money(S.portToday)} />
                <KV k="That pays, after tax" id="sPays" v={money(S.pays) + " per year"} />
              </div>
              <div>
                <KV k="Portfolio needed at retirement" id="sPortFuture" v={money(S.portFuture)} />
                <KV k="Your starting value grows to" id="sInitGrows" v={money(S.initGrows)} />
              </div>
            </div>
          </div>
        </Card>

        <ProjectionChart sfx="" segId="segSingle" ariaLabel="Projected inflation-adjusted balance at three rates of return"
          mode={mode} setMode={setMode} band={band} setBand={setBand}
          histMix={s.histMix} setHistMix={set("histMix")} histMixEnd={s.histMixEnd} setHistMixEnd={set("histMixEnd")} glides={p.glide.on}
          mcFields={<Field id="volatility" label={<Tipped text="Volatility" k="volatility" />}><Affixed suffix="%/yr" className="w-26"><NumberInput id="volatility" nonNeg value={s.vol} onValueChange={set("vol")} /></Affixed></Field>}
          mcHint="Each redraw runs 5,000 simulations."
          chart={chart} maxX={p.years} bandItems={bandLegend(p.nominal, parseNum(band) / 100)}
          tipHead={(b) => <b>Year {fmtNum(b.year)}</b>} target={S.portToday} targetLabel={TARGET_LABEL} />

        <div className="grid min-w-0 grid-cols-1 items-start gap-5 max-sm:gap-3.5 wide:grid-cols-2">
          <Card>
            <CardHeader><CardTitle>Milestones</CardTitle></CardHeader>
            <CardContent id="msBody"><Milestones rows={R.years} infl={p.inflation} feeCost={V.feeCost} horizon={p.years} /></CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Take it further</CardTitle></CardHeader>
            <CardContent>
              <p className="hint mt-0">See how long this balance lasts once you start
                drawing on it. This carries your inflation-adjusted balance into the
                Drawdown Simulator.</p>
              <Button variant="outline" id="toDrawdown" onClick={toDrawdown}>Test withdrawals</Button>
              <p className="hint mt-5 border-t border-border pt-3.5">The Stages tab lets you change your
                contribution, return, or timeline partway through the plan. This will carry
                your current numbers over as the first stage, then add a second stage with
                the same numbers running 10 years longer.</p>
              <Button variant="outline" id="btnToStages" onClick={() => handToStages(false)}>Model these numbers in Stages</Button>
            </CardContent>
          </Card>
        </div>

        <Collapsible className="min-w-0" render={<Card />}>
          <CardHeader>
            <CardTitle><CollapsibleTrigger>Year by year<ChevronDownIcon aria-hidden="true" /></CollapsibleTrigger></CardTitle>
            <CardAction><CsvButton table={tableRef} label="Year by year" /></CardAction>
          </CardHeader>
          <CollapsibleContent keepMounted>
            <div className="swipehint">Swipe the table sideways to see every column.</div>
            <div className="scroll">
              <table id="yearTable" ref={tableRef}>
                <thead><tr><th>Year</th><th>Start balance</th><th>Contributions</th><th>Growth</th><th>End balance</th><th>Inflation adj.</th></tr></thead>
                <tbody>
                  {R.years.map((y) => (
                    <tr key={y.year}><td>{y.year}</td><td>{money(y.start)}</td><td>{money(y.contrib)}</td><td className="pos">{money(y.growth)}</td>
                      <td>{money(y.end)}</td><td>{money(y.end / Math.pow(1 + p.inflation, y.year))}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CollapsibleContent>
        </Collapsible>
      </div>

      {dialog === "conv" ? (
        <ConverterDialog title="Contribution converter" onClose={() => setDialog(null)} period={s.period}
          amount={a ? mine + matchPer(a, PER_YEAR[s.period]) : parseNum(s.contrib)}
          apply={(v, period) => setState((c) => withTotal({ ...c, period }, v))} />
      ) : null}
      {growthDialog}
    </div>
  );
}

/** A heading over one group of the inputs, on a rule after the first. */
function GroupHead({ first, children }: { first?: boolean; children: React.ReactNode }) {
  return <h3 className={cn("m-0 mb-3 text-sm font-semibold", !first && "mt-1 border-t border-border pt-4")}>{children}</h3>;
}

/** An account's heading inside the split: its name at Title size, what kind
    of account it is in Label/Muted after it. */
function AcHead({ note, rule, children }: { note?: string; rule?: boolean; children: React.ReactNode }) {
  return (
    <div className={cn("mb-2 text-sm font-semibold", rule && "mt-1 border-t border-border pt-3.5")}>
      {children}{note ? <span className="ml-1.5 text-label font-normal text-muted-foreground">{note}</span> : null}
    </div>
  );
}

function YearsDiff({ Y, years }: { Y: { reached: boolean; years: number }; years: number }) {
  if (!Y.reached) return <KV k="Difference" id="sYearsDiff" cls="" v={DASH} />;
  const d = Y.years - years;
  return (
    <KV k="Difference" id="sYearsDiff"
      v={Math.abs(d) < 0.005 ? "on track" : (d > 0 ? "+" : "−") + fmtYears(Math.abs(d))} />
  );
}


function bandLegend(nominal: number, band: number): [string, string][] {
  const lbl = bandLabel(band);
  return [
    [SERIES.teal, band > 0 ? "At " + pctStr(nominal + band, 2) + " (+" + lbl + "%)" : "Higher"],
    [SERIES.plan, "At " + pctStr(nominal, 2) + " (your rate)"],
    [SERIES.rose, band > 0 ? "At " + pctStr(Math.max(-0.99, nominal - band), 2) + " (−" + lbl + "%)" : "Lower"],
  ];
}

/* ---- the numbers ---- */

/** What the chart draws in each mode. */
function chartData(s: AdvancedInputs, V: ReturnType<typeof advancedCompute>, mode: ChartMode, band: number, seed: number): ChartData {
  const { p, R } = V;
  if (!R.years.length) return emptyChart();
  const real = (v: number, yr: number) => v / Math.pow(1 + p.inflation, yr);
  const start = { year: 0, base: p.initial, hi: p.initial, lo: p.initial, p25: p.initial, p75: p.initial };
  if (mode === "hist") {
    return histChart(start, historicalRuns({ initial: p.initial, fees: p.fees }, [{
      years: p.years, contrib: p.contrib, period: p.period, growth: p.growth, nominal: p.nominal, mix: fraction(s.histMix),
      glide: p.glide.on ? { on: true, years: p.glide.years, endMix: fraction(s.histMixEnd) } : { on: false },
    }]));
  }
  if (mode === "mc") {
    const mc = monteCarlo({ initial: p.initial, inflation: p.inflation },
      [{ years: p.years, contrib: p.contrib, period: p.period, growth: p.growth, nominal: p.nominal, vol: p.vol }], MC_RUNS, seed);
    const pts = fanPoints({ ...start, det: p.initial }, mc.bands, (b, i) => ({ det: R.years[i] ? real(R.years[i].end, R.years[i].year) : b.p50 }));
    return { ...emptyChart(true), pts, legend: "mc", mc };
  }
  const hiR = project({ ...p, nominal: p.nominal + band });
  const loR = project({ ...p, nominal: Math.max(-0.99, p.nominal - band) });
  const pts = [{ year: 0, base: p.initial, hi: p.initial, lo: p.initial }, ...R.years.map((y, i) => ({
    year: y.year, base: real(y.end, y.year),
    hi: real(hiR.years[i] ? hiR.years[i].end : y.end, y.year),
    lo: real(loR.years[i] ? loR.years[i].end : y.end, y.year),
  }))];
  return { ...emptyChart(), pts, legend: "band" };
}
