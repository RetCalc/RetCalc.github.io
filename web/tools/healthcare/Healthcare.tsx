"use client";

/* The Healthcare Cost Planner: ACA premiums and subsidies for the years
   before Medicare, then Medicare Part B, Part D and IRMAA by income. Ported
   from src/js/app/34-healthcare.js and src/main/22-healthcare-inputs.html,
   24-healthcare.html. */

import { useRouter } from "next/navigation";
import { useHouseholdFill } from "@/components/household/HouseholdProvider";
import { Affixed, Field, MoneyField, NumberField, SelectField } from "@/components/fields/Field";
import { MoneyInput } from "@/components/fields/NumberInput";
import { useToast } from "@/components/shell/Toast";
import { TipDot, Tipped } from "@/components/shell/Tooltips";
import { setToolInputs, toolInputs, useToolState } from "@/components/tools/ToolState";
import { KV } from "@/components/common/Readout";
import { HC_AGE40_MULT, HC_STATE_PREMIUM_40, hcCalcACA, hcFPL, hcGrossPremium, ssTaxable } from "@/lib/engine/typed";
import { dollarsField, money, parseNum } from "@/lib/format";
import { TAX_DEFAULTS, runTax, taxInput } from "@/tools/tax/model";
import { HC_IRMAA, HC_MEDIGAP_HIGH, HC_MEDIGAP_LOW, HC_PARTD_BASE, HC_STATES, HEALTHCARE_DEF, irmaaTier, type HealthcareInputs } from "./model";
import { Button } from "@/components/ui/button";

const small = "text-dimmer text-fine";
const lead = "text-note text-dim mt-0 mx-0 mb-3";
const empty = "text-dim text-aside";
const TIER_NAMES = ["Standard", "Tier 1", "Tier 2", "Tier 3", "Tier 4", "Tier 5"];
const r = Math.round;

const Sub = ({ children }: { children: React.ReactNode }) => <span className={small}>{children}</span>;
const Label = ({ children, note }: { children: React.ReactNode; note?: React.ReactNode }) => (
  <div className="hc-section-label">{children}{note ? <> <span className="font-normal text-dimmer">{note}</span></> : null}</div>
);

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

  const retireAge = Math.round(parseNum(s.retireAge)) || 62;
  const joint = s.status === "m";
  const household = parseInt(s.household) || (joint ? 2 : 1);
  const state = s.state || "IL";
  const manualPremium = parseNum(s.premium) || 0;

  /* The field is AGI, also the MAGI Medicare's IRMAA uses. The ACA adds back
     untaxed Social Security, found from the benefit: its taxable part depends
     on the other income, so repeated passes settle it (exact within a cent). */
  const magi = parseNum(s.income) || 0;
  const ssGross = parseNum(s.ss) || 0;
  let ssTaxed = 0;
  for (let it = 0; it < 150 && ssGross > 0; it++) ssTaxed = ssTaxable(ssGross, Math.max(0, magi - ssTaxed), joint ? "m" : "s").taxable;
  const acaMagi = magi + Math.max(0, ssGross - ssTaxed);

  // ── the ACA bridge ──
  const bridgeYears = Math.max(0, 65 - retireAge);
  const fpl = hcFPL(household);
  const pctFPL = acaMagi > 0 ? acaMagi / fpl : 0;
  const acaAge = Math.min(64, Math.max(21, retireAge));
  /* The credit is for the household: the benchmark for everyone enrolling
     (each adult at their own age; a spouse already 65 is on Medicare),
     children at the under-15 rate with at most three counted, less ONE
     contribution based on household income. */
  const spouseAge = Math.round(parseNum(s.spouseAge)) || retireAge;
  const spouseOn = joint && spouseAge < 65;
  const acaAge2 = Math.min(64, Math.max(21, spouseAge));
  const kids = Math.min(3, Math.max(0, household - (joint ? 2 : 1)));
  const childPrem = (((HC_STATE_PREMIUM_40 as Record<string, number>)[state] || 500) / (HC_AGE40_MULT as number)) * 0.765;
  const grossMonthly = manualPremium > 0 ? manualPremium
    : hcGrossPremium(state, acaAge, 0) + (spouseOn ? hcGrossPremium(state, acaAge2, 0) : 0) + kids * childPrem;
  const coveredDesc = (spouseOn ? (acaAge2 === acaAge ? "two adults age " + acaAge : "ages " + acaAge + " and " + acaAge2) : "age " + acaAge) +
    (kids ? " + " + kids + (kids === 1 ? " child" : " children") : "");
  const std = hcCalcACA(acaMagi, grossMonthly, pctFPL, false);
  const enh = hcCalcACA(acaMagi, grossMonthly, pctFPL, true);
  const usingStateEst = manualPremium <= 0;

  let aca: React.ReactNode;
  if (bridgeYears <= 0) {
    aca = <p className={empty}>Retiring at 65 or later: no ACA bridge needed. Medicare coverage begins at 65.</p>;
  } else if (acaMagi <= 0) {
    aca = <p className={empty}>Enter your expected retirement MAGI to see your ACA premium estimate.</p>;
  } else {
    const pctFPLStr = (pctFPL * 100).toFixed(0) + "%";
    const incNote = acaMagi > magi + 0.5 ? " (your MAGI plus " + money(acaMagi - magi) + " of untaxed Social Security, which the ACA counts)" : "";
    const medicaid = pctFPL < 1.0;
    const showEnhanced = (!std.eligible && enh.eligible) || (std.eligible && Math.abs(enh.net - std.net) > 5);
    const cliff400 = fpl * 4.0;
    aca = (
      <>
        {/* The headline is what 2026 actually costs; the enhanced figure is a what-if. */}
        <div className="hc-stats">
          <div className="hc-stat"><div className="v">{bridgeYears} yr{bridgeYears !== 1 ? "s" : ""}</div><div className="optlabel">years on ACA bridge</div></div>
          <div className="hc-stat"><div className="v">${r(std.eligible ? std.net : grossMonthly)}/mo</div><div className="optlabel">est. net Silver premium{spouseOn || kids ? ", whole household" : ""}</div></div>
        </div>
        {medicaid ? (
          <>
            <p className={lead}>Your income of {money(acaMagi)}{incNote} is <b>{pctFPLStr} of the federal poverty level</b> for a {household}-person household. Premium tax credits only begin at 100% FPL, so ACA subsidies do not apply here.</p>
            <div className="hc-insight">In the 40 states (plus DC) that expanded Medicaid under the ACA, an income this low typically qualifies you for Medicaid at little or no monthly premium. In the remaining non-expansion states there is a coverage gap: income is too high for Medicaid but too low for ACA subsidies, leaving limited options for subsidized coverage. Check your state&apos;s Medicaid eligibility rules.</div>
          </>
        ) : (
          <>
            <p className={lead}>Your income of {money(acaMagi)}{incNote} is <b>{pctFPLStr} of the federal poverty level</b> for a {household}-person household — this ratio drives your subsidy. {std.eligible
              ? "The ACA sets what you're expected to contribute toward health coverage at " + (std.pct * 100).toFixed(2) + "% of your income. The government covers whatever the Silver plan costs above that amount, in the form of a monthly premium tax credit applied at enrollment."
              : "That income is above the 400% FPL cutoff, so there is no credit and you would pay the Silver plan's full list price. The enhanced credits that removed this cutoff (capping your share at 8.5% of income) expired after 2025."}</p>
            <Label>2026 ACA rules</Label>
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
              <div className="hc-section">
                <Label note="(in place 2021–2025)">If Congress restores the enhanced credits</Label>
                <KV k={<>Premium tax credit <Sub>({(enh.pct * 100).toFixed(2)}% income cap, no 400% cliff)</Sub></>} cls="pos" v={"−$" + r(enh.credit) + "/mo"} />
                <div className="kv total"><span className="k">Your net premium (Silver)</span><span className="v">${r(enh.net)}/mo</span></div>
              </div>
            ) : null}
            <div className="hc-section">
              <Label note="(same credit applies to any tier)">Plan tier comparison</Label>
              <div className="hc-tier-row"><span>🥉 Bronze: lowest monthly cost; high deductible — you pay most costs out-of-pocket until you hit it</span><span>~${r(Math.max(0, grossMonthly * 0.75 - std.credit))}/mo</span></div>
              <div className="hc-tier-row hc-tier-sel"><span>🥈 Silver: the credit is built around this tier; also unlocks cost-sharing reductions at lower incomes</span><span>${r(std.net)}/mo</span></div>
              <div className="hc-tier-row"><span>🥇 Gold: higher monthly cost; lower deductible and copays — better if you expect to use a lot of care</span><span>~${r(Math.max(0, grossMonthly * 1.25 - std.credit))}/mo</span></div>
            </div>
            {spouseOn ? (
              <div className="hc-insight">For a couple, <b>both spouses need their own plan</b>, and the figures above cover both of you. The credit is worked out for the household as a whole: the benchmark for both plans, less one contribution based on your combined income. {std.eligible ? "That's why a subsidized couple pays about what one person at the same income would, not double." : "Above the 400% cliff there is no credit, so you pay both full premiums."}</div>
            ) : null}
            {/* Near the 400% cliff, where a dollar more income loses the whole credit. */}
            {std.eligible && pctFPL > 3.5 && acaMagi < cliff400 ? (
              <div className="hc-insight">⚠️ Your income is <b>{money(cliff400 - acaMagi)} below</b> the 400% FPL cliff. Every dollar above ${r(cliff400).toLocaleString()} eliminates the entire subsidy, adding ${r(std.credit)}/mo instantly. Roth conversions or portfolio decisions that push income over this line have an outsized cost.</div>
            ) : null}
          </>
        )}
        <div className="hc-note">
          {usingStateEst
            ? "Benchmark Silver premium is a state-level estimate for " + state + " scaled by age, for " + coveredDesc + ". " +
              (kids ? "Children are priced as under-15 enrollees; at lower incomes many qualify for CHIP or Medicaid instead. " : "")
            : "Using your entered benchmark premium. "}
          Enter your actual quote from <a href="https://healthcare.gov" target="_blank">healthcare.gov</a> in the sidebar for precision. Credits for 2026 use the IRS&apos;s 2026 contribution percentages and the 2025 poverty guidelines. The enhanced credits of 2021–2025, which removed the 400% FPL cliff and capped contributions at 8.5% of income, expired at the end of 2025; the House passed an extension in January 2026, but it has not become law.
        </div>
      </>
    );
  }

  // ── Medicare ──
  const tier = irmaaTier(magi, joint);
  const [, , partB, partDIrmaa] = HC_IRMAA[tier];
  const partD = HC_PARTD_BASE + partDIrmaa;
  const totalLow = partB + partD + HC_MEDIGAP_LOW, totalHigh = partB + partD + HC_MEDIGAP_HIGH;
  const hasIrmaa = tier > 0;
  const people = joint ? 2 : 1;
  let medicare: React.ReactNode;
  if (magi <= 0) {
    medicare = <p className={empty}>Enter your expected retirement MAGI to see Medicare cost estimates. Medicare uses your income from <b>two years prior</b> to determine surcharges.</p>;
  } else {
    const prev = hasIrmaa ? HC_IRMAA[tier - 1] : null;
    const next = tier < HC_IRMAA.length - 1 ? HC_IRMAA[tier + 1] : null;
    const save = prev ? partB - prev[2] + (partDIrmaa - prev[3]) : 0;
    const nextThreshold = next ? next[joint ? 1 : 0] : 0;
    const nextCost = next ? next[2] - partB + (next[3] - partDIrmaa) : 0;
    medicare = (
      <>
        <p className={lead}><b>Part B</b> covers doctor visits, outpatient care, and preventive services. <b>Part D</b> covers prescription drugs. Most enrollees add a <b>Medigap supplement</b> (like Plan G) which covers deductibles and copays that Parts A and B leave unpaid, capping your out-of-pocket exposure. Higher incomes trigger IRMAA surcharges that raise the Part B and Part D premiums.</p>
        <div className={"hc-irmaa-badge" + (hasIrmaa ? " hc-irmaa-hit" : "")}>IRMAA {TIER_NAMES[tier]}{hasIrmaa ? ": income surcharge applies" : ": standard premium"}</div>
        <KV k={<>Part B premium{hasIrmaa ? <> <Sub>includes IRMAA surcharge</Sub></> : null}</>} v={"$" + partB.toFixed(0) + "/mo per person"} />
        <KV k={<>Part D estimate <Sub>{partDIrmaa > 0 ? "~$" + HC_PARTD_BASE + " avg plan + $" + partDIrmaa.toFixed(0) + " IRMAA" : "avg plan, no IRMAA"}</Sub></>} v={"~$" + r(partD) + "/mo per person"} />
        <KV k={<>Medigap Plan G <Sub>varies by state, insurer &amp; age</Sub></>} v={"~$" + HC_MEDIGAP_LOW + "–$" + HC_MEDIGAP_HIGH + "/mo per person"} />
        <div className="kv total"><span className="k">Estimated total per person</span><span className="v">~${r(totalLow)}–${r(totalHigh)}/mo</span></div>
        {joint ? <KV k={<>For the couple <Sub>both at same IRMAA tier</Sub></>} v={"~$" + r(totalLow * 2) + "–$" + r(totalHigh * 2) + "/mo"} /> : null}
        {prev ? (
          <div className="hc-insight">Your income is <b>{money(magi - prev[joint ? 1 : 0], 0)} above</b> the {TIER_NAMES[tier]} threshold (${prev[joint ? 1 : 0].toLocaleString()}). Reducing MAGI below that threshold saves <b>${r(save)}/mo per person</b> (${r(save * people * 12).toLocaleString()}/yr{joint ? " for the couple" : ""}) in Medicare premiums. Roth conversions and capital gains realizations both count toward IRMAA.</div>
        ) : null}
        {next && nextThreshold - magi < 25000 ? (
          <div className="hc-insight">Your income is <b>{money(nextThreshold - magi, 0)} below</b> the next IRMAA threshold (${nextThreshold.toLocaleString()}). Crossing it adds <b>${r(nextCost)}/mo per person</b> (${r(nextCost * people * 12).toLocaleString()}/yr{joint ? " for the couple" : ""}). Consider this before large Roth conversions or realizing capital gains.</div>
        ) : null}
        <div className="hc-note">Medicare costs use CMS&apos;s 2026 figures: a $202.90 standard Part B premium and 2026 IRMAA tiers. Medicare applies the surcharge based on your income from <b>two years prior</b>, so income in retirement year 1 may not affect Part B until year 3. Part D estimate is a national average plus IRMAA; your actual plan premium varies. Medigap Plan G estimates are rough national ranges at age 65, and state, insurer, and enrollment age make a significant difference. Medicare Advantage (Part C) plans often have lower monthly premiums but different cost-sharing and network rules.</div>
      </>
    );
  }

  return (
    <>
      <aside id="asideHC">
        <div className="panel inputs">
          <h2>Your situation</h2>
          <div className="body">
            <NumberField id="hcRetireAge" label="Retirement age" unit="age" max={75} value={s.retireAge} onValueChange={set("retireAge")} />
            <div className="two">
              <SelectField id="hcStatus" label="Filing status" value={s.status} onChange={set("status")}>
                <option value="s">Single</option>
                <option value="m">Married</option>
              </SelectField>
              <SelectField id="hcHousehold" label="Household" value={s.household} onChange={set("household")}>
                {[1, 2, 3, 4, 5, 6].map((n) => <option key={n} value={String(n)}>{n} {n === 1 ? "person" : "people"}</option>)}
              </SelectField>
            </div>
            <NumberField id="hcSpouseAge" wrapId="hcSpouseAgeWrap" hidden={!joint} label={<Tipped text="Spouse's age then" k="hcspouseage" />} unit="age" max={90} value={s.spouseAge} onValueChange={set("spouseAge")} />
            <SelectField id="hcState" label="State" value={s.state} onChange={set("state")}>
              {HC_STATES.map(([code, name]) => <option key={code} value={code}>{name}</option>)}
            </SelectField>
            <Field id="hcIncome" label={<Tipped text="Retirement MAGI" k="hcincome" />}>
              <Affixed prefix="$"><MoneyInput id="hcIncome" nonNeg value={s.income} onValueChange={set("income")} /></Affixed>
              <Button variant="outline" size="sm" className="mt-1.5" id="hcCopyTax"
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
              <Button variant="outline" size="sm" className="mt-1" id="hcGoTax"
                onClick={() => {
                  setToolInputs("tax", { ...toolInputs("tax", TAX_DEFAULTS), mode: "retire" });
                  router.push("/incometax");
                }}>Open Income Tax</Button>
            </Field>
            <MoneyField id="hcSS" label={<>Social Security received <span className="tipglue"><span className="opt">optional</span><TipDot k="hcss" /></span></>} unit="/yr" value={s.ss} onValueChange={set("ss")} />
            <Field id="hcManualPremium" label={<Tipped text="ACA benchmark premium" k="hcbenchmark" />}>
              <Affixed prefix="$"><MoneyInput id="hcManualPremium" nonNeg placeholder="state est. if blank" value={s.premium} onValueChange={set("premium")} /></Affixed>
            </Field>
          </div>
        </div>
      </aside>

      <div className="stack" id="tab-healthcare">
        <div className="panel">
          <h2>Pre-65: ACA bridge</h2>
          <div className="body" id="hcACABody">{aca}</div>
        </div>
        <div className="panel">
          <h2>Post-65: Medicare</h2>
          <div className="body" id="hcMedicareBody">{medicare}</div>
        </div>
      </div>
    </>
  );
}
