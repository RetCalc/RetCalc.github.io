"use client";

/* Mapping out a career's pay for the Social Security estimate: the ages
   it started and will stop, raises above wage growth so far and ahead,
   and every year's pay in a table where any figure can be set by hand (a
   job change, a few years out, part-time at the end). The benefit the
   pattern earns updates as it's shaped. Apply hands the pattern and the
   edits back to the tool; Reset clears the hand-set years. */

import { useMemo, useState } from "react";
import { RotateCcwIcon } from "lucide-react";
import { Affixed } from "@/components/fields/Field";
import { MoneyInput, NumberInput } from "@/components/fields/NumberInput";
import { Modal, ModalTop } from "@/components/shell/Modal";
import { fmtNum, groupDigits, money } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { careerPia, careerYears, type Career } from "./model";

export function CareerDialog({ who, career, ageNow, incomeNow, fra, apply, onClose }: {
  who: string; career: Career; ageNow: number; incomeNow: number; fra: number;
  apply: (c: Career) => void; onClose: () => void;
}) {
  const [c, setC] = useState<Career>({ ...career, edits: { ...career.edits } });
  const up = (k: keyof Omit<Career, "edits">) => (v: string) => setC((x) => ({ ...x, [k]: v }));
  const years = useMemo(() => careerYears(c, ageNow, incomeNow), [c, ageNow, incomeNow]);
  const est = careerPia(years);
  const edited = Object.values(c.edits).filter((v) => v !== "").length;
  const field = (k: keyof Omit<Career, "edits">, label: string, unit: string, step?: number) => (
    <div className="field"><Label className="mb-1.5" htmlFor={"car_" + k}><span>{label}</span></Label>
      <Affixed suffix={unit}><NumberInput id={"car_" + k} step={step} value={c[k]} onValueChange={up(k)} /></Affixed></div>
  );
  return (
    <Modal size="wide" onClose={onClose} focus="#car_start">
      <ModalTop title={`${who} pay over a career`} onClose={onClose} />
      <div className="formhint">
        Every figure is in today&apos;s dollars. Social Security indexes past pay to wage growth, so a raise that only kept up with wages counts as 0%, and the pattern walks today&apos;s {money(incomeNow)} back and forward at the rates here. Change any year by hand; the benefit updates as you go.
      </div>
      <div className="two">
        {field("start", "Started working at", "age")}
        {field("stop", "Stop working at", "age")}
      </div>
      <div className="two">
        {field("growPast", "Raises so far, above wage growth", "%/yr", 0.5)}
        {field("growAhead", "Raises ahead, above wage growth", "%/yr", 0.5)}
      </div>

      <div className="kv total mt-1 mx-0 mb-1"><span className="k">Benefit at {fra % 1 ? fra.toFixed(2) : fra}, a month</span><span className="v" id="car_pia">{money(est.pia)}</span></div>
      <p className="hint m-0 mb-3">Best 35 years average {money(est.aime * 12)} a year{est.years < 35 ? ", with " + fmtNum(35 - est.years) + " zero " + (35 - est.years === 1 ? "year" : "years") + " averaged in" : ""}. Pay over the wage base doesn&apos;t count.</p>

      <div className="mb-2 flex items-center justify-between gap-3">
        <span className="text-label text-muted-foreground">{edited ? fmtNum(edited) + (edited === 1 ? " year set by hand" : " years set by hand") : "Every year follows the pattern"}</span>
        <Button variant="ghost" size="sm" disabled={!edited} onClick={() => setC((x) => ({ ...x, edits: {} }))}><RotateCcwIcon aria-hidden="true" />Reset to the pattern</Button>
      </div>
      <div className="scroll max-h-72">
        <table id="carTable">
          <thead><tr><th>Age</th><th>Year</th><th>Pay, today&apos;s dollars</th></tr></thead>
          <tbody>
            {years.map((y) => (
              <tr key={y.age} className={cn(y.age === ageNow && "font-semibold")}>
                <td>{y.age}{y.age === ageNow ? <span className="ml-1.5 font-normal text-muted-foreground">now</span> : null}{y.edited ? <span className="ml-1.5 font-normal text-primary">set by hand</span> : null}</td>
                <td>{y.year}</td>
                <td className="py-1">
                  <Affixed prefix="$" className="w-40">
                    <MoneyInput nonNeg aria-label={"Pay at " + y.age} value={y.edited ? c.edits[String(y.age)] : groupDigits(Math.round(y.pay), true)}
                      onValueChange={(v) => setC((x) => ({ ...x, edits: { ...x.edits, [String(y.age)]: v } }))} />
                  </Affixed>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="formactions mt-3">
        <Button variant="outline" className="flex-1" onClick={onClose}>Cancel</Button>
        <Button className="flex-1" onClick={() => { onClose(); apply(c); }}>Use this career: {money(est.pia)} a month</Button>
      </div>
    </Modal>
  );
}
