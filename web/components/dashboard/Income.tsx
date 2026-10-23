"use client";

/* Income: each person's pay, what employers add to savings, and money
   coming in besides pay, with what it all comes to per month. */

import { BanknoteIcon, Building2Icon, PlusIcon, Trash2Icon, WalletIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Affixed, MoneyField, SelectField } from "@/components/fields/Field";
import { MoneyInput } from "@/components/fields/NumberInput";
import { Frame } from "./Frame";
import { PayFields, StateField, num, txt, type PKey } from "./fields";
import { money, money10 } from "./format";
import { answers, contribMonth, couple, nameOf, otherMonth, outsideUS, people, grossYear } from "./model";
import { newId, useDashboard, type Person, type Profile } from "./store";
import { Tile } from "./ui";

export function Income() {
  const { data, setProfile: set } = useDashboard();
  const pr = data.profile, two = couple(pr), abroad = outsideUS(pr);
  const keys: PKey[] = two ? ["p1", "p2"] : ["p1"];
  const setP = (k: PKey, v: Partial<Person>) => set((p) => ({ ...p, [k]: { ...p[k], ...v } }));
  const A = answers(pr, data.entries);
  const gross = people(pr).reduce((s, p) => s + (grossYear(p) ?? 0), 0);
  const saving = (contribMonth(pr) ?? 0) + (pr.employer ?? 0);
  const rate = gross > 0 ? (saving * 12) / gross : null;
  const putOther = (id: string, v: Partial<Profile["other"][number]>) => set((p) => ({ ...p, other: p.other.map((o) => (o.id === id ? { ...o, ...v } : o)) }));
  return (
    <Frame current="income" title="Income" sub={A.takehome ? `About ${money10(A.takehome)} per month coming in, after taxes` : "What comes in"}>
      <Tile icon={BanknoteIcon} title="Coming in">
        <div className="dsh-stats">
          <div className="dsh-stat"><div className="dsh-label">Take-home, all together</div><div className="dsh-fig dsh-key">{A.takehome ? money10(A.takehome) : "—"}<small>per month</small></div></div>
          {!abroad ? <div className="dsh-stat"><div className="dsh-label">Pay before taxes</div><div className="dsh-fig dsh-md">{gross ? money(gross) : "—"}<small>per year</small></div></div> : null}
          <div className="dsh-stat"><div className="dsh-label">Saving, with employers</div><div className="dsh-fig dsh-md">{money(saving)}<small>per month</small></div></div>
          {rate != null ? <div className="dsh-stat"><div className="dsh-label">Savings rate</div><div className="dsh-fig dsh-md">{Math.round(rate * 1000) / 10}%</div></div> : null}
        </div>
      </Tile>
      <div className="dsh-grid dsh-two">
        <Tile icon={BanknoteIcon} title="Pay">
          <div className="dsh-fields dsh-fields-sm">
            <div className="dsh-row"><StateField id="dshIState" value={pr.state} onChange={(v) => set((p) => ({ ...p, state: v }))} /><div /></div>
            {keys.map((k) => <div className="dsh-person" key={k}><h3>{nameOf(pr, k === "p1" ? 0 : 1)}</h3><PayFields pr={pr} k={k} setP={setP} /></div>)}
          </div>
        </Tile>
        <div className="dsh-side">
          <Tile icon={Building2Icon} title="What employers add">
            <div className="dsh-fields dsh-fields-sm"><div className="dsh-row">
              <MoneyField id="dshIEmp" label="Added to your savings" unit="per month" value={txt(pr.employer)} onValueChange={(v) => set((p) => ({ ...p, employer: num(v) }))} />
              <SelectField id="dshIMatch" label="Getting the whole match?" value={pr.match ?? ""} onChange={(v) => set((p) => ({ ...p, match: (v || null) as Profile["match"] }))}>
                <option value="">Not sure</option><option value="full">Yes, all of it</option><option value="partial">Not all of it</option><option value="none">No match offered</option>
              </SelectField>
            </div></div>
            <p className="dsh-cap dsh-mt">A match is free money: not getting all of it lowers your readiness score&apos;s savings rate.</p>
          </Tile>
          <Tile icon={WalletIcon} title="Other income" right={<span className="dsh-cap">{otherMonth(pr) ? money(otherMonth(pr)) + " per month" : null}</span>}>
            <p className="dsh-cap dsh-mt6">Side work, rent from a property, anything else that comes in now. After taxes.</p>
            <div className="dsh-elist">
              {pr.other.map((o) => (
                <div className="dsh-erow dsh-erow-3" key={o.id}>
                  <Input aria-label="What it is" value={o.name} placeholder="Side work" onChange={(e) => putOther(o.id, { name: e.target.value })} />
                  <Affixed prefix="$" suffix="per month"><MoneyInput aria-label="Amount per month" nonNeg value={txt(o.amount)} onValueChange={(v) => putOther(o.id, { amount: num(v) })} /></Affixed>
                  <Button variant="ghost" size="icon" aria-label={"Remove " + (o.name || "this income")} onClick={() => set((p) => ({ ...p, other: p.other.filter((x) => x.id !== o.id) }))}><Trash2Icon aria-hidden="true" /></Button>
                </div>
              ))}
              <Button variant="outline" size="sm" onClick={() => set((p) => ({ ...p, other: [...p.other, { id: newId(), name: "", amount: null }] }))}><PlusIcon aria-hidden="true" />Add income</Button>
            </div>
          </Tile>
        </div>
      </div>
    </Frame>
  );
}
