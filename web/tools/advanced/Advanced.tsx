"use client";

/* The Advanced calculator: one plan with inflation, fees, taxes, a glide
   path and account types, worked backwards from a target, and charted
   against a rate band, market history or Monte Carlo runs. Ported from
   src/js/app/01-inputs.js, 02-accounts-advanced.js, 03-projection.js,
   04-charts.js, 06-solve.js and 07-converter.js, and the Advanced parts of
   src/main/02-calculator-inputs.html and 03-calculator-results.html. */

import { useDeferredValue, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { BandChart, type BandPoint } from "@/components/charts/BandChart";
import { HistBarNote, HistSummary, McSummary } from "@/components/charts/HistNotes";
import { HistLegend, Legend, McLegend } from "@/components/charts/Legend";
import { BandTipRows, FanTipRows } from "@/components/charts/TipRows";
import { CheckToggle, SignFlip } from "@/components/fields/CheckToggle";
import { Affixed, Field, MoneyField, NumberField, SelectField } from "@/components/fields/Field";
import { MoneyInput, NumberInput } from "@/components/fields/NumberInput";
import { useHousehold, useHouseholdFill } from "@/components/household/HouseholdProvider";
import { useToast } from "@/components/shell/Toast";
import { TipDot, Tipped } from "@/components/shell/Tooltips";
import { AccountTable } from "@/components/tools/AccountTable";
import { ConverterDialog, GrowthRatesDialog } from "@/components/tools/ContribDialogs";
import { setToolInputs, toolInputs, useToolState } from "@/components/tools/ToolState";
import { BigValue } from "@/components/ui/BigValue";
import { CsvButton } from "@/components/ui/CsvButton";
import { Milestones } from "@/components/ui/Milestones";
import { Figure, KV, Segmented } from "@/components/ui/Readout";
import { growthBlend, matchPer, spreadTotal, type GrowthRates } from "@/lib/accounts";
import { PPY, coastFire, goalSolve, historicalRuns, monteCarlo, project, solveYears } from "@/lib/engine/typed";
import { DASH, fmtNum, fmtYears, groupDigits, money, parseNum, pctStr } from "@/lib/format";
import { MC_RUNS, reroll, useMcSeed } from "@/lib/mc-seed";
import { PERIOD_ADV, PERIOD_SHORT, PeriodOptions } from "@/lib/periods";
import { STATE_OPTIONS } from "@/lib/states";
import { TAX_DEFAULTS } from "@/tools/tax/model";
import { ADVANCED_DEF, advancedPlan, glideYearsFor, solvePlan, type AdvancedInputs, type AdvancedPlan } from "./model";
import { toStages } from "./toStages";

type Mode = "band" | "hist" | "mc";
const perYear = PPY as Record<string, number>;
const g = (v: number) => groupDigits(Math.round(v), true);
const TARGET_LABEL = "(the portfolio behind your target above)";

export function Advanced() {
  const { state: s, set, setState } = useToolState(ADVANCED_DEF);
  const { profile } = useHousehold();
  const router = useRouter();
  const toast = useToast();
  const seed = useMcSeed();
  const [mode, setMode] = useState<Mode>("band");
  const [band, setBand] = useState("2");
  const [tracesOn, setTracesOn] = useState(true);
  const [dialog, setDialog] = useState<"conv" | "growth" | null>(null);
  const tableRef = useRef<HTMLTableElement>(null);

  useHouseholdFill("advanced", (h) => setState((c) => {
    const has = (v: number | null) => v != null && isFinite(v);
    const m = (v: number) => g(v);
    const age = has(h.age) && h.age! > 0 && h.age! < 120 ? Math.round(h.age!) : null;
    const retire = has(h.retire) && h.retire! > 0 && h.retire! < 120 ? Math.round(h.retire!) : null;
    const yrs = age && retire && retire > age ? Math.min(100, retire - age) : null;
    const next = { ...c };
    if (yrs) next.years = String(yrs);
    if (c.acOn) {
      // the split is the tool's own; only the facts about you carry in
      if (has(h.income)) next.salary = m(h.income!);
      next.acStatus = h.status === "m" ? "m" : "s";
      if (h.state) next.acState = h.state;
    } else {
      if (has(h.saved)) next.initial = m(h.saved!);
      if (has(h.monthly)) Object.assign(next, { contrib: m(h.monthly!), period: "Monthly" });
    }
    if (h.spend != null && h.spend > 0) Object.assign(next, { solveFor: "After-Tax Withdrawal", target: m(h.spend) });
    if (next.glideOn) next.glideYears = glideYearsFor(next.years, next.glideYears);
    return next;
  }));

  /* The glide can't run longer than the plan; its field follows the years. */
  const setTiming = (k: "years" | "glideYears") => (v: string) => setState((c) => {
    const next = { ...c, [k]: v };
    return next.glideOn ? { ...next, glideYears: glideYearsFor(next.years, next.glideYears) } : next;
  });

  const typed = useDeferredValue(s);
  const V = useMemo(() => compute(typed, profile), [typed, profile]);
  const { P, p, R, S, C, Y } = V;
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
          ...c, acOn: true, tradBal: g(parseNum(c.initial)), tradC: g(parseNum(c.contrib)), rothBal: "0", rothC: "0", brokBal: "0", brokC: "0",
          brokBasis: "", salary: g(H?.income || 0), matchPct: "0", matchCap: "6",
          acStatus: H?.status || tax.status, acState: H?.state || tax.state, gRates: null,
        }));
      } else setState((c) => ({ ...c, acOn: true }));
      toast("Tax is now worked out from each account type");
    } else {
      // Carry the totals and the rate it worked out back into the single
      // fields, so the answer doesn't jump when you switch back.
      const now = advancedPlan(s, profile).p;
      setState((c) => ({
        ...c, acOn: false, initial: g(now.initial), contrib: g(now.contrib), taxRate: String(+(now.taxRate * 100).toFixed(2)),
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
    const t = spreadTotal(advancedPlan(c, profile).a!, perYear[c.period], total);
    return { ...c, tradC: g(t.trad), rothC: g(t.roth), brokC: g(t.brok) };
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
    const now = compute(s, profile);
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
      <label htmlFor="period">Contribution period</label>
      <select id="period" value={s.period} onChange={(e) => set("period")(e.target.value)}><PeriodOptions /></select>
      <button type="button" className="linkbtn" id="convOpen" onClick={() => setDialog("conv")}>
        <svg viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M3 5.5h9.5M10 3l2.5 2.5L10 8M13 10.5H3.5M6 8l-2.5 2.5L6 13" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" /></svg>
        Convert frequency
      </button>
    </div>
  );
  const growthField = (
    <div className="field" id="growthField">
      <label htmlFor="growth"><Tipped text="Contribution growth" k="contribgrowth" /></label>
      <Affixed suffix="%/yr">
        <NumberInput id="growth" value={blended ? String(+(p.growth * 100).toFixed(2)) : s.growth} onValueChange={set("growth")}
          readOnly={blended} className={blended ? "blended" : undefined} title={blended ? "Blended from your per-account rates. Click to edit." : ""}
          onClick={() => blended && setDialog("growth")} />
      </Affixed>
      <button type="button" className="linkbtn" id="acGrowthBtn" hidden={!acOn} onClick={() => setDialog("growth")}>{blended ? "Edit rates by account" : "Set by account"}</button>
    </div>
  );
  const acMoney = (id: "tradBal" | "tradC" | "rothBal" | "rothC" | "brokBal" | "brokC", label: string, contrib?: boolean) => (
    <div className="field">
      <label htmlFor={"ac" + id[0].toUpperCase() + id.slice(1)}>{label}</label>
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
        <div className="panel inputs">
          <h2>Your inputs</h2>
          <div className="body">
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
                <div className="hint" id="glideNote" style={{ margin: 0 }}>{s.glideOn ? glideNote(s) : ""}</div>
              </div>
            </div>
            <NumberField id="fees" label={<>Fees <span className="tipglue"><span className="opt">optional</span><TipDot k="fees" /></span></>} unit="%/yr" step={0.1} value={s.fees} onValueChange={set("fees")} />
            <div className="two">
              <div className="field">
                <label htmlFor="withdrawal"><Tipped text="Withdrawal rate" k="withdrawal" /></label>
                <Affixed suffix="%"><NumberInput id="withdrawal" nonNeg value={s.withdrawal} onValueChange={set("withdrawal")} /></Affixed>
                <button className="btn mini" type="button" id="toDrawdown" style={{ marginTop: "6px" }} onClick={() => {
                  setToolInputs("drawdown", { ...toolInputs("drawdown", {}), initial: g(R.fvReal) });
                  router.push("/drawdown");
                  toast("Portfolio set to " + money(R.fvReal) + ", your balance in today's dollars");
                }}>Test withdrawals</button>
              </div>
              <NumberField id="taxrate" wrapId="taxrateField" hidden={acOn} label={<Tipped text="Effective tax rate" k="efftaxrate" />} unit="%" value={s.taxRate} onValueChange={set("taxRate")} />
              <div className="field" id="acTaxField" hidden={!acOn}>
                <label><Tipped text="Tax on withdrawals" k="actax" /></label>
                <div className="inputwrap" style={{ boxShadow: "none", background: "transparent" }}>
                  <input id="acTaxOut" type="text" readOnly tabIndex={-1} aria-label="Tax on withdrawals, calculated" value={acRate != null ? pctStr(acRate, 1) : ""} /><span className="affix">calc</span>
                </div>
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
          </div>
        </div>
      </aside>

      <div className="stack" role="tabpanel" aria-labelledby="tabbtn-calc" id="tab-single">
        <div className="panel">
          <div className="headline">
            <Figure label="Future value" id="rFV" className="v" value={money(R.fv)} noteId="rFVnote" note={"After " + p.years + " years at " + pctStr(p.nominal, 2)} />
            <Figure label="Inflation adjusted" id="rFVreal" className="v" value={money(R.fvReal)} noteId="rFVrealnote" note={"Inflation of " + pctStr(p.inflation, 2) + " over " + R.inflYears + " years"} />
            <Figure label="After-tax income, per year" id="rMonthly" className="v gold" value={money(R.afterTax)} note="Inflation adjusted, first year of retirement" />
          </div>
          <div className="body">
            <div className="grid2">
              <div>
                <KV k="Amount invested" id="rInvested" v={money(R.invested)} />
                <KV k="Growth" cls="pos" id="rGrowth" v={money(R.growth)} />
                <KV k="Total contributions" id="rContribs" v={money(R.contribTotal)} />
                <KV k="Final contribution, inflation adjusted" id="rLastContrib" v={money(R.lastContribReal) + " " + PERIOD_ADV[p.period]} />
              </div>
              <div>
                <KV k="Annual withdrawal" id="rWd" v={money(R.wd)} />
                <KV k="Annual withdrawal, inflation adjusted" id="rWdReal" v={money(R.wdReal)} />
                <KV k="After tax, per year" id="rAfterTax" v={money(R.afterTax)} />
                <KV k="After tax, per month" id="rAfterTaxMo" v={money(R.afterTaxMo)} />
              </div>
            </div>
          </div>
        </div>

        <div className="panel" id="acPanel" hidden={!acOn}>
          {B ? <AccountTable id="acResults" B={B} years={p.years} /> : null}
        </div>

        <div className="panel">
          <h2>Work backwards from a target</h2>
          <div className="body">
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
              <div className="solvekv">
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
                ? <button className="btn primary" type="button" id="btnCoast" onClick={() => handToStages(true)}>Model this as a staged plan</button> : null}</div>
            </div>
          </div>
          <div className="solveopts">
            <div className="solveopt">
              <div className="optlabel">Option 1 &middot; Change your contribution</div>
              <BigValue className="v gold" id="sPerPeriod" text={money(S.perPeriod, 2)} />
              <div className="note" id="sPerPeriodNote">{"Paid " + p.period.toLowerCase() + " for " + fmtYears(p.years) + ", growing " + pctStr(p.growth, 1) + " a year"}</div>
              <KV k="Per year" id="sPerYear" v={money(S.perYear)} />
              <KV k="Change from current" id="sChange" cls={S.change > 0 ? "neg" : "pos"} v={(S.change >= 0 ? "+" : "") + money(S.change, 2)} />
              <button className="btn primary" id="btnApply" onClick={applyContribution}>Use this contribution</button>
            </div>
            <div className="solveopt">
              <div className="optlabel">Option 2 &middot; Change your timeline</div>
              <BigValue className="v gold" id="sYears" text={Y.reached ? fmtYears(Y.years) : "Out of reach"} />
              <div className="note" id="sYearsNote">{Y.reached
                ? "Keeping " + money(p.contrib, 2) + " " + p.period.toLowerCase() + ", growing " + pctStr(p.growth, 1) + " a year"
                : "Not reached within 100 years at " + money(p.contrib, 2) + " " + p.period.toLowerCase() + "."}</div>
              <KV k="Your plan now" id="sYearsNow" v={fmtYears(p.years)} />
              <YearsDiff Y={Y} years={p.years} />
              <button className="btn primary" id="btnApplyYears" disabled={!Y.reached} onClick={applyYears}>Use this timeline</button>
            </div>
          </div>
        </div>

        <div className="panel">
          <h2>Balance over time, inflation adjusted{"\n        "}
            <span className="h2ctrl">
              <Segmented id="segSingle" attr="data-mode" options={[["band", "Rate band"], ["hist", "Historical"], ["mc", "Monte Carlo"]] as const} value={mode} onChange={setMode} />{"\n          "}
              <span className="modeopt" id="optBand" hidden={mode !== "band"}>
                <Affixed prefix="±" suffix="%" style={{ width: "96px" }}>
                  <NumberInput id="band" nonNeg step={0.5} value={band} onValueChange={setBand} aria-label="Return comparison band, percent" />
                </Affixed>
              </span>
            </span>
          </h2>
          <div className="mcbar" id="histBar" hidden={mode !== "hist"}>
            <NumberField id="histMix" label={<Tipped text="Stock mix" k="histmix" />} unit="%" step={5} max={100} value={s.histMix} onValueChange={set("histMix")} />
            <NumberField id="histMixEnd" wrapId="histGlideWrap" hidden={!(p.glide.on)} label={<Tipped text="Glides to" k="histglidemix" />} unit="%" step={5} max={100} value={s.histMixEnd} onValueChange={set("histMixEnd")} />
            <div className="hint" id="histNote" style={{ margin: 0 }}>{chart.H ? <HistBarNote H={chart.H} /> : null}</div>
          </div>
          <div className="mcbar" id="mcBar" hidden={mode !== "mc"}>
            <NumberField id="volatility" label={<Tipped text="Volatility" k="volatility" />} unit="%/yr" value={s.vol} onValueChange={set("vol")} />
            <button className="btn" type="button" id="btnReroll" onClick={() => {
              reroll();
              toast("New set of runs");
            }}>Re-roll</button>
            <div className="hint" style={{ margin: 0 }}>Each redraw runs 5,000 simulations.</div>
          </div>
          <BandChart id="" pts={chart.pts} maxX={p.years} mode={chart.fan ? "mc" : "band"} enhanced ariaLabel="Projected inflation-adjusted balance at three rates of return"
            traces={chart.traces && tracesOn ? chart.traces : undefined}
            tip={(b: BandPoint) => <><b>Year {fmtNum(b.year)}</b>{chart.fan ? <FanTipRows b={b} /> : <BandTipRows b={b} />}</>} />
          {chart.legend === "hist" ? <HistLegend id="legend" tracesOn={tracesOn} onToggleTraces={() => setTracesOn((v) => !v)} />
            : chart.legend === "mc" ? <McLegend id="legend" />
              : <Legend id="legend" items={chart.legend === "band" ? bandLegend(p.nominal, parseNum(band) / 100) : []} />}
          {mode === "hist" ? <HistSummary id="mcNote" H={chart.H} target={chart.H?.count ? S.portToday : 0} label={TARGET_LABEL} />
            : mode === "mc" ? <McSummary id="mcNote" mc={chart.mc} target={S.portToday} label={TARGET_LABEL} />
              : <div className="mcnote" id="mcNote" hidden></div>}
        </div>

        <div className="panel">
          <h2>Year by year<span className="h2ctrl"><CsvButton table={tableRef} label="Year by year" /></span></h2>
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
        </div>

        <div className="panel">
          <h2>Milestones</h2>
          <div className="body" id="msBody"><Milestones rows={R.years} infl={p.inflation} feeCost={V.feeCost} horizon={p.years} /></div>
        </div>

        <div className="panel">
          <h2>Want to model this in stages?</h2>
          <div className="body">
            <p className="hint" style={{ marginTop: 0 }}>The Stages tab lets you change your
              contribution, return, or timeline partway through the plan. This will carry
              your current numbers over as the first stage, then add a second stage with
              the same numbers running 10 years longer.</p>
            <button className="btn primary" type="button" id="btnToStages" onClick={() => handToStages(false)}>Model these numbers in Stages</button>
          </div>
        </div>
      </div>

      {dialog === "conv" ? (
        <ConverterDialog title="Contribution converter" onClose={() => setDialog(null)} period={s.period}
          amount={a ? mine + matchPer(a, perYear[s.period]) : parseNum(s.contrib)}
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

function glideNote(s: AdvancedInputs): string {
  const total = Math.max(1, Math.round(parseNum(s.years)));
  const gy = Math.min(total, Math.max(1, Math.round(parseNum(s.glideYears)) || 1));
  const startYear = Math.max(1, total - gy + 1);
  return "Holds " + pctStr(parseNum(s.nominal) / 100, 1) + " through year " + (startYear - 1) +
    ", then eases down to " + pctStr(parseNum(s.glideEnd) / 100, 1) + " by year " + total + ".";
}

function bandLegend(nominal: number, band: number): [string, string][] {
  const lbl = (band * 100).toFixed(2).replace(/\.?0+$/, "");
  return [
    ["#4fbf95", band > 0 ? "At " + pctStr(nominal + band, 2) + " (+" + lbl + "%)" : "Higher"],
    ["#e9b872", "At " + pctStr(nominal, 2) + " (your rate)"],
    ["#e2795f", band > 0 ? "At " + pctStr(Math.max(-0.99, nominal - band), 2) + " (−" + lbl + "%)" : "Lower"],
  ];
}

/* ---- the numbers ---- */

function compute(s: AdvancedInputs, household: Parameters<typeof advancedPlan>[1]) {
  const P: AdvancedPlan = advancedPlan(s, household);
  const p = P.p;
  const R = project(p);
  const target = parseNum(s.target);
  const S = goalSolve(solvePlan(P, s.solveFor, target), s.solveFor, target);
  const C = coastFire(p, S.portFuture);
  const Y = solveYears(p, S.portToday);
  const feeCost = p.fees > 0 ? project({ ...p, nominal: p.gross }).fv - R.fv : 0;
  return { P, p, R, S, C, Y, feeCost };
}

/** What the chart draws in each mode. */
function chartData(s: AdvancedInputs, V: ReturnType<typeof compute>, mode: Mode, band: number, seed: number) {
  const { p, R } = V;
  const empty = { pts: [] as BandPoint[], fan: mode !== "band", legend: null as Mode | null, H: null as ReturnType<typeof historicalRuns> | null, mc: null as ReturnType<typeof monteCarlo> | null, traces: null as { xs: number[]; lines: (number | null)[][] } | null };
  if (!R.years.length) return { ...empty, fan: false };
  const real = (v: number, yr: number) => v / Math.pow(1 + p.inflation, yr);
  const start = { year: 0, base: p.initial, hi: p.initial, lo: p.initial, p25: p.initial, p75: p.initial };
  if (mode === "hist") {
    const clamp = (x: string) => Math.max(0, Math.min(1, parseNum(x) / 100));
    const H = historicalRuns({ initial: p.initial, fees: p.fees }, [{
      years: p.years, contrib: p.contrib, period: p.period, growth: p.growth, nominal: p.nominal, mix: clamp(s.histMix),
      glide: p.glide.on ? { on: true, years: p.glide.years, endMix: clamp(s.histMixEnd) } : { on: false },
    }]);
    if (!H.count) return { ...empty, H };
    const pts = [start, ...H.bands.map((b) => ({ year: b.year, base: b.p50, hi: b.p90, lo: b.p10, p25: b.p25, p75: b.p75 }))];
    return { ...empty, pts, legend: "hist" as Mode, H, traces: { xs: pts.map((a) => a.year), lines: (H.traces ?? []).map((t) => [p.initial, ...t]) } };
  }
  if (mode === "mc") {
    const mc = monteCarlo({ initial: p.initial, inflation: p.inflation },
      [{ years: p.years, contrib: p.contrib, period: p.period, growth: p.growth, nominal: p.nominal, vol: p.vol }], MC_RUNS, seed);
    const pts = [{ ...start, det: p.initial }, ...mc.bands.map((b, i) => ({
      year: b.year, base: b.p50, hi: b.p90, lo: b.p10, p25: b.p25, p75: b.p75,
      det: R.years[i] ? real(R.years[i].end, R.years[i].year) : b.p50,
    }))];
    return { ...empty, pts, legend: "mc" as Mode, mc };
  }
  const hiR = project({ ...p, nominal: p.nominal + band });
  const loR = project({ ...p, nominal: Math.max(-0.99, p.nominal - band) });
  const pts = [{ year: 0, base: p.initial, hi: p.initial, lo: p.initial }, ...R.years.map((y, i) => ({
    year: y.year, base: real(y.end, y.year),
    hi: real(hiR.years[i] ? hiR.years[i].end : y.end, y.year),
    lo: real(loR.years[i] ? loR.years[i].end : y.end, y.year),
  }))];
  return { ...empty, pts, fan: false, legend: "band" as Mode };
}

