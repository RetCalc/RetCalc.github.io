"use client";

/* The readiness guide's state: your pace and where you are, every answer
   and where it came from, which steps are done, any trip into a tool, the
   note a step shows on your return, snapshots, ticks and lessons. Kept in
   this browser under its own key (retcalc.guide.v2); the facts the household
   bar also holds are written through to it (actions.ts). A guide saved by
   v1 (before 7 October 2026) isn't carried over: its key is cleared and the
   guide starts fresh. Every page reads this file (the coach on a trip), so
   it stays light: reading a saved state back is stored.ts. */

import { useSyncExternalStore } from "react";
import { readStored, writeStored } from "@/lib/storage";
import { normalizeV2 } from "./stored";

/** Every answer the guide keeps. Numbers are null once a field is cleared. */
export interface Answers {
  status?: "s" | "m" | null; age?: number | null; spouseAge?: number | null; retire?: number | null; state?: string | null;
  income?: number | null; income2?: number | null;
  thKnow?: string | null; takehome?: number | null; txPre?: number | null;
  bgKnow?: string | null; spend?: number | null; bgSave?: number | null; bgMort?: number | null; bgHousing?: number | null; spendSrc?: string | null;
  bgRows?: unknown[] | null;
  cash?: number | null;
  /** What the emergency fund is measured in months of, when it isn't the
      monthly spending (the Dashboard's emergency budget), and whether that's
      the emergency budget. Left out, it's \`spend\`. */
  cashSpend?: number | null;
  cashEmergency?: boolean;
  debtHas?: string | null; debtSrc?: string | null; debtTotal?: number | null; debtHi?: number | null; debtMin?: number | null;
  debtN?: number | null; debtTop?: number | null; debtExtra?: number | null; debtMonths?: number | null; debtRows?: unknown[] | null;
  home?: string | null; mortPaid?: string | null; housePay?: number | null; mortPI?: number | null; moState?: Record<string, unknown> | null;
  college?: string | null; kidAge?: number | null; collegeMo?: number | null; clState?: Record<string, unknown> | null;
  saved?: number | null; contrib?: number | null; employer?: number | null; match?: string | null; risk?: number | null;
  rothNow?: number | null; brokNow?: number | null;
  /** Where each month's saving goes, in percent of what you put in (split.ts). */
  splitTrad?: number | null; splitRoth?: number | null; splitBrok?: number | null;
  /** The four-way choice the split replaced; read from guides saved before it, then dropped. */
  saveTo?: string | null;
  retSpend?: number | null; ssOwn?: number | null; ssOwn2?: number | null; ssClaim?: number | null;
  pension?: number | null; pensionAge?: number | null; pensionCola?: string | null;
  stopAge?: number | null; target?: number | null; retMix?: number | null; minSpend?: number | null; strategy?: string | null;
  hcIncl?: string | null; hcPrem?: number | null; hcAdded?: boolean | null; hcSeen?: boolean | null;
  rule55?: string | null; bridge?: string | null; bridgeHold?: number | null; bridgeLeft?: number | null;
  optGoal?: string | null; optC1?: number | null; optC2?: number | null; optF?: number | null; optU?: number | null; optIm?: number | null; optAc?: number | null;
  ddTool?: { rate: string; strat: string } | null; fiAge?: string | null; fiLabel?: string | null;
  advSeen?: boolean | null; stagesSeen?: boolean | null; btSeen?: boolean | null;
  /* New with v2 (doc 3, Data model): the already-retired on-ramp, the
     placeholder retirement spending before it's entered, the toolkit cards
     opened, and Changes ahead's events with the children it asks about. */
  retired?: boolean | null; spendGuess?: number | null; kitSeen?: Record<string, boolean> | null;
  events?: ChangeEvent[] | null; kidsNow?: number[] | null; kidsPlanned?: number | null; firstIn?: number | null; spacing?: number | null;
  /** Paid childcare before school, and the monthly costs per child when
      they replace the defaults (doc 3, section 3, item 13). */
  childcare?: boolean | null; childEarly?: number | null; childSchool?: number | null;
  /** The teen years' cost (13 to 18) when it replaces the default; where
      childcare would be (big city, suburb, rural); and each planned child's
      gap after the one before, when they aren't evenly spaced. */
  childTeen?: number | null; careArea?: "city" | "suburb" | "rural" | null; kidGaps?: number[] | null;
  /** What a second or later child costs, as a share of the first (the
      Dashboard lets it be set); unset, the usual 80%. */
  childLater?: number | null;
  /** The Dashboard's saving year by year from today's age, already worked
      out account by account (children's costs taken from the accounts the
      household chose), with `yearlyBase` the saving it starts from. The
      schedule uses these in place of its own; nothing else sets them. */
  yearly?: YearSaving[] | null; yearlyBase?: number | null;
  /** The Dashboard's savings at retirement when its Calculator has been
      changed away from the plan (fees, say): every account is scaled to
      this total, today's dollars. Nothing else sets it. */
  fvTo?: number | null;
}
/** One year's saving a month, in today's dollars: traditional (with the
    employer's match), Roth and HSA, and brokerage; and what the costs that
    year leave for spending to cover when saving can't. */
export interface YearSaving { t: number; r: number; b: number; short: number }
export type AnswerKey = keyof Answers;

/* ---------- v2 (retcalc.guide.v2), doc 3 "The stored object" ----------
   The same answers, plus the pace, where each answer came from, dated
   snapshots, the ticks on the moves list and the lessons checked. */
export type Pace = "quick" | "full";
export type SourceKind = "entered" | "tool" | "estimated" | "default";
/** Where an answer came from: typed or tapped, a tool's result (`tool`
    names it), worked out by the guide, or a default standing in. */
export interface Source { kind: SourceKind; tool?: string; at: string }
export type Sources = Partial<Record<AnswerKey, Source>>;
/** What finishing a pace records, for Welcome back's "what moved". */
export interface Snapshot {
  at: string; pace: Pace;
  score: number | null; areas: Record<string, number>;
  fv: number; need: number; success: number; retire: number; spend: number; monthly: number;
  /** The move ids shown at the time. */
  moves: string[];
}
/** A life change Changes ahead turns into a saving schedule. Ages are
    yours; amounts are per month in today's dollars. */
export type ChangeEvent =
  | { id: string; kind: "child"; born: number; childcare: boolean; earlyCost?: number; schoolCost?: number }
  | { id: string; kind: "raise"; at: number; extra: number }
  | { id: string; kind: "parttime"; from: number; to: number; saving: number }
  | { id: string; kind: "payoff"; at: number; freed: number }
  | { id: string; kind: "pause"; from: number; to: number; saving: number }
  | { id: string; kind: "custom"; from: number; to?: number; delta: number; label: string };

export interface GuideStateV2 {
  v: 2; pace: Pace; cur: string; a: Answers; src: Sources; done: Record<string, boolean>;
  trip: Trip | null; back: Back | null; coachMin: boolean;
  /** Newest last; at most SNAPSHOT_CAP. */
  snapshots: Snapshot[];
  /** Ticks on the next-moves list, by move id. */
  moves: Record<string, { done: boolean; at: string }>;
  /** Lessons whose check question was answered. */
  lessons: Record<string, boolean>;
  startedAt: string; finishedAt?: string;
}
/** Two years of monthly check-ins; the oldest is dropped past it. */
export const SNAPSHOT_CAP = 24;
export const freshGuideV2 = (now: string): GuideStateV2 => ({
  v: 2, pace: "quick", cur: "welcome", a: {}, src: {}, done: {}, trip: null, back: null, coachMin: false,
  snapshots: [], moves: {}, lessons: {}, startedAt: now,
});

/** A trip into a tool: which, from which step, the coach's part, and what
    the tool held when it opened (so its return can say what changed). */
export interface Trip {
  id: string; from: string; page?: number;
  base?: Record<string, unknown> | null;
  /** What coming back now would bring: worked out while the tool is open. */
  pending?: Capture | null;
}
/** What a trip brings back: answers to change, and the note that says so. */
export interface Capture { set?: Partial<Answers>; msg: string; undo?: Partial<Answers> | null; sync?: boolean }
/** The note a step shows: HTML the guide writes itself. `see` adds a
    button into a tool. `undoSrc` is where the undone answers had come
    from, put back with them. */
export interface Back {
  step: string; msg: string; undo?: Partial<Answers> | null; undoSrc?: Sources | null;
  /** The tool whose figures came back, for the note's source badge. */
  tool?: string | null;
  see?: { trip: string; label: string } | null;
}

/** The guide as kept: v2 (doc 3, "The stored object"). */
export type GuideState = GuideStateV2;
const KEY = "guide", VERSION = 2, OLD = 1;
const now = () => new Date().toISOString();
export const freshGuide = (): GuideState => freshGuideV2(now());

let state: GuideState | null = null;
const listeners = new Set<() => void>();
const SERVER = freshGuideV2("");

/* v2 if this browser has one, else a first visit. A v1 guide left from
   before the overhaul is cleared, not migrated (the owner's call). */
function load(): GuideState {
  if (readStored(KEY, OLD) != null) writeStored(KEY, OLD, null);
  return normalizeV2(readStored(KEY, VERSION), now()) ?? freshGuide();
}

/* A newer Guide arrived from the account (lib/sync): show it. */
if (typeof window !== "undefined") {
  window.addEventListener("retcalc:synced", (e) => {
    if (!(e as CustomEvent<string[]>).detail?.includes(KEY)) return;
    state = load();
    listeners.forEach((l) => l());
  });
}

/** The guide as it stands. */
export function guide(): GuideState {
  if (!state) state = typeof window === "undefined" ? SERVER : load();
  return state;
}

/** Changes the guide, saves it, and redraws whatever shows it. `f` gets a
    copy to change in place. */
export function setGuide(f: (g: GuideState) => void): void {
  const g = structuredClone(guide());
  f(g);
  state = g;
  writeStored(KEY, VERSION, g);
  listeners.forEach((l) => l());
}

/** Replaces the whole guide (Start over, a shared plan). */
export function replaceGuide(g: GuideState): void {
  setGuide((cur) => {
    for (const k of Object.keys(cur)) delete (cur as unknown as Record<string, unknown>)[k];
    Object.assign(cur, g);
  });
}

export function useGuide(): GuideState {
  return useSyncExternalStore(
    (f) => { listeners.add(f); return () => listeners.delete(f); },
    guide,
    () => SERVER,
  );
}
