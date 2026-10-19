/* The guide's share links: what a link carries going out (linkPayload),
   and what comes in from one, cleaned (cleanLink). Only v2 links open; an
   older link opens a fresh guide. Pure: no React and no storage, so the
   unit tests (tests/links.test.ts) run it as it is.

   Only plain values come in from a link: numbers, true/false, and short
   strings of letters, digits and spaces. Nothing that could be markup.
   Changes ahead's children and events are the one exception: lists of
   numbers, and events of the known kinds with numbers and a short label. */

import type { Answers, ChangeEvent, GuideStateV2, Pace, Sources, AnswerKey } from "./store";
import { cleanSources, isObj, isPace } from "./stored";

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
    if (k === "kidsNow" || k === "kidGaps") { if (Array.isArray(x)) a[k] = x.filter((n) => typeof n === "number" && isFinite(n)).slice(0, 6); continue; }
    if ((typeof x === "number" && isFinite(x)) || typeof x === "boolean" || x === null) a[k] = x;
    else if (typeof x === "string" && /^[A-Za-z0-9 .,%\-]{0,40}$/.test(x)) a[k] = x;
  }
  return a as Answers;
}

/** What a v2 share link carries, cleaned: its answers, where they came
    from and its pace. Null for anything else, older links included. */
export function cleanLink(o: unknown, now: string): { a: Answers; src: Sources; pace: Pace } | null {
  if (!isObj(o) || !isObj(o.a) || o.v !== 2) return null;
  const a = cleanAnswers(o.a);
  return { a, src: cleanSources(o.src, a, now), pace: isPace(o.pace) ? o.pace : "full" };
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
