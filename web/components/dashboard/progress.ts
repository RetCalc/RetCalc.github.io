/* Your plan over time: each Net worth entry keeps a small snapshot of the
   plan's headline figures as they stood the day it was saved (snapshot.ts
   works it out), so a later visit can say what changed since, and how net
   worth is doing against the path the plan projected then. Everything here
   is plain arithmetic on saved snapshots, so it's tested on its own
   (tests/progress.test.ts). */

import type { Entry } from "./store";

/** The plan as it stood when an entry was saved. Every figure is in
    today's dollars of that day. Kept small: it syncs with the entry. */
export interface PlanSnap {
  /** Net worth that day. */
  nw: number;
  /** The readiness score, and the chance of success (0 to 1). */
  score: number | null;
  chance: number | null;
  /** The retirement spending per month the plan supports: the most it can
      spend once retired, a fixed amount rising with prices, and still
      reach the chance of success it aims for. */
  supports: number | null;
  /** Savings at retirement, and the year it begins. */
  atRetire: number | null;
  retireYear: number | null;
  /** What the plan put away per month then, every account and the
      emergency fund together, with the employer's match. */
  saving: number;
  /** Prices rising per year (0.03 is 3%), to compare the path with later balances. */
  inflation: number;
  /** Net worth projected from that day to retirement, to the nearest $100:
      the day itself, then `first` years on, then a year apart. */
  path: number[];
  first: number;
}

const num = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const numOr = (v: unknown) => (num(v) ? v : null);

/** A stored snapshot, checked: null (still to be worked out) stays null,
    anything malformed is dropped as if the entry had none. */
export function readPlan(v: unknown): PlanSnap | null | undefined {
  if (v === null) return null;
  if (!v || typeof v !== "object") return undefined;
  const o = v as Record<string, unknown>;
  if (!num(o.nw)) return undefined;
  return {
    nw: o.nw, score: numOr(o.score), chance: numOr(o.chance), supports: numOr(o.supports),
    atRetire: numOr(o.atRetire), retireYear: numOr(o.retireYear),
    saving: num(o.saving) ? Math.max(0, o.saving) : 0, inflation: num(o.inflation) ? o.inflation : 0.03,
    path: Array.isArray(o.path) ? o.path.filter(num) : [], first: num(o.first) && o.first > 0 && o.first <= 1 ? o.first : 1,
  };
}

/** A date (YYYY-MM-DD) as a year with its fraction. */
export const yearOf = (iso: string) => Number(iso.slice(0, 4)) + (Number(iso.slice(5, 7)) - 1) / 12 + (Number(iso.slice(8, 10)) - 1) / 365;

/** An entry with its snapshot. */
export type Snapped = Entry & { plan: PlanSnap };
const snapped = (e: Entry | undefined): e is Snapped => !!e?.plan;

/** "Since your last update": the latest entry before the newest one that
    has a snapshot, to compare with the plan as it is now. Only once the
    newest entry was itself saved with the plan kept (or waiting to be),
    so it starts with the second entry saved this way. */
export function sinceBase(entries: Entry[]): Snapped | null {
  const last = entries[entries.length - 1];
  if (!last || last.plan === undefined) return null;
  for (let i = entries.length - 2; i >= 0; i--) if (snapped(entries[i])) return entries[i] as Snapped;
  return null;
}

/** Months from one date to another (YYYY-MM-DD), with the fraction. */
export const monthsBetween = (from: string, to: string) => Math.max(0, (yearOf(to) - yearOf(from)) * 12);

/** A change in net worth split into what was saved and the rest (markets,
    paying down debt, a home's value, spending more or less than planned):
    saved is the plan's saving per month for each month between the two,
    none past retirement. */
export function splitChange(change: number, base: { date: string; plan: Pick<PlanSnap, "saving" | "retireYear"> }, to: string): { saved: number; other: number; months: number } {
  const months = monthsBetween(base.date, to);
  const working = base.plan.retireYear != null ? Math.max(0, Math.min(months, (base.plan.retireYear - yearOf(base.date)) * 12)) : months;
  const saved = Math.round(Math.max(0, base.plan.saving) * working);
  return { saved, other: Math.round(change) - saved, months };
}

/** The snapshot to measure net worth against: the newest one at least
    three months old (time enough for the plan to have moved), or the
    oldest there is when none are yet. Only one with a projected path. */
export function planRef(entries: Entry[], today: string): Snapped | null {
  const list = entries.filter((e): e is Snapped => snapped(e) && e.plan.path.length > 1);
  if (!list.length) return null;
  const old = list.filter((e) => yearOf(today) - yearOf(e.date) >= 0.24);
  return old.length ? old[old.length - 1] : list[0];
}

/** The snapshot's projected net worth on a date (as a year with its
    fraction), in that date's dollars: the path between its points, with
    prices risen since. Null before the snapshot or past retirement. */
export function planAt(ref: Snapped, t: number): number | null {
  const P = ref.plan, t0 = yearOf(ref.date), dt = t - t0;
  if (dt < -1e-6) return null;
  // Each point's years from the snapshot's day.
  const at = (i: number) => (i === 0 ? 0 : P.first + i - 1);
  const last = P.path.length - 1;
  if (last < 1 || dt > at(last) + 1e-6) return null;
  let i = 0;
  while (i < last - 1 && at(i + 1) < dt) i++;
  const f = Math.min(1, Math.max(0, (dt - at(i)) / (at(i + 1) - at(i))));
  const real = P.path[i] + (P.path[i + 1] - P.path[i]) * f;
  return real * Math.pow(1 + P.inflation, dt);
}

/** The plan's line from the snapshot's day to `until`: its own points
    between, and both ends, in each date's dollars. */
export function planLine(ref: Snapped, until: number): { t: number; v: number }[] {
  const t0 = yearOf(ref.date), out: { t: number; v: number }[] = [];
  const ts = [t0, ...ref.plan.path.slice(1).map((_, i) => t0 + ref.plan.first + i).filter((t) => t < until), until];
  for (const t of ts) { const v = planAt(ref, t); if (v != null) out.push({ t, v }); }
  return out;
}

/** How far ahead of (positive) or behind the plan the latest entry is,
    against the snapshot `ref`; null with no entry after it to measure. */
export function aheadOf(entries: Entry[], ref: Snapped | null, nwOf: (e: Entry) => number): { by: number; date: string } | null {
  const last = entries[entries.length - 1];
  if (!ref || !last || last.date <= ref.date) return null;
  const v = planAt(ref, yearOf(last.date));
  return v == null ? null : { by: Math.round(nwOf(last) - v), date: last.date };
}
