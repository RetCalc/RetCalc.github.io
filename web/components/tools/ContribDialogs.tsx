"use client";

/* The two contribution dialogs Advanced and Stages share: one restates a
   contribution at every frequency, the other sets contribution growth for
   each account type. From openConverter() and openGrowthRates() in
   src/js/app/07-converter.js. */

import { useState } from "react";
import { MoneyInput, NumberInput } from "@/components/fields/NumberInput";
import { Modal, ModalTop } from "@/components/shell/Modal";
import { useToast } from "@/components/shell/Toast";
import type { GrowthRates } from "@/lib/accounts";
import { PPY } from "@/lib/engine/typed";
import { groupDigits, money, parseNum, pctStr } from "@/lib/format";
import { PERIOD_NAMES, PeriodOptions } from "@/lib/periods";

const perYear = PPY as Record<string, number>;

/** Shows a contribution at each frequency; Apply on a row hands that amount
    and frequency to `apply`. */
export function ConverterDialog({ title, amount, period, apply, onClose }: {
  title: string; amount: number; period: string; apply: (v: number, period: string) => void; onClose: () => void;
}) {
  const toast = useToast();
  const [amt, setAmt] = useState(groupDigits(Math.round(amount * 100) / 100, true));
  const [per, setPer] = useState(perYear[period] ? period : "Monthly");
  const annual = parseNum(amt) * perYear[per];
  return (
    <Modal className="popup wide" onClose={onClose} focus="#convAmt">
      <ModalTop title={title} onClose={onClose} />
      <div className="formhint">See what a contribution comes to at each frequency, then apply the one that matches how you save.</div>
      <div className="two">
        <div className="field"><label htmlFor="convAmt">Amount</label>
          <div className="inputwrap"><span className="affix">$</span><MoneyInput id="convAmt" nonNeg value={amt} onValueChange={setAmt} /></div></div>
        <div className="field"><label htmlFor="convPeriod">Paid</label>
          <select id="convPeriod" value={per} onChange={(e) => setPer(e.target.value)}><PeriodOptions /></select></div>
      </div>
      <div id="convOut">
        {PERIOD_NAMES.map((to) => {
          const v = annual / perYear[to];
          return (
            <div className="convrow" key={to}>
              <span className="k">{to}</span><span className="v">{money(v, 2)}</span>
              <button className="btn mini" type="button" data-period={to} onClick={() => {
                const r = Math.round(v);
                onClose();
                apply(r, to);
                toast("Contribution set to " + money(r, 2) + " " + to.toLowerCase());
              }}>Apply</button>
            </div>
          );
        })}
      </div>
    </Modal>
  );
}

/** Three growth rates in, the blend shown live. `apply` gets the rates, or
    null for "Use one rate". */
export function GrowthRatesDialog({ title, init, blend, apply, note, onClose }: {
  title: string; init: GrowthRates; blend: (r: GrowthRates) => number; apply: (r: GrowthRates | null) => void;
  note?: string; onClose: () => void;
}) {
  const pct = (v: number) => String(+(v * 100).toFixed(4));
  const [f, setF] = useState({ t: pct(init.t), r: pct(init.r), b: pct(init.b) });
  const rates = { t: parseNum(f.t) / 100, r: parseNum(f.r) / 100, b: parseNum(f.b) / 100 };
  const row = (k: "t" | "r" | "b", label: string) => (
    <div className="formfield"><label htmlFor={"gr_" + k}>{label}</label>
      <div className="formwrap"><NumberInput id={"gr_" + k} step={0.5} value={f[k]} onValueChange={(v) => setF((c) => ({ ...c, [k]: v }))} /><span className="affix">%/yr</span></div>
    </div>
  );
  const done = (r: GrowthRates | null) => {
    onClose();
    apply(r);
  };
  return (
    <Modal className="popup wide" onClose={onClose} focus="#gr_t">
      <ModalTop title={title} onClose={onClose} />
      <div className="formhint">How much each account&apos;s contribution rises each year. The contribution growth field shows the blend: the single rate that ends at the same total.{note ? " " + note : ""}</div>
      {row("t", "Traditional")}{row("r", "Roth")}{row("b", "Taxable brokerage")}
      <div className="kv total" style={{ margin: "4px 0 14px" }}><span className="k">Blended</span><span className="v" id="gr_blend">{pctStr(blend(rates), 2)}</span></div>
      <div className="formactions">
        <button type="button" className="btn" data-gr="one" onClick={() => done(null)}>Use one rate</button>
        <button type="button" className="btn primary" data-gr="apply" onClick={() => done(rates)}>Apply</button>
      </div>
    </Modal>
  );
}
