"use client";

/* Withdrawal rate (the four-percent-rule lesson): a first-year withdrawal
   rate, raised with inflation, tested on every 30-year retirement the
   record holds. Each bar is one starting year's highest rate that lasted
   30 years (ddSafeByStart, the Drawdown Simulator's own run: 60% US
   stocks, 40% 10-year Treasuries, rebalanced yearly, no fees); a start
   lasted at the chosen rate when its bar reaches the line. */

import { useId, useMemo, useState } from "react";
import { NativeRange } from "@/components/ui/native-range";
import { DD_LASTS, ddOptsFromState, ddSafeByStart } from "@/lib/engine";
import { Chart } from "../Chart";

/** Each January start's highest fixed first-year rate that lasted 30 years. */
export function safeByStart(): { year: number; rate: number }[] {
  const r = ddSafeByStart(ddOptsFromState({ initial: 1000000, years: 30, stock: 60, rate: 4, strategy: "fixed" }), DD_LASTS) as { year: number; rate: number }[] | null;
  return (r ?? []).map((x) => ({ year: x.year, rate: x.rate }));
}

export function WithdrawalRate({ label }: { label: string }) {
  const [tenths, setTenths] = useState(40);
  const id = useId(), rate = tenths / 1000;
  const starts = useMemo(() => safeByStart(), []);
  const failed = starts.filter((s) => s.rate < rate), n = starts.length, ok = n - failed.length;
  const list = failed.map((f) => f.year);
  return (
    <>
      <Chart label={label} spec={{
        type: "bar", stack: true, x: starts.map((s) => s.year), xLabel: "Year retired", y: "pct",
        series: [
          { name: "Lasted 30 years", values: starts.map((s) => (s.rate >= rate ? s.rate : null)), tone: "good" },
          { name: "Ran out early", values: starts.map((s) => (s.rate < rate ? s.rate : null)), tone: "bad" },
        ],
        levels: [{ y: rate, label: `${(rate * 100).toFixed(1)}%` }],
      }} />
      <div className="lrn-mover">
        <label htmlFor={id}>First-year withdrawal</label>
        <NativeRange id={id} min={30} max={80} step={1} value={tenths} onChange={(e) => setTenths(+e.target.value)} />
        <output htmlFor={id}>{(rate * 100).toFixed(1)}% of savings</output>
      </div>
      <p className="lrn-readout">
        Taking {(rate * 100).toFixed(1)}% in year one and raising it with inflation lasted 30 years in <b>{ok} of {n}</b> starts ({n ? ((ok / n) * 100).toFixed(1) : 0}%).
        {list.length === 0 ? <> Every start on record got through.</>
          : list.length <= 6 ? <> The ones that ran out began in <b>{list.join(", ")}</b>.</>
          : <> The {list.length} that ran out began between <b>{list[0]}</b> and <b>{list[list.length - 1]}</b>.</>}
        {" "}Each bar is the most that start could have taken.
      </p>
    </>
  );
}
