"use client";

/* Roth Conversion & RMDs (also the /rmd page): required distributions to
   the end of the plan, and a conversion schedule scored against doing
   nothing. Ported from src/js/app/17-roth.js and src/main/12-roth-inputs.html,
   13-roth.html. */

import { useRef, useState } from "react";
import { BandChart } from "@/components/charts/BandChart";
import { Legend } from "@/components/charts/Legend";
import { useHouseholdFill } from "@/components/household/HouseholdProvider";
import { Affixed, Field, FieldHeading, MoneyField, NumberField, SelectField } from "@/components/fields/Field";
import { MoneyInput } from "@/components/fields/NumberInput";
import { useToast } from "@/components/shell/Toast";
import { Tipped } from "@/components/shell/Tooltips";
import { toolInputs, useToolState } from "@/components/tools/ToolState";
import { CsvButton } from "@/components/common/CsvButton";
import { Figure, KV, Segmented } from "@/components/common/Readout";
import { runRoth } from "@/lib/engine/typed";
import type { RothResult } from "@/lib/engine/types";
import { DASH, fmtNum, groupDigits, money, parseNum, pctStr } from "@/lib/format";
import { STATE_OPTIONS } from "@/lib/states";
import { DRAWDOWN_DEFAULTS } from "@/tools/drawdown/fields";
import { ROTH_DEF, rothInput, type RothInputs } from "./model";
import { useShareKit } from "@/components/shell/share";
import { rothShare } from "./share";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { SERIES } from "@/lib/hues";

export function Roth() {
  const { state: s, set, setState } = useToolState(ROTH_DEF);
  useShareKit(ROTH_DEF.id, rothShare(s));
  const toast = useToast();
  const [view, setView] = useState<"bal" | "tax">("bal");
  const [tableView, setTableView] = useState<"plan" | "base">("plan");
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
  const plan = any ? runRoth(inp, true) : null;
  const base = any ? runRoth(inp, false) : null;

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
    const pts = plan.rows.map((p, i) => {
      const b = base.rows[i];
      const x = view === "bal" ? p.trad : p.tax + p.irmaa, y = view === "bal" ? b.trad : b.tax + b.irmaa;
      return { year: p.age - inp.age, base: x, hi: y, lo: Math.min(x, y) };
    });
    return { taxSaved, nwDelta, be, wRow, widow, verdict, pts, T: tableView === "plan" ? plan : base };
  }
  const R = plan && base ? compare(plan, base) : null;
  const firstRMD = plan?.rows.find((x) => x.rmd > 0);
  const convYears = plan ? plan.rows.filter((x) => x.conv > 0).length : 0;

  return (
    <>
      <aside id="asideRC">
        <Card>
          <CardHeader><CardTitle>Your situation</CardTitle></CardHeader>
          <CardContent>
            <div className="two">
              <NumberField id="rcAge" label="Your age" unit="age" max={95} value={s.age} onValueChange={set("age")} />
              <NumberField id="rcEndAge" label="Plan through" unit="age" max={100} value={s.endAge} onValueChange={set("endAge")} />
            </div>
            <SelectField id="rcStatus" label="Filing status" value={s.status} onChange={set("status")}>
              <option value="m">Married filing jointly</option>
              <option value="s">Single</option>
            </SelectField>
            <NumberField id="rcSpouseAge" wrapId="rcSpouseWrap" hidden={!married} label="Spouse's age" unit="age" max={105} value={s.spouseAge} onValueChange={set("spouseAge")} />
            <SelectField id="rcState" label="State" value={s.state} onChange={set("state")}>
              {STATE_OPTIONS.map((o) => <option key={o.code} value={o.code}>{o.name}</option>)}
            </SelectField>

            <FieldHeading className="mt-2">What you have</FieldHeading>
            <Field id="rcTrad" label={<Tipped text="Traditional 401(k) / IRA" k="rctrad" />}>
              <Affixed prefix="$"><MoneyInput id="rcTrad" nonNeg value={s.trad} onValueChange={set("trad")} /></Affixed>
              <Button variant="outline" size="sm" className="mt-1.5" id="rcCopyDD"
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
            </Field>
            <div className="two">
              <MoneyField id="rcRoth" label="Roth" value={s.roth} onValueChange={set("roth")} />
              <MoneyField id="rcBrok" label="Brokerage" value={s.brok} onValueChange={set("brok")} />
            </div>
            <div className="two">
              <NumberField id="rcBasis" label={<Tipped text="Cost basis" k="rcbasis" />} unit="% of balance" step={5} max={100} value={s.basis} onValueChange={set("basis")} />
              <NumberField id="rcReturn" label={<Tipped text="Real return" k="realreturn" />} unit="%/yr" step={0.5} value={s.ret} onValueChange={set("ret")} />
            </div>

            <FieldHeading className="mt-2">Income and spending</FieldHeading>
            <MoneyField id="rcSpend" label={<Tipped text="Annual spending" k="rcspend" />} value={s.spend} onValueChange={set("spend")} />
            <div className="two">
              <MoneyField id="rcSS" label="Your Social Security" unit="/yr" value={s.ss} onValueChange={set("ss")} />
              <NumberField id="rcSSAge" label="Claim at" unit="age" max={70} value={s.ssAge} onValueChange={set("ssAge")} />
            </div>
            <div className="two" id="rcSpouseSSWrap" hidden={!married}>
              <MoneyField id="rcSpSS" label="Spouse's benefit" unit="/yr" value={s.spSS} onValueChange={set("spSS")} />
              <NumberField id="rcSpSSAge" label="Claim at" unit="age" max={70} value={s.spSSAge} onValueChange={set("spSSAge")} />
            </div>
            <div className="two">
              <MoneyField id="rcOther" label={<Tipped text="Other income" k="rcother" />} unit="/yr" value={s.other} onValueChange={set("other")} />
              <NumberField id="rcOtherStart" label="Starting at" unit="age" max={100} value={s.otherStart} onValueChange={set("otherStart")} />
            </div>
            <NumberField id="rcDeath" wrapId="rcDeathWrap" hidden={!married} label={<Tipped text="Survivor transition" k="rcwidow" />} unit="yrs from now" max={45} value={s.death} onValueChange={set("death")} />

            <FieldHeading className="mt-2">The conversion plan</FieldHeading>
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
            <div className="two" id="rcWindowWrap" hidden={strat === "none"}>
              <NumberField id="rcStartAge" label="Convert from" unit="age" max={100} value={s.startAge} onValueChange={set("startAge")} />
              <NumberField id="rcStopAge" label="Through" unit="age" max={100} value={s.stopAge} onValueChange={set("stopAge")} />
            </div>
            <SelectField id="rcPayFrom" wrapId="rcPayWrap" hidden={strat === "none"} label={<Tipped text="Conversion tax paid from" k="rcpayfrom" />} value={s.payFrom} onChange={set("payFrom")}>
              <option value="taxable">Taxable account</option>
              <option value="withhold">Withheld from the conversion</option>
            </SelectField>

            <FieldHeading className="mt-2">How to score it</FieldHeading>
            <SelectField id="rcIrmaaOn" label={<Tipped text="Medicare IRMAA" k="irmaa" />} value={s.irmaaOn} onChange={set("irmaaOn")}>
              <option value="1">Include the surcharge</option>
              <option value="0">Ignore it</option>
            </SelectField>
            <div className="two">
              <NumberField id="rcHeir" label={<Tipped text="Rate on what's left" k="rcheir" />} unit="%" max={60} value={s.heir} onValueChange={set("heir")} />
              <NumberField id="rcDisc" label={<Tipped text="Discount rate" k="rcdisc" />} unit="%" step={0.5} max={15} value={s.disc} onValueChange={set("disc")} />
            </div>

            <div className="derived">
              <div><span><Tipped text="RMDs begin" k="rcrmdage" /></span><span className="num" id="rcRmdAge">{plan ? "Age " + plan.rmdStart : ""}</span></div>
              <div><span>First RMD</span><span className="num" id="rcFirstRMD">{plan ? (firstRMD ? money(firstRMD.rmd, 0) + " at " + firstRMD.age : "None in this window") : ""}</span></div>
              <div><span>Years converting</span><span className="num" id="rcConvYears">{plan ? (convYears ? fmtNum(convYears) + (convYears === 1 ? " year" : " years") : "None") : ""}</span></div>
              <div><span>Average conversion</span><span className="num" id="rcAvgConv">{plan ? (convYears ? money(plan.totalConv / convYears, 0) + "/yr" : DASH) : ""}</span></div>
            </div>
          </CardContent>
        </Card>
      </aside>

      <div className="stack" id="tab-roth">
        <Card size="flush">
          <div className="headline">
            <Figure label={<Tipped text="Lifetime tax saved" k="rcpv" />} id="rcSaved" className={R ? "v " + (R.taxSaved >= 0 ? "gold" : "neg") : "v gold"}
              value={R ? (R.taxSaved >= 0 ? "" : "−") + money(Math.abs(R.taxSaved)) : DASH} noteId="rcSavedNote"
              note={R ? "Lifetime tax + IRMAA, discounted at " + pctStr(inp.disc, 1) + " real" : ""} />
            <Figure label="After-tax net worth" id="rcNW" className={R ? "v " + (R.nwDelta >= 0 ? "pos" : "neg") : "v"}
              value={R ? (R.nwDelta >= 0 ? "+" : "−") + money(Math.abs(R.nwDelta)) : DASH} noteId="rcNWNote" note={R ? "After-tax, at age " + inp.endAge : ""} />
            <Figure label={<Tipped text="Peak RMD" k="rcpeak" />} id="rcPeak" value={plan && base ? money(base.peakRMD, 0) : DASH} noteId="rcPeakNote"
              note={plan && base ? (plan.peakRMD < base.peakRMD ? "Converting trims it to " + money(plan.peakRMD, 0) : "Unchanged by this plan") : ""} />
          </div>
          <CardContent><div id="rcVerdict">
            {R ? <div className="hint m-0">{R.verdict} Lifetime tax is what you and your heirs hand over; after-tax net worth is what is left standing at age {inp.endAge}, with traditional dollars discounted at {pctStr(inp.heirRate, 0)} because they are still owed to the IRS.</div> : null}
          </div></CardContent>
        </Card>

        <Card id="rcWidow" hidden={!R?.wRow}>
          <CardContent>
            <div className="font-semibold text-text mb-1.5">The survivor&apos;s bracket</div>
            <div className="hint m-0" id="rcWidowText">{R?.widow}</div>
          </CardContent>
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
            <div className="hint mt-3.5">Every figure is in today&apos;s dollars.
              Brackets, the standard deduction and the IRMAA thresholds are held fixed in
              real terms, which is what indexing does to them in practice.</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle id="rcChartTitle">{view === "bal" ? "Traditional balance" : "Tax paid each year"}</CardTitle><CardDescription>in today&apos;s dollars</CardDescription><CardAction>
              <Segmented id="segRC" attr="data-rc" options={[["bal", "Balance"], ["tax", "Tax"]] as const} value={view} onChange={setView} />
            </CardAction></CardHeader>
          <BandChart id="RC" pts={R?.pts ?? []} maxX={inp.endAge - inp.age} enhanced ariaLabel="Converting versus not converting"
            tip={(b) => (
              <>
                <b>Age {fmtNum(inp.age + b.year)}</b>
                <br /><i className="tipsw bg-series-plan"></i>Converting <span className="n">{money(b.base)}</span>
                <br /><i className="tipsw bg-series-gray"></i>No conversions <span className="n">{money(b.hi!)}</span>
              </>
            )} />
          <Legend id="legendRC" items={R ? [
            [SERIES.plan, view === "bal" ? "Traditional balance, converting" : "Tax paid, converting"],
            [SERIES.gray, view === "bal" ? "Traditional balance, no conversions" : "Tax paid, no conversions"],
          ] : []} />
        </Card>

        <Card>
          <CardHeader><CardTitle>Year by year</CardTitle><CardAction>
              <Segmented id="segRCTab" attr="data-rct" options={[["plan", "Converting"], ["base", "Doing nothing"]] as const} value={tableView} onChange={setTableView} />
              <CsvButton table={tableRef} label="Year by year" />
            </CardAction></CardHeader>
          <div className="swipehint">Swipe the table sideways to see every column.</div>
          <div className="scroll">
            <table id="rcTable" ref={tableRef}>
              <thead><tr><th>Age</th><th>Converted</th><th>RMD</th><th>Ordinary income</th><th>MAGI</th><th>Tax</th><th>IRMAA</th><th>Marginal</th><th>Traditional</th><th>Roth</th></tr></thead>
              <tbody>
                {R?.T.rows.map((y) => (
                  <tr key={y.age} className={y.widowed ? "rc-widow" : undefined}>
                    <td>{fmtNum(y.age)}</td><td>{y.conv > 0 ? money(y.conv, 0) : DASH}</td><td>{y.rmd > 0 ? money(y.rmd, 0) : DASH}</td>
                    <td>{money(y.ordinary, 0)}</td><td>{money(y.magi, 0)}</td><td>{money(y.tax, 0)}</td>
                    <td>{inp.irmaaOn && y.irmaa > 0 ? <>{money(y.irmaa, 0)} <span className="rc-tier">T{y.irmaaTier}</span></> : DASH}</td>
                    <td>{pctStr(y.marginal, 1)}</td><td>{money(y.trad, 0)}</td><td>{money(y.roth, 0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </>
  );
}

