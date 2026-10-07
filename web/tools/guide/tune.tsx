"use client";

/* Adjusting the plan: the options the plan's numbers allow, as cards.
   Picking one draws it against the plan as it stands (chart and a
   before/after table); "Apply to my plan" writes it into the answers, and
   so into the household bar, the score and every step after. "Try your own
   numbers" is the same, with fields. From gdTuneHTML() and what it calls in
   src/js/app/30-guide-steps.js. */

import { useSyncExternalStore } from "react";
import { DraftInput } from "@/components/fields/DraftInput";
import { useToast } from "@/components/shell/Toast";
import { fmtNum, money, parseNum, pctStr } from "@/lib/format";
import { gdM, need, ok, options, overFrom, pos, sim, target, type Levers, type Opt, type OptSet, type Sim } from "./calc";
import { PlanChart, series } from "./chart";
import type { Answers } from "./store";
import { LeversLesson } from "./steps/ch6-stronger";
import { BackNote, Callout, NeedsPlan, Q, useGuideView } from "./ui";
import { Button } from "@/components/ui/button";
import { Affixed } from "@/components/fields/Field";
import { Label } from "@/components/ui/label";

/* What's picked, the draft behind "Try your own numbers", and which levers
   the balanced option may move: kept for the visit. */
interface Draft { retire: number | null; contrib: number | null; stopAge: number | null; retSpend: number | null }
interface TuneUI { sel: string | null; draft: Draft | null; levers: Levers; typed: boolean }
let tuneUI: TuneUI = { sel: null, draft: null, levers: { retire: true, save: true, spend: true }, typed: false };
const tuneListeners = new Set<() => void>();
export const tuneState = () => tuneUI;
export function setTune(f: (t: TuneUI) => void) {
  tuneUI = { ...tuneUI };
  f(tuneUI);
  tuneListeners.forEach((l) => l());
}
function useTune(): TuneUI {
  return useSyncExternalStore((l) => { tuneListeners.add(l); return () => tuneListeners.delete(l); }, tuneState, tuneState);
}

export const draftFrom = (a: Answers): Draft => ({ retire: a.retire ?? null, contrib: a.contrib ?? null, stopAge: ok(a.stopAge) ? a.stopAge : null, retSpend: a.retSpend ?? null });

function draftSet(a: Answers, d: Draft): OptSet {
  const set: OptSet = {};
  if (ok(d.retire) && d.retire !== a.retire) set.retire = d.retire;
  if (ok(d.contrib) && d.contrib !== a.contrib) set.contrib = d.contrib;
  const stop = ok(d.stopAge) ? d.stopAge : null, was = ok(a.stopAge) ? a.stopAge : null;
  if (stop !== was) set.stopAge = stop;
  if (pos(d.retSpend) && d.retSpend !== a.retSpend) set.retSpend = d.retSpend;
  return set;
}
function draftProblem(a: Answers, d: Draft): string {
  if (ok(d.retire) && (d.retire <= a.age! || d.retire > 90)) return "Pick a retirement age after your age today, up to 90.";
  const r = ok(d.retire) ? d.retire : a.retire!;
  if (ok(d.stopAge) && (d.stopAge < a.age! || d.stopAge >= r)) return "The age you stop saving has to be between now and retirement. Leave it blank to save until you retire.";
  return "";
}
/** The option picked: the one chosen, or the first on offer. */
export function selected(a: Answers): string | null {
  const O = options(a, tuneUI.levers);
  if (!O) return null;
  const sel = tuneUI.sel && (tuneUI.sel === "custom" || O.list.some((o) => o.id === tuneUI.sel)) ? tuneUI.sel : null;
  return sel || (O.list.length ? O.list[0].id : "custom");
}
/** The option picked, worked out. */
export function curOpt(a: Answers): Opt | null {
  const O = options(a, tuneUI.levers), sel = selected(a);
  if (!O) return null;
  if (sel === "custom") {
    const d = tuneUI.draft || draftFrom(a);
    if (draftProblem(a, d)) return { id: "custom", set: {}, T: null };
    const set = draftSet(a, d);
    return { id: "custom", set, T: sim(a, overFrom(a, set)) };
  }
  return O.list.find((o) => o.id === sel) || null;
}

function optTitle(a: Answers, o: Opt, S: Sim): { t: string; d: string } {
  const v = o.set, ret = Math.round(S.retire), emp = a.employer || 0;
  switch (o.id) {
    case "earlier": return { t: "Retire at " + v.retire, d: ret - v.retire! + (ret - v.retire! === 1 ? " year" : " years") + " sooner" };
    case "coast": return v.stopAge! <= a.age!
      ? { t: "Stop saving now", d: "What you have grows on its own to " + ret }
      : { t: "Stop saving at " + v.stopAge, d: "Then coast the last " + (ret - v.stopAge!) + " years to " + ret };
    case "less": return { t: "Save " + money(v.contrib! + emp) + "/mo", d: money(a.contrib! - v.contrib!) + "/mo back in your budget" };
    case "more": return { t: "Spend " + money(v.retSpend!) + " a year", d: money(v.retSpend! - a.retSpend!) + " a year more in retirement" };
    case "keepsaving": return { t: "Keep saving until " + ret, d: "Instead of stopping at " + fmtNum(S.stop!) };
    case "extra": return { t: "Save " + money(v.contrib! - a.contrib!) + "/mo more", d: money(v.contrib! + emp) + "/mo in all" };
    case "later": return { t: "Retire at " + v.retire, d: v.retire! - ret + (v.retire! - ret === 1 ? " year" : " years") + " later" };
    case "less-spend": return { t: "Spend " + money(v.retSpend!) + " a year", d: money(a.retSpend! - v.retSpend!) + " a year less in retirement" };
    case "balance": {
      const bits = [];
      if ("retire" in v) bits.push("retire at " + v.retire);
      if ("contrib" in v) bits.push(v.contrib! > a.contrib! ? "save " + money(v.contrib! - a.contrib!) + "/mo more" : v.contrib === 0 && !emp ? "stop saving" : "save " + money(a.contrib! - v.contrib!) + "/mo less");
      if ("retSpend" in v) bits.push(v.retSpend! < a.retSpend! ? "spend " + money(a.retSpend! - v.retSpend!) + " less" : "spend " + money(v.retSpend! - a.retSpend!) + " more");
      const t = bits.join(", ");
      return { t: t.charAt(0).toUpperCase() + t.slice(1), d: S.success >= target(a) - 1e-9 ? "A bit of each, as much as the plan can afford" : "A smaller change to each, found for you" };
    }
    case "custom": return { t: "Try your own numbers", d: "Any retirement age, saving, stop age and spending" };
  }
  return { t: "", d: "" };
}

/* Before and after, side by side, and what a change like this means
   beyond the numbers: early withdrawals, healthcare, Social Security. */
function Compare({ a }: { a: Answers }) {
  const G = useGuideView();
  const O = options(a, tuneUI.levers), o = curOpt(a);
  if (!O || !o) return null;
  const S = O.S, T = o.T;
  if (o.id === "custom") {
    const p = draftProblem(a, tuneUI.draft || draftFrom(a));
    if (p) return <Callout cls="warn">{p}</Callout>;
  }
  if (!T) return null;
  if (o.id === "custom" && !Object.keys(o.set).length)
    return <><Callout>Change any of the numbers above to see it here.</Callout><PlanChart id="tune" series={[series(S, a.age!, "Your plan", "p")]} caption="Your plan now, in today's dollars" /></>;
  const saveTxt = (X: Sim) => money(X.monthly) + "/mo" + (X.stop != null ? (X.stop <= a.age! ? ", stopping now" : " until " + fmtNum(X.stop)) : "");
  const rows: [string, string, string][] = [
    ["Retire at", fmtNum(S.retire), fmtNum(T.retire)],
    ["You save", saveTxt(S), saveTxt(T)],
    ["Spending in retirement", money(S.spend) + "/yr", money(T.spend) + "/yr"],
    ["Social Security", money(S.ss.total / 12) + "/mo from " + S.ss.claim, money(T.ss.total / 12) + "/mo from " + T.ss.claim],
    ["Savings at retirement", money(S.fv), money(T.fv)],
    ["Lasted in", pctStr(S.success, 0) + " of retirements", pctStr(T.success, 0) + " of retirements"],
    ["Median left at the end", money(S.H.medianEnd), money(T.H.medianEnd)],
  ];
  const notes: string[] = [];
  if (T.retire < 60 && T.retire < S.retire)
    notes.push("Retiring at " + fmtNum(T.retire) + " means living on savings before 59½, when most 401(k) and IRA withdrawals carry a 10% penalty. The rule of 55, Roth contributions, a taxable brokerage account or 72(t) payments can bridge those years; the Getting to 59½ step plans them.");
  if (T.retire < 65 && S.retire >= 65) notes.push("Before 65 you'll need health insurance until Medicare starts. A healthcare step joins your plan to price it.");
  if (!T.ss.own && T.ss.total < S.ss.total - 1)
    notes.push("Fewer working years also lower your Social Security estimate, from " + money(S.ss.total / 12) + " to " + money(T.ss.total / 12) + " a month. That's already counted above.");
  if (T.stop != null && (a.employer || 0) > 0)
    notes.push("Coasting here means no new money at all from " + (T.stop <= a.age! ? "now" : fmtNum(T.stop)) + ", so your employer's " + money(a.employer!) + "/mo stops too. If you keep working, it's worth still contributing enough to get any match.");
  if (T.stop != null) notes.push("Coasting leans on the " + pctStr(a.risk || 0.045, 1) + " a year your mix is assumed to earn. If markets lag, you can always start saving again.");
  if (o.id === "less" && (a.employer || 0) > 0) notes.push("Your employer's " + money(a.employer!) + "/mo stays in. If it's a match, keep contributing at least enough to get all of it.");
  if (T.spend > S.spend && T.success < 1) notes.push("Spending more uses up your margin: in the worst historical starting years, this spending needed trimming to last.");
  return (
    <>
      <PlanChart id="tune" series={[series(S, a.age!, "Your plan now", "b"), series(T, a.age!, "With this change", "p")]} caption="Your plan now and with this change, in today's dollars" />
      <table className="gd-cmp-t"><thead><tr><th></th><th>Now</th><th>With this change</th></tr></thead>
        <tbody>{rows.map(([k, x, y]) => <tr key={k}><th scope="row">{k}</th><td>{x}</td><td className={x !== y ? "chg" : undefined}>{y}</td></tr>)}</tbody></table>
      {notes.length ? <ul className="gd-notes">{notes.map((n) => <li key={n}>{n}</li>)}</ul> : null}
      <div className="gd-apply"><Button variant="outline" size="lg" data-gd="apply" onClick={() => G.act("apply")}>Apply to my plan</Button>
        <span className="hint">Updates your answers, score and household bar. You can undo it.</span></div>
    </>
  );
}

export function TuneStep() {
  const G = useGuideView(), { v: a } = G;
  const toast = useToast();
  const ui = useTune();
  const O = options(a, ui.levers);
  if (!O) return <NeedsPlan title="Adjust your plan" />;
  const S = O.S, goal = O.goal, want = need(a, S);
  const sel = selected(a);
  const big = O.ahead && want > 0 && S.fv >= want * 1.2;
  const pick = (id: string) => {
    setTune((t) => { t.sel = id; t.typed = false; if (id === "custom" && !t.draft) t.draft = draftFrom(a); });
    if (id === "custom") setTimeout(() => { try { document.getElementById("gdd-retire")?.focus({ preventScroll: true }); } catch { /* old browsers */ } }, 0);
  };
  const card = (o: Opt) => {
    const t = optTitle(a, o, S), on = sel === o.id;
    // the draft shows its figures once changed (and the plan's, until typed in)
    const figs = o.T && (o.id !== "custom" || !ui.typed || Object.keys(o.set).length) ? pctStr(o.T.success, 0) + " lasted · " + money(o.T.fv) + " at " + fmtNum(o.T.retire) : "";
    return (
      <button key={o.id} type="button" className={"gd-opt" + (on ? " on" : "")} data-opt={o.id} aria-pressed={on} onClick={() => pick(o.id)}>
        <b>{t.t}</b><span>{t.d}</span><em data-optfig={o.id}>{figs}</em></button>
    );
  };
  const custom = sel === "custom" ? curOpt(a) || { id: "custom", set: {}, T: null } : { id: "custom", set: {}, T: null };
  const d = ui.draft || draftFrom(a);
  const draftField = (k: keyof Draft, label: string, affix: string, isMoney: boolean, hint?: string) => (
    <div className="field" key={k}><Label className="mb-1.5" htmlFor={"gdd-" + k}><span>{label}</span></Label><Affixed prefix={isMoney ? "$" : undefined} suffix={affix || undefined}>
      <DraftInput money={isMoney} nonNeg step={isMoney ? undefined : 1} id={"gdd-" + k} data-d={k} placeholder={k === "stopAge" ? "at retirement" : undefined}
        value={ok(d[k]) ? d[k]! : NaN} format={(x) => (ok(x) ? (isMoney ? gdM(x) : String(x)) : "")}
        onType={(t) => setTune((x) => { x.draft = { ...d, [k]: t.trim() === "" ? null : parseNum(t) }; x.typed = true; })} />
      </Affixed>{hint ? <div className="hint">{hint}</div> : null}</div>
  );
  return (
    <>
      <Q>{!O.ahead ? "Close the gap" : big ? "You're ahead. Put it to work?" : "Fine-tune your plan"}</Q>
      <LeversLesson ahead={O.ahead} />
      <p className="gd-lead">Your plan now: retire at <b>{fmtNum(S.retire)}</b>,{" "}
        {S.stop != null && S.stop <= a.age! ? <><b>coast</b> with no new saving</> : <>save <b>{money(S.monthly) + "/mo"}</b>{S.stop != null ? " until " + fmtNum(S.stop) : ""}</>}
        , then spend <b>{money(S.spend) + " a year"}</b>.{" "}
        It reaches {money(S.fv)} and lasted in {pctStr(S.success, 0)} of historical retirements
        {want > 0 ? "; lasting in " + (goal >= 1 ? "every one" : pctStr(goal, 0)) + " takes about " + money(want) : ""}.{" "}
        {!O.ahead ? "Each option below closes the gap on its own." : big ? "That's more than it needs, and there's more than one way to use the extra." : "It's close to its target, so the options are small."}</p>
      <BackNote step="adjust" />
      <div className="gd-target"><span>Aim for plans that lasted in</span>
        {([[0.9, "90%"], [0.95, "95%"], [1, "every one"]] as const).map(([x, lab]) => (
          <Button key={x} variant="outline" size="sm" data-target={x} aria-pressed={goal === x} onClick={() => G.set("target", x, true)}>{lab}</Button>
        ))}
        <span className="hint">of historical retirements</span></div>
      {!O.list.length ? <Callout>{O.ahead ? "Your plan sits right at its target, so there's no spare room to spend without adding risk. Try your own numbers to explore."
        : "None of the single changes reach the target within reason. Try your own numbers, or work on the rest of your plan first."}</Callout> : null}
      <div>
        <div className="gd-opts">{O.list.map(card)}{card(custom)}</div>
        {sel === "balance" ? (
          <div className="gd-target"><span>Balance across</span>
            {([["retire", "Retirement age"], ["save", "Monthly saving"], ["spend", "Retirement spending"]] as const).map(([k, lab]) => (
              <Button key={k} variant="outline" size="sm" data-lever={k} aria-pressed={!!ui.levers[k]} onClick={() => {
                const on = (Object.keys(ui.levers) as (keyof Levers)[]).filter((x) => ui.levers[x]);
                if (ui.levers[k] && on.length <= 2) { toast("Balancing needs at least two"); return; }
                setTune((t) => { t.levers = { ...t.levers, [k]: !t.levers[k] }; t.sel = "balance"; });
              }}>{lab}</Button>
            ))}
            <span className="hint">Pick at least two.</span></div>
        ) : null}
        {sel === "custom" ? (
          <div className="gd-fields gd-draft">
            {draftField("retire", "Retire at", "age", false)}
            {draftField("contrib", "You contribute", "/mo", true, a.employer ? "Plus your employer's " + money(a.employer) + "/mo." : "")}
            {draftField("stopAge", "Stop contributing at", "age", false, "Blank means until you retire.")}
            {draftField("retSpend", "Spending in retirement", "/yr", true)}
            <p className="hint full mt-0 mx-0 mb-2.5">Contributions rise with inflation each year, so they stay the same in today&apos;s dollars.</p>
          </div>
        ) : null}
      </div>
      <div className="gd-cmp" id="gdCmp"><Compare a={a} /></div>
      <p className="hint mt-3.5">Prefer the classic FIRE math, with a 4% rule instead of market history?{" "}
        <Button variant="quiet" size="inline" data-trip="fire" data-from="adjust" onClick={() => G.trip("fire", "adjust")}>Open the FIRE Calculator</Button></p>
    </>
  );
}
