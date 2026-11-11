"use client";

/* A state's tax on retirement income (the state-taxes lesson): a state,
   IRA withdrawals, Social Security and a filing status, and the state's
   income tax on them under its own retirement rules (computeRetireTax, which
   hands the state part to stateRetireTax and the year's states.tax and
   states.retire). Everyone 67, standard deduction, no local tax; on a joint
   return the withdrawals are taken as split evenly between the spouses. The
   line is the state tax at each level of withdrawals, $0 to $200,000. */

import { useId, useMemo, useState } from "react";
import { NativeRange } from "@/components/ui/native-range";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Segmented, SegmentedItem } from "@/components/ui/segmented";
import { NEWEST_YEAR, computeRetireTax, yearData } from "@/lib/engine";
import { Chart, fmt } from "../Chart";

type Status = "s" | "m";
interface Rt { state: number; stateTaxable: number; stateNone: boolean; stateName: string; stateSSIn: number; stateExcluded: number; stateDed: number; stateCredit: number; ssGross: number; trad: number }

/** Every state the year's data has, by name. */
export function stateList(): { code: string; name: string }[] {
  const tax = (yearData(NEWEST_YEAR) as { states: { tax: Record<string, { n?: string }> } }).states.tax;
  return Object.keys(tax).map((code) => ({ code, name: tax[code].n || code })).sort((a, b) => a.name.localeCompare(b.name));
}

/** The state's tax on `trad` of IRA withdrawals and `ss` of Social Security, and what it left untaxed. */
export function stateRetirePicture(code: string, trad: number, ss: number, status: Status) {
  const r = computeRetireTax({
    status, ages: status === "m" ? [67, 67] : [67], trad, ss, roth: 0, brok: 0, gainPct: 0, pension: 0, penPublic: false, other: 0,
    state: code, pre: 0, dedType: "std", item: 0, _noMarginal: true,
  }) as Rt;
  const income = trad + ss;
  return {
    tax: r.state, none: r.stateNone, name: r.stateName, income, taxable: r.stateTaxable, untaxed: income - r.stateTaxable,
    ssOut: ss - r.stateSSIn, excluded: r.stateExcluded, ded: Math.max(0, income - r.stateTaxable - (ss - r.stateSSIn) - r.stateExcluded), credit: r.stateCredit,
  };
}

const XS = Array.from({ length: 21 }, (_, i) => i * 10000);

export function StateRetirementTax({ label }: { label: string }) {
  const [code, setCode] = useState("NY");
  const [trad, setTrad] = useState(120000);
  const [ss, setSs] = useState(50000);
  const [status, setStatus] = useState<Status>("m");
  const idState = useId(), idT = useId(), idS = useId();
  const states = useMemo(() => stateList(), []);
  const line = useMemo(() => XS.map((x) => stateRetirePicture(code, x, ss, status).tax), [code, ss, status]);
  const p = stateRetirePicture(code, trad, ss, status);
  const money = (v: number) => fmt(Math.round(v), "money", false);
  const name = states.find((s) => s.code === code)?.name ?? code;
  const parts = [
    p.ssOut >= 1 ? `${money(p.ssOut)} of Social Security` : null,
    p.excluded >= 1 ? `${money(p.excluded)} under its retirement income exclusion` : null,
    p.ded >= 1 ? `${money(p.ded)} covered by deductions and exemptions` : null,
  ].filter((s): s is string => !!s);
  return (
    <>
      <div className="lrn-mixes">
        <label className="lrn-cap" htmlFor={idState}>State</label>
        <NativeSelect id={idState} className="w-auto" value={code} onChange={(e) => setCode(e.target.value)}>
          {states.map((s) => <NativeSelectOption key={s.code} value={s.code}>{s.name}</NativeSelectOption>)}
        </NativeSelect>
      </div>
      <div className="lrn-mixes">
        <span className="lrn-cap">Filing as</span>
        <Segmented role="group" aria-label="Filing status">
          <SegmentedItem pressed={status === "s"} onClick={() => setStatus("s")}>Single</SegmentedItem>
          <SegmentedItem pressed={status === "m"} onClick={() => setStatus("m")}>Married</SegmentedItem>
        </Segmented>
      </div>
      <Chart label={label} spec={{
        type: "line", x: XS, xFormat: "money", xLabel: "IRA withdrawals per year", y: "money",
        series: [{ name: `${name} income tax`, values: line, tone: "accent" }],
        marks: [{ x: trad, label: `${fmt(trad, "money")}: ${fmt(p.tax, "money")}` }],
      }} />
      <div className="lrn-movers">
        <div className="lrn-mover">
          <label htmlFor={idT}>IRA withdrawals per year</label>
          <NativeRange id={idT} min={0} max={200000} step={1000} value={trad} onChange={(e) => setTrad(+e.target.value)} />
          <output htmlFor={idT}>{money(trad)}</output>
        </div>
        <div className="lrn-mover">
          <label htmlFor={idS}>Social Security per year</label>
          <NativeRange id={idS} min={0} max={80000} step={1000} value={ss} onChange={(e) => setSs(+e.target.value)} />
          <output htmlFor={idS}>{money(ss)}</output>
        </div>
      </div>
      <p className="lrn-readout">
        {p.none
          ? <>{name} has no income tax on this income, so all <b>{money(p.income)}</b> goes untaxed by the state.</>
          : <>
            {name} takes <b>{money(p.tax)} per year</b>{p.income > 0 ? <>, {+((p.tax / p.income) * 100).toFixed(1)}% of the {money(p.income)}</> : null}.
            {" "}It leaves <b>{money(p.untaxed)}</b> of the income untaxed{parts.length ? <>: {parts.join(", ")}</> : null}.
            {p.credit >= 1 ? <> A credit of {money(p.credit)} then comes off the tax.</> : null}
          </>}
      </p>
    </>
  );
}
