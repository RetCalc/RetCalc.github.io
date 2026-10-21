/* Number formatting and parsing, ported from src/js/app/00-core.js,
   01-inputs.js and 08-stages.js with the same output. */

/** What a figure shows when there's nothing to calculate yet. */
export const DASH = "\u2014";

/* Building an Intl.NumberFormat is the expensive part, so one is kept per
   decimal count. Tables run to thousands of calls per render. */
const MONEY_FMT: Record<number, Intl.NumberFormat> = {};

/** $1,234 (or with `d` decimals); negatives as -$1,234. A figure too big
    to compute (or not a number at all) shows as a dash, and one that rounds
    to nothing has no minus sign. */
export function money(v: number, d = 0): string {
  if (!Number.isFinite(v)) return DASH;
  const f = (MONEY_FMT[d] ??= new Intl.NumberFormat("en-US", { minimumFractionDigits: d, maximumFractionDigits: d }));
  const text = f.format(Math.abs(v));
  return (v < 0 && /[1-9]/.test(text) ? "-" : "") + "$" + text;
}

/** 0.0425 -> "4.25%" (two decimals unless `d` says otherwise); a dash when
    there's no number to show. */
export function pctStr(v: number, d = 2): string {
  if (!Number.isFinite(v)) return DASH;
  const text = (v * 100).toFixed(d);
  return (/[1-9]/.test(text) ? text : text.replace("-", "")) + "%";
}

/** Up to two decimals, none when it's a whole number: 30, 2.5, 3.14. */
export function fmtNum(v: number): string {
  const r = Math.round(v * 100) / 100;
  return r === Math.floor(r) ? String(r) : r.toFixed(2);
}

/** What a field holds, as a number: commas ignored, anything unreadable
    (or too long to be a number) is 0. */
export function parseNum(s: string | number): number {
  const v = parseFloat(String(s).replace(/,/g, ""));
  return Number.isFinite(v) ? v : 0;
}

/** `v` when it's one of `choices`, otherwise `fallback`: a dropdown's
    value, as a saved copy or share link hands it in. */
export function oneOf<T extends string>(v: string, choices: readonly T[], fallback: T): T {
  return (choices as readonly string[]).includes(v) ? (v as T) : fallback;
}

/** A field's number, or null when it's blank. */
export function parseOptional(s: string): number | null {
  return s.trim() === "" ? null : parseNum(s);
}

/* Groups the integer part with commas and leaves a trailing "." or decimals
   alone, so typing "1250.5" isn't fought mid-keystroke. */
export function groupDigits(raw: string | number, noNeg = false): string {
  let s = String(raw).replace(/[^0-9.\-]/g, "");
  const neg = !noNeg && s.startsWith("-");
  s = s.replace(/-/g, "");
  const dot = s.indexOf(".");
  let int = dot === -1 ? s : s.slice(0, dot);
  const dec = dot === -1 ? "" : "." + s.slice(dot + 1).replace(/\./g, "");
  int = int.replace(/^0+(?=\d)/, "");
  if (int) int = int.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return (neg ? "-" : "") + int + dec;
}

/* Keeps a partial entry usable while typing: a lone "-", a trailing ".", or
   an empty field all pass through untouched. */
export function sanitizeNumeric(v: string, noNeg = false): string {
  let s = String(v).replace(/[^0-9.\-]/g, "");
  const neg = !noNeg && s.indexOf("-") === 0;
  s = s.replace(/-/g, "");
  const i = s.indexOf(".");
  if (i !== -1) s = s.slice(0, i + 1) + s.slice(i + 1).replace(/\./g, "");
  return (neg ? "-" : "") + s;
}

/** 30 years, 1 year, 12.5 years. */
export function fmtYears(y: number): string {
  const r = Math.round(y * 100) / 100;
  return (r === Math.floor(r) ? String(r) : r.toFixed(2)) + (r === 1 ? " year" : " years");
}

/** A dollar amount as a field shows it: whole dollars, grouped. */
export function dollarsField(v: number): string {
  return groupDigits(Math.round(v || 0), true);
}

/** A percent field as a share between 0 and 1 ("80" is 0.8). */
export function fraction(s: string): number {
  return Math.max(0, Math.min(1, parseNum(s) / 100));
}
