"use client";

/* The four holdings in an asset-mix pop-up, and the total under them that
   has to reach 100%. The Drawdown Simulator's and the Portfolio Backtest's
   pop-ups both use it. */

import { NumberInput } from "@/components/fields/NumberInput";
import { parseNum } from "@/lib/format";
import { DD_ASSETS, ddN } from "./text";
import { Affixed } from "@/components/fields/Field";

export type MixForm = Record<(typeof DD_ASSETS)[number][0], string>;

export const mixForm = (m: Record<keyof MixForm, number>): MixForm =>
  ({ stock: ddN(m.stock), sv: ddN(m.sv), bond: ddN(m.bond), cash: ddN(m.cash) });

/** Whether the holdings add up to 100%. */
export const mixOk = (f: MixForm) => Math.abs(DD_ASSETS.reduce((t, [k]) => t + parseNum(f[k]), 0) - 100) < 0.01;

export function MixRows({ f, up, totId }: { f: MixForm; up: (k: keyof MixForm) => (v: string) => void; totId: string }) {
  const t = DD_ASSETS.reduce((a, [k]) => a + parseNum(f[k]), 0), ok = mixOk(f);
  return (
    <>
      {DD_ASSETS.map(([k, , name, desc]) => (
        <div className="ddmixrow" key={k}><div><b>{name}</b><small>{desc}</small></div>
          <Affixed suffix="%" className="w-27.5 flex-none"><NumberInput nonNeg step={5} max={100} data-mix={k} aria-label={name} value={f[k]} onValueChange={up(k)} /></Affixed></div>
      ))}
      <div className="ddmixtot" id={totId}>Total: <b className={ok ? "pos" : "neg"}>{ddN(t)}%</b>{ok ? "" : " — it needs to add up to 100%"}</div>
    </>
  );
}
