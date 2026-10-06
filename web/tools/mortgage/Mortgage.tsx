"use client";

/* The Mortgage Calculator: the monthly payment with everything in it, how
   the balance falls, and extra payments, a recast or a refinance. Ported
   from src/js/app/12-mortgage.js and src/main/19-mortgage-inputs.html,
   21-mortgage.html. */

import { useRef } from "react";
import { BandChart } from "@/components/charts/BandChart";
import { Legend, ShareBar } from "@/components/charts/Legend";
import { FieldHeading, MoneyField, NumberField, SelectField } from "@/components/fields/Field";
import { Tipped, TipDot } from "@/components/shell/Tooltips";
import { useToolState } from "@/components/tools/ToolState";
import { Figure, KV } from "@/components/common/Readout";
import { CsvButton } from "@/components/common/CsvButton";
import { PMI_DEFAULT } from "@/lib/engine/typed";
import { fmtNum, groupDigits, money, parseNum, pctStr } from "@/lib/format";
import { MORTGAGE_DEF as DEF, dur, mortgageCompute, when, type Inputs } from "./model";
import { useShareKit } from "@/components/shell/share";
import { mortgageShare } from "./share";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";



/* PMI only exists below 20% down, so its field follows: a default rate when
   PMI applies, 0 when it doesn't, rather than showing a rate that isn't used. */
function withPmi(s: Inputs): Inputs {
  const price = parseNum(s.price), down = parseNum(s.downAmt);
  const ltv = price > 0 ? (price - down) / price : 0;
  const cur = parseNum(s.pmi);
  if (ltv > 0.8 && cur === 0) return { ...s, pmi: String(PMI_DEFAULT) };
  if (ltv <= 0.8 && cur !== 0) return { ...s, pmi: "0" };
  return s;
}
/* The two down-payment fields mirror each other; whichever was typed in wins. */
const amtFromPct = (s: Inputs) => ({ ...s, downAmt: groupDigits((parseNum(s.price) * parseNum(s.downPct) / 100).toFixed(0), true) });
const pctFromAmt = (s: Inputs) => {
  const price = parseNum(s.price);
  return { ...s, downPct: price > 0 ? String(Math.round((parseNum(s.downAmt) / price) * 10000) / 100) : "0" };
};

const TERMS = (
  <>
    <option value="30">30 years</option>
    <option value="20">20 years</option>
    <option value="15">15 years</option>
    <option value="10">10 years</option>
  </>
);

export function Mortgage() {
  const { state: s, set, setState } = useToolState(DEF);
  useShareKit(DEF.id, mortgageShare(s));
  const table = useRef<HTMLTableElement>(null);
  const setDown = (k: "price" | "downPct" | "downAmt") => (v: string) =>
    setState((cur) => {
      const next = { ...cur, [k]: v };
      return withPmi(k === "downAmt" ? pctFromAmt(next) : amtFromPct(next));
    });

  const { m, R, base, sooner, interestSaved, RF } = mortgageCompute(s);

  const pmiNote = R.ltv > 0.8
    ? R.pmiEndMonth
      ? `PMI applies below 20% down. At this pace it ends around ${when(R.pmiEndMonth)} (federal law requires automatic removal at 22% equity either way).`
      : "PMI applies below 20% down. You can have it removed once you reach 20% equity, and federal law ends it automatically at 22%."
    : "No PMI; you're at or above 20% down.";

  // Name only what's actually in the figure.
  const escParts = ([[R.tax, "tax"], [R.ins, "insurance"], [R.pmi, "PMI"], [R.hoa, "HOA"], [R.maint, "upkeep"], [R.util, "utilities"]] as const)
    .filter((x) => x[0] > 0).map((x) => x[1] as string);
  const escTxt = escParts.length < 2 ? escParts.join("") : escParts.slice(0, -1).join(", ") + " and " + escParts[escParts.length - 1];

  const t = R.total || 1;
  const bars: [string, number, string][] = [
    ["Principal & interest", R.pi, "#4fbf95"], ["Property tax", R.tax, "#e9b872"], ["Homeowners insurance", R.ins, "#7d9fd6"],
  ];
  if (R.pmi > 0) bars.push(["Mortgage insurance (PMI)", R.pmi, "#e2795f"]);
  if (R.hoa > 0) bars.push(["HOA dues", R.hoa, "#8ba0ac"]);
  if (R.maint > 0) bars.push(["Maintenance", R.maint, "#b48ec4"]);
  if (R.util > 0) bars.push(["Utilities", R.util, "#6fb0a6"]);

  // Extra payments and refinancing, measured against the same loan without them.
  let extra: React.ReactNode = null;
  if (base) {
    extra = (
      <>
        <KV k="Payoff" v={when(R.payoffMonth) + (sooner > 0 ? ` (${dur(sooner)} sooner)` : "")} cls="pos" />
        <KV k="Interest saved" v={money(interestSaved)} cls="pos" />
        {R.recastPI != null ? <KV k="Payment after the recast" v={money(R.recastPI) + "/mo"} /> : null}
      </>
    );
  }

  // The balance falling against cumulative interest and principal paid.
  let ci = 0, cp = 0;
  const pts = [{ year: 0, base: R.loan, hi: 0, lo: 0 }];
  for (const y of R.years) {
    ci += y.interest;
    cp += y.principal;
    pts.push({ year: y.year, base: y.balance, hi: cp, lo: ci });
  }

  return (
    <>
      <aside id="asideMort">
        <Card>
          <CardHeader><CardTitle>The home and loan</CardTitle></CardHeader>
          <CardContent>
            <MoneyField id="moPrice" label="Home price" value={s.price} onValueChange={setDown("price")} />
            <div className="two">
              <NumberField id="moDownPct" label="Down payment" unit="%" value={s.downPct} onValueChange={setDown("downPct")} />
              <MoneyField id="moDownAmt" label="or amount" value={s.downAmt} onValueChange={setDown("downAmt")} />
            </div>
            <div className="two">
              <NumberField id="moRate" label="Interest rate" unit="%" step={0.125} value={s.rate} onValueChange={set("rate")} />
              <SelectField id="moTerm" label="Length" value={s.term} onChange={set("term")}>{TERMS}</SelectField>
            </div>
            <div className="two">
              <NumberField id="moTax" label={<Tipped text="Property tax" k="proptax" />} unit="%/yr" step={0.1} value={s.tax} onValueChange={set("tax")} />
              <MoneyField id="moIns" label={<Tipped text="Insurance" k="homeinsurance" />} unit="/yr" value={s.ins} onValueChange={set("ins")} />
            </div>
            <div className="two">
              <NumberField id="moPmi" label={<Tipped text="PMI" k="pmi" />} unit="%/yr" step={0.1} value={s.pmi} onValueChange={set("pmi")} />
              <MoneyField id="moHoa" label="HOA" unit="/mo" value={s.hoa} onValueChange={set("hoa")} />
            </div>
            <div className="two">
              <NumberField id="moMaint" label={<Tipped text="Maintenance" k="maintenance" />} unit="%/yr" step={0.1} value={s.maint} onValueChange={set("maint")} />
              <MoneyField id="moUtil" label={<Tipped text="Utilities" k="utilities" />} unit="/mo" value={s.util} onValueChange={set("util")} />
            </div>
            <div className="hint" id="moPmiNote">{pmiNote}</div>
            <div className="derived">
              <div><span>Loan amount</span><span className="num" id="moLoan">{money(R.loan)}</span></div>
              <div><span>Down payment</span><span className="num" id="moDownShow">{money(m.down) + " (" + pctStr(m.price ? m.down / m.price : 0, 1) + ")"}</span></div>
              <div><span>Total interest paid</span><span className="num" id="moTotInt">{money(R.totalInterest)}</span></div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Already have this loan?</CardTitle></CardHeader>
          <CardContent>
            <SelectField id="moExtrasOn" label={<Tipped text="Extra payments, recasting, or refinancing" k="moextras" />} value={s.extrasOn} onChange={set("extrasOn")}>
              <option value="0">No, just the basics</option>
              <option value="1">Yes, show these options</option>
            </SelectField>
            <div id="moExtrasWrap" hidden={s.extrasOn !== "1"}>
              <FieldHeading className="mt-0.5">Extra payments</FieldHeading>
              <MoneyField id="moExtraMo" label="Extra toward principal" unit="/mo" value={s.extraMo} onValueChange={set("extraMo")} />
              <div className="two">
                <MoneyField id="moExtraOnce" label="One-time extra payment" value={s.extraOnce} onValueChange={set("extraOnce")} />
                <NumberField id="moExtraWhen" label="In month" value={s.extraWhen} onValueChange={set("extraWhen")} />
              </div>
              <SelectField id="moRecast" wrapId="moRecastWrap" label={<Tipped text="After that payment" k="recast" />} value={s.recast} onChange={set("recast")}>
                <option value="0">Keep the same payment, finish early</option>
                <option value="1">Recast &mdash; lower the payment instead</option>
              </SelectField>

              <FieldHeading className="mt-3">Compare a refinance</FieldHeading>
              <div className="two">
                <NumberField id="moRefiRate" label="New rate" unit="%" step={0.125} value={s.refiRate} onValueChange={set("refiRate")} />
                <SelectField id="moRefiTerm" label="New length" value={s.refiTerm} onChange={set("refiTerm")}>{TERMS}</SelectField>
              </div>
              <MoneyField id="moRefiCost" label={<Tipped text="Closing costs" k="reficost" />} value={s.refiCost} onValueChange={set("refiCost")} />
            </div>
          </CardContent>
        </Card>
      </aside>

      <div className="stack" id="tab-mortgage">
        <Card size="flush">
          <div className="headline">
            <Figure label="Monthly payment" id="moTotal" className="v gold" value={money(R.total)} note="Everything included" />
            <Figure label="Principal & interest" id="moPI" value={money(R.pi)} note="The loan itself" />
            <Figure label="Everything else" id="moEsc" value={money(R.total - R.pi)} noteId="moEscNote"
              note={escTxt ? escTxt.charAt(0).toUpperCase() + escTxt.slice(1) : "Nothing else added"} />
          </div>
          <CardContent>
            <div id="moBars">
              {bars.map(([label, v, c]) => <ShareBar key={label} label={label} value={v} share={v / t} color={c} />)}
            </div>
          </CardContent>
        </Card>

        <Card id="moExtraPanel" hidden={!R.extraActive && !m.refiOn}>
          <CardHeader><CardTitle>Extra payments &amp; refinancing</CardTitle></CardHeader>
          <CardContent>
            <div id="moExtraStats">{extra}</div>
            <div id="moRefiBlock" hidden={!RF}>
              <FieldHeading className="mt-1">Refinancing to <span id="moRefiHead">{RF ? `${pctStr(m.refiRate!, 2)} for ${fmtNum(m.refiTerm!)} years` : ""}</span></FieldHeading>
              <div id="moRefiStats">
                {RF ? (
                  <>
                    <KV k="New payment" v={money(RF.then.pi) + "/mo"} />
                    <KV k="Monthly change" v={(RF.monthlyDelta >= 0 ? "−" : "+") + money(Math.abs(RF.monthlyDelta)) + "/mo"} cls={RF.monthlyDelta >= 0 ? "pos" : "neg"} />
                    <KV k="Breaks even on closing costs" v={RF.breakEvenMonths == null ? "Never — payment doesn't drop"
                      : RF.breakEvenMonths <= 0 ? "Immediately — no closing costs to recover" : dur(RF.breakEvenMonths)} />
                    <KV k="Over the life of the loan" v={(RF.lifetimeDelta >= 0 ? "Saves " : "Costs ") + money(Math.abs(RF.lifetimeDelta))} cls={RF.lifetimeDelta >= 0 ? "pos" : "neg"} />
                  </>
                ) : null}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Loan balance and what you&apos;ve paid</CardTitle></CardHeader>
          <BandChart id="Mo" pts={pts} maxX={R.years.length || 1} enhanced ariaLabel="Mortgage balance over time"
            tip={(b) => (
              <>
                <b>Year {fmtNum(b.year)}</b>
                <br /><span className="text-gold">Balance</span> <span className="n">{money(b.base)}</span>
                <br /><span className="text-jade">Principal paid</span> <span className="n">{money(b.hi!)}</span>
                <br /><span className="text-coral">Interest paid</span> <span className="n">{money(b.lo!)}</span>
              </>
            )} />
          <Legend id="legendMo" items={[["#e9b872", "Balance remaining"], ["#4fbf95", "Principal paid"], ["#e2795f", "Interest paid"]]} />
        </Card>

        <Card>
          <CardHeader><CardTitle>Amortization by year<TipDot k="amort" /></CardTitle><CardAction><CsvButton table={table} label="Amortization by year" /></CardAction></CardHeader>
          <div className="swipehint">Swipe the table sideways to see every column.</div>
          <div className="scroll">
            <table id="moTable" ref={table}>
              <thead><tr><th>Year</th><th>Interest</th><th>Principal</th><th>Total paid</th><th>Balance</th></tr></thead>
              <tbody>
                {R.years.map((y) => (
                  <tr key={y.year}><td>{y.year}</td><td>{money(y.interest)}</td><td className="pos">{money(y.principal)}</td><td>{money(y.paid)}</td><td>{money(y.balance)}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </>
  );
}
