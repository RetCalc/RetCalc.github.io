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
import { ProjectionChart, ProjectionSummary, bandLabel, emptyChart, fanPoints, histChart, type ChartData, type ChartMode } from "@/components/tools/Projection";
import { toolInputs, useToolState } from "@/components/tools/ToolState";
import { BigValue } from "@/components/common/BigValue";
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
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

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
      <Label className="mb-1.5" htmlFor="period"><span>Contribution period</span></Label>
      <select id="period" value={s.period} onChange={(e) => set("period")(e.target.value)}><PeriodOptions /></select>
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

  return (
    <>
      <aside id="asideSingle">
        <Card>
          <CardHeader><CardTitle>Your inputs</CardTitle></CardHeader>
          <CardContent>
            <div className="glidewrap acwrap" id="acWrap">
              <CheckToggle id="acToggle" on={acOn} onToggle={toggleAccounts} controls="acFields">Split by account type<TipDot k="accttypes" /></CheckToggle>
              <div className="acfields" id="acFields" hidden={!acOn}>
                <div className="acgroup">Traditional 401(k) / IRA <span>pre-tax</span></div>
                <div className="two">{acMoney("tradBal", "Balance")}{acMoney("tradC", "You add", true)}</div>
                <div className="acgroup">Roth 401(k) / IRA <span>after-tax, grows tax-free</span></div>
                <div className="two">{acMoney("rothBal", "Balance")}{acMoney("rothC", "You add", true)}</div>
                <div className="acgroup">Taxable brokerage <span>gains taxed when sold</span></div>
                <div className="two">{acMoney("brokBal", "Balance")}{acMoney("brokC", "You add", true)}</div>
                <div className="two actotals" aria-live="polite">
                  <div className="actot"><span className="k">Total balance</span><span className="v" id="acTotBal">{a ? money(a.tradBal + a.rothBal + a.brokBal) : ""}</span></div>
                  <div className="actot"><span className="k">Total added</span><span className="v" id="acTotAdd">{a ? money(mine) + per : ""}</span>
                    <span className="actsub" id="acTotSub">{B?.match ? "+ " + money(B.match) + per + " match" : ""}</span></div>
                </div>
                <MoneyField id="acBrokBasis" label={<Tipped text="Cost basis" k="acbasis" />} value={s.brokBasis} onValueChange={set("brokBasis")} />
                <div className="acsep"></div>
                <div className="two" id="acSchedule">{acOn ? <>{periodField}{growthField}</> : null}</div>
                <div className="acsep"></div>
                <div className="acgroup">Employer match <span>paid into traditional</span></div>
                <MoneyField id="acSalary" label="Your salary" unit="/yr" value={s.salary} onValueChange={set("salary")} />
                <div className="two bottomalign">
                  <NumberField id="acMatchPct" label="Match rate" unit="%" step={10} value={s.matchPct} onValueChange={set("matchPct")} />
                  <NumberField id="acMatchCap" label="On the first" unit="% of salary" value={s.matchCap} onValueChange={set("matchCap")} />
                </div>
                <div className="acsep"></div>
                <div className="acgroup">Taxes in retirement</div>
                <div className="two">
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
            <Field id="contrib" wrapId="contribField" hidden={acOn} label="Contribution each period">
              <Affixed prefix="$"><MoneyInput id="contrib" value={s.contrib} onValueChange={set("contrib")} /></Affixed>
            </Field>
            {acOn ? null : periodField}
            <div className="two">
              {acOn ? null : growthField}
              <NumberField id="years" label="Time period" unit="yrs" max={100} negative value={s.years} onValueChange={setTiming("years")} />
            </div>
            <div className="two">
              <Field id="nominal" label={<Tipped text="Rate of return" k="nominalreturn" />}>
                <Affixed suffix="%"><SignFlip value={s.nominal} onFlip={set("nominal")} /><NumberInput id="nominal" value={s.nominal} onValueChange={set("nominal")} /></Affixed>
              </Field>
              <NumberField id="inflation" label={<Tipped text="Inflation" k="inflation" />} unit="%" value={s.inflation} onValueChange={set("inflation")} />
            </div>
            <div className="glidewrap" id="glideWrap">
              <CheckToggle id="glideToggle" on={s.glideOn} onToggle={toggleGlide}>Glide path<TipDot k="glide" /></CheckToggle>
              <div className="glidefields" id="glideFields" hidden={!s.glideOn}>
                <div className="two">
                  <NumberField id="glideEnd" label="End at" unit="%" negative value={s.glideEnd} onValueChange={set("glideEnd")} />
                  <NumberField id="glideYears" label="Over final" unit="yrs" value={s.glideYears} onValueChange={setTiming("glideYears")} />
                </div>
                <div className="hint m-0" id="glideNote">{s.glideOn ? glideNote(parseNum(s.nominal) / 100, parseNum(s.glideEnd) / 100, parseNum(s.years), parseNum(s.glideYears) || 1) : ""}</div>
              </div>
            </div>
            <NumberField id="fees" label={<>Fees <span className="tipglue"><Badge variant="outline" className="ml-1.25">optional</Badge><TipDot k="fees" /></span></>} unit="%/yr" step={0.1} value={s.fees} onValueChange={set("fees")} />
            <div className="two">
              <div className="field">
                <Label className="mb-1.5" htmlFor="withdrawal"><span><Tipped text="Withdrawal rate" k="withdrawal" /></span></Label>
                <Affixed suffix="%"><NumberInput id="withdrawal" nonNeg value={s.withdrawal} onValueChange={set("withdrawal")} /></Affixed>
                <Button variant="outline" size="sm" className="mt-1.5" id="toDrawdown" onClick={() => {
                  sendToDrawdown({ initial: Math.round(R.fvReal) });
                  router.push("/drawdown");
                  toast("Portfolio set to " + money(R.fvReal) + ", your balance in today's dollars");
                }}>Test withdrawals</Button>
              </div>
              <NumberField id="taxrate" wrapId="taxrateField" hidden={acOn} label={<Tipped text="Effective tax rate" k="efftaxrate" />} unit="%" value={s.taxRate} onValueChange={set("taxRate")} />
              <div className="field" id="acTaxField" hidden={!acOn}>
                <Label className="mb-1.5"><span><Tipped text="Tax on withdrawals" k="actax" /></span></Label>
                <Affixed suffix="calc">
                  <InputGroupInput variant="numeric" id="acTaxOut" type="text" readOnly tabIndex={-1} aria-label="Tax on withdrawals, calculated" value={acRate != null ? pctStr(acRate, 1) : ""} /></Affixed>
              </div>
            </div>
            <div className="derived">
              <div><span>Return net of fees</span><span className="num" id="dNetRate">{pctStr(p.nominal, 2) + (p.fees > 0 ? "  (" + pctStr(p.gross, 2) + " − " + pctStr(p.fees, 2) + ")" : "")}</span></div>
              <div><span><Tipped text="Real rate of return" k="realreturn" /></span><span className="num" id="dRealRate">{pctStr(R.realReturn)}</span></div>
              <details className="calcdetails">
                <summary>Calculation details</summary>
                <div><span>Periods per year</span><span className="num" id="dPPY">{R.ppy}</span></div>
                <div><span>Rate per period</span><span className="num" id="dPeriodic">{pctStr(R.periodicRate, 4)}</span></div>
                <div><span>Periods modeled</span><span className="num" id="dPeriods">{R.periods.toLocaleString("en-US")}</span></div>
              </details>
            </div>
          </CardContent>
        </Card>
      </aside>

      <div className="stack" role="tabpanel" aria-labelledby="tabbtn-calc" id="tab-single">
        <ProjectionSummary p="r" R={R} lastPeriod={p.period} fvNote={"After " + p.years + " years at " + pctStr(p.nominal, 2)}
          realNote={"Inflation of " + pctStr(p.inflation, 2) + " over " + R.inflYears + " years"} />

        <Card id="acPanel" hidden={!acOn}>
          {B ? <AccountTable id="acResults" B={B} years={p.years} /> : null}
        </Card>

        <Card>
          <CardHeader><CardTitle>Work backwards from a target</CardTitle></CardHeader>
          <CardContent>
            <div className="grid2" id="solveGrid">
              <div>
                <SelectField id="solveFor" label="Solve for" value={s.solveFor} onChange={set("solveFor")}>
                  <option value="After-Tax Withdrawal">After-tax income</option>
                  <option value="Portfolio Value">Portfolio value</option>
                </SelectField>
                <Field id="target" label="Target, inflation adjusted">
                  <Affixed prefix="$"><MoneyInput id="target" value={s.target} onValueChange={set("target")} /></Affixed>
                  <div className="hint" id="targetHint">{s.solveFor === "After-Tax Withdrawal"
                    ? "The after-tax income you want each year, in today's spending power."
                    : "The portfolio balance you want, in today's spending power."}</div>
                </Field>
              </div>
              <div>
                <KV k="Portfolio needed, inflation adjusted" id="sPortToday" v={money(S.portToday)} />
                <KV k="That pays, after tax" id="sPays" v={money(S.pays) + " per year"} />
                <KV k="Portfolio needed at retirement" id="sPortFuture" v={money(S.portFuture)} />
                <KV k="Your starting value grows to" id="sInitGrows" v={money(S.initGrows)} />
              </div>
            </div>
            <div className="solvecoast">
              <div className="kv coastrow">
                <span className="k"><Tipped text="Coast FIRE" k="coast" /><span className="mssub" id="sCoastNote">{
                  C.state === "already" ? "Your starting value alone reaches the target by year " + fmtNum(p.years) + "."
                    : C.state === "reachable" ? "Stop contributing then and growth alone still reaches " + money(S.portToday) + " by year " + fmtNum(p.years) + "."
                      : "This plan doesn't reach the target by year " + fmtNum(p.years) + ", so there's nothing to coast on yet."}</span></span>
                <span className={C.state === "never" ? "v" : "v pos"} id="sCoast">{C.state === "already" ? "Already there" : C.state === "reachable" ? fmtYears(C.years) : "Not on track"}</span>
              </div>
              <div id="sCoastAction">{C.state === "reachable"
                ? <Button variant="outline" className="w-full sm:w-auto" id="btnCoast" onClick={() => handToStages(true)}>Model this as a staged plan</Button> : null}</div>
            </div>
          </CardContent>
          <div className="solveopts">
            <div className="solveopt">
              <div className="optlabel">Option 1 &middot; Change your contribution</div>
              <BigValue className="v gold" id="sPerPeriod" text={money(S.perPeriod, 2)} />
              <div className="note" id="sPerPeriodNote">{"Paid " + p.period.toLowerCase() + " for " + fmtYears(p.years) + ", growing " + pctStr(p.growth, 1) + " a year"}</div>
              <KV k="Per year" id="sPerYear" v={money(S.perYear)} />
              <KV k="Change from current" id="sChange" cls={S.change > 0 ? "neg" : "pos"} v={(S.change >= 0 ? "+" : "") + money(S.change, 2)} />
              <Button variant="outline" className="mt-3.5 self-start max-sm:self-stretch" id="btnApply" onClick={applyContribution}>Use this contribution</Button>
            </div>
            <div className="solveopt">
              <div className="optlabel">Option 2 &middot; Change your timeline</div>
              <BigValue className="v gold" id="sYears" text={Y.reached ? fmtYears(Y.years) : "Out of reach"} />
              <div className="note" id="sYearsNote">{Y.reached
                ? "Keeping " + money(p.contrib, 2) + " " + p.period.toLowerCase() + ", growing " + pctStr(p.growth, 1) + " a year"
                : "Not reached within 100 years at " + money(p.contrib, 2) + " " + p.period.toLowerCase() + "."}</div>
              <KV k="Your plan now" id="sYearsNow" v={fmtYears(p.years)} />
              <YearsDiff Y={Y} years={p.years} />
              <Button variant="outline" className="mt-3.5 self-start max-sm:self-stretch" id="btnApplyYears" disabled={!Y.reached} onClick={applyYears}>Use this timeline</Button>
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

        <Card>
          <CardHeader><CardTitle>Year by year</CardTitle><CardAction><CsvButton table={tableRef} label="Year by year" /></CardAction></CardHeader>
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
        </Card>

        <Card>
          <CardHeader><CardTitle>Milestones</CardTitle></CardHeader>
          <CardContent id="msBody"><Milestones rows={R.years} infl={p.inflation} feeCost={V.feeCost} horizon={p.years} /></CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Want to model this in stages?</CardTitle></CardHeader>
          <CardContent>
            <p className="hint mt-0">The Stages tab lets you change your
              contribution, return, or timeline partway through the plan. This will carry
              your current numbers over as the first stage, then add a second stage with
              the same numbers running 10 years longer.</p>
            <Button id="btnToStages" onClick={() => handToStages(false)}>Model these numbers in Stages</Button>
          </CardContent>
        </Card>
      </div>

      {dialog === "conv" ? (
        <ConverterDialog title="Contribution converter" onClose={() => setDialog(null)} period={s.period}
          amount={a ? mine + matchPer(a, PER_YEAR[s.period]) : parseNum(s.contrib)}
          apply={(v, period) => setState((c) => withTotal({ ...c, period }, v))} />
      ) : null}
      {growthDialog}
    </>
  );
}

function YearsDiff({ Y, years }: { Y: { reached: boolean; years: number }; years: number }) {
  if (!Y.reached) return <KV k="Difference" id="sYearsDiff" cls="" v={DASH} />;
  const d = Y.years - years;
  return (
    <KV k="Difference" id="sYearsDiff" cls={d > 0.005 ? "neg" : d < -0.005 ? "pos" : ""}
      v={Math.abs(d) < 0.005 ? "on track" : (d > 0 ? "+" : "−") + fmtYears(Math.abs(d))} />
  );
}


function bandLegend(nominal: number, band: number): [string, string][] {
  const lbl = bandLabel(band);
  return [
    ["#4fbf95", band > 0 ? "At " + pctStr(nominal + band, 2) + " (+" + lbl + "%)" : "Higher"],
    ["#e9b872", "At " + pctStr(nominal, 2) + " (your rate)"],
    ["#e2795f", band > 0 ? "At " + pctStr(Math.max(-0.99, nominal - band), 2) + " (−" + lbl + "%)" : "Lower"],
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
