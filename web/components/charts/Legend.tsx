/* Chart legends and the horizontal share bars. From swatch() in
   src/js/app/04-charts.js and bar() in 11-income-tax.js. */
import { money } from "@/lib/format";

export function Legend({ id, items, children }: { id?: string; items: [color: string, label: string][]; children?: React.ReactNode }) {
  return (
    <div className="legend" id={id}>
      {items.map(([c, t]) => (
        <span key={t}><i style={{ background: c }}></i>{t}</span>
      ))}
      {children}
    </div>
  );
}

/** A legend entry that shows or hides a layer of the chart. */
export function LegendToggle({ color, label, on, onToggle }: { color: string; label: string; on: boolean; onToggle: () => void }) {
  return (
    <button type="button" className="lgtoggle" aria-pressed={on} title="Show or hide on the chart" onClick={onToggle}>
      <i style={{ background: color }}></i>{label}
    </button>
  );
}

/** The market-history fan's legend: no "without volatility" line, since no
    assumed rate is used, and a toggle for the line per starting year. */
export function HistLegend({ id, tracesOn, onToggleTraces, extra }: { id?: string; tracesOn: boolean; onToggleTraces: () => void; extra?: string }) {
  return (
    <Legend id={id} items={[["#4fbf95", "10th\u201390th percentile of windows"], ["#3f9a78", "25th\u201375th"], ["#e9b872", "Median window"]]}>
      <LegendToggle color="#7d9fd6" label="Each starting year" on={tracesOn} onToggle={onToggleTraces} />
      {extra ? <span><i style={{ background: "var(--stageline)" }}></i>{extra}</span> : null}
    </Legend>
  );
}

/** The Monte Carlo fan's legend. `noDet`: there's no plan to draw the
    dashed no-volatility line from. */
export function McLegend({ id, extra, noDet }: { id?: string; extra?: string; noDet?: boolean }) {
  return (
    <Legend id={id} items={[["#4fbf95", "10th\u201390th percentile"], ["#3f9a78", "25th\u201375th"], ["#e9b872", "Median"],
      ...(noDet ? [] : [["#7d9fd6", "Without volatility"] as [string, string]])]}>
      {extra ? <span><i style={{ background: "var(--stageline)" }}></i>{extra}</span> : null}
    </Legend>
  );
}

/** One labeled bar. `dim` fades it back while another one is pointed at. */
export function ShareBar({ label, value, share, color, idx, dim }: { label: string; value: number; share: number; color: string; idx?: number; dim?: boolean }) {
  return (
    <div className="bar" data-idx={idx} style={dim ? { opacity: 0.25 } : undefined}>
      <div className="lbl"><span>{label}</span><b>{money(value)}</b></div>
      <div className="track">
        <div className="fill" style={{ width: (Math.max(0, Math.min(1, share)) * 100).toFixed(1) + "%", background: color }}></div>
      </div>
    </div>
  );
}
