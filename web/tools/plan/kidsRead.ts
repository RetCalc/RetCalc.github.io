/* Saved children and their cover amounts, read back keeping only sound
   values (the Stages and Advanced calculators keep them). No React. */
import { MAX_KIDS } from "@/tools/guide/schedule";
import { COVER_ORDER, type CoverLine, type PlanKids } from "./model";
import type { Monthly } from "./kids";

/** A saved PlanKids, or null when it isn't one (an old or damaged copy). */
export function readKids(v: unknown): PlanKids | null {
  if (!v || typeof v !== "object" || Array.isArray(v)) return null;
  const o = v as Record<string, unknown>;
  if (!Array.isArray(o.now) || typeof o.planned !== "number") return null;
  const num = (x: unknown, d: number) => (typeof x === "number" && isFinite(x) ? x : d);
  const str = (x: unknown) => (typeof x === "string" ? x : "");
  return {
    now: o.now.filter((x): x is number => typeof x === "number" && isFinite(x) && x >= 0 && x < 30).slice(0, MAX_KIDS),
    planned: Math.max(0, Math.min(MAX_KIDS, Math.round(num(o.planned, 0)))), firstIn: Math.max(0, num(o.firstIn, 2)), spacing: Math.max(0.5, num(o.spacing, 3)),
    childcare: o.childcare !== false, early: str(o.early), school: str(o.school), teen: str(o.teen),
    area: o.area === "city" || o.area === "rural" ? o.area : "suburb",
    gaps: Array.isArray(o.gaps) ? o.gaps.filter((x): x is number => typeof x === "number" && isFinite(x)) : null,
  };
}

/** The typed cover amounts as saved, keeping only numbers. */
export function readCover(v: unknown): Record<string, Partial<Monthly>> {
  if (!v || typeof v !== "object" || Array.isArray(v)) return {};
  const out: Record<string, Partial<Monthly>> = {};
  for (const [key, row] of Object.entries(v as Record<string, unknown>)) {
    if (!row || typeof row !== "object") continue;
    const r: Partial<Monthly> = {};
    for (const a of COVER_ORDER as readonly CoverLine[]) { const x = (row as Record<string, unknown>)[a]; if (typeof x === "number" && isFinite(x)) r[a] = x; }
    out[key] = r;
  }
  return out;
}
