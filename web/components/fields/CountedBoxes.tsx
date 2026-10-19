"use client";

/* A number of things, then one small box for each, side by side (wrapping
   on a phone): "How many children do you have now?" and each one's age.
   Changing the count adds or drops boxes at the end and keeps what's typed
   in the rest. The values are kept as typed text, one per box. */

import { useState } from "react";
import { Affixed } from "./Field";
import { NumberInput } from "./NumberInput";
import { Label } from "@/components/ui/label";

export function CountedBoxes({ id, countLabel, countAffix, max, values, onChange, boxLabel, boxAffix, boxMax, fill = "", half }: {
  id: string;
  countLabel: React.ReactNode;
  countAffix: string;
  max: number;
  /** One per box, as typed. */
  values: string[];
  onChange: (values: string[]) => void;
  /** Each box's label, from its index. */
  boxLabel: (i: number) => string;
  boxAffix: string;
  boxMax?: number;
  /** What a new box starts with. */
  fill?: string;
  /** The count as wide as a field in a two-column grid with gap-x-3 (its
      neighbours below), not its own narrow width. */
  half?: boolean;
}) {
  // The count as typed, so it can be cleared to type another.
  const [count, setCount] = useState(values.length ? String(values.length) : "");
  const setN = (t: string) => {
    setCount(t);
    const n = Math.max(0, Math.min(max, Math.round(Number(t) || 0)));
    onChange(Array.from({ length: n }, (_, i) => values[i] ?? fill));
  };
  return (
    <div className="col-span-full">
      <div className={half ? "grid grid-cols-2 gap-x-3 max-sm:grid-cols-1" : "max-w-56"}>
        <div>
          <Label className="mb-1.5" htmlFor={id}><span>{countLabel}</span></Label>
          <Affixed suffix={countAffix}><NumberInput id={id} nonNeg max={max} value={count} onValueChange={setN} /></Affixed>
        </div>
      </div>
      {values.length ? (
        <div className="mt-2.5 flex flex-wrap gap-2.5">
          {values.map((v, i) => (
            <div key={i} className="w-34">
              <Label className="mb-1" htmlFor={id + "-" + i}><span className="text-label text-muted-foreground">{boxLabel(i)}</span></Label>
              <Affixed suffix={boxAffix}><NumberInput id={id + "-" + i} nonNeg max={boxMax} value={v}
                onValueChange={(x) => onChange(values.map((y, j) => (j === i ? x : y)))} /></Affixed>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
