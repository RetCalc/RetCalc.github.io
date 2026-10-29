"use client";

/* The Budget's Paycheck tab: one paycheck from gross pay through the taxes
   and the budget, and where what's left goes. The facts sit on the left
   (pay, schedule, filing status, state, what comes out through work, the
   budget as it comes across); the decisions sit on the right, as a slider
   per goal, with a plan to set them all at once and live figures above
   them. Every change reruns the taxes (paycheck-math.ts, on the Income Tax
   engine), and the itemized paycheck under it is the receipt. Designed in
   the mocks of 2026-10-15 (the tab) and 2026-10-18 (the sliders). */

import { useState } from "react";
import { Donut, type DonutPart } from "@/components/charts/Donut";
import { ShareBar } from "@/components/charts/Legend";
import { Affixed, Field, MoneyField, NumberField, SelectField } from "@/components/fields/Field";
import { MoneyInput } from "@/components/fields/NumberInput";
import { CsvButton } from "@/components/common/CsvButton";
import { BigValue } from "@/components/common/BigValue";
import { TipDot } from "@/components/shell/Tooltips";
import { NativeRange } from "@/components/ui/native-range";
import { Segmented } from "@/components/common/Readout";
import { HeroReading, PinnedReading } from "@/components/common/Reading";
import { useToolNav, useToolScope, useToolStore } from "@/components/tools/ToolState";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DASH, groupDigits, money } from "@/lib/format";
import { SERIES } from "@/lib/hues";
import { STATE_OPTIONS } from "@/lib/states";
import { cn } from "@/lib/utils";
import { TAX_DEFAULTS } from "@/tools/tax/model";
import { BracketsCard, StateRulesCard } from "@/tools/tax/TaxTables";
import { NEWEST_YEAR, yearData } from "@/lib/engine/typed";
import { ADVANCED_DEFAULTS } from "@/tools/advanced/model";
import { useHousehold } from "@/components/household/HouseholdProvider";
import { usePopup } from "@/components/shell/Popup";
import { useToast } from "@/components/shell/Toast";
import { PERIOD_ADV } from "@/lib/periods";
import { advancedHasSaving, intoAdvanced, paycheckCopy, taxFromPaycheck } from "./to-calculator";
import { annualize, type BudgetInputs } from "./model";
import {
  PC_LINES, PC_PLANS, PC_STEPS, PC_ZERO, healthRowMonthly, paycheckInput, paycheckRun, pcAmountKey, pcCap, pcCatchText, pcCostPer, pcHasLimit, pcMost,
  pcPlanApply, pcPlanOrder, pcRothRoom, pcPreTax, pcRothKey, pcSplit, rowRole, type PcAges, type PcPlan, type PcRun, type PcStep,
} from "./paycheck-math";

type SetState = (fn: (c: BudgetInputs) => BudgetInputs) => void;

const FREQS = [["52", "Every week"], ["26", "Every two weeks"], ["24", "Twice a month"], ["12", "Monthly"]] as const;
/** The donut's four parts, in order. */
const PART_COLORS = [SERIES.teal, SERIES.rose, SERIES.lavender, SERIES.plan];

/* Cents for one check; whole dollars for a month or a year. */
const cents = (v: number) => money(v, 2);
const amountText = (v: number) => groupDigits(String(Math.round(v * 100) / 100), true);

export function Paycheck({ s, set, setState }: {
  s: BudgetInputs;
  set: <K extends keyof BudgetInputs>(k: K) => (v: BudgetInputs[K]) => void;
  setState: SetState;
}) {
  const store = useToolStore(), go = useToolNav(), scope = useToolScope();
  // The Dashboard keeps pay, filing status, state and the match itself, and
  // says them here in place of the fields.
  const facts = scope?.slots?.payFacts;
  const tax = store.read("tax", TAX_DEFAULTS), taxState = tax.state;
  // In the Dashboard the paycheck is the household's one tax figure, so its
  // itemized deductions count here too.
  // Ages for the catch-up limits come from the household bar (or the
  // Dashboard's profile), never from fields here. The bar holds today's age,
  // so a birthday later this year isn't counted.
  const { profile } = useHousehold(), hh = scope && scope.household !== undefined ? scope.household : profile;
  const known = (n: number | null | undefined) => (n != null && n >= 15 && n < 120 ? Math.round(n) : null);
  const ages: PcAges = scope?.slots?.ages ?? [known(hh?.age), hh?.status === "m" ? known(hh.spouseAge) : null];
  const pi = paycheckInput(s, taxState, scope?.name === "dashboard" ? { ...tax, useItem: true } : tax, ages);
  const r = paycheckRun(pi);
  const base = paycheckRun(pi, PC_ZERO);
  // Married, two incomes: the household by the month; otherwise one paycheck.
  const two = pi.two, per = two ? "month" : "check";
  const empty = !(pi.gross + pi.gross2 > 0);
  const short = !empty && r.left <= -0.01;
  // Unassigned, with less than a cent either way shown as nothing: amounts
  // are kept in cents, and taxes and pay aren't.
  const left = Math.abs(r.left) < 0.01 ? 0 : r.left;
  const [active, setActive] = useState<number | null>(null);


  // The health premiums' field: the Budget's row per check until typed over.
  const healthDerived = s.pcHealth.trim() === "";
  const healthRow = healthRowMonthly(s);

  /* ---- the reading ---- */
  const parts: DonutPart[] = [
    { label: "Savings and investing", v: r.saved, c: PART_COLORS[0] },
    { label: "Taxes", v: r.taxes, c: PART_COLORS[1] },
    { label: "Expenses", v: r.spend + r.health, c: PART_COLORS[2] },
    { label: "Unassigned", v: Math.max(0, r.left), c: PART_COLORS[3] },
  ];

  return (
    <>
      <div className="min-w-0 lg:col-span-1 lg:self-stretch">
        <PinnedReading tone={empty ? "text" : short ? "loss" : "answer"}
          main={{ label: "Saved and invested, each " + per, value: empty ? DASH : money(r.saved) }}
          side={{ label: short ? "Short" : "Unassigned", value: empty ? DASH : money(left) }} />
        <aside id="asidePaycheck" className="max-lg:static max-lg:max-h-none max-lg:overflow-visible">
          <Card>
            <CardHeader><CardTitle>{two ? "Your paychecks" : "Your paycheck"}</CardTitle></CardHeader>
            <CardContent>
              {facts ?? (
                <>
                  {/* Filing status first: it decides whether there's one pay to
                      ask for or two. Switching to two incomes starts the HSA on
                      one each: two earners usually each have their own plan. */}
                  <SelectField id="pcStatus" label="Filing status" value={s.pcStatus}
                    onChange={(v) => setState((c) => ({ ...c, pcStatus: v, ...(v === "m2" && c.pcStatus !== "m2" ? { pcHsaFamily: false, pcHsaBoth: true } : {}) }))}>
                    <option value="s">Single</option>
                    <option value="m">Married, one income</option>
                    <option value="m2">Married, two incomes</option>
                  </SelectField>
                  {two ? (
                    <>
                      <div className="grid grid-cols-2 items-end gap-x-2.5 max-sm:grid-cols-1">
                        <MoneyField id="pcGross" label="Your gross pay, per year" value={s.pcGross} onValueChange={set("pcGross")} />
                        <MoneyField id="pcGross2" label="Spouse's gross pay, per year" value={s.pcGross2} onValueChange={set("pcGross2")} />
                      </div>
                      {/* Each person's own schedule: it sets their check in the itemized paycheck. */}
                      <div className="grid grid-cols-2 items-end gap-x-2.5 max-sm:grid-cols-1">
                        <SelectField id="pcFreq" label="You're paid" value={s.pcFreq} onChange={set("pcFreq")}>
                          {FREQS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                        </SelectField>
                        <SelectField id="pcFreq2" label="Your spouse is paid" value={s.pcFreq2} onChange={set("pcFreq2")}>
                          {FREQS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                        </SelectField>
                      </div>
                      <div className="hint -mt-1.5 mb-3.5">Planned by the month, since two paychecks rarely line up; the itemized paycheck shows each of your checks. Taxed together as a joint return.</div>
                    </>
                  ) : (
                    <div className="grid grid-cols-2 items-end gap-x-2.5 max-sm:grid-cols-1">
                      <MoneyField id="pcGross" label="Gross pay, per year" value={s.pcGross} onValueChange={set("pcGross")} />
                      <SelectField id="pcFreq" label="Paid" value={s.pcFreq} onChange={set("pcFreq")}>
                        {FREQS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                      </SelectField>
                    </div>
                  )}
                  <SelectField id="pcState" label="State" value={pi.state} onChange={set("pcState")}>
                    {STATE_OPTIONS.map((o) => <option key={o.code} value={o.code}>{o.name}</option>)}
                  </SelectField>
                </>
              )}

              <GroupHead>Through work</GroupHead>
              {/* The mock's one field: the Budget's Health insurance row per check
                  until typed over; 0 means not through work, and the row stays
                  an expense. */}
              {/* With two incomes, one field per job: premiums come off the
                  Social Security and Medicare of the person they come through. */}
              <Field id="pcHealth" label={(two ? "Premiums through your job" : "Health, dental and vision premiums") + ", per check"}>
                <Affixed prefix="$"><MoneyInput id="pcHealth" nonNeg value={healthDerived ? amountText((pi.health[0] * pi.p) / pi.pays[0]) : s.pcHealth} onValueChange={set("pcHealth")} /></Affixed>
                {two ? null : healthRow > 0 ? (
                  <div className="hint">{healthDerived ? <>From the Budget&apos;s Health insurance row, {money(healthRow)} per month. 0 if it isn&apos;t through work.</>
                    : pi.health[0] === 0 ? <>Not through work: the Budget&apos;s Health insurance row stays in your expenses.</> : null}</div>
                ) : null}
              </Field>
              {two ? (
                <Field id="pcHealth2" label="Premiums through your spouse's job, per check">
                  <Affixed prefix="$"><MoneyInput id="pcHealth2" nonNeg value={s.pcHealth2} onValueChange={set("pcHealth2")} /></Affixed>
                  {healthRow > 0 ? (
                    <div className="hint">{healthDerived ? <>Health, dental and vision. Yours starts from the Budget&apos;s Health insurance row, {money(healthRow)} per month. Both 0 if not through work.</>
                      : pi.health[0] + pi.health[1] === 0 ? <>Not through work: the Budget&apos;s Health insurance row stays in your expenses.</> : <>Health, dental and vision.</>}</div>
                  ) : <div className="hint">Health, dental and vision.</div>}
                </Field>
              ) : null}
              {facts ? null : (
                <>
                  <div className="grid grid-cols-2 items-end gap-x-2.5">
                    <NumberField id="pcMatchRate" label={two ? "Your 401(k) match" : "Employer 401(k) match"} unit="%" step={5} max={200} value={s.pcMatchRate} onValueChange={set("pcMatchRate")} />
                    <NumberField id="pcMatchUpTo" label="On the first" unit="% of pay" step={1} max={100} value={s.pcMatchUpTo} onValueChange={set("pcMatchUpTo")} />
                  </div>
                  {two ? (
                    <div className="grid grid-cols-2 items-end gap-x-2.5">
                      <NumberField id="pcMatchRate2" label="Spouse's 401(k) match" unit="%" step={5} max={200} value={s.pcMatchRate2} onValueChange={set("pcMatchRate2")} />
                      <NumberField id="pcMatchUpTo2" label="On the first" unit="% of pay" step={1} max={100} value={s.pcMatchUpTo2} onValueChange={set("pcMatchUpTo2")} />
                    </div>
                  ) : null}
                </>
              )}
              {/* With two incomes the HSA's limit depends on whose coverage: one
                  self-only plan, one each, or family (one shared limit). */}
              <SelectField id="pcHsaCov" label="HSA coverage" value={pi.hsa}
                onChange={(v) => setState((c) => ({ ...c, pcHsaFamily: v === "family", pcHsaBoth: v === "self2" }))}>
                <option value="self">{two ? "Self-only, one of you" : "Self-only"}</option>
                {two ? <option value="self2">Self-only, each of you</option> : null}
                <option value="family">Family</option>
              </SelectField>

              <BudgetFromTab s={s} p={pi.p} per={per} onEdit={() => set("view")("budget")} />
            </CardContent>
          </Card>
        </aside>
      </div>

      <div className="stack min-w-0 lg:col-span-2" id="tab-paycheck">
        <Card size="flush" className="min-w-0">
          <HeroReading tone={empty ? "text" : "answer"} sized={!empty} row
            hero={{ label: "Saved and invested, each " + per, id: "pcSaved", value: empty ? DASH : money(r.saved), noteId: "pcSavedNote",
              note: empty ? "Enter your gross pay to begin" : ((r.saved / r.check) * 100).toFixed(1) + "% of gross pay" + (r.match > 0 ? ", plus " + money(r.match) + (two ? " in employer matches" : " from your employer") : "") }}
            figures={[
              { label: "Free before saving", id: "pcFree", value: empty ? DASH : money(base.toAssign), note: "Pay, less taxes and your budget, with nothing saved" },
              { label: short ? "Short each " + per : "Still unassigned", id: "pcLeft", value: empty ? DASH : money(left),
                note: empty ? "" : short ? "More is assigned than the deposit covers" : Math.abs(r.left) < 0.5 ? "Every dollar has a place" : "Not yet given a place" },
            ]} />
          <div className="border-t border-border px-5.5 py-5 max-sm:px-4" hidden={empty}>
            {/* The donut is the picture and the bars are its legend; hovering
                either lights the same part in both. */}
            <div className="flex flex-col items-center gap-6 sm:flex-row">
              <div className="w-full max-w-50 shrink-0 *:block *:h-auto *:w-full">
                <svg id="pcPie" viewBox="0 0 220 220" role="img" aria-label="Where each paycheck goes"
                  onMouseOver={(e) => {
                    const c = (e.target as Element).closest("circle[data-idx]");
                    setActive(c ? +(c.getAttribute("data-idx") ?? 0) : null);
                  }}
                  onMouseLeave={() => setActive(null)}>
                  <Donut parts={parts} center={money(r.check)} centerLabel={two ? "Each month" : "Each check"} active={active} hatch="pch" />
                </svg>
              </div>
              <div className="w-full min-w-0 flex-1" onMouseLeave={() => setActive(null)}
                onMouseOver={(e) => {
                  const b = (e.target as Element).closest(".bar[data-idx]");
                  if (b) setActive(+(b.getAttribute("data-idx") ?? 0));
                }}>
                {parts.map((x, i) => x.v > 0.004 ? (
                  <ShareBar key={x.label} label={x.label} value={x.v} share={r.check > 0 ? x.v / r.check : 0} color={x.c} idx={i} dim={active != null && active !== i} pct />
                ) : null)}
              </div>
            </div>
          </div>
        </Card>

        <Sliders s={s} set={set} setState={setState} pi={pi} r={r} base={base} empty={empty} />
        {scope?.slots?.afterSliders}

        <Itemized s={s} pi={pi} r={r} empty={empty} short={short}
          openTax={() => {
            // Income Tax, filled in from here (taxFromPaycheck).
            store.write("tax", taxFromPaycheck(store.read("tax", TAX_DEFAULTS), pi, r));
            go("/incometax");
          }} />
        {/* The year's taxes on this paycheck in full: the federal brackets,
            then the state's rules, as Income Tax ends. */}
        {empty ? null : <>
          <BracketsCard id="pcBrackets" bands={r.bands} fold />
          <StateRulesCard id="pcStateRules" state={pi.state} status={pi.status} year={NEWEST_YEAR} figuresFrom={yearData().states.year} />
        </>}
      </div>
    </>
  );
}

/** A heading over one group of the inputs, on a rule (as on Income Tax). */
function GroupHead({ children }: { children: React.ReactNode }) {
  return <h3 className="m-0 mt-1 mb-3 border-t border-border pt-4 text-sm font-semibold">{children}</h3>;
}

/* The budget as it comes across: its total a check, and its rows on demand,
   with the ones this tab plans or moves marked and left out. */
function BudgetFromTab({ s, p, per, onEdit }: { s: BudgetInputs; p: number; per: string; onEdit: () => void }) {
  const [open, setOpen] = useState(false);
  const counted = s.rows.map((r, i) => ({ r, i, role: rowRole(s, r) })).filter((x) => annualize(x.r) > 0);
  const spendYear = counted.reduce((a, x) => a + (x.role === "count" ? annualize(x.r) : 0), 0);
  const used = counted.filter((x) => x.role === "count").length;
  return (
    <>
      <div className="m-0 mt-1 mb-2 flex items-baseline justify-between gap-2 border-t border-border pt-4">
        <h3 className="m-0 text-sm font-semibold">From your Budget</h3>
        <Button variant="link" size="inline" onClick={onEdit}>Edit it there</Button>
      </div>
      <div className="flex items-baseline justify-between gap-2 text-note">
        <span>Bills and spending</span><b className="font-medium tabular-nums" id="pcBudget">{cents(spendYear / p)} per {per}</b>
      </div>
      <div className="mb-1.5 text-label text-muted-foreground">
        {spendYear > 0 ? money(spendYear / 12) + " per month, from " + used + (used === 1 ? " line" : " lines") + " of your Budget" : "Nothing in your Budget yet"}
      </div>
      {counted.length ? (
        <Button variant="quiet" size="inline" aria-expanded={open} onClick={() => setOpen(!open)}>{open ? "Hide the lines" : "Show the lines"}</Button>
      ) : null}
      {open ? (
        <ul className="m-0 mt-2 list-none p-0 text-note">
          {counted.map(({ r, i, role }) => (
            <li key={i} className={cn("flex items-baseline justify-between gap-3 border-t border-border py-1", role !== "count" && "text-muted-foreground")}>
              <span className="min-w-0">{r.desc || "Custom"}
                {role !== "count" ? <span className="block text-label">{role === "work" ? "Paid through work: in the premiums above" : "Left out: this tab plans your saving"}</span> : null}
              </span>
              <span className={cn("tabular-nums whitespace-nowrap", role !== "count" && "line-through")}>{money(annualize(r) / r.freq)}{r.freq === 12 ? "/mo" : "/yr"}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </>
  );
}

/* Where the rest goes: a slider per goal, with live figures above them.
   A plan sets them all at once (and puts them in its order); a slider, a
   typed amount or Max sets one. The emergency fund is a line only once
   added. With two incomes every amount is a month, split between you. */
function Sliders({ s, set, setState, pi, r, base, empty }: {
  s: BudgetInputs; set: <K extends keyof BudgetInputs>(k: K) => (v: BudgetInputs[K]) => void; setState: SetState;
  pi: ReturnType<typeof paycheckInput>; r: PcRun; base: PcRun; empty: boolean;
}) {
  const two = pi.two, per = two ? "month" : "check";
  const left = Math.abs(r.left) < 0.01 ? 0 : r.left, short = !empty && r.left <= -0.01;
  const taxCut = base.taxes - r.taxes;
  // In a walkthrough its next step does the copying, in order.
  const scope = useToolScope();
  const store = useToolStore(), go = useToolNav(), toast = useToast(), showPopup = usePopup(), { profile } = useHousehold();
  /* Copy to Advanced: the saving, account by account, split by account
     type (asking first if that would replace saving already there), then
     on to it. */
  const copyOut = async () => {
    const c = paycheckCopy(pi), total = c.trad + c.roth + c.brok + c.hsa;
    if (!(total > 0)) { toast("Nothing is going into an account yet"); return; }
    const amount = money(total, 2) + " " + PERIOD_ADV[c.period];
    // Taxes in retirement, if the split starts here: the household's, else this paycheck's.
    const seed = { status: profile?.status || pi.status, state: profile?.state || pi.state };
    const cur = store.read("advanced", ADVANCED_DEFAULTS);
    if (advancedHasSaving(cur) && await showPopup("Replace the saving in Advanced?", [
      { label: "Replace it", desc: "Its \u201cYou add\u201d amounts and employer match. Balances stay as they are." }]) < 0) return;
    store.write("advanced", intoAdvanced(cur, c, seed));
    go("/advanced");
    toast("Copied " + amount + " into Advanced, split by account type");
  };
  /** Set one line by hand: the plan no longer describes it. */
  const setLine = (k: PcStep, v: number) => setState((c) => ({ ...c, [pcAmountKey(k)]: amountText(Math.max(0, v)), pcPlan: "" }));
  /* A plan: its 401(k) and IRA settings, every line filled in its order
     (the ones it leaves out at nothing), and the sliders shown in that order. */
  const applyPlan = (k: PcPlan) => {
    const { roth, amounts: a } = pcPlanApply(pi, k);
    setState((c) => ({
      ...c, ...Object.fromEntries(PC_STEPS.map((x) => [pcAmountKey(x), amountText(a[x])])),
      pcMatchRoth: roth.match, pcK401maxRoth: roth.k401max, pcIraRoth: roth.rothIra,
      pcOrder: pcPlanOrder(k).join(","), pcPlan: k,
    }));
  };
  const rr = pcRothRoom(pi, r);
  const clear = () => setState((c) => ({ ...c, ...Object.fromEntries(PC_STEPS.map((x) => [pcAmountKey(x), "0"])), pcPlan: "" }));
  const plan = (s.pcPlan in PC_PLANS ? s.pcPlan : "") as PcPlan | "";
  const sp = pcSplit(pi);
  return (
    <Card className="min-w-0">
      <CardHeader>
        <CardTitle>Where the rest goes</CardTitle>
        <CardAction>
          {scope ? null : <Button variant="outline" size="sm" id="pcCopyOut" disabled={empty} title="Copy what goes into each account into Advanced" onClick={copyOut}>Copy to Advanced</Button>}
        </CardAction>
      </CardHeader>
      <CardContent>
        {/* The figures: they tick to each new value as a slider moves. */}
        <div className="mb-4 grid grid-cols-4 overflow-hidden rounded-(--r-field) border border-border max-sm:grid-cols-2" aria-live="polite">
          <Stat label="Saved and invested" value={empty ? DASH : money(r.saved)} tone="answer" id="pcSaved2" note={!empty && r.match > 0.005 ? cents(r.saved + r.match) + " with match" : undefined} />
          <Stat label="Available to save" value={empty ? DASH : money(r.saved + r.left)} id="pcAvail" />
          <Stat label={<>Taxes <TipDot k="pctaxes" /></>} value={empty ? DASH : money(r.taxes)} id="pcTaxes" note={!empty && taxCut > 0.005 ? cents(taxCut) + " saved" : undefined} />
          <Stat label={short ? "Short" : "Unassigned"} value={empty ? DASH : cents(left)} id="pcUnassigned" tone={short ? "loss" : left === 0 && !empty ? "gain" : undefined} />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="text-label text-muted-foreground">Start from a plan:</span>
          {(Object.keys(PC_PLANS) as PcPlan[]).map((k) => (
            <Button key={k} size="sm" variant={plan === k ? "secondary" : "outline"} aria-pressed={plan === k} disabled={empty} onClick={() => applyPlan(k)}>{PC_PLANS[k].name}</Button>
          ))}
          <Button size="sm" variant="ghost" id="pcClear" onClick={clear}>Clear</Button>
        </div>
        <p className="mt-1.5 mb-1 text-note text-muted-foreground" id="pcPlanNote">
          {plan ? <>{PC_PLANS[plan].note}{pi.efOn ? (plan === "tax" ? ", with the emergency fund before the IRA." : ", with the emergency fund right after the match.") : "."}</>
            : "A plan sets every slider at once; drag from there."}
        </p>

        <div id="pcSliders">
          {pi.order.map((k) => {
            const line = PC_LINES[k], v = pi.amounts[k], cap = pcCap(pi, k, pi.amounts);
            // To the cent, so all the way right is exactly the limit (and a full line looks full).
            const toCents = (x: number) => Math.floor(x * 100 + 1e-6) / 100;
            const room = Math.max(0, r.left);
            const max = Math.max(0.01, k === "brok" ? toCents(v + room) : k === "ef" ? toCents(Math.max(cap, v + room)) : toCents(cap));
            const over = pcHasLimit(k) && v > cap + 0.005;
            const half = two && v > 0 && (k === "match" || k === "k401max" || k === "rothIra" || (k === "hsa" && pi.hsa !== "self")) ? sp[k as "match"] : null;
            const rothKey = pcRothKey(k), catchUp = pcCatchText(pi, k, pi.amounts);
            const limit = k === "match" ? (two ? "Both full matches " : "Limit ") + cents(toCents(cap))
              : k === "k401max" ? "Limit " + cents(toCents(cap)) + (two ? " for both, with the matches" : "")
              : k === "hsa" && two ? (pi.hsa === "family" ? "Family limit " : pi.hsa === "self2" ? "Two self-only limits " : "Self-only limit ") + cents(toCents(cap))
              : k === "rothIra" && two ? "Two limits " + cents(toCents(cap))
              : k === "brok" ? "Whatever's left" : "Limit " + cents(toCents(cap));
            return (
              <div key={k} data-line={k} className="flex items-center gap-4 border-t border-border py-3 first:border-t-0 max-sm:flex-wrap max-sm:gap-x-3 max-sm:gap-y-2">
                {/* A desktop: name, slider and amount on one line, the caption under the name and slider.
                    A phone: name and amount, then the slider, then the caption, each the full width. */}
                <div className="min-w-0 flex-1 max-sm:contents">
                  <div className="flex items-center gap-4 max-sm:contents">
                    <div className="flex w-80 flex-none items-center gap-2.5 whitespace-nowrap max-sm:order-1 max-sm:w-auto max-sm:min-w-0 max-sm:flex-1 max-sm:flex-wrap max-sm:whitespace-normal">
                      <b className="font-medium">{line.name}</b>
                      {line.roth ? (
                        <Segmented size="compact" attr="data-kind" options={[["trad", "Traditional"], ["roth", "Roth"]] as const}
                          value={s[rothKey] ? "roth" : "trad"} onChange={(x) => setState((c) => ({ ...c, [rothKey]: x === "roth", pcPlan: "" }))} />
                      ) : null}
                      {k === "ef" ? <Button variant="quiet" size="inline" onClick={() => setState((c) => ({ ...c, pcEfOn: false, pcEf: "0" }))}>Remove</Button> : null}
                    </div>
                    <NativeRange className="flex-1 max-sm:order-3 max-sm:basis-full" min={0} max={max} step={0.01} value={Math.min(v, max)} fill={v / max} disabled={empty}
                      aria-label={line.name + ", per " + per} data-slider={k} onChange={(e) => setLine(k, parseFloat(e.target.value))} />
                  </div>
                  <div className="mt-0.5 text-label text-muted-foreground max-sm:order-4 max-sm:mt-0 max-sm:basis-full" data-note>
                    {k === "ef" ? (
                      <span className="inline-flex items-center gap-1.5">Plans fill it to
                        <Affixed prefix="$" className="w-24"><MoneyInput nonNeg aria-label={"Emergency fund: how much a plan puts in, per " + per} value={s.pcEfCap} onValueChange={set("pcEfCap")} /></Affixed>
                        per {per}</span>
                    ) : <>
                      {limit}
                      {catchUp.included ? " · " + catchUp.included : null}
                      {catchUp.ifText ? " · up to " + cents(toCents(catchUp.ifCap)) + " " + catchUp.ifText : null}
                      {over ? <span className="text-destructive"> · over the limit</span> : null}
                      {half ? " · you " + cents(half[0]) + ", spouse " + cents(half[1]) : null}
                      {v > 0 && pcPreTax(pi, k) && (k !== "rothIra" || r.iraDed >= 0.005) ? <>{two ? " · costs your deposits " : " · costs your deposit "}<b className="font-medium text-foreground tabular-nums">{cents(v * pcCostPer(pi, k))}</b></> : null}
                      {/* The IRA: how much of a traditional one is deductible; past the Roth's income range, the backdoor. */}
                      {k === "rothIra" && !pi.roth.rothIra && v > 0 && r.iraDed < v - 0.005 ? <>
                        {r.iraDed < 0.005 ? " · not deductible at your income" : " · " + cents(r.iraDed) + " of it deductible"}<TipDot k="pciradeduct" /></> : null}
                      {k === "rothIra" && pi.roth.rothIra && (rr.over || rr.reduced) ? <>
                        {" · "}<b className="font-medium text-foreground">{rr.over ? "Over the Roth income limit: use a backdoor Roth" : "Roth limit cut to " + money(rr.direct) + " per year" + (two ? " each" : "") + " at your income: a backdoor covers the rest"}</b>
                        <TipDot k="pcbackdoor" /></> : null}
                    </>}
                  </div>
                </div>
                <div className="flex flex-none items-center gap-1.5 max-sm:order-2">
                  <Affixed prefix="$" suffix={two ? "/mo" : undefined} className={two ? "w-36" : "w-30"}>
                    <MoneyInput nonNeg data-amt={k} aria-label={line.name + ", per " + per} value={s[pcAmountKey(k)]}
                      onValueChange={(x) => setState((c) => ({ ...c, [pcAmountKey(k)]: x, pcPlan: "" }))} />
                  </Affixed>
                  <Button variant="outline" size="sm" disabled={empty} title="As much as this line takes, or what's left" onClick={() => setLine(k, pcMost(pi, k))}>Max</Button>
                </div>
              </div>
            );
          })}
        </div>
        {!pi.efOn ? (
          <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1 border-t border-border pt-3 text-note text-muted-foreground">
            <span>Still building an emergency fund?</span>
            <Button variant="link" size="inline" id="pcEfAdd" onClick={() => setState((c) => ({ ...c, pcEfOn: true }))}>+ Add an emergency fund</Button>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

/** One of the figures over the sliders: it ticks to each new value. */
function Stat({ label, value, id, tone, note }: { label: React.ReactNode; value: string; id: string; tone?: "answer" | "gain" | "loss"; note?: string }) {
  return (
    <div className="min-w-0 border-border px-3.5 py-3 not-first:border-l max-sm:nth-3:border-l-0 max-sm:nth-[n+3]:border-t">
      <div className="k text-label text-muted-foreground">{label}</div>
      <BigValue text={value} id={id} sized={false}
        className={cn("text-2xl font-medium tracking-tight whitespace-nowrap tabular-nums max-sm:text-xl", tone === "answer" && "text-primary", tone === "gain" && "text-gain", tone === "loss" && "text-destructive")} />
      <div className="min-h-4 text-label text-muted-foreground">{note}</div>
    </div>
  );
}

/* The itemized paycheck: earnings, what comes out before tax, the taxes,
   the deposit, the budget (its lines on demand) and what's saved from the
   deposit, per check, per month (unless paid monthly) and per year. */
function Itemized({ s, pi, r, empty, short, openTax }: {
  s: BudgetInputs; pi: ReturnType<typeof paycheckInput>; r: PcRun; empty: boolean; short: boolean; openTax: () => void;
}) {
  const scope = useToolScope();
  const [showBudget, setShowBudget] = useState(false);
  // Per check, per month (unless paid monthly, when the two are the same) and
  // per year. With two incomes: each of your checks, on its own schedule, up
  // to what it deposits, then the household per month and per year; what's
  // shared (the budget, the saving from your deposits) fills only those two.
  const p = pi.p, two = pi.two, monthly = p !== 12;
  const heads = two ? ["Your check", "Spouse's check", "Per month", "Per year"] : monthly ? ["Per check", "Per month", "Per year"] : ["Per check", "Per year"];
  type Row = { kind: "sec" | "item" | "sub" | "total" | "hi"; label: string; v?: number; tag?: string; tip?: string; toggle?: boolean; per?: number[] };
  /** A row's cells: null where a check column has nothing (a shared line). */
  const vals = (x: Row): (number | null)[] => {
    const v = x.v ?? 0;
    if (two) return [x.per ? (x.per[0] * 12) / pi.pays[0] : null, x.per ? (x.per[1] * 12) / pi.pays[1] : null, v, v * 12];
    return monthly ? [v, (v * p) / 12, v * p] : [v, v * p];
  };
  const rows: Row[] = [];
  const sec = (label: string, toggle?: boolean) => rows.push({ kind: "sec", label, toggle });
  const ln = (kind: Row["kind"], label: string, v: number, tag?: string, per?: number[]) => rows.push({ kind, label, v, tag, per });
  /** Each person's share of a line, negated like the line. */
  const each = (k: keyof PcRun["people"][number], sign = -1) => (two ? r.people.map((x) => sign * x[k]) : undefined);
  // With two incomes, why the 401(k) columns differ (the split favors the bigger match, then each one's room).
  const k401Tip = (v: [number, number]) => { if (two && Math.abs(v[0] - v[1]) >= 0.01) rows[rows.length - 1].tip = "pc401ksplit"; };
  sec("Earnings"); ln("item", "Gross pay", r.check, undefined, each("gross", 1));
  if (r.k401 || r.hsa || r.health) {
    sec("Before tax");
    if (r.k401) { ln("item", "Traditional 401(k)", -r.k401, undefined, each("k401")); k401Tip(r.k401s); }
    if (r.hsa) {
      ln("item", "HSA", -r.hsa, "excluded from FICA", each("hsa"));
      // With two incomes, one above the Social Security wage cap: why more of the HSA comes out of the other's pay.
      const hs = pcSplit(pi);
      if (pi.two && hs.hsaFirst != null && Math.abs(hs.hsa[0] - hs.hsa[1]) >= 0.01) rows[rows.length - 1].tip = "pchsasplit";
    }
    if (r.health) ln("item", "Health, dental and vision", -r.health, "excluded from FICA", each("health"));
  }
  sec("Taxes");
  ln("item", "Federal income tax", -r.fed, undefined, each("fed"));
  ln("item", (r.stateName || "State") + " income tax", -r.state, r.stateAddBack > 0 ? "keeps " + money(r.stateAddBack) + "/yr of pre-tax in its base" : undefined, each("state"));
  if (r.local > 0) ln("item", "Local income tax", -r.local, "from Income Tax", each("local"));
  ln("item", "Social Security", -r.ss, undefined, each("ss"));
  ln("item", "Medicare", -r.med, undefined, each("med"));
  if (r.roth401) {
    sec("After tax");
    ln("item", "Roth 401(k)", -r.roth401, undefined, each("roth401")); k401Tip(r.roth401s);
  }
  ln("total", two ? "Deposits to your bank" : "Deposit to your bank", r.deposit, undefined, each("deposit", 1));
  sec("Your budget", true);
  ln("item", "Bills and spending", -r.spend);
  const budgetLines = s.rows.map((row, i) => ({ row, i })).filter(({ row }) => rowRole(s, row) === "count" && annualize(row) > 0);
  const subStart = rows.length;
  for (const { row } of budgetLines) ln("sub", (row.desc || "Custom") + (row.freq === 1 ? " (" + money(annualize(row)) + " per year)" : ""), -annualize(row) / p);
  const subEnd = rows.length;
  ln("total", "Free to save or invest", r.toAssign);
  if (r.ef || r.rothIra || r.brok) {
    sec(two ? "From your deposits" : "From your deposit");
    if (r.ef) ln("item", "Emergency fund", -r.ef);
    if (r.rothIra) ln("item", pi.roth.rothIra ? "Roth IRA" : "Traditional IRA", -r.rothIra);
    if (r.brok) ln("item", "Taxable brokerage", -r.brok);
  }
  ln("hi", short ? "Short" : "Unassigned", Math.abs(r.left) < 0.01 ? 0 : r.left);

  // The CSV has every row, budget lines included, whether or not they're shown.
  const csv = () => empty ? null : [["Line", ...heads], ...rows.map((x) => x.v == null ? [x.label] : [(x.kind === "sub" ? "  " : "") + x.label, ...vals(x).map((y) => (y == null ? "" : y.toFixed(2)))])];

  return (
    <Card className="min-w-0" hidden={empty}>
      <CardHeader>
        <CardTitle>Itemized paycheck</CardTitle>
        <CardAction>
          <div className="flex flex-wrap justify-end gap-2">
            {/* A walkthrough has the tax tables below and stays put. */}
            {scope ? null : <Button variant="outline" size="sm" id="pcToTax" title="Open Income Tax with this pay, state and these pre-tax deductions" onClick={openTax}>Open in Income Tax</Button>}
            <CsvButton id="pcCsv" label="itemized paycheck" title="Download the itemized paycheck as a CSV" rows={csv} filename="retcalc-paycheck.csv" />
          </div>
        </CardAction>
      </CardHeader>
      {/* The whole stub, never cut off at a height: it scrolls sideways only. */}
      <div className="overflow-x-auto">
        <table id="pcStub">
          <thead><tr><th>Line</th>{heads.map((h) => <th key={h} className="whitespace-nowrap">{h}</th>)}</tr></thead>
          <tbody>
            {rows.map((x, j) => {
              if (x.kind === "sub" && (!showBudget || j < subStart || j >= subEnd)) return null;
              if (x.kind === "sec") return (
                <tr key={j}><td colSpan={heads.length + 1} className="pt-3.5">
                  <span className="mr-2 text-label font-medium tracking-wide text-muted-foreground uppercase">{x.label}</span>
                  {x.toggle ? <Button variant="link" size="inline" aria-expanded={showBudget} onClick={() => setShowBudget(!showBudget)}>{showBudget ? "Hide the lines" : "Show the lines"}</Button> : null}
                </td></tr>
              );
              return (
                <tr key={j} className={cn(x.kind === "total" && "font-semibold border-t-2 border-t-line", x.kind === "hi" && "font-semibold border-t-2 border-t-line", x.kind === "sub" && "text-muted-foreground")}>
                  <td className={cn(x.kind === "item" && "pl-6", x.kind === "sub" && "pl-9", x.kind === "hi" && (short ? "text-destructive" : "text-primary"))}>
                    {x.label}{x.tag ? <Badge variant="outline" className="ml-2">{x.tag}</Badge> : null}{x.tip ? <TipDot k={x.tip} /> : null}
                  </td>
                  {vals(x).map((y, c) => {
                    // The check columns in cents (red when taken out); months and years in dollars.
                    const check = two ? c < 2 : c === 0;
                    return <td key={c} className={cn("whitespace-nowrap", check && y != null && y < -0.004 && x.kind !== "hi" && "text-destructive")}>{y == null ? "" : check ? cents(y) : money(y)}</td>;
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
