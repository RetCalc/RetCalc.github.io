"use client";

/* Cashing out an old 401(k) (the old-401k-rollovers lesson): a traditional
   balance, the age on leaving the job and the salary, for a single filer
   with the standard deduction. Income tax on the cash-out is the extra
   federal tax from adding the balance to the year's wages (bracketTax on
   salary + balance, less on salary alone), as the lesson's example works
   it; the 10% penalty applies before 55 (leaving the job in or after the
   year you turn 55 waives it for that plan). Against it, the balance left
   invested to 65 at 5% per year after inflation, the lesson's rate. No
   state tax. */

import { useId, useState } from "react";
import { NativeRange } from "@/components/ui/native-range";
import { NEWEST_YEAR, bracketTax, yearData } from "@/lib/engine";
import { Chart, fmt } from "../Chart";

export const CASH_OUT = { real: 0.05, at: 65, penalty: 0.1, penaltyFreeAge: 55 };

/** What cashing out keeps after federal tax and penalty, and what the balance would be at 65. */
export function cashOut(balance: number, age: number, salary: number) {
  const Y = yearData(NEWEST_YEAR) as { year: number; fed: { s: number[][] }; fedStd: { s: number } };
  const tax = (w: number) => (bracketTax(Math.max(0, w - Y.fedStd.s), Y.fed.s) as { tax: number }).tax;
  const incomeTax = tax(salary + balance) - tax(salary);
  const penalty = age < CASH_OUT.penaltyFreeAge ? CASH_OUT.penalty * balance : 0;
  const later = balance * Math.pow(1 + CASH_OUT.real, Math.max(0, CASH_OUT.at - age));
  return { year: Y.year, incomeTax, penalty, kept: balance - incomeTax - penalty, later };
}

export function CashOut({ label }: { label: string }) {
  const [balance, setBalance] = useState(30000);
  const [age, setAge] = useState(35);
  const [salary, setSalary] = useState(75000);
  const idB = useId(), idA = useId(), idS = useId();
  const p = cashOut(balance, age, salary);
  const money = (v: number) => fmt(Math.round(v), "money", false);
  const lost = p.incomeTax + p.penalty;
  return (
    <>
      <Chart label={label} spec={{
        type: "bar", stack: true, labels: true, x: ["Cashed out now", `Left invested to ${CASH_OUT.at}`], y: "money",
        series: [
          { name: "Still yours", values: [p.kept, p.later], tone: "good" },
          { name: "Federal income tax", values: [p.incomeTax, 0], tone: "bad" },
          { name: "10% early withdrawal penalty", values: [p.penalty, 0], tone: "accent" },
        ],
      }} />
      <div className="lrn-movers">
        <div className="lrn-mover">
          <label htmlFor={idB}>Balance</label>
          <NativeRange id={idB} min={5000} max={200000} step={1000} value={balance} onChange={(e) => setBalance(+e.target.value)} />
          <output htmlFor={idB}>{fmt(balance, "money", false)}</output>
        </div>
        <div className="lrn-mover">
          <label htmlFor={idA}>Age on leaving</label>
          <NativeRange id={idA} min={22} max={64} step={1} value={age} onChange={(e) => setAge(+e.target.value)} />
          <output htmlFor={idA}>{age}</output>
        </div>
        <div className="lrn-mover">
          <label htmlFor={idS}>Salary that year</label>
          <NativeRange id={idS} min={20000} max={250000} step={5000} value={salary} onChange={(e) => setSalary(+e.target.value)} />
          <output htmlFor={idS}>{fmt(salary, "money", false)}</output>
        </div>
      </div>
      <p className="lrn-readout">
        Cashing out adds {money(balance)} to the year&apos;s income: <b>{money(p.incomeTax)}</b> more federal income tax for {p.year}
        {p.penalty > 0 ? <> and a <b>{money(p.penalty)}</b> penalty</> : <>, and no penalty, since leaving the job at 55 or later waives it for this plan</>},
        {" "}{Math.round((lost / balance) * 100)}% of the balance. You keep <b>{money(p.kept)}</b>.
        Left invested at 5% per year after inflation, it would be about <b>{money(Math.round(p.later / 100) * 100)}</b> at {CASH_OUT.at}, in today&apos;s dollars, still to be taxed as it comes out. Single filer, no state tax.
      </p>
    </>
  );
}
