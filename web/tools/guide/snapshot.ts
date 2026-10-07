/* Snapshots and what moved (doc 3, section 3, item 10): finishing a pace
   keeps the plan's figures, dated; the next visit says what changed since,
   field by field and area by area, only where something did. */

import { FACTORS, type Part, type FactorId, type Sim } from "./calc";
import type { GuideState, Snapshot } from "./store";

export const SNAPSHOT_CAP = 24;

/** The figures worth comparing, from the plan as it stands. */
export function snapshotOf(g: GuideState, S: Sim, need: number, R: { score: number | null; P: Partial<Record<FactorId, Part>> }, moveIds: string[], at: string): Snapshot {
  const areas: Record<string, number> = {};
  for (const f of FACTORS) if (R.P[f.id]) areas[f.id] = Math.round(R.P[f.id]!.p * f.w);
  return { at, pace: g.pace, score: R.score, areas, fv: Math.round(S.fv), need, success: S.success, retire: S.retire, spend: S.spend, monthly: S.monthly, moves: moveIds };
}

/** Keeps a snapshot, newest last, at most 24. */
export function keep(g: GuideState, s: Snapshot) {
  g.snapshots = [...g.snapshots, s].slice(-SNAPSHOT_CAP);
}

export interface Moved { k: string; label: string; from: number; to: number; d: number; kind: "money" | "pct" | "pts" | "age" | "score" }
const FIELDS: { k: keyof Snapshot; label: string; kind: Moved["kind"] }[] = [
  { k: "score", label: "Readiness score", kind: "score" },
  { k: "fv", label: "On course for", kind: "money" },
  { k: "need", label: "The plan needs", kind: "money" },
  { k: "success", label: "Lasted in", kind: "pct" },
  { k: "retire", label: "Retire at", kind: "age" },
  { k: "spend", label: "Spending in retirement", kind: "money" },
  { k: "monthly", label: "Saving a month", kind: "money" },
];
/** The signed difference per field, and per area in points, where it isn't zero. */
export function whatMoved(prev: Snapshot, next: Snapshot): Moved[] {
  const out: Moved[] = [];
  for (const f of FIELDS) {
    const from = prev[f.k] as number | null, to = next[f.k] as number | null;
    if (from == null || to == null) continue;
    const d = to - from;
    if (Math.abs(d) < (f.kind === "pct" ? 0.005 : 0.5)) continue;
    out.push({ k: f.k, label: f.label, from, to, d, kind: f.kind });
  }
  for (const f of FACTORS) {
    const from = prev.areas[f.id], to = next.areas[f.id];
    if (from == null || to == null || from === to) continue;
    out.push({ k: "area:" + f.id, label: f.name, from, to, d: to - from, kind: "pts" });
  }
  return out;
}
