/* The Full walkthrough's hand-off to Advanced (trips.ts): the guide's own
   changes written in as Advanced's changes ahead, and what you changed
   there read back as edits to the guide's. Stages did this before it was
   folded into Advanced. No React, so the tests can load it. */
import type { Scenario } from "@/components/dashboard/scenarios";
import { coastChange } from "@/tools/advanced/changes";
import type { AdvancedInputs } from "@/tools/advanced/model";
import { ok, pos, saveMo } from "./calc";
import { hasChanges, schedule } from "./schedule";
import type { Answers, ChangeEvent } from "./store";

/** The id the guide's own changes carry in Advanced, so a later trip
    replaces them and leaves yours alone. */
export const GUIDE_ID = "g-";

/** Changes ahead's schedule, when the answers have one. */
export function guideSchedule(a: Answers) {
  if (!hasChanges(a) || !ok(a.age) || !ok(a.retire) || !(a.retire > a.age)) return null;
  const stop = ok(a.stopAge) && a.stopAge < a.retire ? Math.max(a.age, a.stopAge) : null;
  const L = schedule(a, { monthly: saveMo(a), stop });
  return L.length ? L : null;
}

/** `s` (Advanced filled from the answers, saving `saveMo` a month and
    keeping pace with inflation, as the guide's saving does) with the
    guide's changes in, years from now, in today's dollars: Changes ahead's
    schedule when it has one, else the answers' one turning point (a plan
    to stop saving, the debt paid off freeing its minimums, college ending
    freeing its saving). They replace the ones a trip wrote before; your
    own stay. `made` names them. */
export function guideChanges(a: Answers, s: AdvancedInputs): { s: AdvancedInputs; made: string[] } {
  const age = Math.round(a.age!), yrs = Math.round(a.retire! - a.age!), mo = Math.round(saveMo(a));
  const mine = (s.changes ?? []).filter((c) => !c.id.startsWith(GUIDE_ID));
  const made: Scenario[] = [];
  const change = (from: number, to: number, delta: number, name: string) => made.push({
    id: GUIDE_ID + from, kind: "saving", name, on: true, from: from - age, until: to >= age + yrs ? 0 : to - age,
    mode: "amount", amount: Math.round(delta), ramp: 0, acct: "auto", nominal: 0,
  });
  const sched = guideSchedule(a);
  if (sched) {
    for (const x of sched) if (Math.round(x.monthly) !== mo) change(x.from, x.to, x.monthly - mo, x.label);
  } else {
    const dy = pos(a.debtMonths) ? Math.ceil(a.debtMonths / 12) : 0;
    const cy = a.college === "yes" && ok(a.kidAge) && pos(a.collegeMo) ? Math.max(1, Math.round(22 - a.kidAge)) : 0;
    const sy = ok(a.stopAge) && a.stopAge < a.retire! ? Math.max(0, Math.round(a.stopAge - a.age!)) : null;
    if (sy != null) made.push({ ...coastChange(sy), id: GUIDE_ID + "stop", name: "Coasting" });
    else if (dy && dy < yrs && pos(a.debtMin)) change(age + dy, age + yrs, a.debtMin, "Debt-free");
    else if (cy && cy < yrs) change(age + cy, age + yrs, a.collegeMo!, "After college");
  }
  return { s: { ...s, changes: [...made, ...mine] }, made: made.map((c) => c.name) };
}

/** What changed in Advanced's saving, year by year (today's dollars a
    month from `age0` on), as the guide's own edits: one for each run of
    years that moved by the same amount. */
export function editsFrom(was: number[], now: number[], age0: number): ChangeEvent[] {
  const w = was.map(Math.round), n = now.map(Math.round), edits: ChangeEvent[] = [];
  for (let i = 0; i < w.length && i < n.length;) {
    if (n[i] === w[i]) { i++; continue; }
    let j = i;
    while (j < w.length && j < n.length && n[j] - w[j] === n[i] - w[i]) j++;
    edits.push({ id: "adv-" + (age0 + i) + "-" + (age0 + j), kind: "custom", from: age0 + i, to: age0 + j, delta: n[i] - w[i], label: "" });
    i = j;
  }
  return edits;
}
