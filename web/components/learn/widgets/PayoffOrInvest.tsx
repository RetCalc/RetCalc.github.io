"use client";

/* Pay the mortgage down or invest (the mortgage-payoff lesson): the
   $360,000, 30-year loan, and the same extra money each month used two
   ways. Pay down first: the extra goes on the loan (mortgage(), the
   Mortgage page's own walk, with extraMonthly) until it's gone, then the
   whole payment plus the extra is invested each month to the end of the
   thirty years. Invest from the start: the extra is invested each month
   and the loan is paid as scheduled. Deposits at the end of each month,
   monthly growth (1 + return)^(1/12), no taxes on either side. */

import { useId, useMemo, useState } from "react";
import { NativeRange } from "@/components/ui/native-range";
import { mortgage } from "@/lib/engine/typed";
import { Chart, fmt } from "../Chart";

export const LOAN = { amount: 360000, term: 30 };

/** The investment account at the end of each year under each choice, and when the paid-down loan ends. */
export function payoffOrInvest(rate: number, ret: number, extra: number) {
  const base = { price: LOAN.amount, down: 0, rate, term: LOAN.term, taxPct: 0, ins: 0, pmiPct: 0, hoa: 0, maintPct: 0, util: 0, extraMonthly: 0, extraOnce: 0, extraOnceMonth: 0, recast: false };
  const pi = mortgage(base).pi;
  const off = mortgage({ ...base, extraMonthly: extra }).payoffMonth;
  const g = Math.pow(1 + ret, 1 / 12) - 1, n = LOAN.term * 12, prepay = [0], invest = [0];
  let a = 0, b = 0;
  for (let i = 1; i <= n; i++) {
    a = a * (1 + g) + (i > off ? pi + extra : 0);
    b = b * (1 + g) + extra;
    if (i % 12 === 0) { prepay.push(a); invest.push(b); }
  }
  return { pi, off, prepay, invest, even: Math.pow(1 + rate / 12, 12) - 1 };
}

export function PayoffOrInvest({ label }: { label: string }) {
  const [rate, setRate] = useState(725);
  const [ret, setRet] = useState(60);
  const [extra, setExtra] = useState(500);
  const idR = useId(), idG = useId(), idE = useId();
  const p = useMemo(() => payoffOrInvest(rate / 10000, ret / 1000, extra), [rate, ret, extra]);
  const money = (v: number) => fmt(v, "money", false);
  const years = Array.from({ length: LOAN.term + 1 }, (_, i) => i);
  const a = p.prepay[LOAN.term], b = p.invest[LOAN.term], gap = Math.abs(b - a);
  const dur = `${Math.floor(p.off / 12)} years${p.off % 12 ? ` ${p.off % 12} months` : ""}`;
  return (
    <>
      <Chart label={label} spec={{
        type: "line", x: years, xLabel: "Year of the loan", y: "money",
        series: [
          { name: "Pay down first, then invest", values: p.prepay, tone: "accent" },
          { name: "Invest from the start", values: p.invest, tone: "neutral" },
        ],
      }} />
      <div className="lrn-movers">
        <div className="lrn-mover">
          <label htmlFor={idR}>Mortgage rate</label>
          <NativeRange id={idR} min={250} max={900} step={25} value={rate} onChange={(e) => setRate(+e.target.value)} />
          <output htmlFor={idR}>{(rate / 100).toFixed(2)}%</output>
        </div>
        <div className="lrn-mover">
          <label htmlFor={idG}>Investments earn</label>
          <NativeRange id={idG} min={0} max={120} step={5} value={ret} onChange={(e) => setRet(+e.target.value)} />
          <output htmlFor={idG}>{(ret / 10).toFixed(1)}% per year</output>
        </div>
        <div className="lrn-mover">
          <label htmlFor={idE}>Extra each month</label>
          <NativeRange id={idE} min={100} max={2000} step={50} value={extra} onChange={(e) => setExtra(+e.target.value)} />
          <output htmlFor={idE}>{money(extra)}</output>
        </div>
      </div>
      <p className="lrn-readout">
        The payment is {money(p.pi)} per month. With {money(extra)} extra the loan is gone in <b>{dur}</b>, and from then on {money(p.pi + extra)} per month is invested.
        After {LOAN.term} years the account holds <b>{money(a)}</b> paying down first and <b>{money(b)}</b> investing from the start:
        {gap < 1000 ? <> about the same.</> : <> <b>{a > b ? "paying down" : "investing"}</b> is ahead by {money(gap)}.</>}
        {" "}The two come out even when investments earn about <b>{(p.even * 100).toFixed(2)}%</b> per year, the loan&apos;s rate with monthly compounding counted.
      </p>
    </>
  );
}
