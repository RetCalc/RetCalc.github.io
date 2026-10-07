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

import { DraftInput } from "@/components/fields/DraftInput";
import { Affixed } from "@/components/fields/Field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { fmtNum, money, parseNum } from "@/lib/format";
import { XIcon } from "lucide-react";
import { gdM, ok, pos, saveMo, withGuess, type Sim } from "../calc";
import { ScheduleBars } from "../charts/Schedule";
import { Lesson, Term } from "../lessons/Lesson";
import { CHILD_COST, CHILD_SOURCE, children, collegeWindows, hasChanges, householdAtRetire, householdByAge, schedule, type Stage } from "../schedule";
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
        {ev.kind === "raise" ? <><EvField ev={ev} k="at" label="From age" affix="age" /><EvField ev={ev} k="extra" label="Saving more" money affix="/mo" /></> : null}
        {ev.kind === "payoff" ? <><EvField ev={ev} k="at" label="Paid off at" affix="age" /><EvField ev={ev} k="freed" label="Payment freed for saving" money affix="/mo" /></> : null}
        {ev.kind === "parttime" || ev.kind === "pause" ? <><EvField ev={ev} k="from" label="From age" affix="age" /><EvField ev={ev} k="to" label="Until age" affix="age" />
          <EvField ev={ev} k="saving" label="Saving then" money affix="/mo" /></> : null}
        {ev.kind === "custom" ? <>
          {!(ev.id.startsWith("edit-") || ev.id.startsWith("stg-")) ? <div className="field full"><Label className="mb-1.5" htmlFor={"gdev-" + ev.id + "-label"}><span>What it is</span></Label>
            <Input id={"gdev-" + ev.id + "-label"} maxLength={40} defaultValue={ev.label}
              onChange={(e) => { const label = e.target.value.replace(/[^A-Za-z0-9 .,%'\-]/g, "").slice(0, 40); G.set("events", (G.a.events || []).map((x) => (x.id === ev.id ? { ...x, label } as ChangeEvent : x))); }} /></div> : null}
          <EvField ev={ev} k="from" label="From age" affix="age" /><EvField ev={ev} k="to" label="Until age" affix="age" />
          <div className="field"><Label className="mb-1.5" htmlFor={"gdev-" + ev.id + "-dir"}><span>Saving</span></Label>
            <NativeSelect id={"gdev-" + ev.id + "-dir"} value={ev.delta < 0 ? "less" : "more"}
              onChange={(e) => G.set("events", (G.a.events || []).map((x) => (x.id === ev.id && x.kind === "custom" ? { ...x, delta: Math.abs(x.delta) * (e.target.value === "less" ? -1 : 1) } : x)), true)}>
              <option value="less">Less a month</option><option value="more">More a month</option></NativeSelect></div>
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
    </Affixed></div>
  );
}

export function ChangesCard() {
  const G = useGuideView(), { a } = G;
  const L = scheduleOf(a), flatMo = saveMo(a), kids = children(a), on = hasChanges(a);
  const ages = (a.kidsNow || []).join(", ");
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
      <Numbers>
        <H3>Children</H3>
        <div className="gd-fields">
          <div className="field full"><Label className="mb-1.5" htmlFor="gdf-kidsNow"><span>Children you have now: their ages</span></Label>
            <Input id="gdf-kidsNow" data-a="kidsNow" inputMode="numeric" placeholder="none, or for example 4, 7" defaultValue={ages}
              onChange={(e) => G.set("kidsNow", e.target.value.split(/[^0-9]+/).filter(Boolean).map(Number).filter((n) => n < 30).slice(0, 12))} />
            <div className="hint">Leave blank if none. Today&apos;s saving already pays for them; the plan raises it as they grow up.</div></div>
          <NumF k="kidsPlanned" label="Children planned" affix="children" hint="0 if none." />
          {pos(a.kidsPlanned) ? <><NumF k="firstIn" label="The first in about" affix="years" /><NumF k="spacing" label="Then one every" affix="years" /></> : null}
        </div>
        {kids.length ? (
          <>
            <H3>Paid childcare before school?</H3>
            <div className="gd-choices two">
              <button type="button" className={"gd-choice" + (a.childcare !== false ? " on" : "")} data-set="childcare" data-val="yes" aria-pressed={a.childcare !== false} onClick={() => G.set("childcare", true, true)}>
                <i className="dot" aria-hidden="true"></i><span className="t"><b>Yes</b><span>{money(CHILD_COST.care)} a month per child, to age 6</span></span></button>
              <button type="button" className={"gd-choice" + (a.childcare === false ? " on" : "")} data-set="childcare" data-val="no" aria-pressed={a.childcare === false} onClick={() => G.set("childcare", false, true)}>
                <i className="dot" aria-hidden="true"></i><span className="t"><b>No</b><span>{money(CHILD_COST.noCare)} a month per child, to age 6</span></span></button>
            </div>
            <div className="gd-fields">
              <MoneyF k="childEarly" label="A child before school costs" per="/mo" ph={String(a.childcare !== false ? CHILD_COST.care : CHILD_COST.noCare)} />
              <MoneyF k="childSchool" label="At school, to 18" per="/mo" ph={String(CHILD_COST.school)} />
            </div>
            <p className="hint mx-0 mt-0 mb-3">{pos(a.childEarly) && pos(a.childSchool) ? <SourceBadge kind="entered" /> : <SourceBadge kind="estimated" />} Estimated from {CHILD_SOURCE}.
              {" "}A second or later child costs 20% less. Overwrite either with your own figure.</p>
          </>
        ) : null}
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

function ChangesMeans() {
  const { a } = useGuideView();
  const on = hasChanges(a), wa = withGuess(a);
  const withJ = usePlanJob<Sim>("sim", on ? wa : null), flatJ = usePlanJob<Sim>("sim", on ? wa : null, { args: { over: { flat: true } } });
  if (!on) return <Means><p className="gd-means-empty">Your saving schedule appears once a child or another change is in. With none, the plan keeps today&apos;s saving every year.</p></Means>;
  const L = scheduleOf(a), S = withJ.res, F = flatJ.res, kids = children(a), W = collegeWindows(a), ret = Math.round(a.retire || 65);
  const H = householdByAge(a).filter((h, i, all) => !i || h.n !== all[i - 1].n);
  const floored = L.some((s) => s.floored);
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
      {floored ? <Callout cls="warn">* The costs in that stage come to more than you save, so it reads $0 rather than a negative figure; the rest would come from your budget.</Callout> : null}
      <ul className="gd-read">
        {H.length > 1 ? <li>Your household before 65: {and(H.map((h, i) => (i ? h.n + " from " + h.age : h.n + " now")))}. {ret < 65 ? "The plan prices health insurance before Medicare for a household of " + householdAtRetire(a, ret) + "." : ""}</li> : null}
        {W.map((w, i) => (
          <li key={i}>{W.length > 1 ? (i === 0 ? "Your first child" : i === 1 ? "Your second" : "Child " + (i + 1)) : "Your child"} starts college at {w.from}{w.from >= ret ? ", after you retire" : ", " + yrs(ret - w.from) + " before you retire"}
            {w.to > ret && w.from < ret ? ": those years overlap your retirement, so the plan card asks you to check the college line is funded" : ""}.</li>
        ))}
        {W.length ? <li>College isn&apos;t in this schedule; Home and big goals&apos; college question keeps a line for it.</li> : null}
      </ul>
    </Means>
  );
}
