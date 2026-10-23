"use client";

/* Spending: one number per month, or a budget whose total takes its place.
   What's left after spending and saving is shown against take-home. */

import Link from "next/link";
import { PlusIcon, ReceiptIcon, Trash2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Segmented, SegmentedItem } from "@/components/ui/segmented";
import { Affixed, MoneyField } from "@/components/fields/Field";
import { MoneyInput } from "@/components/fields/NumberInput";
import { TOOLS } from "@/lib/tools";
import { Frame } from "./Frame";
import { num, txt } from "./fields";
import { money, money10 } from "./format";
import { answers, budgetMonth, spendMonth } from "./model";
import { newId, useDashboard, type BudgetLine } from "./store";
import { Note, Tile } from "./ui";

const LINES = ["Housing: rent or mortgage, taxes, insurance", "Groceries", "Transportation", "Utilities, phone and internet", "Insurance", "Health care",
  "Childcare and school", "Debt payments", "Dining out and fun", "Travel", "Giving", "Everything else"];

export function Spending() {
  const { data, setProfile: set } = useDashboard();
  const pr = data.profile, A = answers(pr, data.entries);
  const spend = spendMonth(pr) ?? 0, total = budgetMonth(pr);
  const left = A.takehome ? A.takehome - spend : null;
  const budget = pr.useBudget;
  // A new budget starts with today's one number under "Everything else",
  // so the total (and every figure) stays put until lines are filled in.
  const startBudget = () => set((p) => ({ ...p, useBudget: true, budget: p.budget.length ? p.budget
    : LINES.filter((l) => p.kids || !l.startsWith("Childcare")).map((name) => ({ id: newId(), name, amount: name === "Everything else" ? p.spend : null })) }));
  const put = (id: string, v: Partial<BudgetLine>) => set((p) => ({ ...p, budget: p.budget.map((b) => (b.id === id ? { ...b, ...v } : b)) }));
  const biggest = Math.max(...pr.budget.map((b) => b.amount ?? 0), 1);
  return (
    <Frame current="spending" title="Spending" sub={spend ? `${money(spend)} per month` : "What goes out"}>
      <Tile icon={ReceiptIcon} title="Each month" right={
        <Segmented aria-label="One number or a budget">
          <SegmentedItem pressed={!budget} onPressedChange={() => set((p) => ({ ...p, useBudget: false }))}>One number</SegmentedItem>
          <SegmentedItem pressed={budget} onPressedChange={startBudget}>A budget</SegmentedItem>
        </Segmented>
      }>
        <div className="dsh-stats">
          <div className="dsh-stat"><div className="dsh-label">Spending</div><div className="dsh-fig dsh-key">{money(spend)}<small>per month</small></div></div>
          {A.takehome ? <div className="dsh-stat"><div className="dsh-label">Coming in, after taxes</div><div className="dsh-fig dsh-md">{money10(A.takehome)}<small>per month</small></div></div> : null}
          {left != null ? <div className="dsh-stat"><div className="dsh-label">{left >= 0 ? "Left over" : "Short"}</div><div className="dsh-fig dsh-md">{money10(Math.abs(left))}<small>per month</small></div></div> : null}
        </div>
        {left != null && left < 0 ? <div className="dsh-mt"><Note>You&apos;re spending more than comes in. Check the numbers, or see where it can come from in the budget.</Note></div> : null}
        {!budget ? (
          <div className="dsh-fields dsh-fields-sm"><div className="dsh-row">
            <MoneyField id="dshSSpend" label="Spending, all together" unit="per month" value={txt(pr.spend)} onValueChange={(v) => set((p) => ({ ...p, spend: num(v) }))} />
            <div className="dsh-hint dsh-self-end">Everything that leaves your checking account, housing included. What you save isn&apos;t spending.</div>
          </div></div>
        ) : (
          <div className="dsh-cats">
            {pr.budget.map((b) => (
              <div className="dsh-cat" key={b.id}>
                <Input aria-label="Category" value={b.name} onChange={(e) => put(b.id, { name: e.target.value })} />
                <div className="dsh-catbar" aria-hidden="true"><svg viewBox="0 0 100 8" preserveAspectRatio="none"><rect x={0} y={0} height={8} width={((b.amount ?? 0) / biggest) * 100} /></svg></div>
                <Affixed prefix="$"><MoneyInput aria-label={"Per month: " + b.name} nonNeg value={txt(b.amount)} onValueChange={(v) => put(b.id, { amount: num(v) })} /></Affixed>
                <Button variant="ghost" size="icon" aria-label={"Remove " + b.name} onClick={() => set((p) => ({ ...p, budget: p.budget.filter((x) => x.id !== b.id) }))}><Trash2Icon aria-hidden="true" /></Button>
              </div>
            ))}
            <div className="dsh-inline dsh-mt6">
              <Button variant="outline" size="sm" onClick={() => set((p) => ({ ...p, budget: [...p.budget, { id: newId(), name: "", amount: null }] }))}><PlusIcon aria-hidden="true" />Add a line</Button>
              <span className="dsh-cap">Total <b>{money(total)}</b> per month, used everywhere on your dashboard. Lower &ldquo;Everything else&rdquo; as you fill in the rest.</span>
            </div>
          </div>
        )}
        <div className="dsh-foot">
          <Button variant="link" size="inline" nativeButton={false} render={<Link href="/dashboard/profile" />}>Spending once retired is set in Profile</Button>
          <Button variant="link" size="inline" nativeButton={false} render={<Link href={"/" + TOOLS.budget.path} />}>More detail: the {TOOLS.budget.name}</Button>
        </div>
      </Tile>
    </Frame>
  );
}
