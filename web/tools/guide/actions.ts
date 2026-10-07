"use client";

/* Moving between the guide and the tools, and writing the guide's answers
   through to the household bar. From gdTrip(), gdCapture(), gdEndTrip() and
   gdHouseholdSync() in src/js/app/31-guide-coach.js and 29-guide-trips.js. */

import { setToolInputs, toolInputs, type ToolInputs } from "@/components/tools/ToolState";
import { HOUSEHOLD_STORE, type SavedHousehold } from "@/lib/household";
import { readStored } from "@/lib/storage";
import { ADVANCED_DEFAULTS } from "@/tools/advanced/model";
import { BT_DEFAULTS } from "@/tools/backtest/model";
import { BASIC_INPUTS } from "@/tools/basic/model";
import { BRIDGE_DEFAULTS } from "@/tools/bridge/model";
import { BUDGET_DEFAULTS } from "@/tools/budget/model";
import { COLLEGE_DEFAULTS } from "@/tools/college/model";
import { DEBT_DEFAULTS } from "@/tools/debt/model";
import { DRAWDOWN_DEFAULTS } from "@/tools/drawdown/fields";
import { FIRE_DEFAULTS } from "@/tools/fire/model";
import { HEALTHCARE_DEFAULTS } from "@/tools/healthcare/model";
import { MORTGAGE_DEFAULTS } from "@/tools/mortgage/model";
import { STAGES_DEFAULTS } from "@/tools/stages/model";
import { TAX_DEFAULTS } from "@/tools/tax/model";
import { mar, ok, pos, saveNow } from "./calc";
import { current, stepById } from "./route";
import { mark, putter, tripTool } from "./sources";
import { guide, setGuide, type Answers, type GuideState, type Sources, type Trip } from "./store";
import { TRIP_META } from "./tripMeta";
import { trip as tripDef } from "./trips";

/** Each tool's inputs before it's been opened. */
const DEFAULTS: Record<string, ToolInputs> = {
  tax: TAX_DEFAULTS, budget: BUDGET_DEFAULTS, debt: DEBT_DEFAULTS, mortgage: MORTGAGE_DEFAULTS, college: COLLEGE_DEFAULTS,
  basic: BASIC_INPUTS, drawdown: DRAWDOWN_DEFAULTS, bridge: BRIDGE_DEFAULTS, healthcare: HEALTHCARE_DEFAULTS, fire: FIRE_DEFAULTS,
  advanced: ADVANCED_DEFAULTS, stages: STAGES_DEFAULTS, backtest: BT_DEFAULTS,
};

/** The tool's inputs filled in for a trip, from the inputs it holds. */
export function prefill(t: Trip, a: Answers, s: ToolInputs): ToolInputs {
  const T = tripDef(t.id);
  try { return T ? T.prefill(a, s, t) : s; } catch { return s; }
}

/** Everything the household bar also knows goes there too. Blank answers
    leave the profile's own value alone. Its time stays as it was: the
    guide never pushes its numbers into a tool behind your back. Read
    from storage, as the page may not have loaded it yet. */
export function syncHousehold(a: Answers, save: (h: SavedHousehold) => void) {
  const profile = readStored<SavedHousehold>(HOUSEHOLD_STORE.key, HOUSEHOLD_STORE.version);
  const H = { ...(profile || { status: "s", age: null, spouseAge: null, retire: null, state: null, saved: null, monthly: null, income: null, income2: null, spend: null, savedAt: 0 }) } as SavedHousehold;
  if (a.status) H.status = a.status;
  if (ok(a.age)) H.age = a.age;
  H.spouseAge = mar(a) && ok(a.spouseAge) ? a.spouseAge : mar(a) ? H.spouseAge : null;
  if (ok(a.retire)) H.retire = a.retire;
  if (a.state) H.state = a.state;
  if (ok(a.income)) H.income = a.income;
  H.income2 = mar(a) && ok(a.income2) ? a.income2 : mar(a) ? H.income2 : null;
  if (ok(a.saved)) H.saved = a.saved;
  if (ok(a.contrib)) H.monthly = saveNow(a);
  if (pos(a.retSpend)) H.spend = a.retSpend;
  save(H);
}
/** First visit: start from whatever the household bar already holds. */
export function seedFromHousehold(a: Answers, H: SavedHousehold) {
  const put = <K extends keyof Answers>(k: K, v: Answers[K] | undefined) => { if (a[k] == null && v != null && v !== "") a[k] = v; };
  put("status", H.status); put("age", H.age); put("spouseAge", H.spouseAge); put("retire", H.retire);
  put("state", H.state); put("income", H.income); put("income2", H.income2); put("saved", H.saved); put("retSpend", H.spend);
}

/* A trip started this visit fills its tool on the way; only a reload in
   the middle of one has the coach fill it again (Coach.tsx). */
export const tripBoot = { done: false };

/** Into a tool: the step's answers settled, the tool filled in. Returns
    where to go, and whether the household bar needs writing. */
export function startTrip(id: string, from?: string): { path: string; sync: boolean } | null {
  const meta = TRIP_META[id];
  if (!meta) return null;
  let sync = false;
  setGuide((g) => {
    const st = current(g);
    if (st.commit && !st.needs?.(g.a)) { st.commit(g.a, putter(g)); sync = !!st.sync; }
    const t: Trip = { id, from: from || st.id };
    t.pending = null;
    setToolInputs(meta.store, prefill(t, g.a, toolInputs(meta.store, DEFAULTS[meta.store])));
    g.trip = t;
    // On a phone the open coach would cover most of the tool, so it starts
    // folded to its title, the next thing to do and Back to guide.
    g.coachMin = typeof window !== "undefined" && window.matchMedia("(max-width:640px)").matches;
  });
  tripBoot.done = true;
  return { path: meta.path, sync };
}

/** Back in the guide: what the tool found comes with you, onto the step
    the trip left from, marked as the tool's. However you got back (the
    coach's button, the phone's back gesture), the last reading of the tool
    is what comes. Returns whether the household bar needs writing. */
export function finishTrip(): boolean {
  const t = guide().trip;
  if (!t) return false;
  const c = t.pending;
  setGuide((g: GuideState) => {
    const undoSrc: Sources = {};
    for (const k of Object.keys(c?.undo ?? {}) as (keyof Answers)[]) if (g.src[k]) undoSrc[k] = g.src[k];
    if (c?.set) {
      Object.assign(g.a, c.set);
      for (const k of Object.keys(c.set) as (keyof Answers)[]) mark(g, k, "tool", tripTool(t.id));
    }
    g.back = c && c.msg ? { step: t.from, msg: c.msg, undo: c.undo || null, undoSrc: c.undo ? undoSrc : null,
      tool: c.set && Object.keys(c.set).some((k) => !/Seen$/.test(k)) ? tripTool(t.id) : null } : null;
    if (stepById(t.from)) g.cur = t.from;
    g.trip = null;
  });
  return !!c?.sync;
}
