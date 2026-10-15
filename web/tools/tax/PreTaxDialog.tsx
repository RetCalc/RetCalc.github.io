"use client";

/* The Pre-tax deductions pop-up: the one figure broken down by kind, and on
   a joint return by earner, since each kind comes off different taxes (and
   some states keep a few in their base). As it's filled in it says what
   the breakdown does to the year's taxes, and flags anything over the
   year's contribution limits. "Use these deductions" puts its total in the
   field; "Go back to one figure" keeps the total and drops the breakdown. */

import { useState } from "react";
import { CircleAlertIcon } from "lucide-react";
import { Modal } from "@/components/shell/Modal";
import { Button } from "@/components/ui/button";
import { Affixed } from "@/components/fields/Field";
import { MoneyInput } from "@/components/fields/NumberInput";
import { yearData } from "@/lib/engine/typed";
import { groupDigits, money, parseNum } from "@/lib/format";
import { PRE_ROWS, type PreField, type TaxInputs, runTax, taxInput, taxYearOf } from "./model";

type Form = Record<PreField, string>;
type Person = { k401: number; ira: number; hsa: number; health: number; other: number; iraDed: number; covered: boolean };
type Note = { text: string; over?: boolean };

const FIELDS = PRE_ROWS.flatMap((r) => [r.you, r.spouse]) as PreField[];

export function PreTaxDialog({ s, setState, close }: {
  s: TaxInputs;
  setState: (fn: (c: TaxInputs) => TaxInputs) => void;
  close: () => void;
}) {
  const joint = s.status === "m";
  // Opened from a single figure, the breakdown starts as that figure under
  // Other, so the total holds until it's moved.
  const [f, setF] = useState<Form>(() => {
    const blank = Object.fromEntries(FIELDS.map((k) => [k, "0"])) as Form;
    if (s.itemize) return Object.fromEntries(FIELDS.map((k) => [k, s[k]])) as Form;
    return { ...blank, dother: groupDigits(parseNum(s.pre), true) };
  });
  const up = (k: PreField) => (v: string) => setF((c) => ({ ...c, [k]: v }));

  // The year's taxes with this breakdown, and with no pre-tax deductions at all.
  const R = runTax(taxInput({ ...s, ...f, itemize: true }, true));
  const none = runTax(taxInput({ ...s, itemize: false, pre: "0" }, true));
  const total = R.pre as number, saved = none.total - R.total;
  const people = (R.preTax?.people ?? []) as Person[];
  const L = yearData(taxYearOf(s)).limits;

  /* What to say under a row, for each earner: a limit gone over, or the
     part of an IRA the income test doesn't let off. */
  const notes = (kind: string): Note[] => {
    const out: Note[] = [];
    const who = (i: number) => (joint ? (i ? "Spouse: " : "You: ") : "");
    people.slice(0, joint ? 2 : 1).forEach((p, i) => {
      if (kind === "k401" && p.k401 > L.k401.base) {
        const top = L.k401.base + L.k401.catch60;
        out.push(p.k401 > top
          ? { over: true, text: who(i) + "over the " + money(top) + " most anyone can defer, even at 60 to 63." }
          : { text: who(i) + "over the " + money(L.k401.base) + " limit, so this counts on a catch-up: " + money(L.k401.catch50) +
              " more from 50, or " + money(L.k401.catch60) + " at 60 to 63." });
      }
      if (kind === "ira" && p.ira > 0) {
        const top = L.ira.base + L.ira.catch50;
        if (p.ira > top) out.push({ over: true, text: who(i) + "over the " + money(top) + " limit, even from 50." });
        else if (p.ira > L.ira.base) out.push({ text: who(i) + "over " + money(L.ira.base) + ", fine only from 50 (" + money(L.ira.catch50) + " more)." });
        if (p.iraDed < Math.min(p.ira, top)) {
          const why = p.covered ? "with a plan at work" : "with your spouse's plan at work";
          out.push({ text: who(i) + (p.iraDed > 0 ? "only " + money(p.iraDed) + " of this is deductible" : "none of this is deductible") +
            " at your income " + why + ". The rest still goes in, after tax." });
        }
      }
      if (kind === "hsa" && p.hsa > L.hsa.self && !joint)
        out.push(p.hsa > L.hsa.family + L.hsa.catch55
          ? { over: true, text: "Over the " + money(L.hsa.family + L.hsa.catch55) + " most an HSA takes, with family coverage from 55." }
          : { text: "Over the " + money(L.hsa.self) + " self-only limit: fine with family coverage (" + money(L.hsa.family) + ", plus " + money(L.hsa.catch55) + " from 55)." });
    });
    // On a joint return the family limit is one between the two of you.
    if (kind === "hsa" && joint) {
      const both = people[0].hsa + people[1].hsa, top = L.hsa.family + 2 * L.hsa.catch55;
      if (both > top) out.push({ over: true, text: "Together over " + money(top) + ", the most a couple can put in, with both 55 or older." });
      else if (both > L.hsa.family) out.push({ text: "Together over the " + money(L.hsa.family) + " family limit: fine only with catch-ups from 55 (" + money(L.hsa.catch55) + " each)." });
    }
    return out;
  };

  const use = () => {
    setState((c) => ({ ...c, ...f, itemize: true, pre: groupDigits(total, true) }));
    close();
  };
  const clear = () => {
    setState((c) => ({ ...c, itemize: false, pre: groupDigits(parseNum(c.pre), true) }));
    close();
  };

  return (
    <Modal size={joint ? "study" : "wide"} onClose={close} focus="[data-pre]">
      <h3>Pre-tax deductions</h3>
      <div className="formhint">
        A year of each. Every kind comes off federal income tax; some also come off Social Security and Medicare,
        and some states tax a few of them anyway.
      </div>
      {joint ? (
        <div className="flex gap-3 pb-1 text-label text-muted-foreground" aria-hidden="true">
          <span className="flex-1 max-sm:hidden" /><span className="w-28 flex-none max-sm:flex-1">You</span><span className="w-28 flex-none max-sm:flex-1">Spouse</span>
        </div>
      ) : null}
      {PRE_ROWS.map((r) => {
        const ns = notes(r.kind);
        return (
          <div className="border-b border-border py-2" key={r.kind}>
            {/* On a phone the amounts drop under the name, side by side. */}
            <div className="flex items-start gap-x-3 gap-y-2 max-sm:flex-wrap">
              <div className="min-w-0 flex-1 text-note max-sm:basis-full">
                <b>{r.name}</b>
                <small className="mt-0.5 block text-label text-muted-foreground">{r.desc}</small>
              </div>
              <Affixed prefix="$" className="w-28 flex-none max-sm:w-auto max-sm:flex-1">
                <MoneyInput nonNeg data-pre={r.you} aria-label={r.name + (joint ? ", you" : "")} value={f[r.you]} onValueChange={up(r.you)} />
              </Affixed>
              {joint ? (
                <Affixed prefix="$" className="w-28 flex-none max-sm:w-auto max-sm:flex-1">
                  <MoneyInput nonNeg aria-label={r.name + ", spouse"} value={f[r.spouse]} onValueChange={up(r.spouse)} />
                </Affixed>
              ) : null}
            </div>
            {/* Limits and the IRA's income test, across the row's full width. */}
            {ns.map((n, i) => (
              <small key={i} className={"mt-1 flex items-start gap-1 text-label " + (n.over ? "text-destructive" : "text-muted-foreground")}>
                {n.over ? <CircleAlertIcon className="mt-px size-3.5 shrink-0" aria-hidden="true" /> : null}<span>{n.text}</span>
              </small>
            ))}
          </div>
        );
      })}
      <div className="mt-3 mb-4 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 text-note tabular-nums" id="txPreTot">
        <span>Total: <b>{money(total)}</b> a year</span>
        <span className="text-muted-foreground">
          {saved > 0.5 ? <>Lowers this year&apos;s taxes by <b className="text-foreground">{money(saved)}</b></> : "No tax saved yet"}
        </span>
      </div>
      <div className="formactions">
        {s.itemize ? <Button variant="ghost" className="mr-auto" onClick={clear}>Go back to one figure</Button> : null}
        <Button variant="outline" className={s.itemize ? undefined : "flex-1"} onClick={close}>Cancel</Button>
        <Button className={s.itemize ? undefined : "flex-1"} data-preok onClick={use}>Use these deductions</Button>
      </div>
    </Modal>
  );
}
