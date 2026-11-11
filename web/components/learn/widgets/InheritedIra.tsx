"use client";

/* An inherited IRA under the ten-year rule (the beneficiaries-and-estate
   lesson): a single heir with a steady salary empties a traditional IRA
   within ten years, and the federal tax each withdrawal adds on top of the
   salary. As the lesson's worked example: the newest year's single brackets
   and standard deduction (bracketTax) held for all ten years, no growth,
   federal income tax only. Three ways to take it: the same each year, all
   in the last five years, or all in year ten. */

import { useId, useMemo, useState } from "react";
import { NativeRange } from "@/components/ui/native-range";
import { Segmented, SegmentedItem } from "@/components/ui/segmented";
import { NEWEST_YEAR, bracketTax, yearData } from "@/lib/engine";
import { Chart, fmt } from "../Chart";

export type Pattern = "even" | "late" | "ten";
const PATTERNS: [Pattern, string][] = [["even", "Even"], ["late", "Last five"], ["ten", "Year ten"]];

/** Each year's withdrawal and the federal tax it adds to the heir's salary, and the total. */
export function inheritedTax(size: number, salary: number, pattern: Pattern) {
  const Y = yearData(NEWEST_YEAR) as { year: number; fed: { s: number[][] }; fedStd: { s: number } };
  const br = Y.fed.s, base = Math.max(0, salary - Y.fedStd.s);
  const taxOn = (t: number) => (bracketTax(t, br) as { tax: number }).tax;
  const w = Array.from({ length: 10 }, (_, i) => (pattern === "even" ? size / 10 : pattern === "late" ? (i >= 5 ? size / 5 : 0) : i === 9 ? size : 0));
  const tax = w.map((x) => taxOn(base + x) - taxOn(base));
  return { year: Y.year, w, tax, total: tax.reduce((a, b) => a + b, 0) };
}

export function InheritedIra({ label }: { label: string }) {
  const [size, setSize] = useState(600000);
  const [salary, setSalary] = useState(110000);
  const [pattern, setPattern] = useState<Pattern>("even");
  const idS = useId(), idP = useId();
  const all = useMemo(() => Object.fromEntries(PATTERNS.map(([k]) => [k, inheritedTax(size, salary, k)])) as Record<Pattern, ReturnType<typeof inheritedTax>>, [size, salary]);
  const p = all[pattern];
  const money = (v: number) => fmt(Math.round(v / 100) * 100, "money", false);
  const best = PATTERNS.reduce((a, [k]) => (all[k].total < all[a].total ? k : a), "even" as Pattern);
  return (
    <>
      <div className="lrn-mixes">
        <span className="lrn-cap">Withdrawals</span>
        <Segmented role="group" aria-label="When the withdrawals are taken">
          {PATTERNS.map(([k, t]) => <SegmentedItem key={k} pressed={pattern === k} onClick={() => setPattern(k)}>{t}</SegmentedItem>)}
        </Segmented>
      </div>
      <Chart label={label} spec={{
        type: "bar", x: p.w.map((_, i) => `${i + 1}`), xLabel: "Year after the death", y: "money",
        series: [
          { name: "Withdrawal", values: p.w, tone: "neutral" },
          { name: "Federal tax it adds", values: p.tax, tone: "accent" },
        ],
      }} />
      <div className="lrn-movers">
        <div className="lrn-mover">
          <label htmlFor={idS}>Inherited IRA</label>
          <NativeRange id={idS} min={50000} max={2000000} step={25000} value={size} onChange={(e) => setSize(+e.target.value)} />
          <output htmlFor={idS}>{fmt(size, "money", false)}</output>
        </div>
        <div className="lrn-mover">
          <label htmlFor={idP}>Heir&apos;s salary</label>
          <NativeRange id={idP} min={0} max={300000} step={5000} value={salary} onChange={(e) => setSalary(+e.target.value)} />
          <output htmlFor={idP}>{fmt(salary, "money", false)} per year</output>
        </div>
      </div>
      <p className="lrn-readout">
        Taken this way, the withdrawals add <b>{money(p.total)}</b> of federal tax over the ten years, {Math.round((p.total / size) * 100)}% of the account.
        The same each year: <b>{money(all.even.total)}</b>. All in the last five years: <b>{money(all.late.total)}</b>. All in year ten: <b>{money(all.ten.total)}</b>.
        {best === "even" && p.total - all.even.total >= 100 ? <> Spreading it evenly would save {money(p.total - all.even.total)}.</> : null}
        {" "}Single filer, {p.year} brackets held steady, no growth.
      </p>
    </>
  );
}
