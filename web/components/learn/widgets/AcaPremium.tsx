"use client";

/* The marketplace premium (the health-cover-before-65 lesson): what one
   person or a couple, both the same age, pays per year for the benchmark
   silver plan at each income, under the newest year's rules. The list price
   is hcGrossPremium (KFF's state average for a 40-year-old, scaled by the
   federal age curve, flat in community-rated states), once per person. What
   income buys is hcCoverage, the rule every tool uses: Medicaid under 138%
   of the poverty line in an expansion state, the coverage gap under 100% in
   the others, otherwise the premium tax credit (hcCalcACA) with its cliff at
   400% of the poverty line (hcFPL). */

import { useId, useMemo, useState } from "react";
import { NativeRange } from "@/components/ui/native-range";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Segmented, SegmentedItem } from "@/components/ui/segmented";
import { HC_COMMUNITY_RATED, NEWEST_YEAR, hcCoverage, hcFPL, hcGrossPremium, yearData } from "@/lib/engine";
import { STATE_OPTIONS } from "@/lib/states";
import { Chart, fmt } from "../Chart";

type Kind = "medicaid" | "gap" | "aca" | "cliff";
const LO = 20000, HI = 150000, STEP = 1000;

/** One income's premium and credit, per year, for a household of `size` paying `gross` per month in list price. */
export function acaYear(income: number, size: number, state: string, gross: number) {
  const c = hcCoverage(income, size, state, gross) as { kind: Kind; net: number; credit: number; pct: number };
  return { kind: c.kind, net: c.net * 12, credit: c.credit * 12, pct: c.pct };
}

/** The premium across incomes, the reader's point, and the cliff: the 400% line and what the first dollar over it costs. */
export function acaPicture(income: number, age: number, size: number, state: string) {
  const Y = yearData(NEWEST_YEAR) as { year: number; aca: { cliff: number } };
  const gross = (hcGrossPremium(state, age, 0) as number) * size;
  const line = Math.floor(Y.aca.cliff * (hcFPL(size) as number));
  const xs = [...new Set([...Array.from({ length: (HI - LO) / STEP + 1 }, (_, i) => LO + i * STEP), line, line + 1])].sort((a, b) => a - b);
  const curve = xs.map((x) => acaYear(x, size, state, gross).net);
  const edge = acaYear(line, size, state, gross);
  return { year: Y.year, full: gross * 12, line, xs, curve, at: acaYear(income, size, state, gross), edge, jump: gross * 12 - edge.net };
}

export function AcaPremium({ label }: { label: string }) {
  const [size, setSize] = useState(2);
  const [state, setState] = useState("IL");
  const [age, setAge] = useState(62);
  const [income, setIncome] = useState(84000);
  const idA = useId(), idI = useId();
  const p = useMemo(() => acaPicture(income, age, size, state), [income, age, size, state]);
  const money = (v: number) => fmt(v, "money", false);
  const name = STATE_OPTIONS.find((s) => s.code === state)?.name ?? state;
  const flat = !!(HC_COMMUNITY_RATED as Record<string, number>)[state];
  const who = size === 2 ? "they" : "you";
  return (
    <>
      <div className="lrn-mixes">
        <span className="lrn-cap">Household</span>
        <Segmented role="group" aria-label="People on the plan">
          <SegmentedItem pressed={size === 1} onClick={() => setSize(1)}>One</SegmentedItem>
          <SegmentedItem pressed={size === 2} onClick={() => setSize(2)}>Couple</SegmentedItem>
        </Segmented>
        <NativeSelect className="w-auto" size="sm" aria-label="State" value={state} onChange={(e) => setState(e.target.value)}>
          {STATE_OPTIONS.map((s) => <NativeSelectOption key={s.code} value={s.code}>{s.name}</NativeSelectOption>)}
        </NativeSelect>
      </div>
      <Chart label={label} spec={{
        type: "line", x: p.xs, xFormat: "money", xLabel: size === 2 ? "Household income (MAGI)" : "Income (MAGI)", y: "money",
        series: [{ name: `${p.year} rules, per year`, values: p.curve, tone: "bad" }],
        levels: [{ y: p.full, label: "Full price" }],
        marks: [{ x: income, label: `${money(income)}: ${money(p.at.net)}` }],
      }} />
      <div className="lrn-movers">
        <div className="lrn-mover">
          <label htmlFor={idA}>{size === 2 ? "Both aged" : "Age"}</label>
          <NativeRange id={idA} min={40} max={64} step={1} value={age} onChange={(e) => setAge(+e.target.value)} />
          <output htmlFor={idA}>{age}</output>
        </div>
        <div className="lrn-mover">
          <label htmlFor={idI}>Income per year</label>
          <NativeRange id={idI} min={LO} max={HI} step={STEP} value={income} onChange={(e) => setIncome(+e.target.value)} />
          <output htmlFor={idI}>{money(income)}</output>
        </div>
      </div>
      <p className="lrn-readout">
        The benchmark plan lists at <b>{money(p.full)}</b> per year {size === 2 ? "for the two of them" : "for one person"} in {name}{flat ? ", the same at every adult age, since insurers there can't price by age" : ""}.{" "}
        {p.at.kind === "medicaid" ? <>At {money(income)}, under 138% of the poverty line, {name} covers adults on <b>Medicaid</b>, with no premium.</>
          : p.at.kind === "gap" ? <>At {money(income)}, under the poverty line, there&apos;s no credit, and {name} hasn&apos;t expanded Medicaid: {who} pay the full price.</>
          : p.at.kind === "aca" ? <>At {money(income)}, {Math.round(p.at.pct * 100)}% of the poverty line, {who} pay <b>{money(p.at.net)}</b> and the credit pays <b>{money(p.at.credit)}</b>.</>
          : <>At {money(income)}, over the 400% line, there&apos;s no credit: {who} pay the full <b>{money(p.full)}</b>. At {money(p.line)} it would be {money(p.edge.net)}.</>}
        {" "}For {p.year} the credit stops at <b>{money(p.line)}</b>; the first dollar over it costs <b>{money(p.jump)}</b>.
      </p>
    </>
  );
}
