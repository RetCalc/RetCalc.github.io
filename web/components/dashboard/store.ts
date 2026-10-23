"use client";

/* What the Dashboard keeps: the profile from setup, and the dated entries
   of what the household has and owes. Stored under retcalc.dashboard.v1 and
   synced to the account (lib/storage.ts), separate from Your household, the
   Guide and the tools. */

import { useCallback, useEffect, useSyncExternalStore } from "react";
import { readStored, writeStored } from "@/lib/storage";
import { SYNCED_EVENT } from "@/lib/sync/engine";

export type Per = "week" | "2weeks" | "twice" | "month" | "year";
export const PER_LABEL: Record<Per, string> = { week: "per week", "2weeks": "every two weeks", twice: "twice a month", month: "per month", year: "per year" };
export const PER_YEAR: Record<Per, number> = { week: 52, "2weeks": 26, twice: 24, month: 12, year: 1 };

export interface Person {
  name: string;
  /** Birth month (1 to 12) and year: ages stay right as the years pass. */
  bm: number | null; by: number | null;
  retire: number | null;
  pay: number | null; per: Per; taxed: "before" | "after";
}
export interface Kid { name: string; bm: number | null; by: number | null }
export interface Profile {
  who: "single" | "couple" | null;
  kids: number;
  p1: Person; p2: Person;
  kidList: Kid[];
  /** One number until it's split into accounts; counted as a 401(k). */
  saved: number | null;
  contrib: number | null; cper: "month" | "2weeks" | "year";
  /** Per month. */
  spend: number | null;
  home: "own" | "rent" | null;
  value: number | null; owed: number | null; rent: number | null;
}
/** What the household had and owed on a day (YYYY-MM-DD). One a day: saving
    again the same day replaces it. */
export interface Entry { date: string; saved: number; value: number; owed: number }
export interface DashData {
  profile: Profile;
  entries: Entry[];
  /** Setup: the step reached, the steps skipped, and whether it's finished. */
  step: number; skipped: string[]; done: boolean;
}

const KEY = "dashboard", VERSION = 1;

const person = (): Person => ({ name: "", bm: null, by: null, retire: null, pay: null, per: "year", taxed: "before" });
export const EMPTY: DashData = {
  profile: { who: null, kids: 0, p1: person(), p2: person(), kidList: [], saved: null, contrib: null, cper: "month", spend: null, home: null, value: null, owed: null, rent: null },
  entries: [], step: 0, skipped: [], done: false,
};

/* One copy for every component on the page, kept in step with storage and
   with whatever the account sync brings in. */
let current: DashData | null = null;
const listeners = new Set<() => void>();
function load(): DashData {
  const v = readStored<DashData>(KEY, VERSION);
  return v ? { ...EMPTY, ...v, profile: { ...EMPTY.profile, ...v.profile } } : EMPTY;
}
function get(): DashData {
  if (!current) current = load();
  return current;
}
function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}
function save(next: DashData) {
  current = next;
  writeStored(KEY, VERSION, next);
  listeners.forEach((l) => l());
}

/** Today, as YYYY-MM-DD in the person's own time zone. */
export function today(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** The entry setup's answers make: savings and the home, as of today. */
export function entryFrom(p: Profile, date = today()): Entry | null {
  if (p.saved == null && p.home !== "own") return null;
  return { date, saved: p.saved ?? 0, value: p.home === "own" ? p.value ?? 0 : 0, owed: p.home === "own" ? p.owed ?? 0 : 0 };
}
/** Adds an entry, replacing one already saved for that day. */
export function withEntry(entries: Entry[], e: Entry): Entry[] {
  return [...entries.filter((x) => x.date !== e.date), e].sort((a, b) => a.date.localeCompare(b.date));
}
export const netWorth = (e: Entry) => e.saved + e.value - e.owed;

/** What's stored right now, read straight from this browser (not the
    first render's empty copy). */
export const readDashboard = () => get();
/** Nothing answered yet: setup hasn't been started. */
export const unstarted = (d: DashData) => !d.done && d.step === 0 && d.profile.who == null;

export function useDashboard() {
  const data = useSyncExternalStore(subscribe, get, () => EMPTY);
  // Items arriving from the account replace what's shown.
  useEffect(() => {
    const on = (e: Event) => {
      if ((e as CustomEvent<string[]>).detail?.includes(KEY)) { current = load(); listeners.forEach((l) => l()); }
    };
    window.addEventListener(SYNCED_EVENT, on);
    return () => window.removeEventListener(SYNCED_EVENT, on);
  }, []);
  const update = useCallback((f: (d: DashData) => DashData) => save(f(get())), []);
  return { data, update };
}
