"use client";

/* The Advanced calculator: one plan with inflation, fees, taxes, a glide
   path and account types, worked backwards from a target, and charted
   against a rate band, market history or Monte Carlo runs. Ported from
   src/js/app/01-inputs.js, 02-accounts-advanced.js, 03-projection.js,
   04-charts.js, 06-solve.js and 07-converter.js, and the Advanced parts of
   src/main/02-calculator-inputs.html and 03-calculator-results.html. */

import { useDeferredValue, useMemo, useRef, useState } from "react";
import { CheckToggle, SignFlip } from "@/components/fields/CheckToggle";
import { Affixed, Field, MoneyField, NumberField, SelectField } from "@/components/fields/Field";
import { MoneyInput, NumberInput } from "@/components/fields/NumberInput";
import { useHousehold, useHouseholdFill } from "@/components/household/HouseholdProvider";
import { useToast } from "@/components/shell/Toast";
import { TipDot, Tipped } from "@/components/shell/Tooltips";
import { AccountTable } from "@/components/tools/AccountTable";
import { ConvertIcon, ConverterDialog, GrowthRatesDialog } from "@/components/tools/ContribDialogs";
import { ProjectionChart, ProjectionReading, bandLabel, emptyChart, fanPoints, histChart, type ChartData, type ChartMode } from "@/components/tools/Projection";
import { useToolNav, useToolScope, useToolState, useToolStore } from "@/components/tools/ToolState";
import { CsvButton } from "@/components/common/CsvButton";
import { Milestones } from "@/components/common/Milestones";
import { growthBlend, matchPer, spreadTotal, withHsaRate, type GrowthRates } from "@/lib/accounts";
import { historicalRuns, monteCarlo, project, projectSeries, PER_YEAR } from "@/lib/engine/typed";
import { dollarsField, fmtNum, fraction, groupDigits, money, parseNum, pctStr } from "@/lib/format";
import { MC_RUNS, useMcSeed } from "@/lib/mc-seed";
import { PERIOD_SHORT, PeriodOptions } from "@/lib/periods";
import { has } from "@/lib/household";
import { STATE_OPTIONS } from "@/lib/states";
import { sendToDrawdown } from "@/tools/drawdown/fields";
import { TAX_DEFAULTS } from "@/tools/tax/model";
import { useShareKit } from "@/components/shell/share";
import { projectionShare } from "./share";
import { ADVANCED_DEF, ADVANCED_DEFAULTS, advancedCompute, advancedPlan, glideNote, glideYearsFor, type AdvancedInputs } from "./model";
import { changesCompute, changesOn, type Compiled } from "./changes";
import { ChangesAhead, ReachCard, ageOf } from "./ChangesAhead";
import { useBusy } from "@/lib/busy";
import { Button } from "@/components/ui/button";
import { InputGroupInput } from "@/components/ui/input-group";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { PinnedReading } from "@/components/common/Reading";
import { cn } from "@/lib/utils";
import { ChevronDownIcon, CircleAlertIcon, CircleCheckIcon, CircleXIcon } from "lucide-react";
import type { Series } from "@/lib/engine/types";
import { SERIES } from "@/lib/hues";
import { NativeSelect } from "@/components/ui/native-select";

const TARGET_LABEL = "(the portfolio behind your target above)";

export function Advanced() {
  const { state: s, set, setState } = useToolState(ADVANCED_DEF);
  const { profile } = useHousehold();
  const store = useToolStore(), go = useToolNav();
  // In a walkthrough, its own steps lead on: no Drawdown or Stages hand-offs here.
  const scope = useToolScope();
  const toast = useToast();
  const seed = useMcSeed();
  const [mode, setMode] = useState<ChartMode>("band");
  const [band, setBand] = useState("2");
  const [dialog, setDialog] = useState<"conv" | "growth" | null>(null);
  const tableRef = useRef<HTMLTableElement>(null);

  useHouseholdFill("advanced", s, setState, (h, c) => {
    // A walkthrough fills these in from its own steps.
    if (scope) return c;
    const age = has(h.age) && h.age! > 0 && h.age! < 120 ? Math.round(h.age!) : null;
    const retire = has(h.retire) && h.retire! > 0 && h.retire! < 120 ? Math.round(h.retire!) : null;
    const yrs = age && retire && retire > age ? Math.min(100, retire - age) : null;
    const next = { ...c };
    if (yrs) next.years = String(yrs);
    if (age && c.age.trim() === "") next.age = String(age);
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
  });

  /* The glide can't run longer than the plan; its field follows the years. */
  const setTiming = (k: "years" | "glideYears") => (v: string) => setState((c) => {
    const next = { ...c, [k]: v };
    return next.glideOn ? { ...next, glideYears: glideYearsFor(next.years, next.glideYears) } : next;
  });

  const typed = useDeferredValue(s);
  useBusy(typed !== s);
  const V = useMemo(() => advancedCompute(typed, profile), [typed, profile]);
  const { P, p, S, C } = V;
  // With a change ahead on, the plan runs as the stages the changes make;
  // with none, it's Advanced's own (the two agree to the cent).
  const on = changesOn(typed);
  const CH = useMemo(() => (on ? changesCompute(typed, profile) : null), [on, typed, profile]);
  const R: Series | typeof V.R = CH ? CH.V.R : V.R;
  const age = ageOf(typed);
  useShareKit(ADVANCED_DEF.id, CH ? projectionShare({ kind: "stages", g: CH.V.P.g, eff: CH.V.P.eff, R: CH.V.R, mode }) : projectionShare({ kind: "advanced", P, R: V.R, target: typed.target, solveFor: typed.solveFor, mode }));
  const chart = useMemo(() => {
    if (!CH) return chartData(typed, V, mode, parseNum(band) / 100, seed);
    const c = changesChart(typed, CH.C, CH.V, mode, parseNum(band) / 100, seed);
    // Where each change starts, numbered as the list numbers them.
    const order = [...(typed.changes ?? []).filter((x) => x.kind === "children"), ...(typed.changes ?? []).filter((x) => x.kind !== "children")];
    const marks = CH.C.starts.filter((m) => m.year > 0).map((m) => ({ year: m.year, label: String(order.findIndex((x) => x.id === m.id) + 1) }))
      .reduce<{ year: number; label: string }[]>((acc, m) => { const same = acc.find((x) => x.year === m.year); if (same) same.label += ", " + m.label; else acc.push(m); return acc; }, []);
    return { ...c, marks };
  }, [typed, V, CH, mode, band, seed]);

  const acOn = s.acOn;
  const blended = acOn && !!s.gRates;
  const per = PERIOD_SHORT[s.period] || "";

  /* ---- account split on and off ---- */
  const toggleAccounts = () => {
    if (!acOn) {
      // Seed from what's on screen, so switching modes doesn't change the
      // answer until you start splitting it up.
      const blank = (["tradBal", "tradC", "rothBal", "rothC", "brokBal", "brokC", "hsaBal", "hsaC"] as const).every((k) => !(parseNum(s[k]) > 0));
      if (blank) {
        const tax = store.read("tax", TAX_DEFAULTS), H = profile;
        setState((c) => ({
          ...c, acOn: true, tradBal: dollarsField(parseNum(c.initial)), tradC: dollarsField(parseNum(c.contrib)), rothBal: "0", rothC: "0", brokBal: "0", brokC: "0", hsaBal: "0", hsaC: "0",
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
    return { ...c, tradC: dollarsField(t.trad), rothC: dollarsField(t.roth), brokC: dollarsField(t.brok), hsaC: dollarsField(t.hsa) };
  };

  const growthDialog = dialog === "growth" && acOn ? (
    <GrowthRatesDialog title="Contribution growth by account" onClose={() => setDialog(null)}
      init={withHsaRate(s.gRates || { t: parseNum(s.growth) / 100, r: parseNum(s.growth) / 100, b: parseNum(s.growth) / 100 })}
      blend={(rates) => { const a = P.a!; return growthBlend(p, p.years, { t: a.tradC, r: a.rothC, b: a.brokC, h: a.hsaC }, rates); }}
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
  const acMoney = (id: "tradBal" | "tradC" | "rothBal" | "rothC" | "brokBal" | "brokC" | "hsaBal" | "hsaC", label: string, contrib?: boolean) => (
    <div className="field">
      <Label className="mb-1.5" htmlFor={"ac" + id[0].toUpperCase() + id.slice(1)}><span>{label}</span></Label>
      <Affixed prefix="$" suffix={contrib ? per : undefined}>
        <MoneyInput id={"ac" + id[0].toUpperCase() + id.slice(1)} nonNeg value={s[id]} onValueChange={set(id)} />
      </Affixed>
    </div>
  );
  const a = P.a, B = CH ? CH.V.P.B : P.B;
  const mine = a ? a.tradC + a.rothC + a.brokC + a.hsaC : 0;
  // The calculated rate stays in its (hidden) field after the split is
  // turned off, as it did on the old site.
  const acRate = B ? B.effRate : s.tradBal !== "" ? advancedPlan({ ...typed, acOn: true }, profile).B!.effRate : null;

  // The target beside the answer, with the plan's verdict on it (the Coast
  // FIRE state below says the same in full).
  const target = parseNum(typed.target);
  const income = typed.solveFor === "After-Tax Withdrawal";
  // The portfolio the goal needs, and what it pays after tax.
  const need = CH ? CH.V.portToday : S.portToday;
  const pays = income ? (CH ? need * CH.V.P.g.withdrawal * (1 - CH.V.rate) : S.pays) : null;
  const onTrack = CH ? R.fvReal >= need - 0.5 : C.state !== "never";
  const already = !CH && C.state === "already";
  // The target as it comes, before anyone has set one: no verdict on a
  // goal you didn't choose.
  const exampleTarget = s.target === ADVANCED_DEFAULTS.target && s.solveFor === ADVANCED_DEFAULTS.solveFor;
  const VerdictIcon = onTrack ? CircleCheckIcon : CircleXIcon;
  // An after-tax income target can't be met by a portfolio that pays
  // nothing after tax: no contribution or timeline reaches it.
  const noPay = income && target > 0 && !(p.withdrawal > 0 && p.taxRate < 1);
  const payWarn = !noPay ? "" : p.withdrawal > 0
    ? "At a 100% tax rate nothing is left after tax, so no portfolio reaches an after-tax income. Lower the tax rate."
    : "At a 0% withdrawal rate the portfolio pays no income, so no amount reaches your target. Set a withdrawal rate above 0%.";
  const badWd = noPay && !(p.withdrawal > 0), badTax = noPay && !badWd && !acOn;

  const toDrawdown = () => {
    sendToDrawdown({ initial: Math.round(R.fvReal) });
    go("/drawdown");
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
            <CardContent>
              <GroupHead first>Your savings</GroupHead>
              <div className="glidewrap acwrap mt-0" id="acWrap">
                <CheckToggle id="acToggle" on={acOn} onToggle={toggleAccounts} controls="acFields" tip={<TipDot k="accttypes" />}>Split by account type</CheckToggle>
                <div className="acfields" id="acFields" hidden={!acOn}>
                  <AcHead note="pre-tax">Traditional 401(k) / IRA</AcHead>
                  <div className="two max-sm:grid-cols-2">{acMoney("tradBal", "Balance")}{acMoney("tradC", "You add", true)}</div>
                  <AcHead note="after-tax, grows tax-free">Roth 401(k) / IRA</AcHead>
                  <div className="two max-sm:grid-cols-2">{acMoney("rothBal", "Balance")}{acMoney("rothC", "You add", true)}</div>
                  <AcHead note="gains taxed when sold">Taxable brokerage</AcHead>
                  <div className="two max-sm:grid-cols-2">{acMoney("brokBal", "Balance")}{acMoney("brokC", "You add", true)}</div>
                  <MoneyField id="acBrokBasis" label={<Tipped text="Cost basis" k="acbasis" />} value={s.brokBasis} onValueChange={set("brokBasis")} />
                  <AcHead note="tax-free for health care">HSA</AcHead>
                  <div className="two max-sm:grid-cols-2">{acMoney("hsaBal", "Balance")}{acMoney("hsaC", "You add", true)}</div>
                  <div className="mb-3.5 grid grid-cols-2 gap-x-2.5 border-t border-border pt-2.5" aria-live="polite">
                    <div className="actot"><span className="k">Total balance</span><span className="v" id="acTotBal">{a ? money(a.tradBal + a.rothBal + a.brokBal + a.hsaBal) : ""}</span></div>
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
              <div className="two bottomalign max-sm:grid-cols-2">
                <NumberField id="age" label={<>Your age <Badge variant="outline" className="ml-1.25">optional</Badge></>} unit="yrs" max={119} value={s.age} onValueChange={set("age")} />
                <div className="hint mb-3.5 self-end" id="ageHint">{age != null ? "Retiring at " + (age + Math.round(parseNum(s.years))) + ". Changes ahead read by age." : "With it, the changes ahead read by age."}</div>
              </div>

              <GroupHead>Markets</GroupHead>
              <Field id="nominal" label={<Tipped text="Rate of return" k="nominalreturn" />}>
                <Affixed suffix="%"><SignFlip value={s.nominal} onFlip={set("nominal")} /><NumberInput id="nominal" value={s.nominal} onValueChange={set("nominal")} /></Affixed>
              </Field>
              <div className="glidewrap -mt-1" id="glideWrap">
                <CheckToggle id="glideToggle" on={s.glideOn} onToggle={toggleGlide} tip={<TipDot k="glide" />}>Glide path</CheckToggle>
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
                <div><span><Tipped text="Real rate of return" k="realreturn" /></span><span className="num" id="dRealRate">{pctStr(V.R.realReturn)}</span></div>
                <details className="calcdetails">
                  <summary>Calculation details</summary>
                  <div><span>Periods per year</span><span className="num" id="dPPY">{V.R.ppy}</span></div>
                  <div><span>Rate per period</span><span className="num" id="dPeriodic">{pctStr(V.R.periodicRate, 4)}</span></div>
                  <div><span>Periods modeled</span><span className="num" id="dPeriods">{V.R.periods.toLocaleString("en-US")}</span></div>
                </details>
              </div>

              <ChangesAhead s={s} setState={setState} household={profile} />

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
                <NumberField id="withdrawal" label={<Tipped text="Withdrawal rate" k="withdrawal" />} unit="%" value={s.withdrawal} onValueChange={set("withdrawal")}
                  aria-invalid={badWd || undefined} aria-describedby={badWd ? "payWarnText" : undefined} />
                <NumberField id="taxrate" wrapId="taxrateField" hidden={acOn} label={<Tipped text="Effective tax rate" k="efftaxrate" />} unit="%" value={s.taxRate} onValueChange={set("taxRate")}
                  aria-invalid={badTax || undefined} aria-describedby={badTax ? "payWarnText" : undefined} />
                <div className="field" id="acTaxField" hidden={!acOn}>
                  <Label className="mb-1.5"><span><Tipped text="Tax on withdrawals" k="actax" /></span></Label>
                  <Affixed suffix="calc">
                    <InputGroupInput variant="numeric" id="acTaxOut" type="text" readOnly tabIndex={-1} aria-label="Tax on withdrawals, calculated" value={acRate != null ? pctStr(acRate, 1) : ""} /></Affixed>
                </div>
              </div>
              <div className="-mt-1 mb-1 flex items-start gap-2 text-note text-destructive" id="payWarn" hidden={!noPay}>
                <CircleAlertIcon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                <span id="payWarnText" role="alert">{payWarn}</span>
              </div>
            </CardContent>
          </Card>
        </aside>
      </div>

      <div className="stack min-w-0 lg:col-span-2" role="tabpanel" aria-labelledby="tabbtn-calc" id="tab-single">
        <ProjectionReading p="r" R={R} lastPeriod={CH ? CH.V.R.lastPeriod : p.period} fvNote={CH ? "Across " + CH.C.shown.length + (CH.C.shown.length === 1 ? " stage, " : " stages, ") + fmtNum(p.years) + " years" : "After " + p.years + " years at " + pctStr(p.nominal, 2)}
          realNote={"Inflation of " + pctStr(p.inflation, 2) + " over " + R.inflYears + " years"}>
          {target > 0 ? (
            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5 text-note">
              <span className="text-muted-foreground">Your target</span>
              <span className="font-medium whitespace-nowrap tabular-nums">{money(target) + (income ? " per year, after tax" : " portfolio, in today's dollars")}</span>
              {exampleTarget ? <span className="text-muted-foreground">an example: set your own under Your goal to see if you&apos;re on track</span>
                : <Badge variant={onTrack ? "positive" : "destructive"}><VerdictIcon aria-hidden="true" />{already ? "Already there" : onTrack ? "On track" : "Not on track"}</Badge>}
            </div>
          ) : null}
        </ProjectionReading>

        <Card id="acPanel" hidden={!acOn}>
          {B ? <AccountTable id="acResults" B={B} years={p.years} /> : null}
        </Card>

        <ReachCard s={typed} setState={setState} household={profile} need={need} pays={pays} />

        <ProjectionChart sfx="" segId="segSingle" ariaLabel="Projected inflation-adjusted balance at three rates of return"
          mode={mode} setMode={setMode} band={band} setBand={setBand}
          histMix={s.histMix} setHistMix={set("histMix")} histMixEnd={s.histMixEnd} setHistMixEnd={set("histMixEnd")} glides={p.glide.on}
          mcFields={<Field id="volatility" label={<Tipped text="Volatility" k="volatility" />}><Affixed suffix="%/yr" className="w-26"><NumberInput id="volatility" nonNeg value={s.vol} onValueChange={set("vol")} /></Affixed></Field>}
          mcHint="Each redraw runs 5,000 simulations."
          chart={chart} maxX={p.years} bandItems={CH ? changesLegend(parseNum(band) / 100, chart.marks.length > 0) : bandLegend(p.nominal, parseNum(band) / 100)} legendExtra={CH && chart.marks.length ? "A change starts" : undefined}
          tipHead={(b) => <b>{age != null ? "Age " + fmtNum(age + b.year) : "Year " + fmtNum(b.year)}</b>} target={need} targetLabel={TARGET_LABEL}
          xOffset={age ?? 0} layout="fixed" aspect={0.5} gutter={64} bandHint={CH ? "Every year's return this much higher, and this much lower." : "Your return this much higher, and this much lower."} />

        <div className={cn("grid min-w-0 grid-cols-1 items-start gap-5 max-sm:gap-3.5", !scope && "wide:grid-cols-2")}>
          <Card>
            <CardHeader><CardTitle>Milestones</CardTitle></CardHeader>
            <CardContent id="msBody">{CH
              ? <Milestones rows={CH.V.R.rows.map((r) => ({ year: r.endYear, end: r.end, growth: r.growth, contrib: r.contrib }))} infl={p.inflation} feeCost={CH.V.feeCost} horizon={p.years} wholeYears />
              : <Milestones rows={V.R.years} infl={p.inflation} feeCost={V.feeCost} horizon={p.years} />}</CardContent>
          </Card>

          <Card hidden={!!scope}>
            <CardHeader><CardTitle>Take it further</CardTitle></CardHeader>
            <CardContent>
              <p className="hint mt-0">See how long this balance lasts once you start
                drawing on it. This carries your inflation-adjusted balance into the
                Drawdown Simulator.</p>
              <Button variant="outline" id="toDrawdown" onClick={toDrawdown}>Test withdrawals</Button>
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
            <div className="scroll" tabIndex={0} role="region" aria-label="Year by year">
              <table id="yearTable" ref={tableRef}>
                <thead><tr><th>Year</th><th>Start balance</th><th>Contributions</th><th>Growth</th><th>End balance</th><th>Inflation adj.</th></tr></thead>
                <tbody>
                  {(CH ? CH.V.R.calRows : V.R.years).map((y) => (
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

function bandLegend(nominal: number, band: number): [string, string][] {
  const lbl = bandLabel(band);
  return [
    [SERIES.teal, band > 0 ? "At " + pctStr(nominal + band, 2) + " (+" + lbl + "%)" : "Higher"],
    [SERIES.plan, "At " + pctStr(nominal, 2) + " (your rate)"],
    [SERIES.rose, band > 0 ? "At " + pctStr(Math.max(-0.99, nominal - band), 2) + " (−" + lbl + "%)" : "Lower"],
  ];
}

/** With changes on, the band moves every year's return together. */
function changesLegend(band: number, marks: boolean): [string, string][] {
  const lbl = bandLabel(band);
  return [
    [SERIES.teal, band > 0 ? "Every year +" + lbl + "%" : "Higher"],
    [SERIES.plan, "As entered"],
    [SERIES.rose, band > 0 ? "Every year −" + lbl + "%" : "Lower"],
    ...(marks ? [["var(--stageline)", "A change starts"] as [string, string]] : []),
  ];
}

/* ---- the numbers ---- */

/** What the chart draws with changes on: the stages' run, as Stages draws
    it. A glide split year by year moves historical mode's mix along with it. */
function changesChart(s: AdvancedInputs, C: Compiled, V: ReturnType<typeof changesCompute>["V"], mode: ChartMode, band: number, seed: number): ChartData {
  const { P, R } = V, g = P.g;
  if (!R.rows.length) return emptyChart();
  const defl = (yr: number) => Math.pow(1 + g.inflation, yr);
  const start = { year: 0, stage: 1, base: g.initial, hi: g.initial, lo: g.initial, p25: g.initial, p75: g.initial };
  if (mode === "hist") {
    const mix = fraction(s.histMix), endMix = fraction(s.histMixEnd);
    const H = historicalRuns({ initial: g.initial, fees: g.fees }, P.eff.map((st, i) => {
      const at = C.glideAt[i];
      return { ...st, mix: at == null ? mix : mix + (endMix - mix) * at, ...(st.glide?.on ? { glide: { ...st.glide, endMix } } : {}) };
    }));
    return histChart(start, H);
  }
  if (mode === "mc") {
    const mc = monteCarlo(g, P.eff, MC_RUNS, seed);
    const pts = fanPoints({ ...start, det: g.initial }, mc.bands, (b, i) => ({ det: R.chartRows[i] ? R.chartRows[i].end / defl(R.chartRows[i].year) : b.p50 }));
    return { ...emptyChart(true), pts, legend: "mc", mc };
  }
  const shift = (d: number) => P.eff.map((st) => ({ ...st, nominal: Math.max(-0.99, st.nominal + d) }));
  const hiR = projectSeries(g, shift(band)), loR = projectSeries(g, shift(-band));
  const pts = [{ year: 0, base: g.initial, hi: g.initial, lo: g.initial }, ...R.chartRows.map((r, i) => ({
    year: r.year, base: r.end / defl(r.year),
    hi: (hiR.chartRows[i] ? hiR.chartRows[i].end : r.end) / defl(r.year),
    lo: (loR.chartRows[i] ? loR.chartRows[i].end : r.end) / defl(r.year),
  }))];
  return { ...emptyChart(), pts, legend: "band" };
}

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
