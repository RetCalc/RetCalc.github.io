"use client";

/* The walkthrough's own parts around the tools: the Start step, and the
   heading over each step that says what it's for and what to do in it. */

import { useEffect } from "react";
import { useHousehold } from "@/components/household/HouseholdProvider";
import { MoneyField, NumberField, SelectField } from "@/components/fields/Field";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { groupDigits } from "@/lib/format";
import { STATE_OPTIONS } from "@/lib/states";
import type { BudgetInputs } from "@/tools/budget/model";
import { planAges, toolOf } from "./flow";
import { STEPS, setPlan, stepIndex, type PlanState, type StepId } from "./model";

const FREQS = [["52", "Every week"], ["26", "Every two weeks"], ["24", "Twice a month"], ["12", "Monthly"]] as const;

/** What each step is for, and what to do in it. */
const HEADS: Record<StepId, { title: string; lede: string; todo?: string }> = {
  start: { title: "", lede: "" },
  budget: { title: "What you spend", lede: "Every bill and spending line, by the month or by the year. Saving isn't spending: that comes next.",
    todo: "Fill in the lines that apply, add your own with the + on a group, and remove what you don't need." },
  paycheck: { title: "Where each paycheck goes", lede: "Your paycheck from the top: taxes, your budget, and what's left for saving, account by account.",
    todo: "Start with what you put in today: your 401(k), HSA and IRA. Then pick a plan, or move each slider, until nothing's left unassigned. Every change reruns the taxes, and the itemized paycheck and the tax tables under it follow." },
  plan: { title: "Where that gets you", lede: "Your saving by account, carried over from your paycheck, grown to the age you'd like to retire.",
    todo: "Add what you've saved so far in each account under Your savings, and check the return and inflation. The target is what you spend today; change it to what you'll want in retirement." },
  stages: { title: "Changes ahead", lede: "Saving changes over a lifetime. Add what you see coming to the plan you just built, and it changes from there.",
    todo: "Under Changes ahead, add a change: children you have or are planning, a raise, a bigger house, easing off for a while, a lump sum such as an inheritance. Each says what it does to your savings at retirement, and The stages behind this shows the plan year by year." },
  summary: { title: "Your plan", lede: "" },
};

export function StepHead({ step }: { step: StepId }) {
  if (step === "summary" || step === "start") return null;
  const h = HEADS[step], n = stepIndex(step);
  return (
    <div className="col-span-full -mb-1 grid gap-x-12 gap-y-2 lg:grid-cols-2 lg:items-end">
      <div>
        {n > 0 ? <div className="text-label text-muted-foreground">Step {n} of {STEPS.length - 1}{step === "stages" ? ", optional" : ""}</div> : null}
        <h2 className="m-0 mt-0.5 text-xl font-semibold">{h.title}</h2>
        <p className="m-0 mt-1 max-w-copy text-muted-foreground">{h.lede}</p>
      </div>
      {h.todo ? <p className="m-0 max-w-copy text-note lg:pb-0.5">{h.todo}</p> : null}
    </div>
  );
}

/** Start: your age and when you'd like to retire, then your filing status,
    pay (one or two, by the status), schedule and state, from the household
    profile the first time. The pay goes straight into the Paycheck tab's
    own fields, which the later steps run on. */
export function StartStep({ plan }: { plan: PlanState }) {
  const { profile } = useHousehold();
  const b = toolOf(plan, "budget"), two = b.pcStatus === "m2";
  useEffect(() => {
    if (!profile) return;
    setPlan((p) => {
      let n = p;
      if (p.age === "" && p.retire === "") n = { ...n, age: profile.age ? String(Math.round(profile.age)) : p.age, retire: profile.retire ? String(Math.round(profile.retire)) : p.retire };
      const cur = toolOf(n, "budget");
      if (cur.pcGross === "" && profile.income != null) {
        const both = profile.status === "m" && (profile.income2 ?? 0) > 0;
        n = { ...n, tools: { ...n.tools, budget: { ...cur, pcStatus: profile.status !== "m" ? "s" : both ? "m2" : "m",
          pcGross: groupDigits(profile.income, true), pcGross2: both ? groupDigits(profile.income2!, true) : "",
          ...(both ? { pcHsaFamily: false, pcHsaBoth: true } : {}), ...(profile.state ? { pcState: profile.state } : {}) } } };
      }
      return n;
    });
  }, [profile]);
  const set = (k: "age" | "retire") => (v: string) => setPlan((p) => ({ ...p, [k]: v }));
  const setB = (patch: Partial<BudgetInputs>) => setPlan((p) => ({ ...p, tools: { ...p.tools, budget: { ...toolOf(p, "budget"), ...patch } } }));
  const ages = planAges(plan);
  const steps = [
    ["Budget", "Enter what you spend in a typical month, line by line: housing, food, transportation, insurance and the rest. Use monthly or yearly amounts, add your own lines, and remove any that don't apply."],
    ["Paycheck", "See your pay after federal, state and payroll taxes, then subtract your budget to find what's left to save. Put it into your 401(k), HSA, IRA and brokerage account with a preset plan or the sliders, and watch the taxes update as you go."],
    ["Your plan", "Add what you've already saved in each account and set the return you expect. See what your saving grows to by the age you plan to retire, and what that can support in retirement."],
    ["Changes ahead", "Optional. Your income, spending and saving won't stay the same for decades. Add the changes you see coming, like kids, a raise, a bigger house or a lump sum, to the plan from step 3."],
    ["Summary", "Your pay, budget, saving and projected retirement on one page, with a report to print or save. You can also copy the plan into the other tools."],
  ];
  return (
    <div className="col-span-full grid grid-cols-1 items-start gap-5 max-sm:gap-3.5 lg:grid-cols-3">
      <Card className="min-w-0">
        <CardHeader><CardTitle>About you</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 items-end gap-x-2.5">
            <NumberField id="ppAge" label="Your age" unit="years" max={99} value={plan.age} onValueChange={set("age")} />
            <NumberField id="ppRetire" label="Retire at" unit="years" max={100} value={plan.retire} onValueChange={set("retire")} />
          </div>
          <p className="hint -mt-1.5 mb-3.5">{ages ? ages.years + " years of saving to go." : "Your age and retirement age set how long your saving grows."}</p>
          {/* Filing status first: it decides whether there's one pay to ask
              for or two. Two incomes start with an HSA each, as on the Paycheck tab. */}
          <h3 className="m-0 mt-1 mb-3 border-t border-border pt-4 text-sm font-semibold">Your pay</h3>
          <SelectField id="ppStatus" label="Filing status" value={b.pcStatus}
            onChange={(v) => setB({ pcStatus: v, ...(v === "m2" && b.pcStatus !== "m2" ? { pcHsaFamily: false, pcHsaBoth: true } : {}) })}>
            <option value="s">Single</option>
            <option value="m">Married, one income</option>
            <option value="m2">Married, two incomes</option>
          </SelectField>
          {two ? (
            <>
              <div className="grid grid-cols-2 items-end gap-x-2.5">
                <MoneyField id="ppGross" label="Your gross pay, per year" value={b.pcGross} onValueChange={(v) => setB({ pcGross: v })} />
                <MoneyField id="ppGross2" label="Spouse's gross pay, per year" value={b.pcGross2} onValueChange={(v) => setB({ pcGross2: v })} />
              </div>
              <div className="grid grid-cols-2 items-end gap-x-2.5">
                <SelectField id="ppFreq" label="You're paid" value={b.pcFreq} onChange={(v) => { setB({ pcFreq: v }); setPlan((p) => ({ ...p, freq: v })); }}>
                  {FREQS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </SelectField>
                <SelectField id="ppFreq2" label="Your spouse is paid" value={b.pcFreq2} onChange={(v) => setB({ pcFreq2: v })}>
                  {FREQS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </SelectField>
              </div>
            </>
          ) : (
            <div className="grid grid-cols-2 items-end gap-x-2.5">
              <MoneyField id="ppGross" label="Gross pay, per year" value={b.pcGross} onValueChange={(v) => setB({ pcGross: v })} />
              <SelectField id="ppFreq" label="You're paid" value={b.pcFreq} onChange={(v) => { setB({ pcFreq: v }); setPlan((p) => ({ ...p, freq: v })); }}>
                {FREQS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </SelectField>
            </div>
          )}
          <SelectField id="ppState" label="State" value={b.pcState || toolOf(plan, "tax").state} onChange={(v) => setB({ pcState: v })}>
            {STATE_OPTIONS.map((o) => <option key={o.code} value={o.code}>{o.name}</option>)}
          </SelectField>
        </CardContent>
      </Card>
      <Card className="min-w-0 lg:col-span-2">
        <CardHeader><CardTitle>How it works</CardTitle>
          <CardDescription>Five steps that take you from your monthly spending to a retirement projection: how much you spend, what&apos;s left after taxes and expenses, where to save it, and where that gets you. It takes about fifteen minutes.</CardDescription></CardHeader>
        <CardContent>
          <ol className="m-0 grid list-none grid-cols-2 gap-x-6 gap-y-3.5 p-0 max-sm:grid-cols-1">
            {steps.map(([t, d], i) => (
              <li key={t} className="flex gap-3">
                <span className="grid size-6 flex-none place-items-center rounded-full border border-input text-label tabular-nums">{i + 1}</span>
                <span><b className="font-semibold">{t}</b><span className="block text-note text-muted-foreground">{d}</span></span>
              </li>
            ))}
          </ol>
          <p className="hint mt-5 border-t border-border pt-3.5">Nothing you enter here changes your other tools. At the end you can copy it into them if you want. Your work is saved in this browser, and to your account if you sign in.</p>
        </CardContent>
      </Card>
    </div>
  );
}
