/* Saved children and how their costs are covered, read back keeping only sound
   values (the Stages and Advanced calculators keep them). No React. */
import { MAX_KIDS } from "@/tools/guide/schedule";
import { COVER_ORDER, type CoverLine, type CoverRule, type PlanKids } from "./model";

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
    ...(typeof o.later === "string" ? { later: o.later } : {}),
    area: o.area === "city" || o.area === "rural" ? o.area : "suburb",
    gaps: Array.isArray(o.gaps) ? o.gaps.filter((x): x is number => typeof x === "number" && isFinite(x)) : null,
  };
}

/** A saved CoverRule, or null (the usual order) when it isn't one. */
export function readRule(v: unknown): CoverRule | null {
  if (!v || typeof v !== "object" || Array.isArray(v)) return null;
  const o = v as Record<string, unknown>;
  if (o.by !== "order" && o.by !== "share") return null;
  const order = Array.isArray(o.order) ? [...new Set(o.order.filter((x): x is CoverLine => (COVER_ORDER as readonly unknown[]).includes(x)))] : [];
  return { by: o.by, ...(order.length ? { order: [...order, ...COVER_ORDER.filter((k) => !order.includes(k))] } : {}) };
}
