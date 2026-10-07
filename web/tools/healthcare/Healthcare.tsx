"use client";

/* The Healthcare Cost Planner: ACA premiums and subsidies for the years
   before Medicare, then Medicare Part B, Part D and IRMAA by income. Ported
   from src/js/app/34-healthcare.js and src/main/22-healthcare-inputs.html,
   24-healthcare.html.

   Laid out answer-first (the healthcare critique, 2026-10-06), in Basic's
   thirds: the inputs a third, then one reading (the net ACA premium in
   amber, or Medicare when retiring at 65 or later, with the years on the
   bridge and Medicare from 65 beside it) whose foot carries the cliff and
   IRMAA warnings, then the two phases side by side from 1100px. With no
   income the reading shows dashes and the income field says it's the one
   figure needed. On a phone a compact reading leads and stays pinned. */

import { useRouter } from "next/navigation";
import { CheckIcon, ChevronDownIcon, CircleCheckIcon, InfoIcon, TriangleAlertIcon } from "lucide-react";
import { useHouseholdFill } from "@/components/household/HouseholdProvider";
import { Affixed, Field, MoneyField, NumberField, SelectField } from "@/components/fields/Field";
import { MoneyInput } from "@/components/fields/NumberInput";
import { useToast } from "@/components/shell/Toast";
import { TipDot, Tipped } from "@/components/shell/Tooltips";
import { setToolInputs, toolInputs, useToolState } from "@/components/tools/ToolState";
import { HeroReading, PinnedReading, type ReadingFigure } from "@/components/common/Reading";
import { KV } from "@/components/common/Readout";
import { DASH, dollarsField, money, parseNum } from "@/lib/format";
import { TAX_DEFAULTS, runTax, taxInput } from "@/tools/tax/model";
import { HC_MEDIGAP_HIGH, HC_MEDIGAP_LOW, HC_PARTD_BASE, HC_STATES, HEALTHCARE_DEF, healthcareCompute, type HealthcareInputs } from "./model";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";

const small = "text-dimmer text-fine";
const lead = "text-note text-dim mt-0 mx-0 mb-3 max-w-copy";
const empty = "text-dim text-aside max-w-copy";
const note = "hc-note max-w-copy";
const two = "two bottomalign max-sm:grid-cols-2";
const TIER_NAMES = ["Standard", "Tier 1", "Tier 2", "Tier 3", "Tier 4", "Tier 5"];
const r = Math.round;

const Sub = ({ children }: { children: React.ReactNode }) => <span className={small}>{children}</span>;
const head = "m-0 border-t border-border text-sm font-semibold text-foreground";
const Aside = ({ children }: { children: React.ReactNode }) => <span className="font-normal text-muted-foreground">{children}</span>;

/** A part of a phase that most readers can skip: its heading opens it. */
function Fold({ title, aside, children }: { title: string; aside: string; children: React.ReactNode }) {
  return (
    <div className="mt-4 border-t border-border pt-2.5">
      <Collapsible>
        <h3 className="m-0 text-sm font-semibold">
          <CollapsibleTrigger><span>{title} <Aside>{aside}</Aside></span><ChevronDownIcon aria-hidden="true" /></CollapsibleTrigger>
        </h3>
        <CollapsibleContent keepMounted><div className="pt-1.5">{children}</div></CollapsibleContent>
      </Collapsible>
    </div>
  );
}

function GroupHead({ children }: { children: React.ReactNode }) {
  return <h3 className="m-0 mt-1 mb-3 border-t border-border pt-4 text-sm font-semibold">{children}</h3>;
}

/** A line in the reading that isn't a figure: a prompt or a plain fact. */
function Band({ id, children }: { id?: string; children: React.ReactNode }) {
  return (
    <div id={id} className="flex items-start gap-2 border-t border-border px-5.5 py-3.5 text-body text-foreground max-sm:px-4">
      <InfoIcon className="mt-1 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
      <p className="m-0 max-w-copy">{children}</p>
    </div>
  );
}

export function Healthcare() {
  const { state: s, set, setState } = useToolState(HEALTHCARE_DEF);
  const router = useRouter();
  const toast = useToast();

  useHouseholdFill("healthcare", (h) => setState((c) => {
    const married = h.status === "m";
    const retire = h.retire != null && h.retire > 0 && h.retire < 120 ? Math.round(h.retire) : null;
    const next: HealthcareInputs = { ...c, status: married ? "m" : "s" };
    if (retire && retire >= 40 && retire <= 75) next.retireAge = String(retire);
    if (!married || parseNum(c.household) <= 2) next.household = married ? "2" : "1";
    if (married && h.spouseAge != null && h.spouseAge > 0 && h.age != null && h.age > 0 && retire)
      next.spouseAge = String(Math.round(h.spouseAge + (retire - h.age)));
    if (h.state && HC_STATES.some(([code]) => code === h.state)) next.state = h.state;
    return next;
  }));

  const {
    joint, household, state, magi, acaMagi, bridgeYears, pctFPL, acaAge, spouseOn, acaAge2, kids, grossMonthly, std, enh, usingStateEst,
    tier, partB, partDIrmaa, partD, totalLow, totalHigh, hasIrmaa, people, prev, next, save, nextThreshold, nextCost, cliff400, bronze, gold,
  } = healthcareCompute(s);
  const coveredDesc = (spouseOn ? (acaAge2 === acaAge ? "two adults age " + acaAge : "ages " + acaAge + " and " + acaAge2) : "age " + acaAge) +
    (kids ? " + " + kids + (kids === 1 ? " child" : " children") : "");

  const bridge = bridgeYears > 0;
  const acaReady = bridge && acaMagi > 0;
  const medReady = magi > 0;
  const nearCliff = acaReady && std.eligible && pctFPL > 3.5 && acaMagi < cliff400;
  const nearIrmaa = medReady && !!next && nextThreshold - magi < 25000;

  /* The reading's figures, in the words and formats the cards below use. */
  const acaPrem = acaReady ? "$" + r(std.eligible ? std.net : grossMonthly) + "/mo" : DASH;
  const yearsVal = acaReady ? bridgeYears + " yr" + (bridgeYears !== 1 ? "s" : "") : DASH;
  const medPer = medReady ? "~$" + r(totalLow) + "–$" + r(totalHigh) + "/mo" : DASH;
  const medCouple = medReady ? "~$" + r(totalLow * 2) + "–$" + r(totalHigh * 2) + "/mo" : DASH;
  const medMain = joint ? medCouple : medPer;
  const medNote = medReady ? (joint ? "Estimated total, for the couple" : "Estimated total per person") : "";

  const heroReady = bridge ? acaReady : medReady;
  const hero: ReadingFigure = bridge
    ? { label: "ACA premium before 65", id: "hcHeroAca", value: acaPrem,
      note: acaReady ? "Est. net Silver premium" + (spouseOn || kids ? ", whole household" : "") : "" }
    : { label: "Medicare from 65", id: "hcHeroMed", value: medMain, note: medNote };
  const figures: ReadingFigure[] = bridge
    ? [
      { label: "Years on the ACA bridge", id: "hcHeroYears", value: yearsVal, note: acaReady ? "Until Medicare at 65" : "" },
      { label: "Medicare from 65", id: "hcHeroMed", value: medMain, note: medNote },
    ]
    : joint
      ? [{ label: "Per person", id: "hcHeroPer", value: medPer, note: medReady ? "Both at the same IRMAA tier" : "" }]
      : [{ label: "Part B premium", id: "hcHeroPartB", value: medReady ? "$" + partB.toFixed(0) + "/mo" : DASH,
        note: medReady ? "Per person" + (hasIrmaa ? ", includes IRMAA surcharge" : "") : "" }];
  const side = figures[figures.length - 1];

  /* Near the 400% cliff, where a dollar more income loses the whole credit,
     and near the next IRMAA tier: shown at the foot of the reading. */
  const cliffWarn = nearCliff ? (
    <div className="hc-insight warn mt-0 max-w-copy">Your income is <b>{money(cliff400 - acaMagi)} below</b> the 400% FPL cliff. Every dollar above ${r(cliff400).toLocaleString()} eliminates the entire subsidy, adding ${r(std.credit)}/mo instantly. Roth conversions or portfolio decisions that push income over this line have an outsized cost.</div>
  ) : null;
  const irmaaWarn = nearIrmaa ? (
    <div className="hc-insight warn mt-0 max-w-copy">Your income is <b>{money(nextThreshold - magi, 0)} below</b> the next IRMAA threshold (${nextThreshold.toLocaleString()}). Crossing it adds <b>${r(nextCost)}/mo per person</b> (${r(nextCost * people * 12).toLocaleString()}/yr{joint ? " for the couple" : ""}). Consider this before large Roth conversions or realizing capital gains.</div>
  ) : null;

  let aca: React.ReactNode = null;
  if (bridge && acaMagi <= 0) {
    aca = <p className={empty}>Enter your expected retirement MAGI to see your ACA premium estimate.</p>;
  } else if (acaReady) {
    const pctFPLStr = (pctFPL * 100).toFixed(0) + "%";
    const incNote = acaMagi > magi + 0.5 ? " (your MAGI plus " + money(acaMagi - magi) + " of untaxed Social Security, which the ACA counts)" : "";
    const medicaid = pctFPL < 1.0;
    const showEnhanced = (!std.eligible && enh.eligible) || (std.eligible && Math.abs(enh.net - std.net) > 5);
    const tierRow = "hc-tier-row";
    aca = (
      <>
        {medicaid ? (
          <>
            <p className={lead}>Your income of {money(acaMagi)}{incNote} is <b>{pctFPLStr} of the federal poverty level</b> for a {household}-person household. Premium tax credits only begin at 100% FPL, so ACA subsidies do not apply here.</p>
            <div className="hc-insight max-w-copy">In the 40 states (plus DC) that expanded Medicaid under the ACA, an income this low typically qualifies you for Medicaid at little or no monthly premium. In the remaining non-expansion states there is a coverage gap: income is too high for Medicaid but too low for ACA subsidies, leaving limited options for subsidized coverage. Check your state&apos;s Medicaid eligibility rules.</div>
          </>
        ) : (
          <>
            <p className={lead}>Your income of {money(acaMagi)}{incNote} is <b>{pctFPLStr} of the federal poverty level</b> for a {household}-person household — this ratio drives your subsidy. {std.eligible
              ? "The ACA sets what you're expected to contribute toward health coverage at " + (std.pct * 100).toFixed(2) + "% of your income. The government covers whatever the Silver plan costs above that amount, in the form of a monthly premium tax credit applied at enrollment."
              : "That income is above the 400% FPL cutoff, so there is no credit and you would pay the Silver plan's full list price. The enhanced credits that removed this cutoff (capping your share at 8.5% of income) expired after 2025."}</p>
            <h3 className={cn(head, "mt-4 mb-1 pt-3.5")}>2026 ACA rules</h3>
            <KV k={<>Benchmark Silver plan {usingStateEst ? <Sub>({state} est., {coveredDesc}) — the reference used to price your credit</Sub> : <Sub>your entered premium</Sub>}</>} v={"$" + r(grossMonthly) + "/mo"} />
            {!std.eligible ? (
              <>
                <KV k="Premium tax credit" v={<span className="text-dimmer">none (income above 400% FPL)</span>} />
                <div className="kv total"><span className="k">Your net premium</span><span className="v">${r(grossMonthly)}/mo</span></div>
              </>
            ) : (
              <>
                <KV k={<>Premium tax credit <Sub>({(std.pct * 100).toFixed(2)}% income cap)</Sub></>} cls="pos" v={"−$" + r(std.credit) + "/mo"} />
                <div className="kv total"><span className="k">Your net premium (Silver)</span><span className="v">${r(std.net)}/mo</span></div>
              </>
            )}
            {showEnhanced ? (
              <Fold title="If Congress restores the enhanced credits" aside="(in place 2021–2025)">
                <KV k={<>Premium tax credit <Sub>({(enh.pct * 100).toFixed(2)}% income cap, no 400% cliff)</Sub></>} cls="pos" v={"−$" + r(enh.credit) + "/mo"} />
                <div className="kv total"><span className="k">Your net premium (Silver)</span><span className="v">${r(enh.net)}/mo</span></div>
              </Fold>
            ) : null}
            <Fold title="Plan tier comparison" aside="(same credit applies to any tier)">
              <div className={tierRow}><span><b>Bronze:</b> lowest monthly cost; high deductible — you pay most costs out-of-pocket until you hit it</span><span>~${r(bronze)}/mo</span></div>
              <div className={cn(tierRow, "hc-tier-sel")}><span><CheckIcon className="mr-1.5 inline size-3.5 align-middle" aria-hidden="true" /><b>Silver:</b> the credit is built around this tier; also unlocks cost-sharing reductions at lower incomes</span><span>${r(std.net)}/mo</span></div>
              <div className={tierRow}><span><b>Gold:</b> higher monthly cost; lower deductible and copays — better if you expect to use a lot of care</span><span>~${r(gold)}/mo</span></div>
            </Fold>
            {spouseOn ? (
              <div className="hc-insight max-w-copy">For a couple, <b>both spouses need their own plan</b>, and the figures above cover both of you. The credit is worked out for the household as a whole: the benchmark for both plans, less one contribution based on your combined income. {std.eligible ? "That's why a subsidized couple pays about what one person at the same income would, not double." : "Above the 400% cliff there is no credit, so you pay both full premiums."}</div>
            ) : null}
          </>
        )}
        <div className={note}>
          {usingStateEst
            ? "Benchmark Silver premium is a state-level estimate for " + state + " scaled by age, for " + coveredDesc + ". " +
              (kids ? "Children are priced as under-15 enrollees; at lower incomes many qualify for CHIP or Medicaid instead. " : "")
            : "Using your entered benchmark premium. "}
          Enter your actual quote from <a href="https://healthcare.gov" target="_blank">healthcare.gov</a> in the sidebar for precision. Credits for 2026 use the IRS&apos;s 2026 contribution percentages and the 2025 poverty guidelines. The enhanced credits of 2021–2025, which removed the 400% FPL cliff and capped contributions at 8.5% of income, expired at the end of 2025; the House passed an extension in January 2026, but it has not become law.
        </div>
      </>
    );
  }

  let medicare: React.ReactNode;
  if (!medReady) {
    medicare = <p className={empty}>Enter your expected retirement MAGI to see Medicare cost estimates. Medicare uses your income from <b>two years prior</b> to determine surcharges.</p>;
  } else {
    medicare = (
      <>
        <p className={lead}><b>Part B</b> covers doctor visits, outpatient care, and preventive services. <b>Part D</b> covers prescription drugs. Most enrollees add a <b>Medigap supplement</b> (like Plan G) which covers deductibles and copays that Parts A and B leave unpaid, capping your out-of-pocket exposure. Higher incomes trigger IRMAA surcharges that raise the Part B and Part D premiums.</p>
        <div className="mb-3.5">
          <Badge variant={hasIrmaa ? "destructive" : "positive"}>
            {hasIrmaa ? <TriangleAlertIcon aria-hidden="true" /> : <CircleCheckIcon aria-hidden="true" />}
            IRMAA {TIER_NAMES[tier]}{hasIrmaa ? ": income surcharge applies" : ": standard premium"}
          </Badge>
        </div>
        <KV k={<>Part B premium{hasIrmaa ? <> <Sub>includes IRMAA surcharge</Sub></> : null}</>} v={"$" + partB.toFixed(0) + "/mo per person"} />
        <KV k={<>Part D estimate <Sub>{partDIrmaa > 0 ? "~$" + HC_PARTD_BASE + " avg plan + $" + partDIrmaa.toFixed(0) + " IRMAA" : "avg plan, no IRMAA"}</Sub></>} v={"~$" + r(partD) + "/mo per person"} />
        <KV k={<>Medigap Plan G <Sub>varies by state, insurer &amp; age</Sub></>} v={"~$" + HC_MEDIGAP_LOW + "–$" + HC_MEDIGAP_HIGH + "/mo per person"} />
        <div className="kv total"><span className="k">Estimated total per person</span><span className="v">~${r(totalLow)}–${r(totalHigh)}/mo</span></div>
        {joint ? <KV k={<>For the couple <Sub>both at same IRMAA tier</Sub></>} v={"~$" + r(totalLow * 2) + "–$" + r(totalHigh * 2) + "/mo"} /> : null}
        {prev ? (
          <div className="hc-insight max-w-copy">Your income is <b>{money(magi - prev[joint ? 1 : 0], 0)} above</b> the {TIER_NAMES[tier]} threshold (${prev[joint ? 1 : 0].toLocaleString()}). Reducing MAGI below that threshold saves <b>${r(save)}/mo per person</b> (${r(save * people * 12).toLocaleString()}/yr{joint ? " for the couple" : ""}) in Medicare premiums. Roth conversions and capital gains realizations both count toward IRMAA.</div>
        ) : null}
        <div className={note}>Medicare costs use CMS&apos;s 2026 figures: a $202.90 standard Part B premium and 2026 IRMAA tiers. Medicare applies the surcharge based on your income from <b>two years prior</b>, so income in retirement year 1 may not affect Part B until year 3. Part D estimate is a national average plus IRMAA; your actual plan premium varies. Medigap Plan G estimates are rough national ranges at age 65, and state, insurer, and enrollment age make a significant difference. Medicare Advantage (Part C) plans often have lower monthly premiums but different cost-sharing and network rules.</div>
      </>
    );
  }

  const needIncome = !s.income.trim() || magi <= 0;

  return (
    <div className="col-span-full grid grid-cols-1 items-start gap-5 max-sm:gap-3.5 lg:grid-cols-3">
      <div className="min-w-0 lg:col-span-1 lg:self-stretch">
        {/* Phones and narrow screens: the answer leads, and stays under the
            tab rail while the inputs are on screen. */}
        <PinnedReading tone={heroReady ? "answer" : "text"} main={{ label: hero.label, value: hero.value }} side={{ label: side.label, value: side.value }} />

        <aside id="asideHC" className="max-lg:static max-lg:max-h-none max-lg:overflow-visible">
          <Card>
            <CardHeader>
              <CardTitle>Your situation</CardTitle>
              <CardDescription>When you retire, who&apos;s covered, and your income in retirement.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className={two}>
                <NumberField id="hcRetireAge" label="Retirement age" unit="age" max={75} value={s.retireAge} onValueChange={set("retireAge")} />
                <SelectField id="hcState" label="State" value={s.state} onChange={set("state")}>
                  {HC_STATES.map(([code, name]) => <option key={code} value={code}>{name}</option>)}
                </SelectField>
              </div>
              <div className={two}>
                <SelectField id="hcStatus" label="Filing status" value={s.status} onChange={set("status")}>
                  <option value="s">Single</option>
                  <option value="m">Married</option>
                </SelectField>
                <SelectField id="hcHousehold" label="Household" value={s.household} onChange={set("household")}>
                  {[1, 2, 3, 4, 5, 6].map((n) => <option key={n} value={String(n)}>{n} {n === 1 ? "person" : "people"}</option>)}
                </SelectField>
              </div>
              <NumberField id="hcSpouseAge" wrapId="hcSpouseAgeWrap" hidden={!joint} label={<Tipped text="Spouse's age then" k="hcspouseage" />} unit="age" max={90} value={s.spouseAge} onValueChange={set("spouseAge")} />

              <GroupHead>Income</GroupHead>
              <Field id="hcIncome" label={<Tipped text="Retirement MAGI" k="hcincome" />}>
                <Affixed prefix="$"><MoneyInput id="hcIncome" nonNeg value={s.income} onValueChange={set("income")} aria-describedby={needIncome ? "hcIncomeHint" : undefined} /></Affixed>
                {needIncome ? (
                  <div className="mt-1.5 flex items-start gap-1.5 text-note text-foreground" id="hcIncomeHint">
                    <InfoIcon className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
                    <span>The one figure this needs: your income in retirement.</span>
                  </div>
                ) : null}
                <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5">
                  <Button variant="outline" size="sm" id="hcCopyTax"
                    onClick={() => {
                      const tax = toolInputs("tax", TAX_DEFAULTS);
                      if (tax.mode !== "retire") {
                        toast("Switch the Income Tax tool to Retirement income mode first");
                        return;
                      }
                      const R = runTax(taxInput(tax));
                      const agi = R.agi || 0;
                      if (!agi) {
                        toast("Enter income in the Income Tax tool first");
                        return;
                      }
                      setState((c) => ({ ...c, income: dollarsField(agi), ss: R.ssGross > 0 ? dollarsField(R.ssGross) : "" }));
                      toast("Copied " + money(agi) + " MAGI from Income Tax");
                    }}>Copy from Income Tax</Button>{" "}
                  <Button variant="quiet" size="inline" id="hcGoTax"
                    onClick={() => {
                      setToolInputs("tax", { ...toolInputs("tax", TAX_DEFAULTS), mode: "retire" });
                      router.push("/incometax");
                    }}>Open Income Tax</Button>
                </div>
              </Field>
              <MoneyField id="hcSS" label={<>Social Security received <span className="tipglue"><Badge variant="outline" className="ml-1.25">optional</Badge><TipDot k="hcss" /></span></>} unit="/yr" value={s.ss} onValueChange={set("ss")} />

              <GroupHead>Your own quote</GroupHead>
              <Field id="hcManualPremium" label={<Tipped text="ACA benchmark premium" k="hcbenchmark" />}>
                <Affixed prefix="$"><MoneyInput id="hcManualPremium" nonNeg placeholder="state est. if blank" value={s.premium} onValueChange={set("premium")} /></Affixed>
              </Field>
            </CardContent>
          </Card>
        </aside>
      </div>

      <div className="stack min-w-0 lg:col-span-2" id="tab-healthcare">
        <Card size="flush" className="min-w-0" id="hcReading">
          <HeroReading tone={heroReady ? "answer" : "text"} sized={heroReady} hero={hero} figures={figures} />
          {/* Retiring at 65 or later, the bridge is this one fact. */}
          {!bridge ? <Band id="hcACABody">Retiring at 65 or later: no ACA bridge needed. Medicare coverage begins at 65.</Band> : null}
          {!heroReady ? <Band>Enter your retirement income (MAGI) to see what coverage costs.</Band> : null}
          {cliffWarn || irmaaWarn ? (
            <div className="grid gap-2.5 border-t border-border px-5.5 py-3.5 max-sm:px-4">{cliffWarn}{irmaaWarn}</div>
          ) : null}
        </Card>

        <div className="grid min-w-0 grid-cols-1 gap-5 max-sm:gap-3.5 wide:grid-cols-2">
          {bridge ? (
            <Card className="min-w-0">
              <CardHeader><CardTitle>Before 65: the ACA bridge</CardTitle></CardHeader>
              <CardContent id="hcACABody">{aca}</CardContent>
            </Card>
          ) : null}
          <Card className={cn("min-w-0", !bridge && "wide:col-span-2")}>
            <CardHeader><CardTitle>From 65: Medicare</CardTitle></CardHeader>
            <CardContent id="hcMedicareBody">{medicare}</CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
