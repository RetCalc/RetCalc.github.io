"use client";

/* The readiness guide's state: where you are, every answer, which steps are
   done, any trip into a tool, and the note a step shows on your return.
   Kept in this browser under its own key; the facts the household bar also
   holds are written through to it (sync.ts). From gdLoadState(), gdSave()
   and gdMigrate() in src/js/app/28-guide-core.js. */

import { useSyncExternalStore } from "react";
import { readStored, writeStored } from "@/lib/storage";

/** Every answer the guide keeps. Numbers are null once a field is cleared. */
export interface Answers {
  status?: "s" | "m" | null; age?: number | null; spouseAge?: number | null; retire?: number | null; state?: string | null;
  income?: number | null; income2?: number | null;
  thKnow?: string | null; takehome?: number | null; txPre?: number | null;
  bgKnow?: string | null; spend?: number | null; bgSave?: number | null; bgMort?: number | null; bgHousing?: number | null; spendSrc?: string | null;
  bgRows?: unknown[] | null;
  cash?: number | null;
  debtHas?: string | null; debtSrc?: string | null; debtTotal?: number | null; debtHi?: number | null; debtMin?: number | null;
  debtN?: number | null; debtTop?: number | null; debtExtra?: number | null; debtMonths?: number | null; debtRows?: unknown[] | null;
  home?: string | null; mortPaid?: string | null; housePay?: number | null; mortPI?: number | null; moState?: Record<string, unknown> | null;
  college?: string | null; kidAge?: number | null; collegeMo?: number | null; clState?: Record<string, unknown> | null;
  saved?: number | null; contrib?: number | null; employer?: number | null; match?: string | null; risk?: number | null;
  rothNow?: number | null; brokNow?: number | null; saveTo?: string | null;
  retSpend?: number | null; ssOwn?: number | null; ssOwn2?: number | null; ssClaim?: number | null;
  pension?: number | null; pensionAge?: number | null; pensionCola?: string | null;
  stopAge?: number | null; target?: number | null; retMix?: number | null; minSpend?: number | null; strategy?: string | null;
  hcIncl?: string | null; hcPrem?: number | null; hcAdded?: boolean | null; hcSeen?: boolean | null;
  rule55?: string | null; bridge?: string | null; bridgeHold?: number | null; bridgeLeft?: number | null;
  optGoal?: string | null; optC1?: number | null; optC2?: number | null; optF?: number | null; optU?: number | null; optIm?: number | null; optAc?: number | null;
  ddTool?: { rate: string; strat: string } | null; fiAge?: string | null; fiLabel?: string | null;
  advSeen?: boolean | null; stagesSeen?: boolean | null; btSeen?: boolean | null;
}
export type AnswerKey = keyof Answers;

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
    button into a tool. */
export interface Back { step: string; msg: string; undo?: Partial<Answers> | null; see?: { trip: string; label: string } | null }

export interface GuideState {
  v: 1; cur: string; a: Answers; done: Record<string, boolean>;
  trip: Trip | null; back: Back | null; coachMin: boolean;
}

const STORE = { key: "guide", version: 1 } as const;
export const freshGuide = (): GuideState => ({ v: 1, cur: "intro", a: {}, done: {}, trip: null, back: null, coachMin: false });

/* Answers saved before income tax was built in. The Roth and brokerage
   split used to be asked only on the Getting to 59½ step; and a tax
   estimate added to retirement spending by hand would now be counted twice. */
export function migrate(a: Answers & Record<string, unknown>) {
  if (a.rothNow == null && a.brRothNow != null) a.rothNow = a.brRothNow as number;
  if (a.brokNow == null && a.brBrokNow != null) a.brokNow = a.brBrokNow as number;
  delete a.brRothNow; delete a.brBrokNow;
  const tax = a.retTax as number | undefined;
  if (a.retTaxAdded && tax && tax > 0 && a.retSpend && a.retSpend > 0) a.retSpend = Math.max(0, a.retSpend - tax);
  delete a.retTaxAdded; delete a.retTax;
}

let state: GuideState | null = null;
const listeners = new Set<() => void>();
const SERVER = freshGuide();

function load(): GuideState {
  const v = readStored<GuideState>(STORE.key, STORE.version);
  if (v && v.v === 1 && v.a && typeof v.a === "object") {
    // The Retiring early step became Adjust your plan.
    if (v.cur === "fire") v.cur = "tune";
    if (v.back && v.back.step === "fire") v.back = null;
    migrate(v.a as Answers & Record<string, unknown>);
    return { ...freshGuide(), ...v };
  }
  return freshGuide();
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
  writeStored(STORE.key, STORE.version, g);
  listeners.forEach((l) => l());
}

/** Replaces the whole guide (Start over, a shared plan). */
export function replaceGuide(g: GuideState): void {
  setGuide((cur) => Object.assign(cur, g));
}

export function useGuide(): GuideState {
  return useSyncExternalStore(
    (f) => { listeners.add(f); return () => listeners.delete(f); },
    guide,
    () => SERVER,
  );
}
