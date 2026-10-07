/* The guide's cards, declared (doc 1, "Step types" and "What a step looks
   like in code"; doc 3, "Step schema and route"). Each card says what kind
   it is, which pace walks it, when it applies, what Continue needs, what it
   teaches, the tool it's built on and roughly how long it takes. The screens
   are bound to these by id in steps/index.tsx; this file holds no React, so
   route.ts and its tests walk every route from the declarations alone. */

import { ok, pos } from "../calc";
import type { AnswerKey, Answers, Pace, SourceKind } from "../store";

export type StepType = "welcome" | "question" | "lesson" | "readout" | "decision" | "trip" | "summary";

/** Writes an answer a card assumes, only where there's none yet, with
    where it came from (a default, the guide's estimate, or a tool's figure). */
export type Put = <K extends AnswerKey>(k: K, v: Answers[K], kind: Exclude<SourceKind, "entered">, tool?: string) => void;

/** What the route may know beyond the answers: the plan's last result. */
export interface RouteFacts {
  /** The plan lasted in less than its target share of history. */
  behind?: boolean;
}

export interface StepDecl {
  id: string;
  /** 1 to 7; the Welcome card is 0. */
  chapter: number;
  title: string;
  type: StepType;
  /** "quick": a Quick check card, which both paces walk. "full": a deeper
      card, which the Full walkthrough walks and the Quick check lists. */
  pace: Pace;
  /** Roughly how long the card takes, for "about N minutes left". */
  minutes: number;
  /** The trips the card offers, counted on the Full walkthrough. */
  tripMinutes?: number;
  /** Cards that only some plans need (healthcare before 65, the bridge). */
  when?: (a: Answers) => boolean;
  /** A deeper card the Quick check walks after all when the plan calls
      for it: Adjust your plan, when the plan falls short. */
  promote?: (a: Answers, facts: RouteFacts) => boolean;
  /** Why Continue can't be pressed yet, or null when it can. */
  needs?: (a: Answers) => string | null;
  /** The lessons the card teaches (lessons/index.ts). */
  teaches?: string[];
  /** The tool the card is built on. */
  tool?: string;
  /** Answers the card assumes on arrival. */
  prep?: (a: Answers, put: Put) => void;
  /** Answers it settles on the way out. */
  commit?: (a: Answers, put: Put) => void;
  /** Writes the household bar on the way out. */
  sync?: boolean;
}

/** The seven chapters, named for the questions people ask (decision D4). */
export const CHAPTERS = [
  "You and your timeline", "Where you stand", "Building your savings", "What retirement costs",
  "Will it last", "Make it stronger", "Your plan and toolkit",
];

const need = (yes: boolean, why: string) => (yes ? null : why);

export const STEPS: StepDecl[] = [
  { id: "welcome", chapter: 0, title: "Welcome", type: "welcome", pace: "quick", minutes: 0.5 },

  /* 1 · You and your timeline */
  { id: "about", chapter: 1, title: "About you", type: "question", pace: "quick", minutes: 1, sync: true, teaches: ["two-clocks"],
    needs: (a) => need(ok(a.age) && a.age >= 16 && a.age < 100 && ok(a.retire) && a.retire > a.age && a.retire <= 90, "Enter your age and a retirement age after it"),
    commit: (a, put) => put("status", "s", "default") },

  /* 2 · Where you stand */
  { id: "income", chapter: 2, title: "Income and take-home", type: "question", pace: "quick", minutes: 1, tripMinutes: 3, tool: "tax", sync: true,
    teaches: ["take-home"], needs: (a) => need(ok(a.income), "Enter your yearly income") },
  { id: "spending", chapter: 2, title: "What you spend", type: "question", pace: "quick", minutes: 1, tripMinutes: 15, tool: "budget",
    teaches: ["keystone"], needs: (a) => need(pos(a.spend), "Enter your monthly spending, or use the slider") },
  { id: "cash", chapter: 2, title: "Your safety net", type: "question", pace: "quick", minutes: 0.5, tool: "budget",
    teaches: ["months"], needs: (a) => need(ok(a.cash), "Enter your cash savings, even if it's 0") },
  { id: "debt", chapter: 2, title: "Debt", type: "question", pace: "quick", minutes: 1, tripMinutes: 5, tool: "debt", teaches: ["eight-percent", "order"],
    needs: (a) => need(a.debtHas === "no" || (a.debtHas === "yes" && ok(a.debtTotal)), a.debtHas === "yes" ? "Enter the total you owe" : "Choose an answer") },
  { id: "goals", chapter: 2, title: "Home and big goals", type: "question", pace: "full", minutes: 2, tripMinutes: 8, tool: "mortgage", teaches: ["housing"],
    needs: (a) => need(!!a.home && !!a.college, "Answer the housing and college questions"),
    prep: (a, put) => { if (a.home === "mortgage" && pos(a.bgHousing)) put("housePay", a.bgHousing, "tool", "budget"); } },

  /* 3 · Building your savings */
  { id: "savings", chapter: 3, title: "Retirement savings", type: "question", pace: "quick", minutes: 2, tool: "basic", sync: true,
    prep: (a, put) => { put("risk", 0.045, "default"); put("saveTo", "trad", "default"); },
    needs: (a) => need(ok(a.saved) && ok(a.contrib) && !!a.match, "Fill in your savings and contributions, and answer the match question"),
    commit: (a, put) => put("employer", 0, "default") },

  /* 4 · What retirement costs */
  { id: "retspend", chapter: 4, title: "Spending in retirement", type: "question", pace: "quick", minutes: 2, tool: "budget", sync: true,
    needs: (a) => need(pos(a.retSpend), "Enter your yearly spending in retirement") },

  /* 5 · Will it last */
  { id: "number", chapter: 5, title: "Your projection", type: "readout", pace: "quick", minutes: 0.5, tripMinutes: 10, tool: "basic" },
  { id: "lasting", chapter: 5, title: "Will it last?", type: "readout", pace: "quick", minutes: 0.5, tool: "drawdown" },

  /* 6 · Make it stronger (deeper; Adjust joins the Quick check when the plan falls short) */
  { id: "adjust", chapter: 6, title: "Adjust your plan", type: "decision", pace: "full", minutes: 2, tool: "stages",
    promote: (_a, f) => !!f.behind },
  { id: "strategy", chapter: 6, title: "Drawing it down", type: "decision", pace: "full", minutes: 2, tripMinutes: 10, tool: "drawdown" },
  { id: "health", chapter: 6, title: "Healthcare before 65", type: "decision", pace: "full", minutes: 1, tripMinutes: 4, tool: "healthcare",
    when: (a) => ok(a.retire) && a.retire < 65,
    prep: (a, put) => put("hcIncl", "no", "default") },
  { id: "bridge", chapter: 6, title: "Getting to 59½", type: "decision", pace: "full", minutes: 1, tripMinutes: 6, tool: "bridge",
    when: (a) => ok(a.retire) && a.retire < 59.5 },
  { id: "optimize", chapter: 6, title: "Plan Optimizer", type: "decision", pace: "full", minutes: 2, tool: "optimizer" },

  /* 7 · Your plan and toolkit */
  { id: "plan", chapter: 7, title: "Score and plan", type: "summary", pace: "quick", minutes: 1 },
];
