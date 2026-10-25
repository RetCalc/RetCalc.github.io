"use client";

/* Fields setup and the sections share: birth month and year, a choice card,
   where you live, and one person's pay. The profile holds numbers; fields
   hold text as typed. */

import type { ReactNode } from "react";
import { Segmented, SegmentedItem } from "@/components/ui/segmented";
import { MoneyField, SelectField } from "@/components/fields/Field";
import { groupDigits, parseNum } from "@/lib/format";
import { STATE_OPTIONS } from "@/lib/states";
import { MONTHS, money, money10 } from "./format";
import { answers, payYear } from "./model";
import { Tip } from "./ui";
import { OUTSIDE_US, PER_LABEL, type Per, type Person, type Profile } from "./store";

export type PKey = "p1" | "p2";
export const THIS_YEAR = new Date().getFullYear();

export const txt = (n: number | null | undefined) => (n == null ? "" : groupDigits(n, true));
export const num = (s: string) => (s.trim() === "" ? null : parseNum(s));
export const pctTxt = (v: number | null | undefined) => (v == null ? "" : String(Math.round(v * 10000) / 100));

export function years(from: number, to: number) {
  const out: number[] = [];
  for (let y = to; y >= from; y--) out.push(y);
  return out;
}

export function Choice({ on, icon, title, sub, onClick }: { on: boolean; icon: ReactNode; title: string; sub: string; onClick: () => void }) {
  return <button type="button" className="dsh-choice" aria-pressed={on} onClick={onClick}>{icon}<b>{title}</b><span>{sub}</span></button>;
}

export function BirthFields({ id, label, bm, by, from, to, optional, onChange }: { id: string; label: string; bm: number | null; by: number | null; from: number; to: number; optional?: boolean; onChange: (v: { bm?: number | null; by?: number | null }) => void }) {
  return (
    <>
      <SelectField id={id + "M"} label={label + " month"} value={String(bm ?? "")} onChange={(v) => onChange({ bm: v ? Number(v) : null })}>
        <option value="">{optional ? "Month (optional)" : "Month"}</option>
        {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
      </SelectField>
      <SelectField id={id + "Y"} label={label + " year"} value={String(by ?? "")} onChange={(v) => onChange({ by: v ? Number(v) : null })}>
        <option value="">{optional ? "Year (optional)" : "Year"}</option>
        {years(from, to).map((y) => <option key={y} value={y}>{y}</option>)}
      </SelectField>
    </>
  );
}

export function StateField({ id, value, onChange }: { id: string; value: string | null; onChange: (v: string | null) => void }) {
  return (
    <SelectField id={id} label="Where you live" value={value ?? ""} onChange={(v) => onChange(v || null)}>
      <option value="">Choose a state</option>
      {STATE_OPTIONS.map((o) => <option key={o.code} value={o.code}>{o.name}</option>)}
      <option value={OUTSIDE_US}>Outside the US</option>
    </SelectField>
  );
}

/** Each person's share of the household's take-home, by their pay. */
export function takeHomeOf(pr: Profile, k: PKey): number | null {
  const A = answers(pr), gross = (A.income ?? 0) + (A.income2 ?? 0);
  return A.takehome && gross > 0 ? (A.takehome * ((k === "p1" ? A.income : A.income2) ?? 0)) / gross : null;
}

/** One person's pay: amount, how often, before or after taxes, and what
    it comes to. */
export function PayFields({ pr, k, setP }: { pr: Profile; k: PKey; setP: (k: PKey, v: Partial<Person>) => void }) {
  const p = pr[k], y = payYear(p), abroad = pr.state === OUTSIDE_US, th = takeHomeOf(pr, k);
  return (
    <>
      <div className="dsh-row dsh-pair">
        <MoneyField id={"dshPay" + k} label={abroad ? "Pay after taxes" : "Pay"} value={txt(p.pay)} onValueChange={(v) => setP(k, { pay: num(v) })} />
        <SelectField id={"dshPer" + k} label="How often" value={p.per} onChange={(v) => setP(k, { per: v as Per })}>
          {Object.entries(PER_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </SelectField>
      </div>
      {abroad ? (y != null && p.per !== "year" ? <span className="dsh-cap"><b>{money(y)}</b> per year</span> : null) : (
        <div className="dsh-inline">
          <Segmented aria-label="Before or after taxes">
            <SegmentedItem pressed={p.taxed === "before"} onPressedChange={() => setP(k, { taxed: "before" })}>Before taxes</SegmentedItem>
            <SegmentedItem pressed={p.taxed === "after"} onPressedChange={() => setP(k, { taxed: "after" })}>After taxes</SegmentedItem>
          </Segmented>
          <Tip id="payTaxed" title="Before or after taxes" />
          <span className="dsh-cap">
            {y == null ? null : p.taxed === "after" ? <>Take-home. We&apos;ll work out the pay before taxes.</>
              : <>{p.per === "year" ? null : <><b>{money(y)}</b> per year, </>}{th ? <>{p.per === "year" ? "About" : "about"} <b>{money10(th)}</b> take-home per month</> : null}</>}
          </span>
        </div>
      )}
    </>
  );
}
