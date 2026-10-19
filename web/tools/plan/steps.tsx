"use client";

/* The walkthrough's own parts around the tools: the Start step, and the
   heading over each step that says what it's for and what to do in it. */

import { useEffect } from "react";
import { useHousehold } from "@/components/household/HouseholdProvider";
import { NumberField, SelectField } from "@/components/fields/Field";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { planAges } from "./flow";
import { setPlan, stepIndex, type PlanState, type StepId } from "./model";

const FREQS = [["52", "Every week"], ["26", "Every two weeks"], ["24", "Twice a month"], ["12", "Monthly"]] as const;

/** What each step is for, and what to do in it. */
const HEADS: Record<StepId, { title: string; lede: string; todo?: string }> = {
  start: { title: "Four questions, in your own numbers", lede: "What do you take home after taxes? What do you spend? Where should the rest go? And where does that get you by retirement?" },
  taxes: { title: "What you take home", lede: "Your pay and the taxes on it, for the year and for each paycheck.",
    todo: "Enter your pay, filing status and state. If you put money into a 401(k), HSA or IRA before tax today, add it under Pre-tax deductions; if you're not sure, leave it at $0." },
  budget: { title: "What you spend", lede: "Every bill and spending line, by the month or by the year. Saving isn't spending: that comes next.",
    todo: "Fill in the lines that apply, add your own with the + on a group, and remove what you don't need." },
  paycheck: { title: "Where each paycheck goes", lede: "Your paycheck from the top: taxes, your budget, and what's left for saving, account by account.",
    todo: "Filled in from your taxes, with what you save today as the starting lines. Pick a plan, or move each slider, until nothing's left unassigned. Every change reruns the taxes." },
  plan: { title: "Where that gets you", lede: "Your saving by account, carried over from your paycheck, grown to the age you'd like to retire.",
    todo: "Add what you've saved so far in each account under Accounts, and check the return and inflation. The target is what you spend today; change it to what you'll want in retirement." },
  stages: { title: "Life stages", lede: "Saving changes over a lifetime. Stages splits the years into stretches, each with its own saving.",
    todo: "Tell us about any children you have or are planning, and how you'd cover what they cost, and the stages are made from that. For anything else (a raise, a move, part-time years), change a stage's saving or return, or add one." },
  summary: { title: "Your plan", lede: "" },
};

export function StepHead({ step }: { step: StepId }) {
  if (step === "summary") return null;
  const h = HEADS[step], n = stepIndex(step);
  return (
    <div className="col-span-full -mb-1">
      {n > 0 ? <div className="text-label text-muted-foreground">Step {n} of 6{step === "stages" ? ", optional" : ""}</div> : null}
      <h2 className="m-0 mt-0.5 text-xl font-semibold">{h.title}</h2>
      <p className="m-0 mt-1 max-w-copy text-muted-foreground">{h.lede}</p>
      {h.todo ? <p className="m-0 mt-2 max-w-copy text-note">{h.todo}</p> : null}
    </div>
  );
}

/** Start: your age, when you'd like to retire, and how often you're paid,
    from the household profile the first time. */
export function StartStep({ plan }: { plan: PlanState }) {
  const { profile } = useHousehold();
  useEffect(() => {
    if (!profile || plan.age !== "" || plan.retire !== "") return;
    setPlan((p) => ({ ...p, age: profile.age ? String(Math.round(profile.age)) : p.age, retire: profile.retire ? String(Math.round(profile.retire)) : p.retire }));
  }, [profile, plan.age, plan.retire]);
  const set = (k: "age" | "retire" | "freq") => (v: string) => setPlan((p) => ({ ...p, [k]: v }));
  const ages = planAges(plan);
  const steps = [
    ["Taxes", "Your pay after federal, state and payroll taxes, a year and a paycheck."],
    ["Budget", "What you spend, line by line."],
    ["Paycheck", "What's left, and which account each dollar goes into: 401(k), HSA, IRA, brokerage."],
    ["Your plan", "That saving, grown to the age you'd like to retire."],
    ["Life stages", "Optional: kids and other changes, as stages with their own saving."],
    ["Summary", "Everything on one page, and a full report to print or save."],
  ];
  return (
    <div className="col-span-full grid grid-cols-1 items-start gap-5 max-sm:gap-3.5 lg:grid-cols-3">
      <Card className="min-w-0">
        <CardHeader><CardTitle>About you</CardTitle><CardDescription>Three facts every step uses.</CardDescription></CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 items-end gap-x-2.5">
            <NumberField id="ppAge" label="Your age" unit="years" max={99} value={plan.age} onValueChange={set("age")} />
            <NumberField id="ppRetire" label="Retire at" unit="years" max={100} value={plan.retire} onValueChange={set("retire")} />
          </div>
          <SelectField id="ppFreq" label="You're paid" value={plan.freq} onChange={set("freq")}>
            {FREQS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </SelectField>
          <p className="hint mt-1">{ages ? ages.years + " years of saving to go." : "Your age and retirement age set how long your saving grows."}</p>
        </CardContent>
      </Card>
      <Card className="min-w-0 lg:col-span-2">
        <CardHeader><CardTitle>How it works</CardTitle>
          <CardDescription>Six steps, about fifteen minutes. Each one fills in the next.</CardDescription></CardHeader>
        <CardContent>
          <ol className="m-0 grid list-none grid-cols-2 gap-x-6 gap-y-3.5 p-0 max-sm:grid-cols-1">
            {steps.map(([t, d], i) => (
              <li key={t} className="flex gap-3">
                <span className="grid size-6 flex-none place-items-center rounded-full border border-input text-label tabular-nums">{i + 1}</span>
                <span><b className="font-semibold">{t}</b><span className="block text-note text-muted-foreground">{d}</span></span>
              </li>
            ))}
          </ol>
          <p className="hint mt-5 border-t border-border pt-3.5">What you type here stays here: your other tools aren&apos;t changed. At the end you can copy it all into them. It&apos;s saved in this browser, and to your account if you sign in.</p>
        </CardContent>
      </Card>
    </div>
  );
}
