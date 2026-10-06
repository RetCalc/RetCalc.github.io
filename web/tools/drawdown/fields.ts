/* The Drawdown Simulator's inputs: every field it keeps, its kind and its
   default, and the conversions between the fields as typed, the saved state
   the engine reads (ddOptsFromState) and a partial fill from another tool.
   From DD_STATE, readDDState() and writeDDState() in
   src/js/app/15-drawdown.js. */
import { setToolInputs, toolInputs, type ToolDef } from "@/components/tools/ToolState";
import { DD_LANDING, HIST_START, HIST_STOCK, ddStagesFromRates, type DdItem } from "@/lib/engine/typed-drawdown";
import { groupDigits, parseNum } from "@/lib/format";

/* Kinds: "money" (grouped digits), "money0" (the same, blank when 0, since
   0 means none), "num" and "num0" (blank when 0), "text" (kept as typed,
   blank allowed), "select" (kept as text), "pick" (a select of numbers) and
   "check" (a tick box). */
type Kind = "money" | "money0" | "num" | "num0" | "text" | "select" | "pick" | "check";

/** [saved key, element id, kind, default] */
export const DD_STATE: [string, string, Kind, number | string | boolean][] = [
  ["initial", "ddInitial", "money", 1000000],
  ["years", "ddYears", "num", 30],
  ["stock", "ddStock", "num", 60],
  ["stockEnd", "ddStockEnd", "text", ""],
  ["sv", "ddSV", "num", 0],
  ["cash", "ddCash", "num", 0],
  ["rebal", "ddRebal", "select", "year"],
  ["rebalN", "ddRebalN", "num", 3],
  ["rebalBand", "ddRebalBand", "num", 5],
  ["fee", "ddFee", "num", 0],
  ["strategy", "ddStrategy", "select", "fixed"],
  ["rate", "ddRate", "num", 4],
  ["guardBand", "ddGuardBand", "num", 20],
  ["adjust", "ddAdjust", "num", 10],
  ["guardBandLo", "ddGuardBandLo", "num", 20],
  ["adjustLo", "ddAdjustLo", "num", 10],
  ["gkFinal", "ddGkFinal", "check", false],
  ["gkFinalYrs", "ddGkFinalYrs", "num", 15],
  ["floor", "ddFloor", "num", 10],
  ["ceil", "ddCeil", "num", 10],
  ["yaleWeight", "ddYaleWeight", "num", 70],
  ["yaleRate", "ddYaleRate", "num", 5],
  ["spendFloor", "ddSpendFloor", "money0", 0],
  ["spendCeil", "ddSpendCeil", "money0", 0],
  ["vpwRate", "ddVpwRate", "num", 3.8],
  ["vpwFV", "ddVpwFV", "money", 0],
  ["legacyGoal", "ddLegacyGoal", "money0", 0],
  ["ssMode", "ddSSMode", "select", "none"],
  ["ssWho", "ddSSWho", "select", "single"],
  ["ssIncome", "ddSSIncome", "money", 85000],
  ["ssClaim", "ddSSClaim", "pick", 67],
  ["ssIncome2", "ddSSIncome2", "money", 85000],
  ["ssClaim2", "ddSSClaim2", "pick", 67],
  ["ssAmount", "ddSSAmount", "money", 33000],
  ["ssAmount2", "ddSSAmount2", "money", 33000],
  ["ssDelay", "ddSSDelay", "num", 0],
  ["retireAge", "ddRetireAge", "text", ""],
  ["starts", "ddStarts", "select", "month"],
  ["fromYear", "ddFromYear", "num", 1926],
  ["comfort", "ddComfort", "money0", 0],
  ["tCrit", "ddTCrit", "select", "comfort"],
  ["tConf", "ddTConf", "pick", 100],
  ["skipRaise", "ddSkipRaise", "check", false],
  ["vgCeil", "ddVgCeil", "num", 5],
  ["vgFloor", "ddVgFloor", "num", 2.5],
  ["kitThresh", "ddKitThresh", "num", 50],
  ["kitRaise", "ddKitRaise", "num", 10],
  ["kitGap", "ddKitGap", "num", 3],
  ["clyFloor", "ddClyFloor", "num", 95],
  ["hebWeight", "ddHebWeight", "num", 75],
  ["hebRate", "ddHebRate", "num", 3],
  ["sensExtra", "ddSensExtra", "num", 10],
  ["rgTarget", "ddRgTarget", "num", 90],
  ["rgLo", "ddRgLo", "num", 70],
  ["rgHi", "ddRgHi", "num", 99],
  ["capeA", "ddCapeA", "num", 1.75],
  ["capeB", "ddCapeB", "num", 0.5],
  ["path", "ddPath", "select", "flat"],
  ["pathEase", "ddPathEase", "num", 1],
  ["gShare", "ddGShare", "num0", 0],
  ["gType", "ddGType", "select", "tips"],
  ["gYield", "ddGYield", "num", 2],
  ["gPayout", "ddGPayout", "num", 6.5],
  ["gInflate", "ddGInflate", "check", false],
  ["mcBlock", "ddMcBlock", "num", 1],
  ["mcRet", "ddMcRet", "select", "hist"],
  ["mcStock", "ddMcStock", "num", 10.4],
  ["mcSV", "ddMcSV", "num", 14.2],
  ["mcBond", "ddMcBond", "num", 4.8],
  ["mcCash", "ddMcCash", "num", 3.3],
  ["mcInfl", "ddMcInfl", "num", 3],
];

/* Settings added after scenarios were first saved. A full set of inputs
   that doesn't have one (an old scenario, a hand-off from another tool)
   sets it to its default, rather than keeping whatever was on screen. */
const DD_LATER = ["sv", "cash", "rebal", "rebalN", "rebalBand", "gkFinal", "gkFinalYrs", "starts", "fromYear", "comfort", "tCrit", "tConf", "skipRaise",
  "vgCeil", "vgFloor", "kitThresh", "kitRaise", "kitGap", "clyFloor", "hebWeight", "hebRate", "sensExtra",
  "rgTarget", "rgLo", "rgHi", "capeA", "capeB", "path", "pathEase", "gShare", "gType", "gYield", "gPayout", "gInflate",
  "mcBlock", "mcRet", "mcStock", "mcSV", "mcBond", "mcCash", "mcInfl"];

/** A custom income or expense: a pension, a rental, a new car. */
/** A spending stage: from year `start`, spending moves to `level`% of year one's. */
export type { DdItem };
export interface PathStage { start: number; level?: number; name?: string }
/** A change in the minimum: from year `start`, `amount`, eased in over `glide` years. */
export interface FloorStep { start: number; amount: number; glide: number }

/** The fields as typed (strings, and true/false for tick boxes), and the
    four lists the fields can't hold. */
export interface DrawdownState {
  [k: string]: string | boolean | DdItem[] | PathStage[] | FloorStep[];
  incomeItems: DdItem[]; expenseItems: DdItem[]; pathStages: PathStage[]; floorSteps: FloorStep[];
}

/** A saved value as its field shows it. */
function fieldText(kind: Kind, v: unknown): string | boolean {
  if (kind === "check") return !!v;
  if (kind === "money") return groupDigits(v as number, true);
  if (kind === "money0") return (v as number) > 0 ? groupDigits(v as number, true) : "";
  if (kind === "num0") return (v as number) > 0 ? String(v) : "";
  return String(v);
}
/** A field's text as the saved value: numbers parsed as the old num() did (blank is 0). */
function fieldValue(kind: Kind, v: string | boolean): unknown {
  if (kind === "check") return !!v;
  if (kind === "text") return String(v).trim();
  if (kind === "select") return v;
  return parseNum(v as string);
}

export const DD_DEFAULTS: Record<string, unknown> = Object.fromEntries(DD_STATE.map((f) => [f[0], f[3]]));

export const DRAWDOWN_DEFAULTS = {
  ...Object.fromEntries(DD_STATE.map((f) => [f[0], fieldText(f[2], f[3])])),
  incomeItems: [] as DdItem[], expenseItems: [] as DdItem[], pathStages: [] as PathStage[], floorSteps: [] as FloorStep[],
} as DrawdownState;

export const DRAWDOWN_DEF: ToolDef<DrawdownState> = { id: "drawdown", label: "Drawdown", noun: "drawdown plan", defaults: DRAWDOWN_DEFAULTS };

const copy = <T extends object>(a: T[] | undefined): T[] => (Array.isArray(a) ? a.map((x) => ({ ...x })) : []);

/** The saved state the engine reads, from the fields as typed. */
export function ddRaw(s: DrawdownState): Record<string, unknown> {
  const d: Record<string, unknown> = {};
  for (const [k, , kind] of DD_STATE) d[k] = fieldValue(kind, s[k] as string | boolean);
  d.incomeItems = copy(s.incomeItems);
  d.expenseItems = copy(s.expenseItems);
  d.pathStages = copy(s.pathStages);
  d.floorSteps = copy(s.floorSteps);
  return d;
}

/** Fills the fields from saved values, as writeDDState() did. A full set
    (one with a rate or a strategy) sets anything it doesn't mention that
    came later to its default, and replaces the stages and the minimum's
    changes; a partial fill leaves the rest be. */
export function ddWrite(cur: DrawdownState, input: Record<string, unknown>): DrawdownState {
  let d = { ...input };
  const full = d.rate != null || d.strategy != null;
  // Spending stages saved before the spending path were a withdrawal rate for
  // the fixed strategy; as a path, each is that rate's share of the start.
  if (d.path == null && Array.isArray(d.wdStages)) {
    const strat = (d.strategy as string) || (cur.strategy as string);
    const conv = strat === "fixed" ? ddStagesFromRates(d.wdStages as unknown[], d.rate != null ? +(d.rate as number) : parseNum(cur.rate as string)) : [];
    d = { ...d, path: conv.length ? "stages" : "flat", pathStages: conv };
  }
  if (full) for (const k of DD_LATER) if (d[k] == null) d[k] = DD_DEFAULTS[k];
  // Saved before the two guardrails were split: the lower one matches the upper.
  if (d.guardBandLo == null && d.guardBand != null) d.guardBandLo = d.guardBand;
  if (d.adjustLo == null && d.adjust != null) d.adjustLo = d.adjust;
  const next: DrawdownState = { ...cur };
  for (const [k, , kind] of DD_STATE) if (d[k] != null) next[k] = fieldText(kind, d[k]);
  if (Array.isArray(d.incomeItems)) next.incomeItems = copy(d.incomeItems as DdItem[]);
  if (Array.isArray(d.expenseItems)) next.expenseItems = copy(d.expenseItems as DdItem[]);
  if (Array.isArray(d.floorSteps) || full) next.floorSteps = copy(d.floorSteps as FloorStep[] | undefined);
  if (Array.isArray(d.pathStages) || full) next.pathStages = copy(d.pathStages as PathStage[] | undefined);
  return next;
}

/** A strategy page's setup over the inputs, as the page opens. */
export function ddLanding(cur: DrawdownState, slug: string): DrawdownState {
  const L = DD_LANDING[slug];
  return L ? ddWrite(cur, { ...L, floorSteps: [], pathStages: [] }) : cur;
}

/* ---- Simple and Advanced inputs ----
   Simple shows the five fields a first run needs; Advanced adds the rest.
   Hidden fields still count, so Simple names those set away from their
   defaults. From src/js/app/15f-drawdown-inputs.js. */
const DD_ADV: [string, string][] = [
  ["rebal", "rebalancing"], ["fee", "fees"], ["retireAge", "your age"],
  ["spendFloor", "minimum spending"], ["spendCeil", "maximum spending"], ["path", "a spending path"],
  ["ssMode", "Social Security"], ["legacyGoal", "a legacy goal"], ["comfort", "a comfort line"],
  ["starts", "a start each January only"], ["fromYear", "a later start year"],
  ["mcBlock", "Monte Carlo blocks"], ["mcRet", "your own returns"],
];
const DD_ADV_STRAT: Record<string, [string, string][]> = {
  fixed: [["skipRaise", "skipping raises"]],
  kitces: [["skipRaise", "skipping raises"], ["kitThresh", "ratchet settings"], ["kitRaise", "ratchet settings"], ["kitGap", "ratchet settings"]],
  guardrails: [["guardBand", "guardrail settings"], ["adjust", "guardrail settings"], ["guardBandLo", "guardrail settings"],
    ["adjustLo", "guardrail settings"], ["gkFinal", "guardrail settings"], ["skipRaise", "skipping raises"]],
  floorceil: [["floor", "floor and ceiling"], ["ceil", "floor and ceiling"]],
  vanguard: [["vgCeil", "Vanguard's limits"], ["vgFloor", "Vanguard's limits"]],
  clyatt: [["clyFloor", "the 95% floor"]],
  sensible: [["sensExtra", "the share of gains"]],
};
/** Which advanced settings are in use, by name, once each. */
export function advInUse(d: Record<string, unknown>): string[] {
  const out: string[] = [];
  const add = (n: string) => { if (!out.includes(n)) out.push(n); };
  const off = (k: string) => {
    const a = d[k], b = DD_DEFAULTS[k];
    if (typeof b === "number") return Math.abs((+(a as number) || 0) - b) > 1e-9;
    return String(a == null ? "" : a) !== String(b);
  };
  for (const [k, n] of DD_ADV) if (off(k)) add(n);
  for (const [k, n] of DD_ADV_STRAT[d.strategy as string] || []) if (off(k)) add(n);
  if ((d.incomeItems as DdItem[] || []).some((x) => x.on !== false)) add("other income");
  if ((d.expenseItems as DdItem[] || []).some((x) => x.on !== false)) add("future expenses");
  if ((d.floorSteps as FloorStep[] || []).length) add("a minimum that changes");
  return out;
}

/** The record runs 1926 to 2025, and a retirement has to finish inside it:
    with 30 years, 1996 is the last January it can start. A start year
    outside that snaps back to the nearest end once the field is left, or
    when the years change. From ddFromClamp() in src/js/app/15-drawdown.js. */
export function fromClamp(c: DrawdownState): DrawdownState {
  const years = Math.min(60, Math.max(1, Math.round(parseNum(c.years as string)))) || 1;
  const last = HIST_START + HIST_STOCK.length - years, raw = String(c.fromYear).trim();
  const val = raw === "" ? HIST_START : Math.min(last, Math.max(HIST_START, Math.round(parseNum(raw))));
  return String(val) !== raw ? { ...c, fromYear: String(val) } : c;
}

/** Fills the Drawdown Simulator from another tool, as writeDDState() did:
    it shows these numbers when next opened. */
export function sendToDrawdown(d: Record<string, unknown>): void {
  setToolInputs("drawdown", ddWrite(toolInputs("drawdown", DRAWDOWN_DEFAULTS), d));
}
