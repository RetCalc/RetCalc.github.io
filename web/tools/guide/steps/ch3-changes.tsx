"use client";

/* Deeper · Changes ahead (doc 2, chapter 3; doc 3, "Changes ahead" and
   section 3 items 2b and 13): saving that changes over time. Children
   first, with costs estimated by age and overwritable; then a raise,
   part-time years, a payment that ends, a spouse's pause or anything else,
   each a small form. The card shows the schedule by age with a table whose
   stages can be edited by hand, the number with the changes against the
   number without, the household by age before 65, and each child's
   college years against retirement. The schedule is worked out from the
   answers every time (schedule.ts); a hand edit is kept as an event. */

import { useState } from "react";
import { DraftInput } from "@/components/fields/DraftInput";
import { Affixed } from "@/components/fields/Field";
import { CountedBoxes } from "@/components/fields/CountedBoxes";
import { NumberInput } from "@/components/fields/NumberInput";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { fmtNum, money, parseNum } from "@/lib/format";
import { XIcon } from "lucide-react";
import { gdM, ok, pos, saveMo, withGuess, type Sim } from "../calc";
import { ScheduleBars } from "../charts/Schedule";
import { Lesson, Term } from "../lessons/Lesson";
import { CARE_AREAS, CHILD_COST, CHILD_SOURCE, MAX_KIDS, careAreaOf, children, collegeWindows, earlyCost, hasChanges, householdAtRetire, householdByAge, schedule, shortfall, type Stage } from "../schedule";
import { SourceBadge } from "../SourceBadge";
import type { Answers, ChangeEvent } from "../store";
import { BackNote, Callout, H3, MoneyF, NumF, Q, useGuideView } from "../ui";
import { usePlanJob } from "../usePlan";
import { and, rounded } from "../words";
import { Learn, Means, Numbers } from "../zones";

const yrs = (n: number) => fmtNum(n) + (n === 1 ? " year" : " years");
const newId = (k: string) => k + "-" + Date.now().toString(36).slice(-6);
const stopOf = (a: Answers) => (ok(a.stopAge) && ok(a.retire) && a.stopAge < a.retire ? Math.max(a.age!, a.stopAge) : null);
export const scheduleOf = (a: Answers): Stage[] => (ok(a.age) && ok(a.retire) && a.retire > a.age ? schedule(a, { monthly: saveMo(a), stop: stopOf(a) }) : []);

/** A number in one of the change events, as a small field. */
function EvField({ ev, k, label, money: isMoney, affix }: { ev: ChangeEvent; k: string; label: string; money?: boolean; affix?: string }) {
  const G = useGuideView();
  const val = (ev as unknown as Record<string, number>)[k];
  const put = (t: string) => {
    const n = t.trim() === "" ? null : parseNum(t);
    if (n == null || !isFinite(n)) return;
    G.set("events", (G.a.events || []).map((e) => (e.id === ev.id ? ({ ...e, [k]: n } as ChangeEvent) : e)));
  };
  return (
    <div className="field"><Label className="mb-1.5" htmlFor={"gdev-" + ev.id + "-" + k}><span>{label}</span></Label>
      <Affixed prefix={isMoney ? "$" : undefined} suffix={affix}>
        <DraftInput money={isMoney} nonNeg step={isMoney ? undefined : 1} id={"gdev-" + ev.id + "-" + k} data-ev={ev.id + ":" + k}
          value={ok(val) ? Math.abs(val) : NaN} format={(x) => (ok(x) ? (isMoney ? gdM(x) : String(x)) : "")}
          onType={(t) => put(k === "delta" && val < 0 ? "-" + t : t)} />
      </Affixed></div>
  );
}

const KINDS: { kind: ChangeEvent["kind"]; label: string }[] = [
  { kind: "raise", label: "A raise" }, { kind: "parttime", label: "Part-time years" }, { kind: "payoff", label: "A mortgage paid off" },
  { kind: "pause", label: "A spouse pauses work" }, { kind: "custom", label: "Something else" },
];
function blank(kind: ChangeEvent["kind"], a: Answers): ChangeEvent {
  const age = Math.round(a.age || 40), ret = Math.round(a.retire || 65), mo = saveMo(a), half = Math.round(mo / 2 / 50) * 50;
  const at = Math.min(ret - 1, age + 5);
  switch (kind) {
    case "raise": return { id: newId("raise"), kind, at, extra: 500 };
    case "parttime": return { id: newId("pt"), kind, from: Math.max(age, ret - 5), to: ret, saving: half };
    case "payoff": return { id: newId("pay"), kind, at: Math.min(ret - 1, age + 10), freed: pos(a.mortPI) ? Math.round(a.mortPI) : pos(a.housePay) ? Math.round(a.housePay * 0.7) : 1000 };
    case "pause": return { id: newId("pause"), kind, from: Math.min(ret - 1, age + 2), to: Math.min(ret, age + 5), saving: half };
    default: return { id: newId("x"), kind: "custom", from: at, to: Math.min(ret, at + 3), delta: -500, label: "Something else" };
  }
}

function EventRow({ ev }: { ev: ChangeEvent }) {
  const G = useGuideView();
  const drop = () => G.set("events", (G.a.events || []).filter((e) => e.id !== ev.id), true);
  const title = ev.kind === "raise" ? "A raise" : ev.kind === "parttime" ? "Part-time years" : ev.kind === "payoff" ? "A payment that ends"
    : ev.kind === "pause" ? "A spouse pauses work" : ev.kind === "custom" ? (ev.id.startsWith("edit-") || ev.id.startsWith("stg-") ? "Your edit, ages " + ev.from + " to " + ev.to : ev.label || "Something else") : "";
  return (
    <div className="gd-ev" data-event={ev.kind}>
      <div className="gd-ev-h"><b>{title}</b>
        <Button variant="quiet" size="inline" data-ev-drop={ev.id} aria-label={"Remove " + title.toLowerCase()} onClick={drop}><XIcon aria-hidden="true" />Remove</Button></div>
      <div className="gd-fields">
        {ev.kind === "raise" ? <><EvField ev={ev} k="at" label="From age" affix="yrs old" /><EvField ev={ev} k="extra" label="Saving more" money affix="/mo" /></> : null}
        {ev.kind === "payoff" ? <><EvField ev={ev} k="at" label="Paid off at" affix="yrs old" /><EvField ev={ev} k="freed" label="Payment freed for saving" money affix="/mo" /></> : null}
        {ev.kind === "parttime" || ev.kind === "pause" ? <><EvField ev={ev} k="from" label="From age" affix="yrs old" /><EvField ev={ev} k="to" label="Until age" affix="yrs old" />
          <EvField ev={ev} k="saving" label="Saving then" money affix="/mo" /></> : null}
        {ev.kind === "custom" ? <>
          {!(ev.id.startsWith("edit-") || ev.id.startsWith("stg-")) ? <div className="field full"><Label className="mb-1.5" htmlFor={"gdev-" + ev.id + "-label"}><span>What it is</span></Label>
            <Input id={"gdev-" + ev.id + "-label"} maxLength={40} defaultValue={ev.label}
              onChange={(e) => { const label = e.target.value.replace(/[^A-Za-z0-9 .,%'\-]/g, "").slice(0, 40); G.set("events", (G.a.events || []).map((x) => (x.id === ev.id ? { ...x, label } as ChangeEvent : x))); }} /></div> : null}
          <EvField ev={ev} k="from" label="From age" affix="yrs old" /><EvField ev={ev} k="to" label="Until age" affix="yrs old" />
          <div className="field"><Label className="mb-1.5" htmlFor={"gdev-" + ev.id + "-dir"}><span>Saving</span></Label>
            <NativeSelect id={"gdev-" + ev.id + "-dir"} value={ev.delta < 0 ? "less" : "more"}
              onChange={(e) => G.set("events", (G.a.events || []).map((x) => (x.id === ev.id && x.kind === "custom" ? { ...x, delta: Math.abs(x.delta) * (e.target.value === "less" ? -1 : 1) } : x)), true)}>
              <option value="less">Less per month</option><option value="more">More per month</option></NativeSelect></div>
          <EvField ev={ev} k="delta" label="By" money affix="/mo" />
        </> : null}
      </div>
    </div>
  );
}

/** A stage's saving, editable: an edit is kept as an event over its years. */
function StageCell({ s }: { s: Stage }) {
  const G = useGuideView();
  const put = (t: string) => {
    const v = t.trim() === "" ? null : parseNum(t);
    if (v == null || !isFinite(v) || v < 0) return;
    const id = "edit-" + s.from + "-" + s.to, evs = G.a.events || [], had = evs.find((e) => e.id === id);
    const delta = (had && had.kind === "custom" ? had.delta : 0) + (v - s.monthly);
    G.set("events", [...evs.filter((e) => e.id !== id), ...(delta ? [{ id, kind: "custom", from: s.from, to: s.to, delta, label: "" } as ChangeEvent] : [])]);
  };
  return (
    <div className="gd-stage-in"><Affixed prefix="$" suffix="/mo">
      <DraftInput money nonNeg id={"gdst-" + s.from} data-stage={s.from} aria-label={"Saving from " + s.from + " to " + s.to} value={s.monthly} format={gdM} onType={put} />
    </Affixed>{s.short ? <span className="gd-stage-short" data-stage-short={s.from}>{money(s.short)}/mo short</span> : null}</div>
  );
}

export function ChangesCard() {
  const G = useGuideView(), { a } = G;
  const L = scheduleOf(a), flatMo = saveMo(a), kids = children(a), on = hasChanges(a);
  const events = (a.events || []).filter((e) => e.kind !== "child");
  return (
    <>
      <Q>Will your saving change over the years?</Q>
      <Learn>
        <Lesson id="not-flat" figure={on && L.length > 1 ? <ScheduleBars list={L} flat={flatMo} /> : null} caption={on && L.length > 1 ? "Your saving schedule, in today's dollars." : null}>
          <p>A plan that assumes today&apos;s saving every year until retirement overstates the number when children arrive, and understates it when a mortgage
            {" "}ends. The honest picture is a schedule by age: each <Term k="stage">stage</Term> of life with its own saving.</p>
          <p>Children are the biggest change for most people: childcare before school, then the school years, then saving can rise again. A raise,
            {" "}part-time years or a paid-off loan use the same idea.</p>
        </Lesson>
      </Learn>
      <BackNote step="changes" />
      <Numbers moreLabel="Spacing, childcare and costs" moreOpen={a.childcare === false || pos(a.childEarly) || pos(a.childSchool) || pos(a.childTeen) || !!a.kidGaps || (a.careArea != null && a.careArea !== "suburb")} more={kids.length ? (
        <>
          {pos(a.kidsPlanned) && a.kidsPlanned > 1 ? <PlannedSpacing /> : null}
          <H3>Paid childcare before school?</H3>
          <div className="gd-choices two">
            <button type="button" className={"gd-choice" + (a.childcare !== false ? " on" : "")} data-set="childcare" data-val="yes" aria-pressed={a.childcare !== false} onClick={() => G.set("childcare", true, true)}>
              <i className="dot" aria-hidden="true"></i><span className="t"><b>Yes</b><span>{money(earlyCost(true, careAreaOf(a.careArea)))} per month per child, to age 6</span></span></button>
            <button type="button" className={"gd-choice" + (a.childcare === false ? " on" : "")} data-set="childcare" data-val="no" aria-pressed={a.childcare === false} onClick={() => G.set("childcare", false, true)}>
              <i className="dot" aria-hidden="true"></i><span className="t"><b>No</b><span>{money(CHILD_COST.noCare)} per month per child, to age 6</span></span></button>
          </div>
          {a.childcare !== false ? <>
            <H3>Where you&apos;d use it</H3>
            <div className="gd-choices three">
              {CARE_AREAS.map((x) => {
                const on = careAreaOf(a.careArea) === x.id;
                return (
                  <button key={x.id} type="button" className={"gd-choice" + (on ? " on" : "")} data-set="careArea" data-val={x.id} aria-pressed={on} onClick={() => G.set("careArea", x.id, true)}>
                    <i className="dot" aria-hidden="true"></i><span className="t"><b>{x.name}</b><span>Childcare about {money(CHILD_COST.care[x.id])} per month</span></span></button>
                );
              })}
            </div>
          </> : null}
          <div className="gd-fields">
            <MoneyF k="childEarly" label="Birth to 5" per="/mo" ph={String(earlyCost(a.childcare !== false, careAreaOf(a.careArea)))} />
            <MoneyF k="childSchool" label="6 to 12" per="/mo" ph={String(CHILD_COST.school)} />
            <MoneyF k="childTeen" label="13 to 18" per="/mo" ph={String(CHILD_COST.teen)} />
          </div>
          <p className="hint mx-0 mt-0 mb-3">What one child costs per month at each age. A second or later child costs 20% less than these, since they share a room, clothes and gear.</p>
        </>
      ) : null}>
        <H3>Children</H3>
        <div className="gd-fields">
          <KidsNow />
          <NumF k="kidsPlanned" label="Children planned" affix="children" hint={"0 if none. Up to " + MAX_KIDS + " children in all."} />
          {pos(a.kidsPlanned) ? <NumF k="firstIn" label="The first in about" affix="years" /> : null}
        </div>
        {kids.length ? <p className="hint mx-0 mt-0 mb-3">{pos(a.childEarly) && pos(a.childSchool) && pos(a.childTeen) ? <SourceBadge kind="entered" /> : <SourceBadge kind="estimated" />} Each child costs
          {" "}{money(pos(a.childEarly) ? a.childEarly : earlyCost(a.childcare !== false, careAreaOf(a.careArea)))} per month before school{a.childcare !== false && !pos(a.childEarly) ? ", with childcare" : ""},
          {" "}{money(pos(a.childSchool) ? a.childSchool : CHILD_COST.school)} from 6 to 12 and {money(pos(a.childTeen) ? a.childTeen : CHILD_COST.teen)} from 13 to 18,
          {" "}20% less from the second. Typical costs from {CHILD_SOURCE}; change them under <b>Spacing, childcare and costs</b>.</p> : null}
        <H3>Other changes</H3>
        <div className="gd-picks">{KINDS.map((k) => (
          <Button key={k.kind} variant="outline" size="sm" data-ev-add={k.kind} onClick={() => G.set("events", [...(a.events || []), blank(k.kind, a)], true)}>+ {k.label}</Button>
        ))}</div>
        {events.map((e) => <EventRow key={e.id} ev={e} />)}
      </Numbers>
      <ChangesMeans />
    </>
  );
}

/** The children you have now: how many, then each one's age. */
function KidsNow() {
  const G = useGuideView();
  const [vals, setVals] = useState(() => (G.a.kidsNow || []).map(String));
  return (
    <CountedBoxes id="gdf-kidsNow" countLabel="Children you have now" countAffix="children" max={MAX_KIDS} values={vals} boxLabel={(i) => "Child " + (i + 1) + "'s age"} boxAffix="yrs" boxMax={29}
      onChange={(v) => {
        setVals(v);
        G.set("kidsNow", v.filter((x) => x.trim() !== "").map(Number).filter((n) => isFinite(n) && n >= 0 && n < 30));
      }} />
  );
}

/** Planned children's spacing: one gap for all, or each its own. */
function PlannedSpacing() {
  const G = useGuideView(), { a } = G;
  const n = Math.round(a.kidsPlanned ?? 0), even = pos(a.spacing) ? a.spacing : 3;
  const gaps = a.kidGaps ? Array.from({ length: n - 1 }, (_, i) => a.kidGaps![i] ?? even) : null;
  if (!gaps) return (
    <div className="gd-fields">
      <NumF k="spacing" label="Then one every" affix="years" hint="3 years unless you say otherwise." />
      <div className="field self-end"><Button variant="quiet" size="inline-xs" onClick={() => G.set("kidGaps", Array.from({ length: n - 1 }, () => even), true)}>Space them differently</Button></div>
    </div>
  );
  return (
    <div className="mb-3">
      <div className="flex flex-wrap gap-2.5">
        {gaps.map((g, i) => (
          <div key={i} className="w-40">
            <Label className="mb-1" htmlFor={"gdf-gap" + i}><span className="text-label text-muted-foreground">Planned child {i + 2}</span></Label>
            <Affixed suffix="yrs later"><NumberInput id={"gdf-gap" + i} nonNeg max={15} value={String(g)}
              onValueChange={(v) => G.set("kidGaps", gaps.map((x, j) => (j === i ? Math.max(0, Math.round((Number(v) || 0) * 2) / 2) : x)))} /></Affixed>
          </div>
        ))}
      </div>
      <p className="hint mx-0 mt-1.5 mb-0">Years after the child before it.{" "}
        <Button variant="quiet" size="inline-xs" onClick={() => G.set("kidGaps", null, true)}>Same spacing for all</Button></p>
    </div>
  );
}

function ChangesMeans() {
  const { a } = useGuideView();
  const on = hasChanges(a), wa = withGuess(a);
  const withJ = usePlanJob<Sim>("sim", on ? wa : null), flatJ = usePlanJob<Sim>("sim", on ? wa : null, { args: { over: { flat: true } } });
  if (!on) return <Means><p className="gd-means-empty">Your saving schedule appears once a child or another change is in. With none, the plan keeps today&apos;s saving every year.</p></Means>;
  const L = scheduleOf(a), S = withJ.res, F = flatJ.res, kids = children(a), W = collegeWindows(a), ret = Math.round(a.retire || 65);
  const H = householdByAge(a).filter((h, i, all) => !i || h.n !== all[i - 1].n);
  const SF = shortfall(L);
  return (
    <Means stale={(withJ.stale || flatJ.stale) && !!S}>
      {S && F ? <ul className="gd-read" data-changes="">
        <li>With these changes you&apos;re on course for <b>{rounded(S.fv)}</b> at {fmtNum(S.retire)}, against <b>{rounded(F.fv)}</b> saving today&apos;s {money(saveMo(a))} every month
          {F.fv > S.fv ? <>: the changes cost the plan about <b>{rounded(F.fv - S.fv)}</b>{kids.length ? " before college" : ""}.</> : F.fv < S.fv ? <>: they add about <b>{rounded(S.fv - F.fv)}</b>.</> : "."}</li>
        <li>That lasts in <b>{Math.round(S.success * 100)}%</b> of historical retirements{Math.abs(S.success - F.success) >= 0.005 ? ", against " + Math.round(F.success * 100) + "% without the changes" : ""}.</li>
      </ul> : <p className="gd-means-empty">Working it out…</p>}
      {L.length ? (
        <table className="gd-cmp-t gd-stages">
          <caption className="sr-only">Your saving schedule</caption>
          <thead><tr><th scope="col">Stage</th><th scope="col">Ages</th><th scope="col">Saving</th></tr></thead>
          <tbody>{L.map((s) => (
            <tr key={s.from} data-stage-row={s.from}><th scope="row"><span className="nm">{s.label}{s.floored ? " *" : ""}</span><SourceBadge kind={s.src} /></th>
              <td>{s.from} to {s.to}</td><td><StageCell s={s} /></td></tr>
          ))}</tbody>
        </table>
      ) : null}
      {SF.list.length ? <Callout cls="warn">* {kids.length ? "The children cost" : "These changes cost"} more than the {money(saveMo(a))} per month you save now
        {" "}({and(SF.list.map((x) => money(x.short) + " per month from " + x.from + " to " + x.to))}). Saving can&apos;t go below $0, so that has to come from your budget:
        {" "}about <b>{rounded(SF.total)}</b> in all, in today&apos;s dollars. Trim spending in those years, or build savings outside retirement before they start.</Callout> : null}
      <ul className="gd-read">
        {H.length > 1 ? <li>Your household before 65: {and(H.map((h, i) => (i ? h.n + " from " + h.age : h.n + " now")))}. {ret < 65 ? "The plan prices health insurance before Medicare for a household of " + householdAtRetire(a, ret) + "." : ""}</li> : null}
        {W.map((w, i) => (
          <li key={i}>{W.length > 1 ? (i === 0 ? "Your first child" : i === 1 ? "Your second" : "Child " + (i + 1)) : "Your child"} starts college at {w.from}{w.from >= ret ? ", after you retire" : ", " + yrs(ret - w.from) + " before you retire"}
            {w.to > ret && w.from < ret ? ". Those years overlap your retirement, so your next moves ask you to check the college line is funded" : ""}.</li>
        ))}
        {W.length ? <li>College isn&apos;t in this schedule. The college question on Home and big goals keeps a line for it.</li> : null}
      </ul>
    </Means>
  );
}
