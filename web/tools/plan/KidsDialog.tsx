"use client";

/* Life stages' children: the card over Stages that says what's built in,
   the pop-up that asks about the children (the Guide's questions and
   costs), and "How will you cover this?", which takes each stage's cost
   out of the accounts, the brokerage first. Saving them rebuilds the
   stages (flow.ts seedStages). */

import { useState } from "react";
import { ChevronDownIcon } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useHousehold } from "@/components/household/HouseholdProvider";
import { Affixed } from "@/components/fields/Field";
import { MoneyInput, NumberInput } from "@/components/fields/NumberInput";
import { Segmented } from "@/components/common/Readout";
import { Modal } from "@/components/shell/Modal";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { PER_YEAR } from "@/lib/engine/typed";
import { groupDigits, money, parseNum } from "@/lib/format";
import { advancedPlan } from "@/tools/advanced/model";
import { CARE_AREAS, CHILD_COST, CHILD_SOURCE, MAX_KIDS, type CareArea } from "@/tools/guide/schedule";
import { CountedBoxes } from "@/components/fields/CountedBoxes";
import { freedOf, planAges, seedStages, toolOf } from "./flow";
import { ageSpan, coverStage, kidDefaults, kidList, kidStages, monthlyByAccount, stageKey, type KidStage, type Monthly } from "./kids";
import { COVER_ORDER, NO_KIDS, setPlan, type CoverLine, type PlanKids, type PlanState } from "./model";

const ACCT: Record<CoverLine, string> = { brok: "Brokerage", roth: "Roth", trad: "Traditional", hsa: "HSA" };
const ages = (from: number, to: number) => (to - from <= 1 && Number.isInteger(from) && Number.isInteger(to) ? "Age " : "Ages ") + ageSpan(from, to);
/** To the half year: 2.5 years stays 2.5. */
const half = (v: number) => Math.round(v * 2) / 2;
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
            {/* Folded until wanted, like the year-by-year table. */}
            <Collapsible>
              <CardTitle><CollapsibleTrigger>How each stage covers them<ChevronDownIcon aria-hidden="true" /></CollapsibleTrigger></CardTitle>
              <CollapsibleContent className="mt-3">
            <CoverTable plan={plan} segs={costly} />
            <p className="hint mt-3">Each stage below runs these years at this saving, in today&apos;s dollars. Change any stage&apos;s saving or return
              to plan for other changes too: a raise, a move, part-time years. Changing your children or how you cover them rebuilds the stages.</p>
              </CollapsibleContent>
            </Collapsible>
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
  const [now, setNow] = useState(kids.now.map(String));
  const [planned, setPlanned] = useState(String(kids.planned));
  const [firstIn, setFirstIn] = useState(String(kids.firstIn));
  const [spacing, setSpacing] = useState(String(kids.spacing));
  // Each planned child's gap after the one before, once "Space them differently" is on.
  const [gaps, setGaps] = useState<string[] | null>(kids.gaps ? kids.gaps.map(String) : null);
  const [childcare, setChildcare] = useState(kids.childcare);
  const [area, setArea] = useState<CareArea>(kids.area ?? "suburb");
  const [early, setEarly] = useState(kids.early);
  const [school, setSchool] = useState(kids.school);
  const [teen, setTeen] = useState(kids.teen ?? "");
  const nowAges = now.map((x) => Math.round(parseNum(x))).filter((n, i) => now[i].trim() !== "" && n >= 0 && n < 30);
  const room = Math.max(0, MAX_KIDS - now.length);
  const nPlanned = Math.min(room, Math.max(0, Math.round(parseNum(planned))));
  const even = Math.max(0.5, half(parseNum(spacing))) || 3;
  const form: PlanKids = {
    now: nowAges, planned: nPlanned, firstIn: Math.max(0, half(parseNum(firstIn))), spacing: even, childcare, area, early, school, teen,
    gaps: gaps && nPlanned > 1 ? Array.from({ length: nPlanned - 1 }, (_, i) => Math.max(0, half(parseNum(gaps[i] ?? String(even))))) : null,
  };
  const d = kidDefaults(form), segs = kidStages(form, age, retire), list = kidList(form, age);
  const gapBoxes = Array.from({ length: Math.max(0, nPlanned - 1) }, (_, i) => gaps?.[i] ?? String(even));
  return (
    <Modal size="study" onClose={close} focus="#kdNow">
      <h3>Children</h3>
      <div className="formhint">The biggest change to saving for most people: childcare before school, then the school years, then saving can rise again.
        The costs below are typical ones, in today&apos;s dollars; change any of them to your own. Up to {MAX_KIDS} children in all.</div>
      <div className="grid grid-cols-2 gap-x-3 gap-y-3 max-sm:grid-cols-1">
        <CountedBoxes id="kdNow" countLabel="Children you have now" countAffix="children" max={MAX_KIDS} values={now} onChange={setNow}
          boxLabel={(i) => "Child " + (i + 1) + "'s age"} boxAffix="yrs" boxMax={29} half />
        <div>
          <Label className="mb-1.5" htmlFor="kdPlanned"><span>Children planned</span></Label>
          <Affixed suffix="children"><NumberInput id="kdPlanned" nonNeg max={room} value={planned} onValueChange={setPlanned} /></Affixed>
        </div>
        {nPlanned > 0 ? (
          <div>
            <Label className="mb-1.5" htmlFor="kdFirst"><span>The first in</span></Label>
            <Affixed suffix="years"><NumberInput id="kdFirst" nonNeg max={30} value={firstIn} onValueChange={setFirstIn} /></Affixed>
          </div>
        ) : null}
        {nPlanned > 1 && !gaps ? (
          <div>
            <Label className="mb-1.5" htmlFor="kdSpacing"><span>Then one every</span></Label>
            <Affixed suffix="years"><NumberInput id="kdSpacing" nonNeg max={15} value={spacing} onValueChange={setSpacing} /></Affixed>
            <Button variant="quiet" size="inline-xs" className="mt-1.5" onClick={() => setGaps(gapBoxes)}>Space them differently</Button>
          </div>
        ) : null}
        {nPlanned > 1 && gaps ? (
          <div className="col-span-full">
            <div className="flex flex-wrap gap-2.5">
              {gapBoxes.map((g, i) => (
                <div key={i} className="w-40">
                  <Label className="mb-1" htmlFor={"kdGap" + i}><span className="text-label text-muted-foreground">Planned child {i + 2}</span></Label>
                  <Affixed suffix="yrs later"><NumberInput id={"kdGap" + i} nonNeg max={15} value={g}
                    onValueChange={(v) => setGaps(gapBoxes.map((x, j) => (j === i ? v : x)))} /></Affixed>
                </div>
              ))}
            </div>
            <small className="mt-1 block text-label text-muted-foreground">Years after the planned child before it.{" "}
              <Button variant="quiet" size="inline-xs" onClick={() => setGaps(null)}>Same spacing for all</Button></small>
          </div>
        ) : null}
        <div className="col-span-full">
          <div className="mb-1.5 text-sm">Paid childcare before school?</div>
          <Segmented attr="data-kdcare" options={[["yes", "Yes"], ["no", "No"]] as const} value={childcare ? "yes" : "no"} onChange={(v) => setChildcare(v === "yes")} />
        </div>
        {childcare ? (
          <div className="col-span-full">
            <div className="mb-1.5 text-sm">Where you&apos;d use it</div>
            <Segmented attr="data-kdarea" options={CARE_AREAS.map((x) => [x.id, x.name] as [CareArea, string])} value={area} onChange={setArea} />
            <small className="mt-1 block text-label text-muted-foreground">Childcare costs about {money(CHILD_COST.care[area])} per month here, on top of a child&apos;s everyday costs.</small>
          </div>
        ) : null}
        <div className="col-span-full grid grid-cols-3 gap-x-3 max-sm:grid-cols-1 max-sm:gap-y-3">
          <div>
            <Label className="mb-1.5" htmlFor="kdEarly"><span>Birth to 5</span></Label>
            <Affixed prefix="$" suffix="/mo"><MoneyInput id="kdEarly" nonNeg placeholder={groupDigits(d.early)} value={early} onValueChange={setEarly} /></Affixed>
          </div>
          <div>
            <Label className="mb-1.5" htmlFor="kdSchool"><span>6 to 12</span></Label>
            <Affixed prefix="$" suffix="/mo"><MoneyInput id="kdSchool" nonNeg placeholder={groupDigits(d.school)} value={school} onValueChange={setSchool} /></Affixed>
          </div>
          <div>
            <Label className="mb-1.5" htmlFor="kdTeen"><span>13 to 18</span></Label>
            <Affixed prefix="$" suffix="/mo"><MoneyInput id="kdTeen" nonNeg placeholder={groupDigits(d.teen)} value={teen} onValueChange={setTeen} /></Affixed>
          </div>
          <small className="col-span-full mt-1 block text-label text-muted-foreground">What one child costs per month at each age. A second or later child costs 20% less than these, since they share a room, clothes and gear.</small>
        </div>
      </div>
      {list.length ? (
        <div className="mt-4 border-t border-border pt-3">
          <div className="mb-1.5 text-label text-muted-foreground">The stages this makes, to age {retire}</div>
          <ul className="m-0 list-none p-0 text-note">
            {segs.map((s) => (
              <li key={stageKey(s)} className="flex items-baseline justify-between gap-3 border-b border-border py-1.5 last:border-b-0">
                <span><b className="font-medium">{s.label}</b> <span className="text-muted-foreground">{ages(s.from, s.to)}</span></span>
                <span className="tabular-nums">{s.cost > 0 ? money(s.cost) + " per month" : "No child costs"}</span>
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
                <td className="text-right">{(s.change < 0 ? "−" : "+") + money(Math.abs(s.change))} per month</td>
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
  const perCheck = C.ppy === 12 ? "per month" : C.ppy === 26 ? "per paycheck (every two weeks)" : C.ppy === 52 ? "per paycheck (weekly)" : "per paycheck";
  return (
    <Modal size="table" onClose={close}>
      <h3>How will you cover this?</h3>
      <div className="formhint">Today you save <b>{money(C.today.brok + C.today.roth + C.today.trad + C.today.hsa)}</b> per month:{" "}
        {COVER_ORDER.filter((k) => C.today[k] > 0).map((k) => (k === "brok" || k === "trad" ? ACCT[k].toLowerCase() : ACCT[k]) + " " + money(C.today[k])).join(", ") || "nothing yet"}.
        {" "}Each stage&apos;s children come out of the brokerage first, so the tax-advantaged accounts stay full, then Roth, then traditional
        (where the 401(k) match is), then the HSA. Type over any amount to take it from somewhere else; what saving can&apos;t cover comes out of spending.
        {" "}Money kept out of a traditional account or the HSA is taxed as pay again, so a cut there frees less than its size: each one is cut far enough to cover the cost after that tax.</div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-170 text-note tabular-nums">
          <thead><tr className="text-label text-muted-foreground">
            <th className="text-left font-medium">Stage</th><th className="text-right font-medium">Children cost</th>
            {COVER_ORDER.map((k) => <th key={k} className="text-right font-medium">{ACCT[k]}<span className="block font-normal">{money(C.today[k])} per month now</span></th>)}
            <th className="text-right font-medium">From spending</th>
          </tr></thead>
          <tbody>
            {segs.map((s) => {
              const key = stageKey(s), c = C.cover(s);
              return (
                <tr key={key} className="border-t border-border align-top">
                  <td className="min-w-40 py-2 pr-2"><b className="font-medium">{s.label}</b><span className="block text-label text-muted-foreground">{ages(s.from, s.to)}</span></td>
                  <td className="py-2 text-right">{(s.change < 0 ? "−" : "+") + money(Math.abs(s.change))} per month
                    <span className="block text-label text-muted-foreground">{(s.change < 0 ? "−" : "+") + money(Math.abs(C.per(s.change)), 2)} {perCheck === "per month" ? "" : "/check"}</span></td>
                  {COVER_ORDER.map((k) => s.change > 0 ? (
                    <td key={k} className="py-1.5 pl-2">
                      <Affixed prefix="−$" className="w-30"><MoneyInput nonNeg aria-label={ACCT[k] + " taken, " + s.label + ", per month"}
                        value={typed[key]?.[k] ?? groupDigits(Math.round(c.take[k]))} onValueChange={(v) => setTyped((t) => ({ ...t, [key]: { ...t[key], [k]: v } }))} /></Affixed>
                      {/* A pre-tax cut frees less than itself: say what it frees. */}
                      {c.take[k] > 0.5 && c.take[k] - c.freedBy[k] > 0.5 ? <span className="mt-0.5 block text-right text-label text-muted-foreground">frees {money(c.freedBy[k])}</span> : null}
                      {k === "trad" && c.matchLost > 0.5 ? <span className="block text-right text-label text-loss">−{money(c.matchLost)} match</span> : null}
                    </td>
                  ) : <td key={k} className="py-2 text-right">{c.take[k] < -0.004 ? "+" + money(-c.take[k]) : "–"}</td>)}
                  <td className={"py-2 text-right whitespace-nowrap" + (c.short > 0 ? " text-loss" : "")}>{c.short > 0 ? "−" + money(c.short) + " per month" : "–"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {segs.some((s) => C.cover(s).matchLost > 0.5) ? <p className="hint mt-3 text-loss">⚠ A cut shown in red under Traditional goes below what earns the full employer match, so the match shrinks too. Taking more from another account keeps it.</p> : null}
      <p className="hint mt-3">Amounts are per month, in today&apos;s dollars. The paycheck figure is the same cost {perCheck === "per month" ? "" : "on your pay schedule"}. A stage costing less than today adds the difference to the brokerage.</p>
      <div className="formactions mt-4">
        <Button variant="outline" className="flex-1" onClick={() => setTyped({})}>Brokerage first</Button>
        <Button className="flex-1" onClick={() => save(nums)}>Build the stages</Button>
      </div>
    </Modal>
  );
}
