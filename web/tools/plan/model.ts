/* Paycheck to Retirement (PAYCHECK_PLAN_BRIEF.md): the walkthrough's own
   answers and its copy of each tool's inputs, kept as one item in this
   browser (retcalc.paycheck-plan.v1) and synced to an account like the
   Guide. The tools run inside it on that copy (a tool scope), so nothing
   here touches the standalone tools until "Copy into my tools". */
import type { ToolInputs } from "@/components/tools/ToolState";
import { readStored, writeStored } from "@/lib/storage";

export const PLAN_STORE = { key: "paycheck-plan", version: 1 } as const;

/** The steps, in order. Life stages is optional. (Taxes was a step of its
    own until Start asked the pay; a plan saved on it opens at Start.) */
export const STEPS = [
  { id: "start", name: "Start" },
  { id: "budget", name: "Budget" },
  { id: "paycheck", name: "Paycheck" },
  { id: "plan", name: "Your plan" },
  { id: "stages", name: "Life stages" },
  { id: "summary", name: "Summary" },
] as const;
export type StepId = (typeof STEPS)[number]["id"];

/** The tools the walkthrough runs, by their own ids. */
export type PlanTool = "tax" | "budget" | "advanced" | "stages";

/** The children, as asked: the ages of those you have, those planned (the
    first in `firstIn` years, then one every `spacing`), paid childcare
    before school, and each band's monthly cost as typed ("" = the
    default). The same answers the Guide asks (tools/guide/schedule.ts). */
export interface PlanKids {
  now: number[];
  planned: number;
  firstIn: number;
  spacing: number;
  childcare: boolean;
  early: string;
  school: string;
  /** The teen years (13 to 18) as typed ("" = the default); where childcare
      would be; and each planned child's gap after the one before, when they
      aren't evenly spaced (null: every `spacing` years). */
  teen?: string;
  /** A later child's share of the first's cost, in percent (the Dashboard
      sets it); unset, the usual 80. */
  later?: string;
  area?: "city" | "suburb" | "rural";
  gaps?: number[] | null;
}
export const NO_KIDS: PlanKids = { now: [], planned: 0, firstIn: 2, spacing: 3, childcare: true, early: "", school: "" };

/** The accounts a stage's children are paid for from, in the order the
    cover takes from them by default: the brokerage first, then Roth, then
    traditional (where the 401(k) match is), the HSA last. */
export const COVER_ORDER = ["brok", "roth", "trad", "hsa"] as const;
export type CoverLine = (typeof COVER_ORDER)[number];

export interface PlanState {
  step: StepId;
  /** The furthest step reached, so the rail can jump back to any before it. */
  reached: StepId;
  /** Your age and the age you'd like to retire, as typed. */
  age: string;
  retire: string;
  /** Paychecks a year: 52, 26, 24 or 12 (kept as the paycheck's own too). */
  freq: string;
  tools: Partial<Record<PlanTool, ToolInputs>>;
  /** What each later step was last filled in from, so a step is filled
      again only when what it's built on changed. */
  from: { paycheck?: string; advanced?: string; stages?: string };
  /** Whether the plan goes on into Life stages. */
  stagesOn: boolean;
  /** The children, once asked (null until then). */
  kids: PlanKids | null;
  /** How each stage covers its children, by stage ("from-to"): a month
      taken from each account, where typed over. */
  cover: Record<string, Partial<Record<CoverLine, number>>>;
}

export const PLAN_DEFAULTS: PlanState = {
  step: "start", reached: "start", age: "", retire: "", freq: "26",
  tools: {}, from: {}, stagesOn: false, kids: null, cover: {},
};

export const stepIndex = (id: StepId) => STEPS.findIndex((s) => s.id === id);

/* ---- the store: read once, kept in memory, written on every change ---- */
let current: PlanState | null = null;
const listeners = new Set<() => void>();

function normalize(v: unknown): PlanState {
  const o = v && typeof v === "object" ? (v as Partial<PlanState>) : {};
  return {
    ...PLAN_DEFAULTS, ...o,
    tools: o.tools && typeof o.tools === "object" ? o.tools : {},
    from: o.from && typeof o.from === "object" ? o.from : {},
    cover: o.cover && typeof o.cover === "object" ? o.cover : {},
    step: STEPS.some((s) => s.id === o.step) ? o.step! : "start",
    reached: STEPS.some((s) => s.id === o.reached) ? o.reached! : "start",
  };
}

export function readPlan(): PlanState {
  if (!current) current = normalize(readStored(PLAN_STORE.key, PLAN_STORE.version));
  return current;
}

export function setPlan(f: (p: PlanState) => PlanState): void {
  const next = f(readPlan());
  if (next === current) return;
  current = next;
  writeStored(PLAN_STORE.key, PLAN_STORE.version, next);
  for (const l of listeners) l();
}

/** Replaces the whole plan (a share link, a saved scenario, Start over). */
export function loadPlan(v: unknown): void {
  setPlan(() => normalize(v));
}

export function subscribePlan(l: () => void): () => void {
  listeners.add(l);
  return () => listeners.delete(l);
}

/** The account's copy arrived (lib/sync): read it again. */
export function rereadPlan(): void {
  current = null;
  for (const l of listeners) l();
}

/** A plan that has something in it, worth asking before it's replaced. */
export const planHasWork = (p: PlanState) => Object.keys(p.tools).length > 0 || p.age !== "" || p.step !== "start";
