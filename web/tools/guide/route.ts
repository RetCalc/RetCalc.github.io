/* The route: the cards this person walks, in order, on their pace (doc 1,
   "Pace and route"; doc 3, "Step schema and route" and section 3 item 12).

   - A card applies when its when() says so (Healthcare before 65 and
     Getting to 59½ hang on the retirement age).
   - The Full walkthrough walks every card that applies. The Quick check
     walks its own cards and lists the deeper ones without walking them;
     a deeper card can still be opened from the route, and Adjust your plan
     joins the Quick check when the plan falls short.
   - Switching pace keeps every answer: the card you're on stays if the new
     pace walks it, else you move to the next card it does. Switching to the
     Full walkthrough after finishing the Quick check opens on the first
     deeper card.
   - Time left is the minutes of the cards still ahead on the pace, the one
     you're on included, and on the Full walkthrough the trips they offer;
     rounded to the minute, never under one. */

import { STEPS, type RouteFacts, type StepDecl } from "./steps/decl";
import type { Answers, Pace } from "./store";

export { CHAPTERS, STEPS, type RouteFacts, type StepDecl } from "./steps/decl";

export const stepById = (id: string) => STEPS.find((s) => s.id === id);
export const applies = (s: StepDecl, a: Answers) => !s.when || s.when(a);
/** Whether the pace walks a card, if it applies. */
export const walks = (s: StepDecl, a: Answers, pace: Pace, facts: RouteFacts = {}) =>
  pace === "full" || s.pace === "quick" || !!s.promote?.(a, facts);
/** A card the pace lists but doesn't walk. */
export const deeper = (s: StepDecl, a: Answers, pace: Pace, facts: RouteFacts = {}) => applies(s, a) && !walks(s, a, pace, facts);

/** The cards walked on this pace, Welcome first. */
export function route(a: Answers, pace: Pace, facts: RouteFacts = {}): StepDecl[] {
  return STEPS.filter((s) => applies(s, a) && walks(s, a, pace, facts));
}
/** The cards that count as steps ("Step 6 of 12"): the route without Welcome. */
export const numbered = (a: Answers, pace: Pace, facts: RouteFacts = {}) => route(a, pace, facts).filter((s) => s.type !== "welcome");

interface At { cur: string; a: Answers; pace: Pace; done: Record<string, boolean> }

/** The card to show: the one you're on if it still applies (a deeper card
    opened from the route included), else the next on the route. */
export function current(g: At, facts: RouteFacts = {}): StepDecl {
  const st = stepById(g.cur);
  if (st && applies(st, g.a)) return st;
  return nextOnRoute(g, facts, st ? STEPS.indexOf(st) : 0) ?? route(g.a, g.pace, facts).at(-1)!;
}
function nextOnRoute(g: At, facts: RouteFacts, from: number): StepDecl | undefined {
  return STEPS.slice(from + 1).find((s) => applies(s, g.a) && walks(s, g.a, g.pace, facts));
}
/** Continue: the next card on the route after the one you're on (from a
    deeper card, the next one the pace walks). */
export function after(g: At, facts: RouteFacts = {}): StepDecl {
  const i = STEPS.indexOf(current(g, facts));
  return nextOnRoute(g, facts, i) ?? route(g.a, g.pace, facts).at(-1)!;
}
/** Back: the card on the route before the one you're on. */
export function before(g: At, facts: RouteFacts = {}): StepDecl {
  const i = STEPS.indexOf(current(g, facts));
  const back = STEPS.slice(0, i).filter((s) => applies(s, g.a) && walks(s, g.a, g.pace, facts));
  return back.at(-1) ?? STEPS[0];
}
/** The first card on the route not yet done (the last, when all are). */
export function firstOpen(g: At, facts: RouteFacts = {}): string {
  const L = numbered(g.a, g.pace, facts);
  return (L.find((s) => !g.done[s.id]) || L[L.length - 1]).id;
}

/** "About N minutes left": the cards ahead on the pace, this one included. */
export function minutesLeft(g: At, facts: RouteFacts = {}): number {
  const cur = current(g, facts), i = STEPS.indexOf(cur);
  const ahead = STEPS.filter((s, j) => (j > i || s === cur) && s.type !== "welcome" && applies(s, g.a) && (s === cur || walks(s, g.a, g.pace, facts)));
  const m = ahead.reduce((t, s) => t + s.minutes + (g.pace === "full" ? s.tripMinutes ?? 0 : 0), 0);
  return Math.max(1, Math.round(m));
}
/** The whole pace, from the first card: what the Welcome card promises. */
export function paceMinutes(a: Answers, pace: Pace, facts: RouteFacts = {}): number {
  return Math.max(1, Math.round(numbered(a, pace, facts).reduce((t, s) => t + s.minutes + (pace === "full" ? s.tripMinutes ?? 0 : 0), 0)));
}

/** Where switching to `pace` lands: the card you're on if the new pace
    walks it; else, after finishing the Quick check, the first deeper card
    still open; else the next card the new pace walks. */
export function landing(g: At & { finishedAt?: string }, pace: Pace, facts: RouteFacts = {}): string {
  const h = { ...g, pace }, cur = current(g, facts);
  if (pace === "full" && g.pace === "quick" && (g.finishedAt || cur.id === "plan")) {
    const d = STEPS.find((s) => s.pace === "full" && applies(s, g.a) && !g.done[s.id]);
    if (d) return d.id;
  }
  if (walks(cur, g.a, pace, facts)) return cur.id;
  return (nextOnRoute(h, facts, STEPS.indexOf(cur)) ?? route(g.a, pace, facts).at(-1)!).id;
}
