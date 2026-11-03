"use client";

/* Historical mode's asset mix, on both of the Advanced calculator's
   screens: the four holdings of the Drawdown Simulator's and the
   Backtest's pop-ups (US stocks, small-cap value, bonds and cash), adding
   up to 100%, each earning its actual returns. US stocks are `histMix`,
   small-cap value `histSv` and cash `histCash`, in percent; bonds are the
   rest. A glide moves the stocks' total (`histMixEnd`), small-cap value
   keeping its share of them. */

import { useState } from "react";
import { Field } from "@/components/fields/Field";
import { Tipped } from "@/components/shell/Tooltips";
import { Modal } from "@/components/shell/Modal";
import { Button } from "@/components/ui/button";
import { fmtNum, fraction, parseNum } from "@/lib/format";
import { MixRows, mixForm, mixOk, type MixForm } from "@/tools/drawdown/MixRows";
import { ChevronRightIcon } from "lucide-react";

export interface HistMixFields { histMix: string; histSv?: string; histCash?: string }

/** The mix as the historical runs take it: the stocks' share (US stocks
    and small-cap value together), and, when either is held, small-cap
    value's share of the stocks and cash's share of the rest. */
export function histMixOf(s: HistMixFields): { mix: number; full: { sv?: number; cash?: number } } {
  const us = fraction(s.histMix), svP = fraction(s.histSv ?? "0"), cashP = fraction(s.histCash ?? "0"), stocks = Math.min(1, us + svP);
  const full = svP > 0 || cashP > 0 ? { sv: stocks > 0 ? svP / stocks : 0, cash: stocks < 1 ? cashP / (1 - stocks) : 0 } : {};
  return { mix: stocks, full };
}

function mixWords(s: HistMixFields): string {
  const us = parseNum(s.histMix), sv = parseNum(s.histSv ?? "0"), cash = parseNum(s.histCash ?? "0"), bond = Math.max(0, 100 - us - sv - cash);
  const parts: [number, string][] = [[us, "US stocks"], [sv, "small-cap value"], [bond, "bonds"], [cash, "cash"]];
  return parts.filter(([v]) => v > 0).map(([v, n]) => fmtNum(v) + "% " + n).join(", ") || "Nothing invested";
}

/** The mix in words, as a button that opens it. `sfx` tells the two
    screens' ids apart ("" on the site, "S" on the Dashboard). */
export function HistMixButton({ s, save, sfx }: { s: HistMixFields; save: (f: { histMix: string; histSv: string; histCash: string }) => void; sfx: "" | "S" }) {
  const [open, setOpen] = useState(false);
  return (
    <Field id={"histMixBtn" + sfx} label={<Tipped text="Asset mix" k="histmix" />}>
      <Button variant="outline" className="w-full max-w-90 justify-between" id={"histMixBtn" + sfx} onClick={() => setOpen(true)}>
        <span className="min-w-0 flex-1 truncate text-left">{mixWords(s)}</span><ChevronRightIcon className="text-muted-foreground" aria-hidden="true" /></Button>
      {open ? <HistMixDialog s={s} sfx={sfx} close={() => setOpen(false)} save={(f) => save({ histMix: f.stock, histSv: f.sv, histCash: f.cash })} /> : null}
    </Field>
  );
}

function HistMixDialog({ s, sfx, close, save }: { s: HistMixFields; sfx: "" | "S"; close: () => void; save: (f: MixForm) => void }) {
  const [f, setF] = useState<MixForm>(() => {
    const stock = parseNum(s.histMix), sv = parseNum(s.histSv ?? "0"), cash = parseNum(s.histCash ?? "0");
    return mixForm({ stock, sv, bond: Math.max(0, 100 - stock - sv - cash), cash });
  });
  const up = (k: keyof MixForm) => (v: string) => setF((c) => ({ ...c, [k]: v }));
  const ok = mixOk(f);
  return (
    <Modal size="wide" onClose={close} focus="[data-mix]">
      <h3>Asset mix</h3>
      <div className="formhint">How your savings are invested while you save. Each holding earns its actual monthly returns; small-cap value and cash start in July 1926, so a mix with either starts its runs there. A glide {sfx === "S" ? "in your last stage" : "path"} moves the stocks&apos; total, small-cap value keeping its share of them.</div>
      <MixRows f={f} up={up} totId={"histMixTot" + sfx} />
      <div className="formactions"><Button variant="outline" className="flex-1" data-mixcancel onClick={close}>Cancel</Button>
        <Button className="flex-1" data-mixok disabled={!ok} onClick={() => {
          if (!ok) return;
          save({ stock: String(parseNum(f.stock)), sv: String(parseNum(f.sv)), bond: f.bond, cash: String(parseNum(f.cash)) });
          close();
        }}>Use this mix</Button></div>
    </Modal>
  );
}
