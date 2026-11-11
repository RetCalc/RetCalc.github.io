"use client";

/* Tax brackets (the tax-brackets lesson): an income and a filing status,
   and how much of that income lands in each federal bracket and the tax on
   each slice, for the newest tax year the site has. Wages only, standard
   deduction, no credits: the same bracket arithmetic as the Income Tax
   page (bracketTax). */

import { useId, useState } from "react";
import { NativeRange } from "@/components/ui/native-range";
import { Segmented, SegmentedItem } from "@/components/ui/segmented";
import { NEWEST_YEAR, bracketTax, marginalRate, yearData } from "@/lib/engine";
import { Chart, fmt } from "../Chart";

type Status = "s" | "m";
interface Band { rate: number; amount: number; tax: number }

/** Federal income tax on `income` of wages with the standard deduction. */
export function bracketPicture(income: number, status: Status) {
  const Y = yearData(NEWEST_YEAR) as { year: number; fed: Record<Status, number[][]>; fedStd: Record<Status, number> };
  const std = Y.fedStd[status], taxable = Math.max(0, income - std);
  const { tax, bands } = bracketTax(taxable, Y.fed[status]) as { tax: number; bands: Band[] };
  return { year: Y.year, std, taxable, tax, bands, marginal: taxable > 0 ? (marginalRate(taxable, Y.fed[status]) as number) : 0 };
}

export function Brackets({ label }: { label: string }) {
  const [income, setIncome] = useState(100000);
  const [status, setStatus] = useState<Status>("s");
  const id = useId();
  const p = bracketPicture(income, status);
  const pct = (v: number) => `${+(v * 100).toFixed(1)}%`;
  return (
    <>
      <div className="lrn-mixes">
        <span className="lrn-cap">Filing as</span>
        <Segmented role="group" aria-label="Filing status">
          <SegmentedItem pressed={status === "s"} onClick={() => setStatus("s")}>Single</SegmentedItem>
          <SegmentedItem pressed={status === "m"} onClick={() => setStatus("m")}>Married, filing jointly</SegmentedItem>
        </Segmented>
      </div>
      <Chart label={label} spec={{
        type: "bar", x: p.bands.map((b) => `${Math.round(b.rate * 100)}%`), xLabel: "Bracket", y: "money",
        series: [
          { name: "Income taxed at this rate", values: p.bands.map((b) => b.amount), tone: "neutral" },
          { name: "Tax on it", values: p.bands.map((b) => b.tax), tone: "accent" },
        ],
      }} />
      <div className="lrn-mover">
        <label htmlFor={id}>Income per year</label>
        <NativeRange id={id} min={20000} max={600000} step={2500} value={income} onChange={(e) => setIncome(+e.target.value)} />
        <output htmlFor={id}>{fmt(income, "money", false)}</output>
      </div>
      <p className="lrn-readout">
        The {p.year} standard deduction takes off {fmt(p.std, "money", false)}, leaving <b>{fmt(p.taxable, "money", false)}</b> taxable. The tax is <b>{fmt(Math.round(p.tax), "money", false)}</b>.
        The last dollar is taxed at <b>{pct(p.marginal)}</b> (the marginal rate); the whole bill is <b>{pct(income > 0 ? p.tax / income : 0)}</b> of income (the effective rate).
      </p>
    </>
  );
}
