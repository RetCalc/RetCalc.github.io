"use client";

/* A QCD against a cash gift (the charitable-giving lesson): Social Security,
   IRA withdrawals before the gift and a gift, for a married couple both over
   70½ taking the standard deduction, newest tax year, no state tax. Federal
   tax three ways, each from computeRetireTax:
   - no gift;
   - the gift in cash: the same return with the non-itemizer cash deduction
     (up to $2,000 joint, IRC sec. 170(p), from 2026) added to the standard
     deduction, run as dedType "item" with the standard and age-65 amounts
     plus the gift (the senior deduction is added either way);
   - the gift as a QCD: that much of the IRA withdrawals goes to the charity
     and is left out of income. */

import { useId, useState } from "react";
import { NativeRange } from "@/components/ui/native-range";
import { NEWEST_YEAR, computeRetireTax, yearData } from "@/lib/engine";
import { Chart, fmt } from "../Chart";

/** The cash-gift deduction for a couple who take the standard deduction (the year's data). */
const cashGiftCap = () => (yearData(NEWEST_YEAR) as { limits: { cashGift: { m: number } } }).limits.cashGift.m;

interface Rt { federal: number; taxableSS: number; agi: number }

function ret(trad: number, ss: number, extra: number): Rt {
  const Y = yearData(NEWEST_YEAR) as { fedStd: { m: number }; seniorAddl: { m: number } };
  return computeRetireTax({
    status: "m", ages: [74, 74], trad, ss, roth: 0, brok: 0, gainPct: 0, pension: 0, penPublic: false, other: 0, state: "TX", pre: 0,
    dedType: extra > 0 ? "item" : "std", item: Y.fedStd.m + 2 * Y.seniorAddl.m + extra, _noMarginal: true,
  }) as Rt;
}

/** Federal tax with no gift, with `gift` given in cash, and with it given as a QCD out of `ira`. */
export function qcdPicture(ss: number, ira: number, gift: number) {
  const none = ret(ira, ss, 0), cash = ret(ira, ss, Math.min(gift, cashGiftCap())), qcd = ret(Math.max(0, ira - gift), ss, 0);
  return {
    none: none.federal, cash: cash.federal, qcd: qcd.federal,
    savedCash: none.federal - cash.federal, savedQcd: none.federal - qcd.federal,
    ssLess: none.taxableSS - qcd.taxableSS, agiLess: none.agi - qcd.agi,
  };
}

export function Qcd({ label }: { label: string }) {
  const [ss, setSs] = useState(50000);
  const [ira, setIra] = useState(60000);
  const [gift, setGift] = useState(10000);
  const idS = useId(), idI = useId(), idG = useId();
  const p = qcdPicture(ss, ira, gift);
  const money = (v: number) => fmt(Math.round(v), "money", false);
  return (
    <>
      <Chart label={label} spec={{
        type: "bar", labels: true, x: ["No gift", "Cash gift", "QCD"], xLabel: "How the gift is made", y: "money",
        series: [{ name: "Federal income tax", values: [p.none, p.cash, p.qcd], tone: "accent" }],
      }} />
      <div className="lrn-movers">
        <div className="lrn-mover">
          <label htmlFor={idS}>Social Security per year</label>
          <NativeRange id={idS} min={0} max={80000} step={1000} value={ss} onChange={(e) => setSs(+e.target.value)} />
          <output htmlFor={idS}>{money(ss)}</output>
        </div>
        <div className="lrn-mover">
          <label htmlFor={idI}>IRA withdrawals per year</label>
          <NativeRange id={idI} min={0} max={200000} step={1000} value={ira} onChange={(e) => setIra(+e.target.value)} />
          <output htmlFor={idI}>{money(ira)}</output>
        </div>
        <div className="lrn-mover">
          <label htmlFor={idG}>Gift</label>
          <NativeRange id={idG} min={1000} max={50000} step={1000} value={gift} onChange={(e) => setGift(+e.target.value)} />
          <output htmlFor={idG}>{money(gift)}</output>
        </div>
      </div>
      <p className="lrn-readout">
        With no gift the federal tax is <b>{money(p.none)}</b>.
        {" "}Given in cash, the gift saves <b>{money(p.savedCash)}</b>, since only {money(Math.min(gift, cashGiftCap()))} of it is deductible.
        {" "}Given as a QCD it saves <b>{money(p.savedQcd)}</b>: it takes {money(p.agiLess)} off AGI
        {p.ssLess >= 1 ? <>, {money(p.ssLess)} of it Social Security that no longer counts</> : null}.
        {p.none === 0 ? <> This couple owes no federal tax, so neither kind of gift saves any.</> : null}
      </p>
    </>
  );
}
