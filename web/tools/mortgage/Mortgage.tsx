"use client";

/* The Mortgage Calculator: the monthly payment with everything in it, how
   the balance falls, and extra payments, a recast or a refinance. Ported
   from src/js/app/12-mortgage.js and src/main/19-mortgage-inputs.html,
   21-mortgage.html.

   Laid out in Basic's thirds (the Mortgage critique, 2026-10-06): the home
   and loan in the left third, in four short groups; the results in the two
   thirds, answer first. The monthly payment is the hero reading, principal
   & interest and total interest beside it, and what the payment is made of
   right under it. Extra payments and refinancing sit together in one card
   under the reading, each column its inputs and then its before and after.
   On a phone a compact reading leads and stays pinned while the inputs are
   in view. */

import { useRef } from "react";
import { ChevronDownIcon, CircleAlertIcon, CircleCheckIcon, InfoIcon, TrendingDownIcon, TrendingUpIcon } from "lucide-react";
import { BandChart } from "@/components/charts/BandChart";
import { Legend, ShareBar } from "@/components/charts/Legend";
import { Affixed, Field, MoneyField, NumberField, SelectField } from "@/components/fields/Field";
import { MoneyInput, NumberInput } from "@/components/fields/NumberInput";
import { Tipped, TipDot } from "@/components/shell/Tooltips";
import { useToolState } from "@/components/tools/ToolState";
import { HeroReading, PinnedReading } from "@/components/common/Reading";
import { CsvButton } from "@/components/common/CsvButton";
import { PMI_DEFAULT } from "@/lib/engine/typed";
import { fmtNum, groupDigits, money, parseNum, pctStr } from "@/lib/format";
import { MORTGAGE_DEF as DEF, dur, mortgageCompute, when, type Inputs } from "./model";
import { useShareKit } from "@/components/shell/share";
import { mortgageShare } from "./share";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { SERIES, hatched } from "@/lib/hues";
import { cn } from "@/lib/utils";

function GroupHead({ first, children }: { first?: boolean; children: React.ReactNode }) {
  return <h3 className={cn("m-0 mb-3 text-sm font-semibold", first ? "mt-0" : "mt-1 border-t border-border pt-4")}>{children}</h3>;
}

/** A field's problem, under it: Loss, with an icon (DESIGN.md, Inputs). */
function FieldError({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <div className="mt-1.5 mb-3 flex items-start gap-2 text-note text-destructive">
      <CircleAlertIcon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      <span id={id}>{children}</span>
    </div>
  );
}

/** One figure in an extras / refinance answer: Label, the value at Display
    size (Body for a sentence), and a note. */
function Stat({ label, value, id, note, tone, words }: {
  label: React.ReactNode; value: React.ReactNode; id?: string; note?: React.ReactNode; tone?: "gain" | "loss"; words?: boolean;
}) {
  return (
    <div className="min-w-0" data-pair>
      <span className="block text-label text-muted-foreground" data-k>{label}</span>
      <span id={id} className={cn("block font-medium tabular-nums", words ? "mt-1 text-body leading-snug" : "text-2xl leading-tight sm:text-3xl",
        tone === "gain" ? "text-gain" : tone === "loss" ? "text-destructive" : "text-foreground")}>{value}</span>
      {note ? <span className="mt-0.5 block text-label text-muted-foreground">{note}</span> : null}
    </div>
  );
}



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

  /* Inputs the loan can't be built from: no price, or more down than the
     price. The figures are left as computed (no clamping); the fields are
     marked, the reading loses its amber and says what to fix, and the
     chart and table fold away. */
  const noPrice = !(m.price > 0);
  const overDown = !noPrice && m.down > m.price;
  const bad = noPrice || overDown;
  const hasYears = !bad && R.years.length > 0;

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
    ["Principal & interest", R.pi, SERIES.sky], ["Property tax", R.tax, SERIES.lavender], ["Homeowners insurance", R.ins, SERIES.teal],
  ];
  if (R.pmi > 0) bars.push(["Mortgage insurance (PMI)", R.pmi, SERIES.rose]);
  if (R.hoa > 0) bars.push(["HOA dues", R.hoa, SERIES.gray]);
  if (R.maint > 0) bars.push(["Maintenance", R.maint, hatched(SERIES.lavender)]);
  if (R.util > 0) bars.push(["Utilities", R.util, hatched(SERIES.teal)]);

  // Extra payments, measured against the same loan without them.
  let extra: React.ReactNode = null;
  if (base) {
    extra = (
      <div className="grid grid-cols-2 gap-x-6 gap-y-4">
        <Stat label="Payoff" value={when(R.payoffMonth)} words note={sooner > 0 ? dur(sooner) + " sooner" : undefined} />
        <Stat label="Interest saved" tone="gain" value={
          <span className="inline-flex items-center gap-2">
            <CircleCheckIcon className="size-5 shrink-0" aria-hidden="true" />{money(interestSaved)}
          </span>
        } />
        {R.recastPI != null ? (
          <div className="col-span-2">
            <Stat label="Payment after the recast" value={money(R.recastPI) + "/mo"} note={"Principal & interest, down from " + money(R.pi) + "/mo"} />
          </div>
        ) : null}
      </div>
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

  const extrasOn = s.extrasOn === "1";
  const panelOff = !R.extraActive && !m.refiOn;
  const saves = RF ? RF.monthlyDelta >= 0 : true;
  const lifeSaves = RF ? RF.lifetimeDelta >= 0 : true;

  return (
    <div className="col-span-full grid grid-cols-1 items-start gap-5 max-sm:gap-3.5 lg:grid-cols-3">
      <div className="min-w-0 lg:col-span-1 lg:self-stretch">
        {/* Phones and narrow screens: the answer leads, and stays under the
            tab rail while the inputs are on screen. The inputs don't pin on
            desktop: eleven fields in four groups are taller than a laptop's
            screen, and a scroller inside the page would hide the last ones. */}
        <PinnedReading tone={bad ? "text" : "answer"} main={{ label: "Monthly payment", value: money(R.total) }} side={{ label: "Principal & interest", value: money(R.pi) }} />

        <aside id="asideMort" className="static max-h-none overflow-visible">
          <Card>
            <CardHeader>
              <CardTitle>The home and loan</CardTitle>
              <CardDescription>What you&apos;d pay for the home, how you&apos;d borrow, and what owning it costs each month.</CardDescription>
            </CardHeader>
            <CardContent>
              <GroupHead first>The home</GroupHead>
              <Field id="moPrice" label="Home price">
                <Affixed prefix="$"><MoneyInput id="moPrice" nonNeg value={s.price} onValueChange={setDown("price")}
                  aria-invalid={noPrice || undefined} aria-describedby={noPrice ? "moPriceWarn" : undefined} /></Affixed>
                {noPrice ? <FieldError id="moPriceWarn">Enter a home price.</FieldError> : null}
              </Field>
              <div className="two bottomalign max-sm:grid-cols-2">
                <Field id="moDownPct" label="Down payment">
                  <Affixed suffix="%"><NumberInput id="moDownPct" nonNeg value={s.downPct} onValueChange={setDown("downPct")}
                    aria-invalid={overDown || undefined} aria-describedby={overDown ? "moDownWarn" : undefined} /></Affixed>
                </Field>
                <Field id="moDownAmt" label="or amount">
                  <Affixed prefix="$"><MoneyInput id="moDownAmt" nonNeg value={s.downAmt} onValueChange={setDown("downAmt")}
                    aria-invalid={overDown || undefined} aria-describedby={overDown ? "moDownWarn" : undefined} /></Affixed>
                </Field>
              </div>
              {overDown ? <FieldError id="moDownWarn">More than the home price.</FieldError> : null}
              <div className="mb-4 text-note">
                <div className="flex justify-between gap-4 py-0.5"><span className="text-muted-foreground">Loan amount</span><span className="tabular-nums" id="moLoan">{money(R.loan)}</span></div>
                <div className="flex justify-between gap-4 py-0.5"><span className="text-muted-foreground">Down payment</span><span className="tabular-nums" id="moDownShow">{money(m.down) + " (" + pctStr(m.price ? m.down / m.price : 0, 1) + ")"}</span></div>
              </div>

              <GroupHead>The loan</GroupHead>
              <div className="two max-sm:grid-cols-2">
                <NumberField id="moRate" label="Interest rate" unit="%" step={0.125} value={s.rate} onValueChange={set("rate")} />
                <SelectField id="moTerm" label="Length" value={s.term} onChange={set("term")}>{TERMS}</SelectField>
              </div>

              <GroupHead>Monthly costs</GroupHead>
              <div className="two bottomalign max-sm:grid-cols-2">
                <NumberField id="moTax" label={<Tipped text="Property tax" k="proptax" />} unit="%/yr" step={0.1} value={s.tax} onValueChange={set("tax")} />
                <MoneyField id="moIns" label={<Tipped text="Insurance" k="homeinsurance" />} unit="/yr" value={s.ins} onValueChange={set("ins")} />
              </div>
              <div className="two bottomalign max-sm:grid-cols-2">
                <NumberField id="moPmi" label={<Tipped text="PMI" k="pmi" />} unit="%/yr" step={0.1} value={s.pmi} onValueChange={set("pmi")} />
                <MoneyField id="moHoa" label="HOA" unit="/mo" value={s.hoa} onValueChange={set("hoa")} />
              </div>
              <div className="mb-4 flex items-start gap-2 text-note text-muted-foreground">
                <InfoIcon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                <span id="moPmiNote" className="text-pretty">{pmiNote}</span>
              </div>

              <GroupHead>Cost of owning</GroupHead>
              <div className="two bottomalign max-sm:grid-cols-2">
                <NumberField id="moMaint" label={<Tipped text="Maintenance" k="maintenance" />} unit="%/yr" step={0.1} value={s.maint} onValueChange={set("maint")} />
                <MoneyField id="moUtil" label={<Tipped text="Utilities" k="utilities" />} unit="/mo" value={s.util} onValueChange={set("util")} />
              </div>
            </CardContent>
          </Card>
        </aside>
      </div>

      <div className="stack min-w-0 lg:col-span-2" id="tab-mortgage">
        <Card size="flush" className="min-w-0" id="moReading">
          <div className={cn(bad && "opacity-60")}>
            <HeroReading tone={bad ? "text" : "answer"}
              hero={{ label: "Monthly payment", id: "moTotal", value: money(R.total), note: "Everything included" }}
              figures={[
                { label: "Principal & interest", id: "moPI", value: money(R.pi), note: "The loan itself" },
                { label: "Total interest paid", id: "moTotInt", value: money(R.totalInterest), note: "Over the life of the loan" },
              ]} />
          </div>
          {bad ? (
            <div id="moFix" className="flex items-start gap-2 border-t border-border px-5.5 py-3.5 text-body text-foreground max-sm:px-4">
              <InfoIcon className="mt-1 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
              <p className="m-0 max-w-copy">{noPrice ? "Enter a home price to see the payment." : "Fix the down payment to update the payment: it's more than the home price."}</p>
            </div>
          ) : null}
          {/* What the payment is made of: the loan, then everything else. */}
          <div className={cn("border-t border-border px-5.5 pt-4 pb-3 max-sm:px-4", bad && "opacity-60")}>
            <div className="mb-3.5 flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
              <h3 className="m-0 text-sm font-semibold">Where the payment goes</h3>
              <span className="text-label text-muted-foreground" data-pair>
                <span data-k>Everything else</span>
                <b className="ml-2 text-body font-medium text-foreground tabular-nums" id="moEsc">{money(R.total - R.pi)}</b>
                <span className="ml-2" id="moEscNote">{escTxt ? escTxt.charAt(0).toUpperCase() + escTxt.slice(1) : "Nothing else added"}</span>
              </span>
            </div>
            <div id="moBars" className="grid grid-cols-1 gap-x-8 sm:grid-cols-2">
              {bars.map(([label, v, c]) => <ShareBar key={label} label={label} value={v} share={v / t} color={c} />)}
            </div>
          </div>
        </Card>

        <Card className="min-w-0" id="moExtrasCard">
          <CardHeader>
            <CardTitle>Extra payments and refinancing</CardTitle>
            <CardDescription>For a new loan or one you already have.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="max-w-sm">
              <SelectField id="moExtrasOn" label={<Tipped text="Extra payments, recasting, or refinancing" k="moextras" />} value={s.extrasOn} onChange={set("extrasOn")}>
                <option value="0">No, just the basics</option>
                <option value="1">Yes, show these options</option>
              </SelectField>
            </div>
            {/* Each column: its inputs, then its answer, before against after.
                From 640px the two answers line up on one row. */}
            <div id="moExtrasWrap" hidden={!extrasOn} className={extrasOn ? "grid grid-cols-1 gap-x-8 sm:grid-cols-2" : undefined}>
              <div className="min-w-0 border-t border-border pt-4 sm:order-1">
                <GroupHead first>Paying extra</GroupHead>
                <MoneyField id="moExtraMo" label="Extra toward principal" unit="/mo" value={s.extraMo} onValueChange={set("extraMo")} />
                <div className="two bottomalign max-sm:grid-cols-2">
                  <MoneyField id="moExtraOnce" label="One-time extra payment" value={s.extraOnce} onValueChange={set("extraOnce")} />
                  <NumberField id="moExtraWhen" label="In month" value={s.extraWhen} onValueChange={set("extraWhen")} />
                </div>
                <SelectField id="moRecast" wrapId="moRecastWrap" label={<Tipped text="After that payment" k="recast" />} value={s.recast} onChange={set("recast")}>
                  <option value="0">Keep the same payment, finish early</option>
                  <option value="1">Recast &mdash; lower the payment instead</option>
                </SelectField>
              </div>
              <div className="min-w-0 border-t border-border pt-4 max-sm:order-3 sm:order-2">
                <GroupHead first>Refinancing</GroupHead>
                <div className="two bottomalign max-sm:grid-cols-2">
                  <NumberField id="moRefiRate" label="New rate" unit="%" step={0.125} value={s.refiRate} onValueChange={set("refiRate")} />
                  <SelectField id="moRefiTerm" label="New length" value={s.refiTerm} onChange={set("refiTerm")}>{TERMS}</SelectField>
                </div>
                <MoneyField id="moRefiCost" label={<Tipped text="Closing costs" k="reficost" />} value={s.refiCost} onValueChange={set("refiCost")} />
              </div>
              <div id="moExtraPanel" hidden={panelOff} className={panelOff ? undefined : "contents"}>
                <div className="mb-4 min-w-0 rounded-(--r-panel) bg-muted/50 p-4 max-sm:order-2 sm:order-3 sm:col-start-1" hidden={!base}>
                  <h4 className="m-0 mb-3 text-label font-normal text-muted-foreground">With the extra payments</h4>
                  <div id="moExtraStats">{extra}</div>
                </div>
                <div id="moRefiBlock" hidden={!RF} className="mb-4 min-w-0 rounded-(--r-panel) bg-muted/50 p-4 max-sm:order-4 sm:order-4 sm:col-start-2">
                  <h4 className="m-0 mb-3 text-label font-normal text-muted-foreground">Refinancing to <span id="moRefiHead">{RF ? `${pctStr(m.refiRate!, 2)} for ${fmtNum(m.refiTerm!)} years` : ""}</span></h4>
                  <div id="moRefiStats">
                    {RF ? (
                      <div className="grid grid-cols-2 gap-x-6 gap-y-4">
                        <Stat label="New payment" value={money(RF.then.pi) + "/mo"} note={"Principal & interest, from " + money(R.pi) + "/mo"} />
                        {/* A real change in money: Gain or Loss, with a glyph and a word beside the figure. */}
                        <Stat label="Monthly change" tone={saves ? "gain" : "loss"} words value={
                          <span className="inline-flex items-center gap-1.5">
                            {saves ? <TrendingDownIcon className="size-4 shrink-0" aria-hidden="true" /> : <TrendingUpIcon className="size-4 shrink-0" aria-hidden="true" />}
                            {saves ? "Saves" : "Costs"} <span className="whitespace-nowrap">{(saves ? "−" : "+") + money(Math.abs(RF.monthlyDelta)) + "/mo"}</span>
                          </span>
                        } />
                        <Stat label="Breaks even on closing costs" words value={RF.breakEvenMonths == null ? "Never — payment doesn't drop"
                          : RF.breakEvenMonths <= 0 ? "Immediately — no closing costs to recover" : dur(RF.breakEvenMonths)} />
                        <Stat label="Over the life of the loan" tone={lifeSaves ? "gain" : "loss"} words value={
                          <span className="inline-flex items-center gap-1.5">
                            {lifeSaves ? <CircleCheckIcon className="size-4 shrink-0" aria-hidden="true" /> : <CircleAlertIcon className="size-4 shrink-0" aria-hidden="true" />}
                            {(lifeSaves ? "Saves " : "Costs ") + money(Math.abs(RF.lifetimeDelta))}
                          </span>
                        } />
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="min-w-0" hidden={!hasYears}>
          <CardHeader>
            <CardTitle>Loan balance and what you&apos;ve paid</CardTitle>
            <CardDescription>What&apos;s left on the loan, against the principal and the interest paid so far.</CardDescription>
          </CardHeader>
          {/* On screen the gap between the two paid lines isn't filled (it
              isn't a range); the printed summary and share card copy this
              chart, so their fill stays. */}
          <BandChart id="Mo" pts={pts} maxX={R.years.length || 1} enhanced ariaLabel="Mortgage balance over time" screenOnly={{ noBand: true }}
            tip={(b) => (
              <>
                <b>Year {fmtNum(b.year)}</b>
                <br /><i className="tipsw bg-series-plan"></i>Balance <span className="n">{money(b.base)}</span>
                <br /><i className="tipsw bg-series-teal"></i>Principal paid <span className="n">{money(b.hi!)}</span>
                <br /><i className="tipsw bg-series-rose"></i>Interest paid <span className="n">{money(b.lo!)}</span>
              </>
            )} />
          <Legend id="legendMo" items={[[SERIES.plan, "Balance remaining"], [SERIES.teal, "Principal paid"], [SERIES.rose, "Interest paid"]]} />
        </Card>

        <div className="min-w-0" hidden={!hasYears}>
          <Collapsible render={<Card />}>
            <CardHeader>
              <CardTitle><CollapsibleTrigger>Amortization by year<ChevronDownIcon aria-hidden="true" /></CollapsibleTrigger><TipDot k="amort" /></CardTitle>
              <CardAction><CsvButton table={table} label="Amortization by year" /></CardAction>
            </CardHeader>
            <CollapsibleContent keepMounted>
              <div className="swipehint">Swipe the table sideways to see every column.</div>
              <div className="scroll max-h-none">
                <table id="moTable" ref={table}>
                  <thead><tr><th>Year</th><th>Interest</th><th>Principal</th><th>Total paid</th><th>Balance</th></tr></thead>
                  <tbody>
                    {R.years.map((y) => (
                      <tr key={y.year}><td>{y.year}</td><td>{money(y.interest)}</td><td>{money(y.principal)}</td><td>{money(y.paid)}</td><td>{money(y.balance)}</td></tr>
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
