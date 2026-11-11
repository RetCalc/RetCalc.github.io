"use client";

/* Filling brackets with a Roth conversion (the roth-conversions lesson): a
   conversion, the other taxable income it lands on and a filing status, and
   how the conversion splits across the federal brackets, for the newest tax
   year. Under 65, standard deduction, ordinary income only: the slice of
   each bracket the conversion fills = bracketTax(other + conversion − the
   standard deduction) less bracketTax(other − the deduction), band by band;
   what the deduction still covers is taxed at 0%. */

import { useId, useState } from "react";
import { NativeRange } from "@/components/ui/native-range";
import { Segmented, SegmentedItem } from "@/components/ui/segmented";
import { NEWEST_YEAR, bracketTax, yearData } from "@/lib/engine";
import { Chart, fmt } from "../Chart";

type Status = "s" | "m";
interface Band { rate: number; amount: number; tax: number }

/** The conversion's slice of each rate (0% is the deduction), the tax on it, and its average and last-dollar rates. */
export function conversionPicture(conv: number, other: number, status: Status) {
  const Y = yearData(NEWEST_YEAR) as { year: number; fed: Record<Status, number[][]>; fedStd: Record<Status, number> };
  const std = Y.fedStd[status], br = Y.fed[status];
  const before = bracketTax(Math.max(0, other - std), br) as { tax: number; bands: Band[] };
  const after = bracketTax(Math.max(0, other + conv - std), br) as { tax: number; bands: Band[] };
  const covered = Math.min(conv, Math.max(0, std - other));
  const slices = [{ rate: 0, amount: covered, tax: 0 }].concat(after.bands.map((b, i) => ({
    rate: b.rate, amount: b.amount - before.bands[i].amount, tax: b.tax - before.bands[i].tax,
  })));
  const filled = slices.filter((s) => s.amount > 0.5);
  const tax = after.tax - before.tax;
  return { year: Y.year, std, slices, tax, avg: conv > 0 ? tax / conv : 0, last: filled.length ? filled[filled.length - 1].rate : 0 };
}

export function ConversionBrackets({ label }: { label: string }) {
  const [conv, setConv] = useState(133000);
  const [other, setOther] = useState(0);
  const [status, setStatus] = useState<Status>("m");
  const idC = useId(), idO = useId();
  const p = conversionPicture(conv, other, status);
  // Every rate up to 24%, and higher ones once the conversion reaches them.
  const top = Math.max(4, ...p.slices.map((s, i) => (s.amount > 0.5 ? i : 0)));
  const shown = p.slices.slice(0, top + 1);
  const money = (v: number) => fmt(Math.round(v), "money", false);
  const pct = (v: number) => `${+(v * 100).toFixed(1)}%`;
  return (
    <>
      <div className="lrn-mixes">
        <span className="lrn-cap">Filing as</span>
        <Segmented role="group" aria-label="Filing status">
          <SegmentedItem pressed={status === "s"} onClick={() => setStatus("s")}>Single</SegmentedItem>
          <SegmentedItem pressed={status === "m"} onClick={() => setStatus("m")}>Married</SegmentedItem>
        </Segmented>
      </div>
      <Chart label={label} spec={{
        type: "bar", labels: true, x: shown.map((s) => `${Math.round(s.rate * 100)}%`), xLabel: "Rate", y: "money",
        series: [
          { name: "Converted at this rate", values: shown.map((s) => s.amount), tone: "neutral" },
          { name: "Tax on it", values: shown.map((s) => s.tax), tone: "bad" },
        ],
      }} />
      <div className="lrn-movers">
        <div className="lrn-mover">
          <label htmlFor={idC}>Converted this year</label>
          <NativeRange id={idC} min={0} max={500000} step={1000} value={conv} onChange={(e) => setConv(+e.target.value)} />
          <output htmlFor={idC}>{money(conv)}</output>
        </div>
        <div className="lrn-mover">
          <label htmlFor={idO}>Other taxable income</label>
          <NativeRange id={idO} min={0} max={300000} step={1000} value={other} onChange={(e) => setOther(+e.target.value)} />
          <output htmlFor={idO}>{money(other)}</output>
        </div>
      </div>
      <p className="lrn-readout">
        {other < p.std ? <>The {p.year} standard deduction of {money(p.std)} covers the first {money(Math.min(conv, p.std - other))} converted. </> : <>Your other income already uses the {money(p.std)} standard deduction, so the conversion starts in your bracket. </>}
        Converting {money(conv)} adds <b>{money(p.tax)}</b> of federal tax, an average of <b>{pct(p.avg)}</b>.
        {" "}The last dollar converted is taxed at <b>{pct(p.last)}</b>, and that is the rate to compare with the one you expect later.
      </p>
    </>
  );
}
