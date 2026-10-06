/* Chart legends and the horizontal share bars. From swatch() in
   src/js/app/04-charts.js and bar() in 11-income-tax.js. */
import { money } from "@/lib/format";
import { BAND_INNER, SERIES } from "@/lib/hues";

export function Legend({ id, items, children }: { id?: string; items: [color: string, label: string][]; children?: React.ReactNode }) {
  return (
    <div className="legend" id={id}>
      {items.map(([c, t]) => (
        <span key={t}><i className="bg-(--swatch)" style={{ "--swatch": c } as React.CSSProperties}></i>{t}</span>
      ))}
      {children}
    </div>
  );
}

/** A legend entry that shows or hides a layer of the chart. */
export function LegendToggle({ color, label, on, onToggle }: { color: string; label: string; on: boolean; onToggle: () => void }) {
  return (
    <button type="button" className="lgtoggle" aria-pressed={on} title="Show or hide on the chart" onClick={onToggle}>
      <i className="bg-(--swatch)" style={{ "--swatch": color } as React.CSSProperties}></i>{label}
    </button>
  );
}

/** The market-history fan's legend: no "without volatility" line, since no
    assumed rate is used, and a toggle for the line per starting year. */
export function HistLegend({ id, tracesOn, onToggleTraces, extra, children }: { id?: string; tracesOn: boolean; onToggleTraces: () => void; extra?: string; children?: React.ReactNode }) {
  return (
    <Legend id={id} items={[[SERIES.teal, "10th\u201390th percentile of windows"], [BAND_INNER, "25th\u201375th"], [SERIES.plan, "Median window"]]}>
      <LegendToggle color={SERIES.sky} label="Each starting year" on={tracesOn} onToggle={onToggleTraces} />
      {extra ? <span><i className="bg-stageline"></i>{extra}</span> : null}
      {children}
    </Legend>
  );
}

/** The Monte Carlo fan's legend. `noDet`: there's no plan to draw the
    dashed no-volatility line from. */
export function McLegend({ id, extra, noDet, children }: { id?: string; extra?: string; noDet?: boolean; children?: React.ReactNode }) {
  return (
    <Legend id={id} items={[[SERIES.teal, "10th\u201390th percentile"], [BAND_INNER, "25th\u201375th"], [SERIES.plan, "Median"],
      ...(noDet ? [] : [[SERIES.sky, "Without volatility"] as [string, string]])]}>
      {extra ? <span><i className="bg-stageline"></i>{extra}</span> : null}
      {children}
    </Legend>
  );
}

/** One labeled bar. `dim` fades it back while another one is pointed at. */
export function ShareBar({ label, value, share, color, idx, dim }: { label: string; value: number; share: number; color: string; idx?: number; dim?: boolean }) {
  return (
    <div className={dim ? "bar opacity-25" : "bar"} data-idx={idx}>
      <div className="lbl"><span>{label}</span><b>{money(value)}</b></div>
      <div className="track">
        <div className="fill w-(--w) bg-(--swatch)"
          style={{ "--w": (Math.max(0, Math.min(1, share)) * 100).toFixed(1) + "%", "--swatch": color } as React.CSSProperties}></div>
      </div>
    </div>
  );
}
