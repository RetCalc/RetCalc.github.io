/* The lines inside a chart's tooltip, from tipRows() in src/js/app/04-charts.js. */
import { money } from "@/lib/format";
import type { BandPoint } from "./BandChart";

/** One colored line: a label and its dollar figure. */
export function TipRow({ color, label, value, fmt = money }: { color: string; label: React.ReactNode; value: number; fmt?: (v: number) => string }) {
  return <><br /><span style={{ color }}>{label}</span> <span className="n">{fmt(value)}</span></>;
}

/** A market-history or Monte Carlo fan: its five percentiles. */
export function FanTipRows({ b }: { b: BandPoint }) {
  return (
    <>
      <TipRow color="#4fbf95" label="90th" value={b.hi!} />
      <TipRow color="#3f9a78" label="75th" value={b.p75!} />
      <TipRow color="#e9b872" label="Median" value={b.base} />
      <TipRow color="#3f9a78" label="25th" value={b.p25!} />
      <TipRow color="#e2795f" label="10th" value={b.lo!} />
    </>
  );
}

/** A band: the higher line, the plan, the lower line. */
export function BandTipRows({ b, names = ["Higher", "Your rate", "Lower"] }: { b: BandPoint; names?: [string, string, string] }) {
  return (
    <>
      <TipRow color="#4fbf95" label={names[0]} value={b.hi!} />
      <TipRow color="#e9b872" label={names[1]} value={b.base} />
      <TipRow color="#e2795f" label={names[2]} value={b.lo!} />
    </>
  );
}
