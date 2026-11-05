"use client";

/* The children's pop-ups: the one that asks about the children (the
   Guide's questions and costs), and "How will you cover this?", the rule
   for which accounts each stage's cost comes out of.
   Advanced's Children change, the Dashboard and Stages use them. */

import { useState } from "react";
import { ChevronRightIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
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

type Pick = "usual" | "share" | "own";
const lower = (k: CoverLine) => (k === "brok" || k === "trad" ? ACCT[k].toLowerCase() : ACCT[k]);
const listed = (xs: string[]) => (xs.length < 2 ? xs.join("") : xs.slice(0, -1).join(", ") + " and " + xs[xs.length - 1]);
const stagesWord = (n: number) => (n === 1 ? "one stage" : n + " stages");

/** "How will you cover this?": one choice for every stage, where the
    children's costs come out of saving: the usual order (the brokerage
    first), a bit from each account, or an order you set. Under it, what
    that means in a few plain sentences, worked out on each stage's first
    year of saving (`stage`), as the plan runs it; each stage's figures
    behind a link. `today`: saving a month now, by account; `usual`: the
    order when none is set. `freesLess`: cuts are sized to the paycheck's
    taxes; `matchLast`: the 401(k) up to the match always goes last;
    `spending`: what saving can't cover comes out of spending (the
    Dashboard, which has a budget). */
export function CoverStagesDialog({ segs, today, usual = [...COVER_ORDER], initial, base, stage, freesLess, matchLast, spending, close, save, saveLabel }: {
  segs: KidStage[]; today: Monthly; usual?: CoverLine[]; initial: CoverRule | null; base?: number;
  stage: (s: KidStage, rule: CoverRule | null) => { room: Monthly; cover: Cover };
  freesLess?: boolean; matchLast?: boolean; spending?: boolean; close: () => void; save: (rule: CoverRule | null) => void; saveLabel?: string;
}) {
  const [pick, setPick] = useState<Pick>(() => (initial?.by === "share" ? "share" : initial?.order && initial.order.join() !== usual.join() ? "own" : "usual"));
  const [order, setOrder] = useState<CoverLine[]>(() => initial?.order ?? usual);
  const [open, setOpen] = useState(false);
  const [drag, setDrag] = useState<CoverLine | null>(null);
  const used = pick === "own" ? order : usual;
  const rule: CoverRule | null = pick === "share" ? { by: "share" } : pick === "own" && order.join() !== usual.join() ? { by: "order", order } : null;
  const rows = segs.map((s) => ({ s, ...stage(s, rule) }));
  // The accounts that have saving, now or in any stage, in the order used.
  const shown = used.filter((k) => today[k] > 0.5 || rows.some((r) => r.room[k] > 0.5));
  const usualShown = usual.filter((k) => shown.includes(k) || today[k] > 0.5);
  // Moves `k` to where `to` is (ones with no saving keep their place).
  const moveTo = (k: CoverLine, to: CoverLine) => setOrder((o) => {
    if (k === to) return o;
    const out = o.filter((x) => x !== k);
    out.splice(out.indexOf(to) + (o.indexOf(k) < o.indexOf(to) ? 1 : 0), 0, k);
    return out;
  });
  const earlier = (k: CoverLine) => { const vis = order.filter((x) => shown.includes(x)), i = vis.indexOf(k); if (i > 0) moveTo(k, vis[i - 1]); };

  // What the choice means, in a few sentences.
  const costly = rows.filter((r) => r.s.change > 0);
  const takes = (r: (typeof rows)[number], k: CoverLine) => r.cover.take[k] > 0.5;
  const says: { text: string; warn?: boolean }[] = [];
  if (shown.length <= 1) {
    says.push({ text: shown.length ? `It all comes from ${lower(shown[0])}, the only account you're saving to.` : "You aren't saving to any account yet." });
  } else if (pick === "share") {
    const pct = costly.map((r) => { const room = shown.reduce((t, k) => t + r.room[k], 0); return room > 0 ? Math.min(1, shown.reduce((t, k) => t + Math.max(0, r.cover.take[k]), 0) / room) : 1; });
    const lo = Math.round(Math.min(...pct) * 100), hi = Math.round(Math.max(...pct) * 100);
    says.push({ text: `Each stage takes the same share from every account: ${lo === hi ? `${lo}% of what goes into each` : `from ${lo}% of what goes into each in the lightest stage to ${hi}% at the most expensive`}.` });
  } else {
    const [first, second, ...rest] = shown;
    const alone = costly.filter((r) => shown.every((k) => k === first || !takes(r, k))).length;
    says.push({ text: alone === costly.length ? `${ACCT[first]} covers all of it in every stage.`
      : `${ACCT[first]} goes first${alone ? ` and covers all of it in ${stagesWord(alone)}` : ""}. ${ACCT[second]} tops it up when that isn't enough.` });
    const later = rest.filter((k) => costly.some((r) => takes(r, k)));
    if (later.length) {
      const n = costly.filter((r) => later.some((k) => takes(r, k))).length;
      says.push({ text: `${listed(later.map((k) => ACCT[k]))} ${later.length === 1 ? "is" : "are"} only touched in the ${n === 1 ? "most expensive stage" : n + " most expensive stages"}.` });
    } else if (rest.length && alone < costly.length) says.push({ text: `${listed(rest.map((k) => ACCT[k]))} ${rest.length === 1 ? "isn't" : "aren't"} touched.` });
  }
  if (freesLess && costly.some((r) => takes(r, "trad") || takes(r, "hsa")))
    says.push({ text: "Money kept out of traditional or the HSA is taxed as pay again, so a cut there is made a little bigger to cover the cost." });
  const matchCut = costly.filter((r) => r.cover.matchLost > 0.5).length;
  if (matchCut) says.push({ warn: true, text: `In ${stagesWord(matchCut)} this cuts into the 401(k) up to the match, so the match shrinks too.` });
  const short = costly.filter((r) => r.cover.short > 0);
  const over = (n: number) => (spending ? `plus ${money(n)} per month from spending` : `and ${money(n)} per month more than that`);
  if (short.length === 1) {
    const r = short[0];
    says.push({ warn: true, text: `${spanText(r.s.from, r.s.to, base)} (${r.s.label.charAt(0).toLowerCase() + r.s.label.slice(1)}, ${money(r.s.change)} per month) take everything you save, ${over(r.cover.short)}.` });
  } else if (short.length > 1) {
    const most = short.reduce((m, r) => (r.cover.short > m.cover.short ? r : m));
    says.push({ warn: true, text: `In ${stagesWord(short.length)} the children cost more than you save. The most is ${spanText(most.s.from, most.s.to, base).toLowerCase()}: everything you save, ${over(most.cover.short)}.` });
  }

  const choices: [Pick, string, string][] = [
    ["usual", "Brokerage first", (usualShown.length > 1 ? "Then " + usualShown.slice(1).map(lower).join(", then ") + "." : "") + (matchLast ? " The 401(k) up to the match goes last." : " Your tax-advantaged accounts keep growing the longest.")],
    ["share", "A bit from each", "Every account gives up the same share of what goes into it."],
    ["own", "My own order", "Choose which account goes first."],
  ];
  return (
    <Modal size="wide" onClose={close}>
      <h3>How will you cover this?</h3>
      <p className="formhint">{spending
        ? "Children cost more in some years than you spend now. That difference comes out of what you save; anything saving can't cover comes out of spending."
        : "Children's costs come out of what you save. Choose which accounts give it up."}</p>

      {shown.length > 1 ? (
        <div className="mt-4 grid gap-2" role="radiogroup" aria-label="Which accounts give it up">
          {choices.map(([id, name, desc]) => {
            const on = pick === id;
            return (
              <div key={id} className={"rounded-(--r-card) border transition-colors " + (on ? "border-foreground bg-muted" : "border-border hover:border-muted-foreground")}>
                <button type="button" role="radio" aria-checked={on} onClick={() => setPick(id)}
                  className="flex w-full cursor-pointer items-start gap-2.5 border-0 bg-transparent px-3.5 py-3 text-left font-sans text-base text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
                  <span aria-hidden="true" className={"mt-0.5 grid size-4.5 flex-none place-items-center rounded-full border-2 " + (on ? "border-foreground" : "border-input")}>{on ? <span className="size-2 rounded-full bg-foreground" /> : null}</span>
                  <span className="min-w-0">
                    <span className="flex flex-wrap items-center gap-2 font-medium">{name}{id === "usual" ? <Badge variant="outline">Recommended</Badge> : null}</span>
                    <span className="mt-0.5 block text-note text-muted-foreground">{desc}</span>
                  </span>
                </button>
                {id === "own" && on ? (
                  <div className="px-3.5 pb-3 pl-10.5">
                    <ol className="m-0 flex list-none flex-wrap items-center gap-1.5 p-0" aria-label="The order accounts give up saving">
                      {order.filter((k) => shown.includes(k)).map((k, i) => (
                        <li key={k} className="m-0 flex items-center gap-1.5">
                          {i ? <ChevronRightIcon aria-hidden="true" className="size-3.5 text-muted-foreground" /> : null}
                          <button type="button" draggable onDragStart={() => setDrag(k)} onDragEnd={() => setDrag(null)} onDragOver={(e) => e.preventDefault()}
                            onDrop={() => { if (drag) moveTo(drag, k); setDrag(null); }} onClick={() => earlier(k)}
                            aria-label={i ? `${ACCT[k]}, ${i + 1} of ${shown.length}: move it earlier` : `${ACCT[k]}, first`}
                            className={"inline-flex cursor-grab items-center gap-1.5 rounded-full border border-input bg-background px-2.5 py-1 font-sans text-note text-foreground active:cursor-grabbing focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring" + (drag === k ? " opacity-50" : "")}>
                            <b className="font-medium">{ACCT[k]}</b><span className="text-label text-muted-foreground tabular-nums">{money(today[k])} per month now</span>
                          </button>
                        </li>
                      ))}
                    </ol>
                    <p className="mt-1.5 text-label text-muted-foreground">Drag to change the order, or tap one to move it earlier.</p>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      ) : null}

      <div className="mt-5 border-t border-border pt-4">
        <div className="text-label text-muted-foreground">What this means for your plan</div>
        <ul className="m-0 mt-2 grid list-none gap-2 p-0">
          {says.map((x, i) => (
            <li key={i} className="m-0 flex items-start gap-2.5">
              <span aria-hidden="true" className={"mt-2 size-1.5 flex-none rounded-full " + (x.warn ? "bg-loss" : "bg-muted-foreground")} />
              <span>{x.text}</span>
            </li>
          ))}
        </ul>
        <Button variant="link" size="inline" className="mt-3" aria-expanded={open} onClick={() => setOpen((o) => !o)}>{open ? "Hide each stage" : "See each stage"}</Button>
        {open ? (
          <ul className="m-0 mt-2 list-none p-0 text-note tabular-nums">
            {rows.map(({ s, cover: c }) => {
              const from = shown.filter((k) => Math.abs(c.take[k]) > 0.5).map((k) => c.take[k] > 0 ? `${ACCT[k]} ${money(c.take[k])}` : `${ACCT[k]} +${money(-c.take[k])}`);
              return (
                <li key={stageKey(s)} className="m-0 border-t border-border py-2 first:border-t-0">
                  <b className="font-medium">{spanText(s.from, s.to, base)}</b> · {s.label}
                  <span className="block text-muted-foreground">{money(Math.abs(s.change))} per month{s.change < 0 ? " less than today, added to the brokerage" : ": " + (from.join(" · ") || "nothing")}
                    {c.short > 0 ? <span className="text-loss"> · {money(c.short)} {spending ? "from spending" : "more than you save"}</span> : null}</span>
                </li>
              );
            })}
          </ul>
        ) : null}
      </div>

      <div className="formactions mt-5">
        <Button variant="outline" className="flex-1" onClick={close}>Cancel</Button>
        <Button className="flex-1" onClick={() => save(rule)}>{saveLabel ?? "Save"}</Button>
      </div>
    </Modal>
  );
}
