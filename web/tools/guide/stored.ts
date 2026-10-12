/* The guide as read back from this browser: a v2 state with anything
   missing filled in and anything malformed dropped. Kept apart from the
   rest of the guide, and light, since every page reads it (store.ts, for
   the coach on a trip). Pure: no React and no storage, so the unit tests
   (tests/links.test.ts) run it as it is. */

import type { AnswerKey, Answers, GuideStateV2, Pace, Snapshot, Source, SourceKind, Sources, Trip, Back } from "./store";

const SNAPSHOT_CAP = 24;
const PACES: Pace[] = ["quick", "full"];
const KINDS: SourceKind[] = ["entered", "tool", "estimated", "default"];
const STAMP = /^[0-9TZ:.+-]{1,32}$/;

export const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const present = (v: unknown) => v != null && v !== "" && !(typeof v === "number" && !isFinite(v));
export const isPace = (v: unknown): v is Pace => PACES.includes(v as Pace);

/** A v2 state as read back from storage, with anything missing filled in
    and anything malformed dropped, or null when it isn't one. */
export function normalizeV2(o: unknown, now: string): GuideStateV2 | null {
  if (!isObj(o) || o.v !== 2 || !isObj(o.a)) return null;
  const snaps = Array.isArray(o.snapshots) ? (o.snapshots.filter(isObj) as unknown as Snapshot[]) : [];
  return {
    v: 2, pace: isPace(o.pace) ? o.pace : "quick", cur: typeof o.cur === "string" ? o.cur : "welcome",
    a: o.a as Answers, src: cleanSources(o.src, o.a as Answers, now), done: isObj(o.done) ? (o.done as Record<string, boolean>) : {},
    trip: isObj(o.trip) ? (o.trip as unknown as Trip) : null, back: isObj(o.back) ? (o.back as unknown as Back) : null, coachMin: !!o.coachMin,
    snapshots: snaps.slice(-SNAPSHOT_CAP), moves: isObj(o.moves) ? (o.moves as GuideStateV2["moves"]) : {},
    lessons: isObj(o.lessons) ? (o.lessons as Record<string, boolean>) : {},
    startedAt: typeof o.startedAt === "string" ? o.startedAt : now,
    ...(typeof o.finishedAt === "string" ? { finishedAt: o.finishedAt } : {}),
  };
}

/** Sources kept only for answers present, each a known kind; a tool's name
    is a short word. */
export function cleanSources(o: unknown, a: Answers, now: string): Sources {
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
