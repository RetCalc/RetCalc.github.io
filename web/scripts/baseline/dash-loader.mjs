/* The Dashboard check's loader: loader.mjs, plus stand-ins for the two
   screen files (.tsx) the Dashboard's logic takes plain helpers from:
   ToolState's withDefaults (a copy of the real one) and HistNotes' MON. */
import { resolve as baseResolve } from "./loader.mjs";

const STUB = `
function sameKind(v, d) {
  if (d === null) return typeof v === "object";
  if (v === null || typeof v !== typeof d) return false;
  if (Array.isArray(d)) {
    if (!Array.isArray(v)) return false;
    if (!d.length) return true;
    const first = d[0];
    if (first && typeof first === "object") return v.every((x) => !!x && typeof x === "object" && Array.isArray(x) === Array.isArray(first));
    return v.every((x) => x === null || typeof x !== "object");
  }
  if (typeof d === "object") return !Array.isArray(v);
  return true;
}
export function withDefaults(def, data) {
  const { defaults } = def;
  const out = { ...defaults };
  if (!data || typeof data !== "object") return out;
  for (const k of Object.keys(defaults)) {
    const v = data[k];
    if (v !== undefined && sameKind(v, defaults[k])) out[k] = v;
  }
  return def.clean ? def.clean(out) : out;
}`;

/* HistNotes.tsx: only its month names. */
const MON = `export const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];`;

export async function resolve(spec, ctx, next) {
  if (spec === "@/components/tools/ToolState") return { url: "data:text/javascript," + encodeURIComponent(STUB), shortCircuit: true };
  if (spec === "@/components/charts/HistNotes") return { url: "data:text/javascript," + encodeURIComponent(MON), shortCircuit: true };
  return baseResolve(spec, ctx, next);
}
