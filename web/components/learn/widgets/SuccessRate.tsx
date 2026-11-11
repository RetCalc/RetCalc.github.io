"use client";

/* What "chance of success" means: what was left after 30 years for each
   January retirement from 1927 to 1996 at a chosen first-year withdrawal,
   raised with inflation ($1,000,000 in 60/40, historicalBacktest via
   successRun, history-data.ts). A gap is a start that ran out. */

import { useId, useMemo, useState } from "react";
import { NativeRange } from "@/components/ui/native-range";
import { Chart, fmt } from "../Chart";
import { successRun } from "./history-data";

export function SuccessRate({ label }: { label: string }) {
  const [tenths, setTenths] = useState(40);
  const id = useId(), rate = tenths / 10;
  const r = useMemo(() => successRun(rate), [rate]);
  const list = r.fails.map((f) => f.year);
  const money = (v: number) => fmt(Math.round(v / 1000) * 1000, "money", false);
  return (
    <>
      <Chart label={label} spec={{
        type: "bar", x: r.years, xLabel: "Year retired", y: "money",
        series: [{ name: "Left after 30 years", values: r.left, tone: "accent" }],
        levels: [{ y: 1000000, label: "$1M at the start" }],
      }} />
      <div className="lrn-mover">
        <label htmlFor={id}>First-year withdrawal</label>
        <NativeRange id={id} min={30} max={60} step={1} value={tenths} onChange={(e) => setTenths(+e.target.value)} />
        <output htmlFor={id}>{rate.toFixed(1)}% ({fmt(rate * 10000, "money", false)})</output>
      </div>
      <p className="lrn-readout">
        At {rate.toFixed(1)}%, the money lasted thirty years in <b>{r.survived} of {r.total}</b> retirements, a success rate of <b>{(r.rate * 100).toFixed(1)}%</b>.
        {list.length === 0 ? <> None ran out.</>
          : list.length <= 8 ? <> The {list.length === 1 ? "one" : list.length} that ran out began in <b>{list.join(", ")}</b>.</>
          : <> The {list.length} that ran out began between <b>{list[0]}</b> and <b>{list[list.length - 1]}</b>.</>}
        {" "}The middle retirement finished with {money(r.median)}, and {r.above} of {r.total} finished with more than the $1,000,000 they started with.
      </p>
    </>
  );
}
