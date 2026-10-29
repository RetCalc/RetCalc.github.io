/* Income Tax's itemized paycheck: the year's figures as a paycheck, in the
   order a pay stub runs: gross pay, the pre-tax deductions taken out of
   it, each tax, and what's deposited. By check and by month (the year is
   above it already). With two earners on a joint return, a column for each
   of you by check, and the two together by month. The federal, state and
   local income taxes are the joint return's, split by each earner's share
   of the pay they're figured on; Social Security is each earner's own, and
   Medicare follows each earner's wages. A traditional IRA isn't taken out
   of pay, so it isn't here. No React. */
import { parseNum } from "@/lib/format";
import { PRE_ROWS, itemized, type TaxInputs } from "./model";

/** How often you're paid, as the field offers it: paychecks a year. */
export const PAY_FREQS: [string, string][] = [["52", "Every week"], ["26", "Every two weeks"], ["24", "Twice a month"], ["12", "Every month"]];
export const payWord = (p: number) => PAY_FREQS.find(([v]) => Number(v) === p)?.[1] ?? "Every two weeks";

export interface StubRow { key: string; label: string; kind: "gross" | "pre" | "tax" | "net" | "head"; v: number[] }
export interface Stub { cols: string[]; rows: StubRow[]; ppy: number }

/** The paycheck the year comes to. `R` is the engine's result for `s`. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- the engine's result, as Tax.tsx reads it
export function paycheckStub(s: TaxInputs, R: any): Stub {
  const ppy = Math.max(1, Math.round(parseNum(s.prePay) || 26));
  const joint = s.status === "m";
  const g1 = parseNum(s.gross), g2 = joint ? parseNum(s.gross2) : 0, two = joint && g2 > 0;
  const people = (R.preTax?.people ?? []) as Record<string, number>[];
  // Payroll's pre-tax lines by kind and earner (the IRA left out); without
  // the breakdown, the one figure, all of it the first earner's.
  const KINDS = PRE_ROWS.filter((r) => r.kind !== "ira");
  const pre = (i: number) => (itemized(s) ? Object.fromEntries(KINDS.map((r) => [r.kind, people[i]?.[r.kind] || 0])) : { all: i === 0 ? parseNum(s.pre) : 0 }) as Record<string, number>;
  const P = [pre(0), pre(1)];
  const preSum = (i: number) => Object.values(P[i]).reduce((a, b) => a + b, 0);
  // What each earner's income taxes are figured on, and what FICA is.
  const off = (i: number) => (itemized(s) ? (P[i].hsa || 0) + (P[i].health || 0) : 0);
  const gross = [g1, g2];
  const taxed = gross.map((g, i) => Math.max(0, g - preSum(i)));
  const fica = gross.map((g, i) => Math.max(0, g - off(i)));
  const share = (w: number[]) => { const t = w[0] + w[1]; return t > 0 ? [w[0] / t, w[1] / t] : [1, 0]; };
  const inc = share(taxed), med = share(fica);
  const ss = two ? [R.ss1 || 0, R.ss2 || 0] : [R.ss || 0, 0];
  const medicare = R.med + (R.addl || 0);
  const by = (total: number, sh: number[]) => [total * sh[0], total * sh[1]];

  // Each line for each earner, a year.
  const lines: { key: string; label: string; kind: StubRow["kind"]; yr: number[] }[] = [
    { key: "gross", label: "Gross pay", kind: "gross", yr: gross },
  ];
  if (itemized(s)) {
    for (const r of KINDS) {
      const yr = [P[0][r.kind] || 0, P[1][r.kind] || 0];
      if (yr[0] + yr[1] > 0.005) lines.push({ key: r.kind, label: r.name, kind: "pre", yr });
    }
  } else if (preSum(0) > 0.005) lines.push({ key: "pre", label: "Pre-tax deductions", kind: "pre", yr: [preSum(0), 0] });
  lines.push({ key: "federal", label: "Federal income tax", kind: "tax", yr: by(R.federal, inc) });
  if (R.state > 0.005) lines.push({ key: "state", label: "State income tax" + (R.stateName ? " · " + R.stateName : ""), kind: "tax", yr: by(R.state, inc) });
  if (R.local > 0.005) lines.push({ key: "local", label: "Local income tax", kind: "tax", yr: by(R.local, inc) });
  lines.push({ key: "ss", label: "Social Security", kind: "tax", yr: ss });
  lines.push({ key: "med", label: "Medicare" + (R.addl > 0 ? " (incl. surtax)" : ""), kind: "tax", yr: by(medicare, med) });
  const take = [0, 1].map((i) => lines.reduce((t, l) => t + (l.kind === "gross" ? l.yr[i] : -l.yr[i]), 0));
  lines.push({ key: "net", label: "Take-home pay", kind: "net", yr: take });

  // The columns: by check (each earner's, with two), and by month (together).
  const monthly = ppy === 12;
  const cols = two ? (monthly ? ["You", "Spouse", "Together"] : ["You, per check", "Spouse, per check", "Together, per month"]) : (monthly ? ["Per month"] : ["Per check", "Per month"]);
  const rows: StubRow[] = lines.map((l) => {
    const v = two ? (monthly ? [l.yr[0] / 12, l.yr[1] / 12, (l.yr[0] + l.yr[1]) / 12] : [l.yr[0] / ppy, l.yr[1] / ppy, (l.yr[0] + l.yr[1]) / 12])
      : (monthly ? [l.yr[0] / 12] : [l.yr[0] / ppy, l.yr[0] / 12]);
    return { key: l.key, label: l.label, kind: l.kind, v };
  });
  return { cols, rows, ppy };
}
