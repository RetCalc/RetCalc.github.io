/* Old saved guides and old links, brought up to date (doc 3, "Migration").
   A v1 state (retcalc.guide.v1) or a v1 share link becomes a v2 state: the
   same answers, run through the fixes v1 already made on loading; the pace
   "full", since the old route was the full one; a source for every answer,
   worked out from what the old trips left behind; the old step ids mapped
   onto the new cards; and nothing yet in snapshots, ticks or lessons.

   Pure: no React and no storage, so store.ts and the page call it and the
   unit tests (tests/migrate.test.ts) run it as it is. */

import type {
  AnswerKey, Answers, Back, ChangeEvent, GuideStateV2, Pace, Snapshot, Source, SourceKind, Sources, Trip,
} from "./store";

const SNAPSHOT_CAP = 24;

/* Answers saved before income tax was built in. The Roth and brokerage
   split used to be asked only on the Getting to 59½ step; and a tax
   estimate added to retirement spending by hand would now be counted twice.
   (v1's own fix on loading, from store.ts.) */
export function migrateAnswers(a: Answers & Record<string, unknown>) {
  if (a.rothNow == null && a.brRothNow != null) a.rothNow = a.brRothNow as number;
  if (a.brokNow == null && a.brBrokNow != null) a.brokNow = a.brBrokNow as number;
  delete a.brRothNow; delete a.brBrokNow;
  const tax = a.retTax as number | undefined;
  if (a.retTaxAdded && tax && tax > 0 && a.retSpend && a.retSpend > 0) a.retSpend = Math.max(0, a.retSpend - tax);
  delete a.retTaxAdded; delete a.retTax;
}

/** Each v1 step's id, and the new card it became. Two v1 steps can land on
    one card (Your income and Take-home pay; Housing and College); the
    Retiring early step, already renamed Adjust your plan in v1, too. */
export const STEP_MAP: Record<string, string> = {
  intro: "welcome", about: "about", income: "income", takehome: "income", spending: "spending", cash: "cash", debt: "debt",
  home: "goals", college: "goals", savings: "savings", retspend: "retspend", outlook: "number", lasting: "lasting",
  tune: "adjust", fire: "adjust", strategy: "strategy", health: "health", bridge: "bridge", optimize: "optimize", results: "plan",
};
export const mapStep = (id: string) => STEP_MAP[id] ?? id;

/** The new cards a v1 guide had already finished. A card that took over
    several v1 steps is done when all of them were; the cards split out of
    v1's Retirement savings and Spending in retirement steps are done when
    those were, since v1 asked the same questions there. */
export function doneFromV1(done: Record<string, boolean>): Record<string, boolean> {
  const d = (id: string) => !!done[id];
  const out: Record<string, boolean> = {
    about: d("about"), income: d("income") && d("takehome"), spending: d("spending"), cash: d("cash"), debt: d("debt"),
    goals: d("home") && d("college"), savings: d("savings"), invested: d("savings"), accounts: d("savings"),
    retspend: d("retspend"), social: d("retspend"), number: d("outlook"), lasting: d("lasting"), adjust: d("tune") || d("fire"),
    strategy: d("strategy"), health: d("health"), bridge: d("bridge"), optimize: d("optimize"), plan: d("results"),
  };
  return Object.fromEntries(Object.entries(out).filter(([, v]) => v));
}

/* Keys that record how the guide got somewhere (which choice led to a
   field, a tool's saved rows) rather than an answer of the person's: they
   carry no source. */
const BOOKKEEPING = new Set<string>([
  "thKnow", "bgKnow", "spendSrc", "debtSrc", "bgRows", "debtRows", "moState", "clState", "ddTool",
  "hcSeen", "hcAdded", "advSeen", "stagesSeen", "btSeen", "kitSeen", "retired",
]);
const present = (v: unknown) => v != null && v !== "" && !(typeof v === "number" && !isFinite(v));

/** Where each answer of a v1 guide came from, as far as the old trips left
    a trace: a budget brought back from Budget, debts listed in Debt Payoff,
    take-home from Income Tax (or the quick estimate beside it), a house
    payment from the Mortgage Calculator, a college figure from College
    Savings, the bridge plan, a premium from the Healthcare Cost Planner and
    the FIRE age. Everything else present was typed or tapped: "entered",
    the Social Security statement figures included. */
export function deriveSources(a: Answers, at: string): Sources {
  const src: Sources = {};
  const set = (k: AnswerKey, kind: SourceKind, tool?: string) => { if (present(a[k])) src[k] = tool ? { kind, tool, at } : { kind, at }; };
  for (const k of Object.keys(a) as AnswerKey[]) if (!BOOKKEEPING.has(k)) set(k, "entered");
  if (a.spendSrc === "budget") (["spend", "bgSave", "bgMort", "bgHousing"] as const).forEach((k) => set(k, "tool", "budget"));
  if (a.debtSrc === "tool") (["debtTotal", "debtHi", "debtMin", "debtN", "debtTop", "debtExtra", "debtMonths"] as const).forEach((k) => set(k, "tool", "debt"));
  // v1's Take-home step: "help me work it out" either opened Income Tax,
  // whose capture also writes the pre-tax deductions, or took the estimate.
  if (a.thKnow === "no") {
    if (present(a.txPre)) { set("takehome", "tool", "tax"); set("txPre", "tool", "tax"); }
    else set("takehome", "estimated");
  }
  if (a.moState) (["housePay", "mortPI"] as const).forEach((k) => set(k, "tool", "mortgage"));
  if (a.clState) set("collegeMo", "tool", "college");
  if (present(a.bridge)) (["bridge", "bridgeHold", "bridgeLeft"] as const).forEach((k) => set(k, "tool", "bridge"));
  if (a.hcSeen) set("hcPrem", "tool", "healthcare");
  if (present(a.fiAge)) (["fiAge", "fiLabel"] as const).forEach((k) => set(k, "tool", "fire"));
  return src;
}

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);

/** A v1 saved state as v2, or null when it isn't one. */
export function fromV1(o: unknown, now: string): GuideStateV2 | null {
  if (!isObj(o) || o.v !== 1 || !isObj(o.a)) return null;
  const a = structuredClone(o.a) as Answers & Record<string, unknown>;
  migrateAnswers(a);
  const back = isObj(o.back) && typeof o.back.step === "string" && o.back.step !== "fire" ? { ...(o.back as unknown as Back), step: mapStep(o.back.step) } : null;
  const trip = isObj(o.trip) && typeof o.trip.id === "string" ? { ...(o.trip as unknown as Trip), from: mapStep(String(o.trip.from ?? "")) } : null;
  return {
    v: 2, pace: "full", cur: mapStep(typeof o.cur === "string" ? o.cur : "intro"), a, src: deriveSources(a, now),
    done: doneFromV1(isObj(o.done) ? (o.done as Record<string, boolean>) : {}), trip, back, coachMin: !!o.coachMin,
    snapshots: [], moves: {}, lessons: {}, startedAt: now,
  };
}

const PACES: Pace[] = ["quick", "full"];
const KINDS: SourceKind[] = ["entered", "tool", "estimated", "default"];
const STAMP = /^[0-9TZ:.+-]{1,32}$/;

/** A v2 state as read back from storage, with anything missing filled in
    and anything malformed dropped, or null when it isn't one. */
export function normalizeV2(o: unknown, now: string): GuideStateV2 | null {
  if (!isObj(o) || o.v !== 2 || !isObj(o.a)) return null;
  const snaps = Array.isArray(o.snapshots) ? (o.snapshots.filter(isObj) as unknown as Snapshot[]) : [];
  return {
    v: 2, pace: PACES.includes(o.pace as Pace) ? (o.pace as Pace) : "quick", cur: typeof o.cur === "string" ? o.cur : "welcome",
    a: o.a as Answers, src: cleanSources(o.src, o.a as Answers, now), done: isObj(o.done) ? (o.done as Record<string, boolean>) : {},
    trip: isObj(o.trip) ? (o.trip as unknown as Trip) : null, back: isObj(o.back) ? (o.back as unknown as Back) : null, coachMin: !!o.coachMin,
    snapshots: snaps.slice(-SNAPSHOT_CAP), moves: isObj(o.moves) ? (o.moves as GuideStateV2["moves"]) : {},
    lessons: isObj(o.lessons) ? (o.lessons as Record<string, boolean>) : {},
    startedAt: typeof o.startedAt === "string" ? o.startedAt : now,
    ...(typeof o.finishedAt === "string" ? { finishedAt: o.finishedAt } : {}),
  };
}

/** The guide as stored: v2 if there is one, else the v1 state migrated,
    else nothing (a first visit). v1 is only read, never written. */
export function loadState(v2: unknown, v1: unknown, now: string): GuideStateV2 | null {
  return normalizeV2(v2, now) ?? fromV1(v1, now);
}

/** Sources kept only for answers present, each a known kind; a tool's name
    is a short word. */
function cleanSources(o: unknown, a: Answers, now: string): Sources {
  const out: Sources = {};
  if (!isObj(o)) return out;
  for (const [k, v] of Object.entries(o)) {
    if (!isObj(v) || !KINDS.includes(v.kind as SourceKind) || !present((a as Record<string, unknown>)[k])) continue;
    const s: Source = { kind: v.kind as SourceKind, at: typeof v.at === "string" && STAMP.test(v.at) ? v.at : now };
    if (typeof v.tool === "string" && /^[a-z]{1,16}$/.test(v.tool)) s.tool = v.tool;
    out[k as AnswerKey] = s;
  }
  return out;
}

/* ---------- share links ----------
   Only plain values come in from a link: numbers, true/false, and short
   strings of letters, digits and spaces. Nothing that could be markup.
   Changes ahead's children and events are the one exception: lists of
   numbers, and events of the known kinds with numbers and a short label. */
const EVENT_NUMS = ["born", "earlyCost", "schoolCost", "at", "extra", "from", "to", "saving", "freed", "delta"];
function cleanEvents(v: unknown): ChangeEvent[] | null {
  if (!Array.isArray(v)) return null;
  const out: ChangeEvent[] = [];
  for (const e of v.slice(0, 24)) {
    if (!isObj(e) || !["child", "raise", "parttime", "payoff", "pause", "custom"].includes(e.kind as string)) continue;
    const c: Record<string, unknown> = { id: typeof e.id === "string" && /^[A-Za-z0-9-]{1,24}$/.test(e.id) ? e.id : "e" + out.length, kind: e.kind };
    for (const k of EVENT_NUMS) if (typeof e[k] === "number" && isFinite(e[k] as number)) c[k] = e[k];
    if (typeof e.childcare === "boolean") c.childcare = e.childcare;
    if (typeof e.label === "string" && /^[A-Za-z0-9 .,%'\-]{0,40}$/.test(e.label)) c.label = e.label;
    out.push(c as unknown as ChangeEvent);
  }
  return out;
}
export function cleanAnswers(o: unknown): Answers {
  const a: Record<string, unknown> = {};
  if (!isObj(o)) return a as Answers;
  for (const [k, x] of Object.entries(o)) {
    if (!/^[A-Za-z0-9]{1,24}$/.test(k)) continue;
    if (k === "events") { const e = cleanEvents(x); if (e) a[k] = e; continue; }
    if (k === "kidsNow") { if (Array.isArray(x)) a[k] = x.filter((n) => typeof n === "number" && isFinite(n)).slice(0, 12); continue; }
    if ((typeof x === "number" && isFinite(x)) || typeof x === "boolean" || x === null) a[k] = x;
    else if (typeof x === "string" && /^[A-Za-z0-9 .,%\-]{0,40}$/.test(x)) a[k] = x;
  }
  return a as Answers;
}

/** What a share link carries, cleaned: its answers, where they came from
    and its pace. A v1 link ({ v: 1, a }) gets v1's fixes, sources worked
    out as for a saved state, and the full pace. Null when it's neither. */
export function cleanLink(o: unknown, now: string): { a: Answers; src: Sources; pace: Pace } | null {
  if (!isObj(o) || !isObj(o.a)) return null;
  if (o.v === 1) {
    const a = cleanAnswers(o.a) as Answers & Record<string, unknown>;
    migrateAnswers(a);
    return { a, src: deriveSources(a, now), pace: "full" };
  }
  if (o.v === 2) {
    const a = cleanAnswers(o.a);
    return { a, src: cleanSources(o.src, a, now), pace: PACES.includes(o.pace as Pace) ? (o.pace as Pace) : "full" };
  }
  return null;
}

/** What a v2 link carries: everything but the lists a tool keeps (budget
    rows, debt rows, a tool's saved inputs), which stay in this browser. */
export const LINK_LEAVES_OUT = ["bgRows", "debtRows", "moState", "clState", "ddTool", "kitSeen"];
export function linkPayload(g: Pick<GuideStateV2, "a" | "src" | "pace">) {
  const a: Record<string, unknown> = {}, src: Sources = {};
  for (const [k, x] of Object.entries(g.a)) if (!LINK_LEAVES_OUT.includes(k)) a[k] = x;
  for (const [k, s] of Object.entries(g.src)) if (k in a && s) src[k as AnswerKey] = s;
  return { v: 2 as const, a, src, pace: g.pace };
}
