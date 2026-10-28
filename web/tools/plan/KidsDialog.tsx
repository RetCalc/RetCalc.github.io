"use client";

/* The children's pop-ups: the one that asks about the children (the
   Guide's questions and costs), and "How will you cover this?", which
   takes each stage's cost out of the accounts, the brokerage first.
   Advanced's Children change, the Dashboard and Stages use them. */

import { useState } from "react";
import { Affixed } from "@/components/fields/Field";
import { MoneyInput, NumberInput } from "@/components/fields/NumberInput";
import { Segmented } from "@/components/common/Readout";
import { Modal } from "@/components/shell/Modal";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { groupDigits, money, parseNum } from "@/lib/format";
import { CARE_AREAS, CHILD_COST, CHILD_SOURCE, MAX_KIDS, type CareArea } from "@/tools/guide/schedule";
import { CountedBoxes } from "@/components/fields/CountedBoxes";
import { ageSpan, coverStage, kidDefaults, kidList, kidStages, stageKey, type Cover, type Freed, type KidStage, type Monthly } from "./kids";
import { COVER_ORDER, NO_KIDS, type CoverLine, type PlanKids } from "./model";

const ACCT: Record<CoverLine, string> = { brok: "Brokerage", roth: "Roth", trad: "Traditional", hsa: "HSA" };
const ages = (from: number, to: number) => (to - from <= 1 && Number.isInteger(from) && Number.isInteger(to) ? "Age " : "Ages ") + ageSpan(from, to);
/** A stage's span: your ages, or (in the Stages calculator, which has no
    age) years from now, counted from `base`. */
export const spanText = (from: number, to: number, base?: number) => base == null ? ages(from, to)
  : (to - from <= 1 && Number.isInteger(from) && Number.isInteger(to) ? "Year " : "Years ") + ageSpan(from - base, to - base);
/** To the half year: 2.5 years stays 2.5. */
const half = (v: number) => Math.round(v * 2) / 2;
const cents = (v: number) => groupDigits(String(Math.round(v * 100) / 100), true);

/** What the children come to, in a line: "Two planned, the first in 2 years; childcare before school." */
export function kidsLine(k: PlanKids): string {
  const parts: string[] = [];
  if (k.now.length) parts.push((k.now.length === 1 ? "One child" : k.now.length + " children") + " now (age" + (k.now.length > 1 ? "s " : " ") + k.now.join(", ") + ")");
  if (k.planned > 0) parts.push((k.planned === 1 ? "one" : String(k.planned)) + " planned, the first in " + k.firstIn + (k.firstIn === 1 ? " year" : " years"));
  if (!parts.length) return "No children in the plan.";
  const s = parts.join("; ");
  return s.charAt(0).toUpperCase() + s.slice(1) + (k.childcare ? "; paid childcare before school." : "; no paid childcare.");
}


/* ---- the children ---- */
/** `base`: count the stages in years from now (from this age) rather than
    by your age, for the Stages calculator. */
export function KidsDialog({ kids, age, retire, base, cover = true, close, save, costsOnly, withLater, saveLabel }: {
  kids: PlanKids; age: number; retire: number; base?: number;
  /** Whether "How will you cover this?" comes next (Stages without the account split builds straight away). */
  cover?: boolean; close: () => void; save: (k: PlanKids) => void;
  /** The Dashboard's way in: the children are set elsewhere, so this
      sentence says who they are and only their costs are changed here. */
  costsOnly?: React.ReactNode;
  /** The Dashboard's: a later child's share of the first's cost can be set. */
  withLater?: boolean;
  /** The save button's words, in place of the usual next step. */
  saveLabel?: string;
}) {
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
  const [later, setLater] = useState(kids.later ?? "80");
  const nowAges = now.map((x) => Math.round(parseNum(x))).filter((n, i) => now[i].trim() !== "" && n >= 0 && n < 30);
  const room = Math.max(0, MAX_KIDS - now.length);
  const nPlanned = Math.min(room, Math.max(0, Math.round(parseNum(planned))));
  const even = Math.max(0.5, half(parseNum(spacing))) || 3;
  const form: PlanKids = {
    now: nowAges, planned: nPlanned, firstIn: Math.max(0, half(parseNum(firstIn))), spacing: even, childcare, area, early, school, teen,
    ...(withLater ? { later } : {}),
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
        {costsOnly ? <div className="col-span-full text-note">{costsOnly}</div> : <>
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
        </>}
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
          {withLater ? (
            <div className="col-span-full mt-3 max-w-60">
              <Label className="mb-1.5" htmlFor="kdLater"><span>Each later child costs</span></Label>
              <Affixed suffix="% of the first"><NumberInput id="kdLater" nonNeg max={150} value={later} onValueChange={setLater} /></Affixed>
            </div>
          ) : null}
          <small className="col-span-full mt-1 block text-label text-muted-foreground">What one child costs per month at each age. {withLater ? "A later child usually costs less, since they share a room, clothes and gear: about 80% is typical." : "A second or later child costs 20% less than these, since they share a room, clothes and gear."}</small>
        </div>
      </div>
      {list.length ? (
        <div className="mt-4 border-t border-border pt-3">
          <div className="mb-1.5 text-label text-muted-foreground">{base == null ? "The stages this makes, to age " + retire : "The stages this makes, over " + (retire - base) + " years"}</div>
          <ul className="m-0 list-none p-0 text-note">
            {segs.map((s) => (
              <li key={stageKey(s)} className="flex items-baseline justify-between gap-3 border-b border-border py-1.5 last:border-b-0">
                <span><b className="font-medium">{s.label}</b> <span className="text-muted-foreground">{spanText(s.from, s.to, base)}</span></span>
                <span className="tabular-nums">{s.cost > 0 ? money(s.cost) + " per month" : "No child costs"}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      <small className="mt-3 block text-label text-muted-foreground">Costs: {CHILD_SOURCE}. College isn&apos;t included.</small>
      <div className="formactions mt-4">
        {costsOnly ? null : <Button variant="outline" className="flex-1" onClick={() => save({ ...NO_KIDS })}>No children</Button>}
        <Button className="flex-1" onClick={() => save(form)}>{saveLabel ? saveLabel : !(list.some((c) => c.planned) || form.now.length) ? "Use these" : cover ? "Next: how you'll cover it" : "Build the stages"}</Button>
      </div>
    </Modal>
  );
}

/** "How will you cover this?" for any saving: `today` by account, paid
    `ppy` times a year; `F` what a cut frees (the walkthrough knows the
    paycheck; Stages takes cuts one for one). `base`: spans in years from
    now, as KidsDialog. */
export function CoverStagesDialog({ segs, today, ppy, F, initial, base, close, save, coverFn, order, saveLabel }: {
  segs: KidStage[]; today: Monthly; ppy: number; F?: Freed; initial: Record<string, Partial<Monthly>>; base?: number;
  close: () => void; save: (c: Record<string, Partial<Monthly>>) => void;
  /** The Dashboard's: its own order for what isn't typed, said in `order`,
      and its own words on the save button. */
  coverFn?: (change: number, typed?: Partial<Monthly>) => Cover; order?: string; saveLabel?: string;
}) {
  // What's typed, per stage and account, as text; the rest follow the order.
  const [typed, setTyped] = useState<Record<string, Partial<Record<CoverLine, string>>>>(() =>
    Object.fromEntries(Object.entries(initial).map(([key, v]) => [key, Object.fromEntries(Object.entries(v).map(([k, x]) => [k, cents(x as number)]))])));
  const nums = Object.fromEntries(Object.entries(typed).map(([key, v]) => [key, Object.fromEntries(Object.entries(v).map(([k, x]) => [k, parseNum(x as string)]))])) as Record<string, Partial<Monthly>>;
  const C = { today, ppy, per: (m: number) => (m * 12) / ppy, cover: (s: KidStage) => (coverFn ? coverFn(s.change, nums[stageKey(s)]) : coverStage(s.change, today, nums[stageKey(s)], F)) };
  const perCheck = C.ppy === 12 ? "per month" : C.ppy === 26 ? "per paycheck (every two weeks)" : C.ppy === 52 ? "per paycheck (weekly)" : "per paycheck";
  return (
    <Modal size="table" onClose={close}>
      <h3>How will you cover this?</h3>
      <div className="formhint">Today you save <b>{money(C.today.brok + C.today.roth + C.today.trad + C.today.hsa)}</b> per month:{" "}
        {COVER_ORDER.filter((k) => C.today[k] > 0).map((k) => (k === "brok" || k === "trad" ? ACCT[k].toLowerCase() : ACCT[k]) + " " + money(C.today[k])).join(", ") || "nothing yet"}.
        {" "}{order ? <>Each stage&apos;s children come out of {order}.</> : <>Each stage&apos;s children come out of the brokerage first, so the tax-advantaged accounts stay full, then Roth, then traditional
        (where the 401(k) match is), then the HSA.</>} Type over any amount to take it from somewhere else; what saving can&apos;t cover comes out of spending.
        {F || coverFn ? " Money kept out of a traditional account or the HSA is taxed as pay again, so a cut there frees less than its size: each one is cut far enough to cover the cost after that tax." : null}</div>
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
                  <td className="min-w-40 py-2 pr-2"><b className="font-medium">{s.label}</b><span className="block text-label text-muted-foreground">{spanText(s.from, s.to, base)}</span></td>
                  <td className="py-2 text-right">{(s.change < 0 ? "−" : "+") + money(Math.abs(s.change))} per month
                    {perCheck === "per month" ? null : <span className="block text-label text-muted-foreground">{(s.change < 0 ? "−" : "+") + money(Math.abs(C.per(s.change)), 2)} /check</span>}</td>
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
      <p className="hint mt-3">Amounts are per month, in today&apos;s dollars. {perCheck === "per month" ? "" : "The paycheck figure is the same cost on your pay schedule. "}A stage costing less than today adds the difference to the brokerage.</p>
      <div className="formactions mt-4">
        <Button variant="outline" className="flex-1" onClick={() => setTyped({})}>{order ? "The usual order" : "Brokerage first"}</Button>
        <Button className="flex-1" onClick={() => save(nums)}>{saveLabel ?? "Build the stages"}</Button>
      </div>
    </Modal>
  );
}
