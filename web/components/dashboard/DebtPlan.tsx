"use client";

/* Plan payments, on Net worth: the Debt Payoff tool cut down to your own
   debts (all but the mortgage, which Home has). Each one's balance and rate
   come from the latest entry; you say what you'll pay on it a month, and
   see when it's paid off. A card paid in full every month isn't a debt to
   pay down, and a car loan can be one the next car's payment replaces.
   Added to the plan, each payment is a line in the budget until the debt is
   paid off; then it goes to saving (debts.ts). */

import { useMemo, useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Affixed } from "@/components/fields/Field";
import { MoneyInput, NumberInput } from "@/components/fields/NumberInput";
import { groupDigits, parseNum } from "@/lib/format";
import { money } from "./format";
import { kindName } from "./kinds";
import { interestOnly, linesOf, payoff, PLAN_KINDS } from "./debts";
import { pctTxt, useTyped } from "./fields";
import type { DebtKind, DebtPay, DebtPlan, Item } from "./store";

/** A month from now (1 is next month) as "Mar 2029". */
export function monthName(m: number, now = new Date()): string {
  const d = new Date(now.getFullYear(), now.getMonth() + m, 1);
  return d.toLocaleDateString("en-US", { month: "short", year: "numeric" });
}
/** Months as "2 years 3 months". */
function span(m: number): string {
  const y = Math.floor(m / 12), r = m % 12;
  return [y ? `${y} year${y === 1 ? "" : "s"}` : "", r ? `${r} month${r === 1 ? "" : "s"}` : ""].filter(Boolean).join(" ") || "under a month";
}

/** The debts Plan payments covers on an entry. */
export const plannable = (items: Item[]) => items.filter((i) => i.side === "debt" && PLAN_KINDS.includes(i.kind as DebtKind) && i.value > 0);

interface Row { id: string; name: string; kind: DebtKind; balance: number; rate: number | null; pay: string; full: boolean; replace: boolean }

/** What Add to plan hands back: the plan (null: none), the rates typed in
    here for debts that had none, and the budget's own lines to empty. */
export interface DebtPlanSave { plan: DebtPlan | null; rates: Record<string, number>; clear: string[] }

export function DebtPlanDialog({ items, plan, budgetLines, onSave, onClose }: {
  items: Item[]; plan: DebtPlan | undefined;
  /** The budget's own debt lines with an amount (Other debt payments, Car payment), a month. */
  budgetLines: { slot: string; name: string; monthly: number }[];
  onSave: (s: DebtPlanSave) => void; onClose: () => void;
}) {
  const [rows, setRows] = useState<Row[]>(() => plannable(items).map((i) => {
    const p = plan?.debts.find((d) => d.id === i.id);
    return { id: i.id, name: i.name || kindName(i.kind), kind: i.kind as DebtKind, balance: i.value, rate: i.rate ?? null,
      pay: p && p.pay > 0 ? groupDigits(p.pay, true) : "", full: !!p?.full, replace: p ? !!p.replace : i.kind === "car" };
  }));
  const [roll, setRoll] = useState(plan?.roll ?? true);
  // The budget's own debt lines: emptied on adding, unless kept.
  const [clear, setClear] = useState<Set<string>>(() => new Set(budgetLines.map((l) => l.slot)));
  const put = (id: string, v: Partial<Row>) => setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...v } : r)));
  const debts = useMemo(() => rows.map((r) => ({ id: r.id, name: r.name, kind: r.kind, pay: parseNum(r.pay) || 0, full: r.full, replace: r.replace, balance: r.balance, rate: r.rate ?? 0 })), [rows]);
  const P = useMemo(() => payoff(linesOf(debts), roll), [debts, roll]);
  const live = linesOf(debts), last = live.length && live.every((l) => P.paid[l.id] != null) ? Math.max(...live.map((l) => P.paid[l.id]!)) : null;
  const planned = debts.filter((d) => d.full || d.pay > 0);
  // A car loan the next car replaces is paid off on its own (nothing rolls into or out of it).
  const carOff = (id: string) => { const d = debts.find((x) => x.id === id); return d ? payoff(linesOf([{ ...d, replace: false }]), false).paid[id] ?? null : null; };
  const missingRate = rows.some((r) => r.rate == null && !r.full && parseNum(r.pay) > 0);
  const save = () => {
    const out: DebtPay[] = planned.map((d) => ({ id: d.id, name: d.name, kind: d.kind, pay: d.full ? 0 : d.pay, ...(d.full ? { full: true } : {}), ...(d.kind === "car" && d.replace ? { replace: true } : {}) }));
    const rates = Object.fromEntries(rows.filter((r) => r.rate != null && items.find((i) => i.id === r.id)?.rate == null).map((r) => [r.id, r.rate!]));
    onSave({ plan: out.length ? { roll, debts: out } : null, rates, clear: out.length ? [...clear] : [] });
  };
  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent size="household" aria-labelledby="dshDebtTitle">
        <h2 id="dshDebtTitle" className="dsh-dlg-h">Plan your debt payments</h2>
        <p className="dsh-cap dsh-mt6">Say what you&apos;ll pay on each debt a month. Each payment goes in your budget until the debt is paid off; after that, what you were paying goes to saving. Payments stay the same in dollars, so they shrink a little each year after inflation. Your mortgage is set on Your home.</p>
        <div className="dsh-debtplan">
          {rows.map((r) => {
            const pay = parseNum(r.pay) || 0, rate = r.rate ?? 0, io = interestOnly(r.balance, rate), m = P.paid[r.id];
            const replaced = r.kind === "car" && r.replace;
            return (
              <section key={r.id} className="dsh-debtrow" aria-label={r.name}>
                <div className="dsh-debthead"><b>{r.name}</b><span className="dsh-muted">{kindName(r.kind)} · {money(r.balance)} owed{r.rate != null ? " at " + pctTxt(r.rate) + "%" : ""}</span></div>
                <div className="dsh-debtfields">
                  {r.kind === "card" ? (
                    <label className="dsh-check"><Checkbox checked={r.full} onCheckedChange={(v) => put(r.id, { full: !!v })} />I pay it off in full every month</label>
                  ) : null}
                  {r.full ? null : <>
                    <div className="dsh-ef"><span className="dsh-label">Monthly payment</span>
                      <Affixed prefix="$" suffix="/mo"><MoneyInput aria-label={r.name + ", monthly payment"} nonNeg value={r.pay} placeholder={io > 0 ? groupDigits(Math.ceil(io + r.balance * 0.01), true) : ""} onValueChange={(v) => put(r.id, { pay: v })} /></Affixed>
                    </div>
                    {r.rate == null ? <div className="dsh-ef"><span className="dsh-label">Interest rate</span><RateField onRate={(v) => put(r.id, { rate: v })} name={r.name} /></div> : null}
                  </>}
                  {r.kind === "car" ? (
                    <label className="dsh-check"><Checkbox checked={r.replace} onCheckedChange={(v) => put(r.id, { replace: !!v })} />Replace it with another car payment once it&apos;s paid off</label>
                  ) : null}
                </div>
                <p className="dsh-cap" aria-live="polite">{r.full ? "Nothing to plan: what you charge is part of your spending."
                  : !(pay > 0) ? (io > 0 ? `Interest alone is ${money(io)} a month.` : "Not in your plan until it has a payment.")
                  : pay <= io + 0.005 ? <span className="dsh-warn">{money(pay)} a month doesn&apos;t cover the {money(io)} of interest, so it never gets paid off.</span>
                  : replaced ? `${carOff(r.id) != null ? `Paid off ${monthName(carOff(r.id)!)}; then` : "At this payment,"} the payment carries on for the next car, so it stays in your spending.`
                  : m != null ? `Paid off ${monthName(m)}, in ${span(m)}, with ${money(P.interest[r.id] ?? 0)} of interest.` : "Never paid off at this payment."}</p>
              </section>
            );
          })}
        </div>
        {live.length > 1 ? (
          <label className="dsh-check dsh-mt"><Checkbox checked={roll} onCheckedChange={(v) => setRoll(!!v)} />When one is paid off, put its payment toward the next (highest rate first)</label>
        ) : null}
        {live.length ? <p className="dsh-cap dsh-mt6"><b>{last != null ? `All paid off by ${monthName(last)}` : "Not all paid off at these payments"}</b>{P.total > 0 ? `, ${money(P.total)} of interest in all.` : "."}{live.length > 1 && roll ? " Rolling payments over pays them off sooner and costs less interest." : ""}</p> : null}
        {planned.length && budgetLines.length ? (
          <div className="dsh-mt">
            {budgetLines.map((l) => (
              <label key={l.slot} className="dsh-check"><Checkbox checked={clear.has(l.slot)} onCheckedChange={(v) => setClear((c) => { const n = new Set(c); if (v) n.add(l.slot); else n.delete(l.slot); return n; })} />
                Replace the {money(l.monthly)} a month in your budget&apos;s {l.name} with these</label>
            ))}
          </div>
        ) : null}
        {missingRate ? <p className="dsh-cap dsh-warn dsh-mt6">Add the interest rate for each debt you&apos;re paying, so its payoff date is right.</p> : null}
        <div className="dsh-navbtns dsh-wrapbtns">
          <Button onClick={save} disabled={missingRate}>{planned.length ? (plan ? "Update plan" : "Add to plan") : plan ? "Take out of plan" : "Add to plan"}</Button>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** An interest rate typed here for a debt that has none on Net worth. */
function RateField({ onRate, name }: { onRate: (r: number | null) => void; name: string }) {
  const [text, setText] = useTyped(pctTxt(null));
  return (
    <Affixed suffix="%">
      <NumberInput aria-label={name + ", interest rate"} nonNeg step={0.25} max={40} value={text}
        onValueChange={(v) => { setText(v); onRate(v.trim() === "" ? null : parseNum(v) / 100); }} />
    </Affixed>
  );
}
