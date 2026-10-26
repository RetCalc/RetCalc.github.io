"use client";

/* When to claim Social Security: a claiming age from 62 to 70, the monthly
   benefit as a share of the full-retirement-age amount (full retirement age
   67), and the total collected by each age at death, in today's dollars. */

import { useId, useState } from "react";
import { NativeRange } from "@/components/ui/native-range";
import { Chart, fmt } from "../Chart";

export const CLAIM = { pia: 2000 };

/** The share of the full benefit at each claiming age, for full retirement
    age 67: 5/9 of 1% per month for the first 36 months early, 5/12 of 1%
    for each month before that, and 8% per year of delay to 70. */
export function claimShare(age: number, fra = 67): number {
  const months = Math.round((age - fra) * 12);
  if (months >= 0) return 1 + (Math.min(months, (70 - fra) * 12) * 2) / 3 / 100;
  const early = -months;
  return 1 - (Math.min(early, 36) * 5) / 9 / 100 - (Math.max(0, early - 36) * 5) / 12 / 100;
}

/** Benefits collected by each age at death, claiming at `claim`. */
export function lifetime(claim: number, ages: number[], pia = CLAIM.pia): number[] {
  const m = pia * claimShare(claim);
  return ages.map((d) => Math.max(0, d - claim) * 12 * m);
}

export function ClaimAge({ label }: { label: string }) {
  const [claim, setClaim] = useState(67);
  const id = useId();
  const ages = Array.from({ length: 100 - 62 + 1 }, (_, i) => 62 + i);
  const share = claimShare(claim);
  // Where claiming at `claim` overtakes claiming at 62.
  const even = claim > 62 ? (claim * share - 62 * claimShare(62)) / (share - claimShare(62)) : null;
  return (
    <>
      <Chart label={label} spec={{
        type: "line", x: ages, xLabel: "Age at death", y: "money",
        series: [
          { name: `Claim at ${claim}`, values: lifetime(claim, ages), tone: "accent" },
          ...(claim !== 62 ? [{ name: "Claim at 62", values: lifetime(62, ages), tone: "muted" as const, dash: true }] : []),
          ...(claim !== 70 ? [{ name: "Claim at 70", values: lifetime(70, ages), tone: "neutral" as const, dash: true }] : []),
        ],
      }} />
      <div className="lrn-mover">
        <label htmlFor={id}>Claim at age</label>
        <NativeRange id={id} min={62} max={70} value={claim} onChange={(e) => setClaim(+e.target.value)} />
        <output htmlFor={id}>{claim}</output>
      </div>
      <p className="lrn-readout">
        With a full benefit of {fmt(CLAIM.pia, "money", false)} per month at 67, claiming at {claim} pays <b>{fmt(Math.round(CLAIM.pia * share), "money", false)} per month</b> ({Math.round(share * 1000) / 10}% of the full amount) for life.
        {even ? <> It overtakes claiming at 62 in total collected at about age <b>{Math.round(even * 10) / 10}</b>.</> : null}
      </p>
    </>
  );
}
