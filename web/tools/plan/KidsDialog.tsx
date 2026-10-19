"use client";

/* Life stages' children: the card over Stages that says what's built in,
   the pop-up that asks about the children (the Guide's questions and
   costs), and "How will you cover this?", which takes each stage's cost
   out of the accounts, the brokerage first. Saving them rebuilds the
   stages (flow.ts seedStages). */

import { useState } from "react";
import { useHousehold } from "@/components/household/HouseholdProvider";
import { Affixed } from "@/components/fields/Field";
import { MoneyInput, NumberInput } from "@/components/fields/NumberInput";
import { Segmented } from "@/components/common/Readout";
import { Modal } from "@/components/shell/Modal";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PER_YEAR } from "@/lib/engine/typed";
import { groupDigits, money, parseNum } from "@/lib/format";
import { advancedPlan } from "@/tools/advanced/model";
import { CHILD_COST, CHILD_SOURCE } from "@/tools/guide/schedule";
import { freedOf, planAges, seedStages, toolOf } from "./flow";
import { coverStage, kidDefaults, kidList, kidStages, monthlyByAccount, stageKey, type KidStage, type Monthly } from "./kids";
import { COVER_ORDER, NO_KIDS, setPlan, type CoverLine, type PlanKids, type PlanState } from "./model";

const ACCT: Record<CoverLine, string> = { brok: "Brokerage", roth: "Roth", trad: "Traditional", hsa: "HSA" };
const ages = (from: number, to: number) => (to - from === 1 ? "Age " + from : "Ages " + from + " to " + (to - 1));
const cents = (v: number) => groupDigits(String(Math.round(v * 100) / 100), true);

/** Your age and the retirement age the plan in Advanced runs to. */
function span(plan: PlanState) {
  const a = planAges(plan), years = Math.max(1, Math.round(parseNum(toolOf(plan, "advanced").years)));
  return a ? { age: a.age, retire: a.age + years } : null;
}

/** What the children come to, in a line: "Two planned, the first in 2 years; childcare before school." */
function kidsLine(k: PlanKids): string {
  const parts: string[] = [];
  if (k.now.length) parts.push((k.now.length === 1 ? "One child" : k.now.length + " children") + " now (age" + (k.now.length > 1 ? "s " : " ") + k.now.join(", ") + ")");
  if (k.planned > 0) parts.push((k.planned === 1 ? "one" : String(k.planned)) + " planned, the first in " + k.firstIn + (k.firstIn === 1 ? " year" : " years"));
  if (!parts.length) return "No children in the plan.";
  const s = parts.join("; ");
  return s.charAt(0).toUpperCase() + s.slice(1) + (k.childcare ? "; paid childcare before school." : "; no paid childcare.");
}

export function KidsCard({ plan }: { plan: PlanState }) {
  const { profile } = useHousehold();
  const [open, setOpen] = useState<"kids" | "cover" | null>(plan.kids == null ? "kids" : null);
  const sp = span(plan);
  const k = plan.kids;
  const segs = sp ? kidStages(k, sp.age, sp.retire) : [];
  const costly = segs.filter((s) => s.change !== 0);
  const rebuild = () => setPlan((p) => seedStages(p, profile));
  return (
    <>
      <Card className="col-span-full">
        <CardHeader>
          <CardTitle>Children</CardTitle>
          <CardDescription>{k ? kidsLine(k) : "Tell us about any children you have or are planning, and the stages are built from them."}</CardDescription>
          <CardAction><div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => setOpen("kids")}>{k ? "Edit children" : "Add children"}</Button>
            {costly.length ? <Button variant="outline" size="sm" onClick={() => setOpen("cover")}>How you cover it</Button> : null}
          </div></CardAction>
        </CardHeader>
        {costly.length ? (
          <CardContent>
            <CoverTable plan={plan} segs={costly} />
            <p className="hint mt-3">Each stage below runs these years at this saving, in today&apos;s dollars. Change any stage&apos;s saving or return
              to plan for other changes too: a raise, a move, part-time years. Changing your children or how you cover them rebuilds the stages.</p>
          </CardContent>
        ) : null}
      </Card>
      {open === "kids" && sp ? (
        <KidsDialog kids={k ?? NO_KIDS} age={sp.age} retire={sp.retire} close={() => setOpen(null)}
          save={(next) => {
            const changes = kidStages(next, sp.age, sp.retire).some((s) => s.change !== 0);
            setPlan((p) => ({ ...p, kids: next }));
            if (changes) setOpen("cover");
            else { setOpen(null); rebuild(); }
          }} />
      ) : null}
      {open === "cover" && sp ? (
        <CoverDialog plan={plan} age={sp.age} retire={sp.retire} close={() => { setOpen(null); rebuild(); }}
          save={(cover) => { setPlan((p) => ({ ...p, cover })); setOpen(null); rebuild(); }} />
      ) : null}
    </>
  );
}

/* ---- the children ---- */
function KidsDialog({ kids, age, retire, close, save }: { kids: PlanKids; age: number; retire: number; close: () => void; save: (k: PlanKids) => void }) {
  const [now, setNow] = useState(kids.now.join(", "));
  const [planned, setPlanned] = useState(String(kids.planned));
  const [firstIn, setFirstIn] = useState(String(kids.firstIn));
  const [spacing, setSpacing] = useState(String(kids.spacing));
  const [childcare, setChildcare] = useState(kids.childcare);
  const [early, setEarly] = useState(kids.early);
  const [school, setSchool] = useState(kids.school);
  const form: PlanKids = {
    now: now.split(/[^0-9]+/).filter(Boolean).map(Number).filter((n) => n < 30).slice(0, 8),
    planned: Math.min(6, Math.max(0, Math.round(parseNum(planned)))), firstIn: Math.max(0, Math.round(parseNum(firstIn))),
    spacing: Math.max(1, Math.round(parseNum(spacing)) || 3), childcare, early, school,
  };
  const d = kidDefaults(form), segs = kidStages(form, age, retire), list = kidList(form, age);
  return (
    <Modal size="study" onClose={close} focus="#kdNow">
      <h3>Children</h3>
      <div className="formhint">The biggest change to saving for most people: childcare before school, then the school years, then saving can rise again.
        The costs below are typical ones, in today&apos;s dollars; change any of them to your own.</div>
      <div className="grid grid-cols-2 gap-x-3 gap-y-3 max-sm:grid-cols-1">
        <div className="col-span-full">
          <Label className="mb-1.5" htmlFor="kdNow"><span>Children you have now: their ages</span></Label>
          <Input id="kdNow" inputMode="numeric" placeholder="None, or for example 4, 7" value={now} onChange={(e) => setNow(e.target.value)} />
        </div>
        <div>
          <Label className="mb-1.5" htmlFor="kdPlanned"><span>Children planned</span></Label>
          <Affixed suffix="children"><NumberInput id="kdPlanned" nonNeg max={6} value={planned} onValueChange={setPlanned} /></Affixed>
        </div>
        {form.planned > 0 ? (
          <div>
            <Label className="mb-1.5" htmlFor="kdFirst"><span>The first in</span></Label>
            <Affixed suffix="years"><NumberInput id="kdFirst" nonNeg max={30} value={firstIn} onValueChange={setFirstIn} /></Affixed>
          </div>
        ) : null}
        {form.planned > 1 ? (
          <div>
            <Label className="mb-1.5" htmlFor="kdSpacing"><span>Then one every</span></Label>
            <Affixed suffix="years"><NumberInput id="kdSpacing" nonNeg max={15} value={spacing} onValueChange={setSpacing} /></Affixed>
          </div>
        ) : null}
        <div className="col-span-full">
          <div className="mb-1.5 text-sm">Paid childcare before school?</div>
          <Segmented attr="data-kdcare" options={[["yes", "Yes"], ["no", "No"]] as const} value={childcare ? "yes" : "no"} onChange={(v) => setChildcare(v === "yes")} />
        </div>
        <div>
          <Label className="mb-1.5" htmlFor="kdEarly"><span>A child before school costs</span></Label>
          <Affixed prefix="$" suffix="/mo"><MoneyInput id="kdEarly" nonNeg placeholder={groupDigits(d.early)} value={early} onValueChange={setEarly} /></Affixed>
          <small className="mt-1 block text-label text-muted-foreground">Birth to 5. {groupDigits(childcare ? CHILD_COST.care : CHILD_COST.noCare)} unless you change it.</small>
        </div>
        <div>
          <Label className="mb-1.5" htmlFor="kdSchool"><span>A child at school costs</span></Label>
          <Affixed prefix="$" suffix="/mo"><MoneyInput id="kdSchool" nonNeg placeholder={groupDigits(d.school)} value={school} onValueChange={setSchool} /></Affixed>
          <small className="mt-1 block text-label text-muted-foreground">6 to 18. Each later child costs 20% less.</small>
        </div>
      </div>
      {list.length ? (
        <div className="mt-4 border-t border-border pt-3">
          <div className="mb-1.5 text-label text-muted-foreground">The stages this makes, to age {retire}</div>
          <ul className="m-0 list-none p-0 text-note">
            {segs.map((s) => (
              <li key={stageKey(s)} className="flex items-baseline justify-between gap-3 border-b border-border py-1.5 last:border-b-0">
                <span><b className="font-medium">{s.label}</b> <span className="text-muted-foreground">{ages(s.from, s.to)}</span></span>
                <span className="tabular-nums">{s.cost > 0 ? money(s.cost) + "/mo" : "No child costs"}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      <small className="mt-3 block text-label text-muted-foreground">Costs: {CHILD_SOURCE}. College isn&apos;t included.</small>
      <div className="formactions mt-4">
        <Button variant="outline" className="flex-1" onClick={() => save({ ...NO_KIDS })}>No children</Button>
        <Button className="flex-1" onClick={() => save(form)}>{list.some((c) => c.planned) || form.now.length ? "Next: how you'll cover it" : "Use these"}</Button>
      </div>
    </Modal>
  );
}

/* ---- How will you cover this? ---- */

/** Today's saving, and what each stage takes from each account. */
function useCover(plan: PlanState, typed: Record<string, Partial<Monthly>>) {
  const { profile } = useHousehold();
  const adv = toolOf(plan, "advanced"), P = advancedPlan(adv, profile), period = P.p.period;
  const today = monthlyByAccount(P, period), ppy = PER_YEAR[period] ?? 12;
  const F = freedOf(plan);
  return { today, ppy, per: (m: number) => (m * 12) / ppy, cover: (s: KidStage) => coverStage(s.change, today, typed[stageKey(s)], F) };
}

/** The stages with their cost and what each account gives, for the card. */
function CoverTable({ plan, segs }: { plan: PlanState; segs: KidStage[] }) {
  const C = useCover(plan, plan.cover);
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-150 text-note tabular-nums">
        <thead><tr className="text-label text-muted-foreground">
          <th className="text-left font-medium">Stage</th><th className="text-right font-medium">Children cost</th>
          {COVER_ORDER.map((k) => <th key={k} className="text-right font-medium">{ACCT[k]}</th>)}<th className="text-right font-medium">From spending</th>
        </tr></thead>
        <tbody>
          {segs.map((s) => {
            const c = C.cover(s);
            return (
              <tr key={stageKey(s)} className="border-t border-border">
                <td className="py-1.5"><b className="font-medium">{s.label}</b> <span className="text-muted-foreground">{ages(s.from, s.to)}</span></td>
                <td className="text-right">{(s.change < 0 ? "−" : "+") + money(Math.abs(s.change))}/mo</td>
                {COVER_ORDER.map((k) => <td key={k} className="text-right">{c.take[k] > 0.004 ? "−" + money(c.take[k]) : c.take[k] < -0.004 ? "+" + money(-c.take[k]) : "–"}
                  {k === "trad" && c.matchLost > 0.5 ? <span className="block text-label text-loss">−{money(c.matchLost)} match</span> : null}</td>)}
                <td className={"text-right" + (c.short > 0 ? " text-loss" : "")}>{c.short > 0 ? "−" + money(c.short) : "–"}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function CoverDialog({ plan, age, retire, close, save }: {
  plan: PlanState; age: number; retire: number; close: () => void; save: (c: PlanState["cover"]) => void;
}) {
  const segs = kidStages(plan.kids, age, retire).filter((s) => s.change !== 0);
  // What's typed, per stage and account, as text; the rest follow the order.
  const [typed, setTyped] = useState<Record<string, Partial<Record<CoverLine, string>>>>(() =>
    Object.fromEntries(Object.entries(plan.cover).map(([key, v]) => [key, Object.fromEntries(Object.entries(v).map(([k, x]) => [k, cents(x as number)]))])));
  const nums = Object.fromEntries(Object.entries(typed).map(([key, v]) => [key, Object.fromEntries(Object.entries(v).map(([k, x]) => [k, parseNum(x as string)]))])) as Record<string, Partial<Monthly>>;
  const C = useCover(plan, nums);
  const perCheck = C.ppy === 12 ? "a month" : C.ppy === 26 ? "a paycheck (every two weeks)" : C.ppy === 52 ? "a paycheck (weekly)" : "a paycheck";
  return (
    <Modal size="table" onClose={close}>
      <h3>How will you cover this?</h3>
      <div className="formhint">Today you save <b>{money(C.today.brok + C.today.roth + C.today.trad + C.today.hsa)}</b> a month:{" "}
        {COVER_ORDER.filter((k) => C.today[k] > 0).map((k) => (k === "brok" || k === "trad" ? ACCT[k].toLowerCase() : ACCT[k]) + " " + money(C.today[k])).join(", ") || "nothing yet"}.
        {" "}Each stage&apos;s children come out of the brokerage first, so the tax-advantaged accounts stay full, then Roth, then traditional
        (where the 401(k) match is), then the HSA. Type over any amount to take it from somewhere else; what saving can&apos;t cover comes out of spending.
        {" "}Money kept out of a traditional account or the HSA is taxed as pay again, so a cut there frees less than its size: each one is cut far enough to cover the cost after that tax.</div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-170 text-note tabular-nums">
          <thead><tr className="text-label text-muted-foreground">
            <th className="text-left font-medium">Stage</th><th className="text-right font-medium">Children cost</th>
            {COVER_ORDER.map((k) => <th key={k} className="text-right font-medium">{ACCT[k]}<span className="block font-normal">{money(C.today[k])}/mo now</span></th>)}
            <th className="text-right font-medium">From spending</th>
          </tr></thead>
          <tbody>
            {segs.map((s) => {
              const key = stageKey(s), c = C.cover(s);
              return (
                <tr key={key} className="border-t border-border align-top">
                  <td className="min-w-40 py-2 pr-2"><b className="font-medium">{s.label}</b><span className="block text-label text-muted-foreground">{ages(s.from, s.to)}</span></td>
                  <td className="py-2 text-right">{(s.change < 0 ? "−" : "+") + money(Math.abs(s.change))}/mo
                    <span className="block text-label text-muted-foreground">{(s.change < 0 ? "−" : "+") + money(Math.abs(C.per(s.change)), 2)} {perCheck === "a month" ? "" : "/check"}</span></td>
                  {COVER_ORDER.map((k) => s.change > 0 ? (
                    <td key={k} className="py-1.5 pl-2">
                      <Affixed prefix="−$" className="w-30"><MoneyInput nonNeg aria-label={ACCT[k] + " taken, " + s.label + ", a month"}
                        value={typed[key]?.[k] ?? cents(c.take[k])} onValueChange={(v) => setTyped((t) => ({ ...t, [key]: { ...t[key], [k]: v } }))} /></Affixed>
                      {/* A pre-tax cut frees less than itself: say what it frees. */}
                      {c.take[k] > 0.5 && c.take[k] - c.freedBy[k] > 0.5 ? <span className="mt-0.5 block text-right text-label text-muted-foreground">frees {money(c.freedBy[k])}</span> : null}
                      {k === "trad" && c.matchLost > 0.5 ? <span className="block text-right text-label text-loss">−{money(c.matchLost)} match</span> : null}
                    </td>
                  ) : <td key={k} className="py-2 text-right">{c.take[k] < -0.004 ? "+" + money(-c.take[k]) : "–"}</td>)}
                  <td className={"py-2 text-right whitespace-nowrap" + (c.short > 0 ? " text-loss" : "")}>{c.short > 0 ? "−" + money(c.short) + "/mo" : "–"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {segs.some((s) => C.cover(s).matchLost > 0.5) ? <p className="hint mt-3 text-loss">⚠ A cut shown in red under Traditional goes below what earns the full employer match, so the match shrinks too. Taking more from another account keeps it.</p> : null}
      <p className="hint mt-3">Amounts are a month, in today&apos;s dollars. The paycheck figure is the same cost {perCheck === "a month" ? "" : "on your pay schedule"}. A stage costing less than today adds the difference to the brokerage.</p>
      <div className="formactions mt-4">
        <Button variant="outline" className="flex-1" onClick={() => setTyped({})}>Brokerage first again</Button>
        <Button className="flex-1" onClick={() => save(nums)}>Build the stages</Button>
      </div>
    </Modal>
  );
}
