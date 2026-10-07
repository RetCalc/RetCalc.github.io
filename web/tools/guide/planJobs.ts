/* The guide's plan jobs: what the engine worker runs for the guide
   (plan.worker.ts), and what the page runs itself where a worker can't
   start (planClient.ts). Each takes the answers and returns plain data that
   crosses to the page by structured clone. A plan (Sim) crosses whole but
   for the engine's tax-table cache, which is shared by every plan the
   worker has run and stays where it was built, and the extras the page
   works out for itself (the median path, the strategies). */

import { need, options, sim, strats, type Levers, type Over, type Sim } from "./calc";
import { leverRows } from "./levers";
import type { Answers } from "./store";

export type JobKind = "sim" | "need" | "levers" | "options" | "strategies";
export interface JobArgs {
  /** A different retirement age, saving, stop age or spending. */
  over?: Over;
  /** The plan without the Plan Optimizer's choices. */
  base?: boolean;
  /** Which levers the balanced option may move. */
  levers?: Levers;
}
export const ALL_LEVERS: Levers = { retire: true, save: true, spend: true };

/** A plan as it crosses to the page. */
export function wire(S: Sim): Sim {
  const { retPath: _p, strats: _s, stratsFloor: _f, ...rest } = S;
  return { ...rest, C: { ...S.C, cache: null } as unknown as Sim["C"] };
}

/** A strategy's result as it crosses: the figures the step shows, and the
    years it failed in, without every run's path. */
export interface StratWire {
  id: string; success: number; typical: number; lean: number; leanYear: number | null; leanAge: number | null; end: number; canFail: boolean;
  failYears: number[];
}

export function runPlanJob(kind: JobKind, a: Answers, args: JobArgs = {}): unknown {
  switch (kind) {
    case "sim": {
      const S = sim(a, args.over, !!args.base);
      return S ? wire(S) : null;
    }
    case "need": {
      const S = sim(a, args.over);
      return S ? need(a, S) : null;
    }
    case "levers":
      return leverRows(a);
    case "options": {
      const O = options(a, args.levers ?? ALL_LEVERS);
      return O ? { goal: O.goal, ahead: O.ahead, S: wire(O.S), list: O.list.map((o) => ({ id: o.id, set: o.set, T: o.T ? wire(o.T) : null })) } : null;
    }
    case "strategies": {
      const S = sim(a);
      if (!S) return null;
      return strats(a, S).map((r): StratWire => ({ id: r.st.id, success: r.success, typical: r.typical, lean: r.lean, leanYear: r.leanYear,
        leanAge: r.leanAge, end: r.end, canFail: r.canFail, failYears: r.H ? r.H.failYears.slice() : [] }));
    }
  }
  throw new Error("Unknown guide job: " + kind);
}
