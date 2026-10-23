"use client";

/* Income: each person's pay, the employer's 401(k) match ("X% on the first
   Y% of pay", as the Paycheck tab has it), other income, and Social
   Security: estimated from today's pay, typed from a statement, or worked
   out from the pay history in the Social Security Calculator's own editor. */

import { useState } from "react";
import { BanknoteIcon, Building2Icon, IdCardIcon, PlusIcon, Trash2Icon, WalletIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Affixed, MoneyField, NumberField, SelectField } from "@/components/fields/Field";
import { MoneyInput } from "@/components/fields/NumberInput";
import { social, type SocialInputs, type Who } from "@/tools/social/model";
import { PayYears } from "@/tools/social/PayYears";
import type { BudgetInputs } from "@/tools/budget/model";
import { Frame } from "./Frame";
import { PayFields, StateField, num, txt, type PKey } from "./fields";
import { budgetFor, flow, fromBudget, socialBenefits, socialFor } from "./flows";
import { money, money10 } from "./format";
import { couple, nameOf, otherMonth, outsideUS, results, yearAt } from "./model";
import { newId, useDashboard, type Person, type Profile } from "./store";
import { Note, Tile } from "./ui";

/** When each of you claims: the same ages Retirement shows, changed in either place. */
export function ClaimField({ pr, set, i = 0 }: { pr: Profile; set: (f: (p: Profile) => Profile) => void; i?: 0 | 1 }) {
  const v = i ? pr.ss.claim2 : pr.ss.claim;
  return (
    <SelectField id={"dshClaim" + i} label={`${nameOf(pr, i)} claims`} value={String(v ?? "")} onChange={(x) => set((p) => ({ ...p, ss: { ...p.ss, ...(i ? { claim2: x ? Number(x) : null } : { claim: x ? Number(x) : null }) } }))}>
      <option value="">At 67, or at retirement if later</option>
      {[62, 63, 64, 65, 66, 67, 68, 69, 70].map((a) => <option key={a} value={a}>At {a}{a === 70 ? " (the most per month)" : a === 62 ? " (the earliest)" : ""}</option>)}
    </SelectField>
  );
}

/** The Social Security Calculator's pay-year-by-year editor, for each of
    you, in a pop-up; saving it sets each benefit from the pay history. */
function PayHistory({ pr, set, close }: { pr: Profile; set: (f: (p: Profile) => Profile) => void; close: () => void }) {
  const [s, setS] = useState<SocialInputs>(() => socialFor(pr));
  const [who, setWho] = useState<Who>("you");
  const S = social(s), both = s.status === "m";
  const setP = (key: keyof SocialInputs["you"]) => (v: string) => setS((c) => ({ ...c, [who]: { ...c[who], [key]: v } }));
  const setEdits = (f: (e: Record<string, string>) => Record<string, string>) => setS((c) => ({ ...c, [who]: { ...c[who], edits: f(c[who].edits) } }));
  const B = socialBenefits(s);
  const save = () => {
    set((p) => ({ ...p, tools: { ...p.tools, social: s as unknown as Profile["tools"]["social"] }, ss: { ...p.ss, own1: Math.round(B.you), own2: B.spouse != null ? Math.round(B.spouse) : p.ss.own2, checked: true } }));
    close();
  };
  return (
    <div className="dsh-payhist">
      <h2 id="dshPayTitle" className="dsh-dlg-h">Your pay, year by year</h2>
      <p className="dsh-cap">Social Security averages your best 35 years of pay. Type what you earned in past years (your statement at ssa.gov lists them), and what you expect ahead in today&apos;s dollars.</p>
      <PayYears who={who} setWho={setWho} both={both} inputs={s[who]} person={who === "you" ? S.you : S.spouse!} setP={setP} setEdits={setEdits} />
      <div className="dsh-stats">
        <div className="dsh-stat"><div className="dsh-label">{nameOf(pr, 0)}: benefit at full retirement age</div><div className="dsh-fig dsh-md">{money10(B.you)}<small>per month</small></div></div>
        {B.spouse != null ? <div className="dsh-stat"><div className="dsh-label">{nameOf(pr, 1)}</div><div className="dsh-fig dsh-md">{money10(B.spouse)}<small>per month</small></div></div> : null}
      </div>
      <div className="dsh-navbtns"><DialogClose render={<Button variant="outline" />}>Cancel</DialogClose><Button onClick={save}>Use in my plan</Button></div>
    </div>
  );
}

export function Income() {
  const { data, setProfile: set } = useDashboard();
  const pr = data.profile, two = couple(pr), abroad = outsideUS(pr);
  const keys: PKey[] = two ? ["p1", "p2"] : ["p1"];
  const setP = (k: PKey, v: Partial<Person>) => set((p) => ({ ...p, [k]: { ...p[k], ...v } }));
  const F = flow(pr), b = F.b, R = results(pr, data.entries);
  const [hist, setHist] = useState(false);
  const putB = (v: Partial<BudgetInputs>) => set((p) => fromBudget(p, { ...budgetFor(p), ...v }));
  const putOther = (id: string, v: Partial<Profile["other"][number]>) => set((p) => ({ ...p, other: p.other.map((o) => (o.id === id ? { ...o, ...v } : o)) }));
  const twoIncomes = b.pcStatus === "m2";
  const matchRow = (i: 0 | 1) => {
    const rate = i ? b.pcMatchRate2 : b.pcMatchRate, upTo = i ? b.pcMatchUpTo2 : b.pcMatchUpTo;
    return (
      <div className="dsh-row3" key={i}>
        <div className="dsh-who dsh-self-end">{nameOf(pr, i)}&apos;s employer</div>
        <NumberField id={"dshMr" + i} label="Matches" unit="%" step={5} max={200} value={rate} onValueChange={(v) => putB(i ? { pcMatchRate2: v } : { pcMatchRate: v })} />
        <NumberField id={"dshMu" + i} label="On the first" unit="% of pay" step={1} max={100} value={upTo} onValueChange={(v) => putB(i ? { pcMatchUpTo2: v } : { pcMatchUpTo: v })} />
      </div>
    );
  };
  return (
    <Frame current="income" title="Income" sub={R.takehome ? `About ${money10(R.takehome)} per month coming in, after taxes` : "What comes in"}>
      <Tile icon={BanknoteIcon} title="Coming in">
        <div className="dsh-stats">
          <div className="dsh-stat"><div className="dsh-label">After taxes, all together</div><div className="dsh-fig dsh-key">{R.takehome ? money10(R.takehome) : "—"}<small>per month</small></div></div>
          {!abroad ? <div className="dsh-stat"><div className="dsh-label">Pay before taxes</div><div className="dsh-fig dsh-md">{F.gross ? money(F.gross * 12) : "—"}<small>per year</small></div></div> : null}
          {!abroad ? <div className="dsh-stat"><div className="dsh-label">Employer match</div><div className="dsh-fig dsh-md">{money10(F.match)}<small>per month</small></div></div> : null}
          {otherMonth(pr) ? <div className="dsh-stat"><div className="dsh-label">Other income</div><div className="dsh-fig dsh-md">{money(otherMonth(pr))}<small>per month</small></div></div> : null}
        </div>
      </Tile>
      <div className="dsh-grid dsh-two">
        <Tile id="pay" icon={BanknoteIcon} title="Pay">
          <div className="dsh-fields dsh-fields-sm">
            <div className="dsh-row"><StateField id="dshIState" value={pr.state} onChange={(v) => set((p) => ({ ...p, state: v }))} /><div /></div>
            {keys.map((k) => <div className="dsh-person" key={k}><h3>{nameOf(pr, k === "p1" ? 0 : 1)}</h3><PayFields pr={pr} k={k} setP={setP} /></div>)}
          </div>
        </Tile>
        <div className="dsh-side">
          {!abroad ? (
            <Tile id="match" icon={Building2Icon} title="Employer 401(k) match">
              <div className="dsh-fields dsh-fields-sm">{[matchRow(0), ...(twoIncomes ? [matchRow(1)] : [])]}</div>
              <p className="dsh-cap dsh-mt">
                {F.fullMatch == null ? "Set the match to 0% if there isn't one." : F.fullMatch ? "You're saving enough to get all of it." : "You're not saving enough to get all of it: see Savings."}
              </p>
            </Tile>
          ) : null}
          <Tile id="other-income" icon={WalletIcon} title="Other income" right={<span className="dsh-cap">{otherMonth(pr) ? money(otherMonth(pr)) + " per month" : null}</span>}>
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

      <div className="dsh-r4">
        {abroad ? <Note>Outside the US, Social Security isn&apos;t counted.</Note> : (
          <Tile id="social-security" icon={IdCardIcon} title="Social Security" right={<span className={pr.ss.checked ? "dsh-badge dsh-gain" : "dsh-badge"}>{pr.ss.checked ? (pr.tools.social ? "From your pay history" : "Checked") : "Estimated"}</span>}>
            <p className="dsh-cap dsh-mt6">We estimate each benefit from today&apos;s pay. Type the figure from your statement at ssa.gov, or work it out from your pay history.</p>
            <div className="dsh-fields dsh-fields-sm">
              {(two ? [0, 1] as const : [0] as const).map((i) => (
                <div className="dsh-perrow" key={i}>
                  <MoneyField id={"dshISs" + i} label={`${nameOf(pr, i)}: benefit at full retirement age`} unit="per month" placeholder="Estimated"
                    value={txt(i ? pr.ss.own2 : pr.ss.own1)} onValueChange={(v) => set((p) => ({ ...p, ss: { ...p.ss, ...(i ? { own2: num(v) } : { own1: num(v) }), checked: true } }))} />
                  <ClaimField pr={pr} set={set} i={i} />
                  <div><div className="dsh-label">Claimed at {(i ? R.claim2 : R.claim1) ?? "—"}{(i ? pr.p2 : pr.p1).by ? `, in ${yearAt(i ? pr.p2 : pr.p1, (i ? R.claim2 : R.claim1) ?? 67)}` : ""}</div>
                    <div className="dsh-fig dsh-md">{(i ? R.ss2 : R.ss1) != null ? money10((i ? R.ss2 : R.ss1)!) : "—"}<small>per month</small></div></div>
                </div>
              ))}
              <div className="dsh-perrow">
                <div className="dsh-self-end"><Button variant="outline" onClick={() => setHist(true)}>Estimate from my pay history</Button></div>
                <div className="dsh-self-end">{pr.ss.checked ? <Button variant="link" size="inline" onClick={() => set((p) => ({ ...p, ss: { ...p.ss, own1: null, own2: null, checked: false } }))}>Back to the estimate</Button> : null}</div>
              </div>
            </div>
          </Tile>
        )}
      </div>
      <Dialog open={hist} onOpenChange={setHist}>
        <DialogContent size="table" aria-labelledby="dshPayTitle">{hist ? <PayHistory pr={pr} set={set} close={() => setHist(false)} /> : null}</DialogContent>
      </Dialog>
    </Frame>
  );
}
