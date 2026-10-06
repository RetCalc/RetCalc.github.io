/* The lines inside a chart's tooltip, from tipRows() in src/js/app/04-charts.js. */
import { money } from "@/lib/format";
import { BAND_INNER, SERIES, baseColor, hatchClass } from "@/lib/hues";
import type { BandPoint } from "./BandChart";

/** One line: the series' swatch, a label and its dollar figure. */
export function TipRow({ color, label, value, fmt = money }: { color: string; label: React.ReactNode; value: number; fmt?: (v: number) => string }) {
  return <><br /><i className={"tipsw bg-(--swatch)" + hatchClass(color)} style={{ "--swatch": baseColor(color) } as React.CSSProperties}></i>{label} <span className="n">{fmt(value)}</span></>;
}

/** A market-history or Monte Carlo fan: its five percentiles. */
export function FanTipRows({ b }: { b: BandPoint }) {
  return (
    <>
      <TipRow color={SERIES.teal} label="90th" value={b.hi!} />
      <TipRow color={BAND_INNER} label="75th" value={b.p75!} />
      <TipRow color={SERIES.plan} label="Median" value={b.base} />
      <TipRow color={BAND_INNER} label="25th" value={b.p25!} />
      <TipRow color={SERIES.rose} label="10th" value={b.lo!} />
    </>
  );
}

/** A band: the higher line, the plan, the lower line. */
export function BandTipRows({ b, names = ["Higher", "Your rate", "Lower"] }: { b: BandPoint; names?: [string, string, string] }) {
  return (
    <>
      <TipRow color={SERIES.teal} label={names[0]} value={b.hi!} />
      <TipRow color={SERIES.plan} label={names[1]} value={b.base} />
      <TipRow color={SERIES.rose} label={names[2]} value={b.lo!} />
    </>
  );
}
