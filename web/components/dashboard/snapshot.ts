"use client";

/* The plan's snapshot kept with each Net worth entry (progress.ts has what
   it holds and how it's compared). An entry saved anywhere (Net worth,
   Profile's home figures, setup) waits with `plan: null`; once the
   Dashboard has been still for a moment, the snapshot is worked out from
   the plan as it is then and saved with the entry. */

import { useEffect } from "react";
import { options } from "@/tools/guide/calc";
import { flow } from "./flows";
import { answers, contribMonth, results, retireAt, type Results } from "./model";
import type { PlanSnap } from "./progress";
import { netWorth, readDashboard, useDashboard, type Entry, type Profile } from "./store";

/** The retirement spending per month the plan supports: the most it can
    spend once retired, a fixed amount rising with prices, and still reach
    the chance of success the plan aims for. The same search the readiness
    score's "Plan to spend..." comes from: spending less when the plan
    falls short, more when it's ahead (the most it can afford), and what
    it plans to spend when that's within $1,000 per year of it. Null when
    the plan can't run yet. */
export function supportedSpend(pr: Profile, entries: Entry[]): number | null {
  const a = answers(pr, entries), O = options(a, { retire: false, save: false, spend: true });
  if (!O) return null;
  const pick = O.list.find((o) => o.id === (O.ahead ? "more" : "less-spend"))?.set.retSpend;
  if (pick != null) return pick / 12;
  return O.ahead ? O.S.spend / 12 : null;
}

/** What the plan puts away per month: every account and the emergency
    fund, with the employer's match (setup's one figure before pay is in). */
export function plannedSaving(pr: Profile): number {
  const F = flow(pr);
  return F.hasPay ? F.invested + F.match + F.ef : (contribMonth(pr) ?? 0) + (pr.employer ?? 0);
}

/** The plan as it stands for the entry of `date`: worked out from the
    entries up to that day, so a backdated entry starts from its own
    balances. `R` when the plan's results for those entries are at hand. */
export function snapshotOf(pr: Profile, entries: Entry[], date: string, R?: Results): PlanSnap {
  const upTo = entries.filter((e) => e.date <= date);
  const own = upTo[upTo.length - 1];
  const res = R ?? results(pr, upTo);
  const nw = own ? netWorth(own) : res.path[0]?.v ?? 0;
  // The projection to retirement: the points up to the day it begins.
  const retT = retireAt(pr.p1) ?? Infinity;
  const pre = res.path.filter((p) => p.t <= retT + 1e-6);
  // Measured from the entry's own day, starting at its net worth.
  const shift = pre.length ? nw - pre[0].v : 0;
  const first = pre.length > 1 ? Math.min(1, Math.max(0.01, pre[1].t - pre[0].t)) : 1;
  return {
    nw: Math.round(nw), score: res.score, chance: res.success == null ? null : Math.round(res.success * 10000) / 10000,
    supports: res.S ? round(supportedSpend(pr, upTo), 1) : null,
    atRetire: res.atRetire == null ? null : Math.round(res.atRetire), retireYear: res.retireYear,
    saving: round(plannedSaving(pr), 1) ?? 0, inflation: pr.assume.inflation,
    path: pre.map((p) => Math.round((p.v + shift) / 100) * 100), first: Math.round(first * 1000) / 1000,
  };
}
const round = (v: number | null, to: number) => (v == null ? null : Math.round(v / to) * to);

/** Fills in the snapshots still waiting, once the Dashboard has been still
    for a moment (typing a figure saves an entry with every key). */
export function usePlanStamp() {
  const { data, update } = useDashboard();
  const waiting = data.entries.some((e) => e.plan === null);
  useEffect(() => {
    if (!waiting) return;
    const t = window.setTimeout(() => {
      const d = readDashboard();
      if (!d.entries.some((e) => e.plan === null)) return;
      const plans = new Map(d.entries.filter((e) => e.plan === null).map((e) => [e.date, snapshotOf(d.profile, d.entries, e.date)]));
      update((x) => ({ ...x, entries: x.entries.map((e) => (e.plan === null && plans.has(e.date) ? { ...e, plan: plans.get(e.date)! } : e)) }));
    }, 1500);
    return () => window.clearTimeout(t);
  }, [waiting, data, update]);
}
