"use client";

/* The children's pop-ups: the one that asks about the children (the
   Guide's questions and costs), and "How will you cover this?", the rule
   for which accounts each stage's cost comes out of.
   Advanced's Children change, the Dashboard and Stages use them. */

import { useState } from "react";
import { ChevronDownIcon, ChevronUpIcon } from "lucide-react";
import { Affixed } from "@/components/fields/Field";
import { MoneyInput, NumberInput } from "@/components/fields/NumberInput";
import { Segmented } from "@/components/common/Readout";
import { Modal } from "@/components/shell/Modal";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { groupDigits, money, parseNum } from "@/lib/format";
import { CARE_AREAS, CHILD_COST, CHILD_SOURCE, MAX_KIDS, type CareArea } from "@/tools/guide/schedule";
import { CountedBoxes } from "@/components/fields/CountedBoxes";
import { ageSpan, kidDefaults, kidList, kidStages, stageKey, type Cover, type KidStage, type Monthly } from "./kids";
import { COVER_ORDER, NO_KIDS, type CoverLine, type CoverRule, type PlanKids } from "./model";

const ACCT: Record<CoverLine, string> = { brok: "Brokerage", roth: "Roth", trad: "Traditional", hsa: "HSA" };
const ages = (from: number, to: number) => (to - from <= 1 && Number.isInteger(from) && Number.isInteger(to) ? "Age " : "Ages ") + ageSpan(from, to);
/** A stage's span: your ages, or (in the Stages calculator, which has no
    age) years from now, counted from `base`. */
export const spanText = (from: number, to: number, base?: number) => base == null ? ages(from, to)
  : (to - from <= 1 && Number.isInteger(from) && Number.isInteger(to) ? "Year " : "Years ") + ageSpan(from - base, to - base);
/** To the half year: 2.5 years stays 2.5. */
const half = (v: number) => Math.round(v * 2) / 2;

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
        The costs below are typical ones, in today&apos;s dollars. Change any of them to your own. Up to {MAX_KIDS} children in all.</div>
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

/** "How will you cover this?": one rule for every stage, where the
    children's costs come out of saving: one account at a time in an order
    you set, or a share of each. Below, what the rule takes in each stage,
    worked out on that stage's first year of saving (`stage`), as the plan
    runs it; nothing in the table is typed. `today`: saving a month now, by
    account; `usual`: the order when none is set. `freesLess`: cuts are
    sized to the paycheck's taxes; `matchLast`: the 401(k) up to the match
    always goes last (the Dashboard). */
export function CoverStagesDialog({ segs, today, usual = [...COVER_ORDER], initial, base, stage, freesLess, matchLast, close, save, saveLabel }: {
  segs: KidStage[]; today: Monthly; usual?: CoverLine[]; initial: CoverRule | null; base?: number;
  stage: (s: KidStage, rule: CoverRule | null) => { room: Monthly; cover: Cover };
  freesLess?: boolean; matchLast?: boolean; close: () => void; save: (rule: CoverRule | null) => void; saveLabel?: string;
}) {
  const [by, setBy] = useState<CoverRule["by"]>(initial?.by ?? "order");
  const [order, setOrder] = useState<CoverLine[]>(() => initial?.order ?? usual);
  const usualOrder = order.join() === usual.join();
  const rule: CoverRule | null = by === "order" && usualOrder ? null : { by, ...(usualOrder ? {} : { order }) };
  const rows = segs.map((s) => ({ s, ...stage(s, rule) }));
  // The accounts that have saving, now or in any stage, in the order set.
  const shown = (by === "order" ? order : usual).filter((k) => today[k] > 0.5 || rows.some((r) => r.room[k] > 0.5));
  const move = (k: CoverLine, d: -1 | 1) => setOrder((o) => {
    // Past the next account shown (ones with no saving keep their place).
    const vis = o.filter((x) => shown.includes(x)), i = vis.indexOf(k), j = i + d;
    if (j < 0 || j >= vis.length) return o;
    const swap = vis[j], out = [...o], a = out.indexOf(k), b = out.indexOf(swap);
    [out[a], out[b]] = [out[b], out[a]];
    return out;
  });
  const anyMatch = rows.some((r) => r.cover.matchLost > 0.5);
  return (
    <Modal size="table" onClose={close}>
      <h3>How will you cover this?</h3>
      <p className="formhint">Some stages cost more than you spend now. The difference comes out of what you save, the same way in every stage.
        {" "}What saving can&apos;t cover comes out of spending.</p>

      <div className="mt-4 grid gap-5 md:grid-cols-5 md:items-start">
        <div className="grid gap-3 md:col-span-2">
          {shown.length <= 1 ? (
            <p className="text-note text-muted-foreground">{shown.length ? <>All of it comes from <b className="font-medium text-foreground">{ACCT[shown[0]]}</b>, the only account you&apos;re saving to.</> : "You aren't saving to any account yet, so all of it comes out of spending."}
              {matchLast && shown.length ? " The 401(k) up to the match goes last, so you keep the match as long as you can." : ""}</p>
          ) : <>
            <div className="text-label text-muted-foreground">Take it from</div>
            <Segmented attr="data-cvby" size="fill" options={[["order", "One account at a time"], ["share", "Every account"]] as const} value={by} onChange={setBy} />
            <p className="text-note text-muted-foreground">
              {by === "order" ? "Each account gives up all its saving before the next one gives up any." : "Every account gives up the same share of what goes into it."}
              {matchLast ? " The 401(k) up to the match goes last, so you keep the match." : ""}
            </p>
            {by === "order" ? (
              <div className="grid gap-1.5">
                <ol className="m-0 grid list-none gap-1.5 p-0" aria-label="The order accounts give up saving">
                  {shown.map((k, i) => (
                    <li key={k} className="m-0 flex items-center gap-3 rounded-(--r-well) border border-input bg-background py-1.5 pr-1.5 pl-3">
                      <span className="grid size-6 flex-none place-items-center rounded-full bg-muted text-label font-medium tabular-nums" aria-hidden="true">{i + 1}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block font-medium">{ACCT[k]}</span>
                        <span className="block text-label text-muted-foreground tabular-nums">{money(today[k])} per month now</span>
                      </span>
                      <Button variant="ghost" size="icon-sm" aria-label={"Move " + ACCT[k] + " up"} disabled={i === 0} onClick={() => move(k, -1)}><ChevronUpIcon /></Button>
                      <Button variant="ghost" size="icon-sm" aria-label={"Move " + ACCT[k] + " down"} disabled={i === shown.length - 1} onClick={() => move(k, 1)}><ChevronDownIcon /></Button>
                    </li>
                  ))}
                </ol>
                {usualOrder ? null : <Button variant="link" size="inline" className="justify-self-start" onClick={() => setOrder(usual)}>Back to the usual order</Button>}
              </div>
            ) : null}
          </>}
        </div>

        <div className="min-w-0 md:col-span-3">
          <div className="text-label text-muted-foreground">What that takes, per month</div>
          {/* On a phone, each stage with its accounts under it; the table from sm up. */}
          <ul className="m-0 mt-2 grid list-none p-0 text-note tabular-nums sm:hidden">
            {rows.map(({ s, room, cover: c }) => (
              <li key={stageKey(s)} className="m-0 border-t border-border py-2.5">
                <div className="flex items-baseline justify-between gap-3">
                  <span><b className="font-medium">{s.label}</b><span className="block text-label text-muted-foreground">{spanText(s.from, s.to, base)}</span></span>
                  <span className="whitespace-nowrap">{(s.change < 0 ? "−" : "+") + money(Math.abs(s.change))}</span>
                </div>
                <dl className="m-0 mt-1.5 grid grid-cols-2 gap-x-3 gap-y-0.5 text-label">
                  {shown.filter((k) => Math.abs(c.take[k]) > 0.5).map((k) => (
                    <div key={k} className="contents">
                      <dt className="text-muted-foreground">{ACCT[k]}</dt>
                      <dd className="m-0 text-right">{c.take[k] > 0 ? <>−{money(c.take[k])} <span className="text-muted-foreground">of {money(room[k])}</span></> : <span className="text-gain">+{money(-c.take[k])}</span>}
                        {k === "trad" && c.matchLost > 0.5 ? <span className="block text-loss">−{money(c.matchLost)} match</span> : null}</dd>
                    </div>
                  ))}
                  {c.short > 0 ? <><dt className="text-muted-foreground">From spending</dt><dd className="m-0 text-right text-loss">−{money(c.short)}</dd></> : null}
                </dl>
              </li>
            ))}
          </ul>
          <div className="mt-2 overflow-x-auto max-sm:hidden">
            <table className="w-full min-w-120 text-note tabular-nums">
              <thead><tr className="text-label text-muted-foreground">
                <th className="py-1.5 text-left font-medium">Stage</th><th className="py-1.5 text-right font-medium">Children cost</th>
                {shown.map((k) => <th key={k} className="py-1.5 pl-3 text-right font-medium">{ACCT[k]}</th>)}
                <th className="py-1.5 pl-3 text-right font-medium">From spending</th>
              </tr></thead>
              <tbody>
                {rows.map(({ s, room, cover: c }) => (
                  <tr key={stageKey(s)} className="border-t border-border align-top">
                    <td className="py-2 pr-2"><b className="font-medium">{s.label}</b><span className="block text-label text-muted-foreground">{spanText(s.from, s.to, base)}</span></td>
                    <td className="py-2 text-right whitespace-nowrap">{(s.change < 0 ? "−" : "+") + money(Math.abs(s.change))}</td>
                    {shown.map((k) => (
                      <td key={k} className="py-2 pl-3 text-right whitespace-nowrap">
                        {c.take[k] > 0.5 ? <>
                          <span className="font-medium">−{money(c.take[k])}</span>
                          <span className="block text-label text-muted-foreground">of {money(room[k])}</span>
                          {/* A pre-tax cut, sized to the paycheck's taxes, frees less than itself: say what it frees. */}
                          {freesLess && (k === "trad" || k === "hsa") && c.take[k] - c.freedBy[k] > 0.5 ? <span className="block text-label text-muted-foreground">frees {money(c.freedBy[k])}</span> : null}
                          {k === "trad" && c.matchLost > 0.5 ? <span className="block text-label text-loss">−{money(c.matchLost)} match</span> : null}
                        </> : c.take[k] < -0.5 ? <span className="text-gain">+{money(-c.take[k])}</span> : <span className="text-muted-foreground">–</span>}
                      </td>
                    ))}
                    <td className={"py-2 pl-3 text-right whitespace-nowrap" + (c.short > 0 ? " text-loss" : "")}>{c.short > 0 ? "−" + money(c.short) : <span className="text-muted-foreground">–</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {anyMatch ? <p className="hint mt-3 text-loss">A cut shown in red goes below what earns the full employer match, so the match shrinks too.{shown.length > 1 ? " Putting Traditional later keeps it." : ""}</p> : null}
          <p className="hint mt-3">Each stage at its first year, in today&apos;s dollars, from what you&apos;ll be saving then. {by === "order" ? "As saving grows through a stage, more of it can come from the first account." : "As saving grows through a stage, each account gives up a smaller share."}
            {freesLess ? " Money kept out of a traditional account or the HSA is taxed as pay again, so a cut there is made bigger to cover the cost after that tax." : ""}
            {rows.some((r) => r.s.change < 0) ? " A stage that costs less than today adds the difference to the brokerage." : ""}</p>
        </div>
      </div>

      <div className="formactions mt-5">
        <Button variant="outline" className="flex-1" onClick={close}>Cancel</Button>
        <Button className="flex-1" onClick={() => save(rule)}>{saveLabel ?? "Save"}</Button>
      </div>
    </Modal>
  );
}
