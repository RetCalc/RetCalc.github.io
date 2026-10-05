/* Chart legends and the horizontal share bars. From swatch() in
   src/js/app/04-charts.js and bar() in 11-income-tax.js. */
import { money } from "@/lib/format";

export function Legend({ id, items }: { id?: string; items: [color: string, label: string][] }) {
  return (
    <div className="legend" id={id}>
      {items.map(([c, t]) => (
        <span key={t}><i style={{ background: c }}></i>{t}</span>
      ))}
    </div>
  );
}

export function ShareBar({ label, value, share, color, idx }: { label: string; value: number; share: number; color: string; idx?: number }) {
  return (
    <div className="bar" data-idx={idx}>
      <div className="lbl"><span>{label}</span><b>{money(value)}</b></div>
      <div className="track">
        <div className="fill" style={{ width: (Math.max(0, Math.min(1, share)) * 100).toFixed(1) + "%", background: color }}></div>
      </div>
    </div>
  );
}
