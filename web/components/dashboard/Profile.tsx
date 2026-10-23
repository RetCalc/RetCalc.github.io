"use client";

/* Profile: every answer from setup on one page, each editable where it
   stands, and the plan's assumptions (growth, inflation, stocks once
   retired), which every figure on the dashboard uses. What's saved so far
   is read from Accounts and changed there. */

import Link from "next/link";
import { useState } from "react";
import { parseNum } from "@/lib/format";
import { CHILD_COST, earlyCost } from "@/tools/guide/schedule";
import { ChildCostsDialog } from "./children";
import { BabyIcon, Building2Icon, HouseIcon, SlidersHorizontalIcon, SunsetIcon, UserRoundIcon, UsersRoundIcon, BanknoteIcon, ReceiptIcon, WalletIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, MoneyField, NumberField, SelectField } from "@/components/fields/Field";
import { RISKS } from "@/lib/engine/typed";
import { Frame } from "./Frame";
import { toolHref } from "./host";
import { BirthFields, Choice, PayFields, StateField, THIS_YEAR, num, pctTxt, txt, type PKey } from "./fields";
import { money, money10 } from "./format";
import { flow } from "./flows";
import { couple, holdings, mortgage, nameOf, realGrowth, spendMonth } from "./model";
import { DEFAULT_ASSUMPTIONS, OUTSIDE_US, hasAccounts, useDashboard, withHome, type Person, type Profile as P } from "./store";
import { Note, Tile } from "./ui";

const pct = (v: number) => (Math.round(v * 1000) / 10).toFixed(1).replace(/\.0$/, "") + "%";

/** The plan's assumptions, with presets that say what each means. */
export function Assumptions({ pr, set }: { pr: P; set: (f: (p: P) => P) => void }) {
  const A = pr.assume, real = realGrowth(pr);
  const put = (v: Partial<P["assume"]>) => set((p) => ({ ...p, assume: { ...p.assume, ...v } }));
  const preset = RISKS.find((r) => Math.abs(r.real - real) < 0.0005);
  return (
    <Tile icon={SlidersHorizontalIcon} title="Assumptions" right={<span className="dsh-cap">Used by every figure on your dashboard</span>}>
      <div className="dsh-stats">
        <div className="dsh-stat"><div className="dsh-label">Savings grow, after inflation</div><div className="dsh-fig">{pct(real)}<small>per year</small></div></div>
      </div>
      <div className="dsh-label dsh-mt">Help me choose: how your savings are invested until you retire</div>
      <div className="dsh-presets">
        {RISKS.map((r) => (
          <button key={r.label} type="button" className="dsh-preset" aria-pressed={preset === r}
            onClick={() => put({ growth: (1 + r.real) * (1 + A.inflation) - 1 })}>
            <b>{r.label}</b><span>{r.sub}</span><em>{pct(r.real)} after inflation</em>
          </button>
        ))}
      </div>
      <div className="dsh-row3 dsh-mt dsh-fields-sm">
        <NumberField id="dshGrowth" label="Growth per year, before inflation" unit="%" step={0.25} max={20} value={pctTxt(A.growth)} onValueChange={(v) => put({ growth: (num(v) ?? 0) / 100 })} />
        <NumberField id="dshInfl" label="Inflation per year" unit="%" step={0.25} max={15} value={pctTxt(A.inflation)} onValueChange={(v) => put({ inflation: (num(v) ?? 0) / 100 })} />
        <NumberField id="dshStocks" label="In stocks once retired" unit="%" step={5} max={100} value={String(A.stocks)} onValueChange={(v) => put({ stocks: Math.max(0, Math.min(100, num(v) ?? 0)) })} />
      </div>
      <div className="dsh-mt"><Note>
        Until you retire, savings grow at a steady <b>{pct(real)}</b> per year after inflation ({pct(A.growth)} growth less {pct(A.inflation)} inflation). Once retired, the plan runs through <b>every market since 1926</b>, {A.stocks}% in stocks, instead of a steady rate. Every figure is in today&apos;s dollars.
      </Note></div>
      <div className="dsh-foot"><Button variant="link" size="inline" onClick={() => set((p) => ({ ...p, assume: DEFAULT_ASSUMPTIONS }))}>Back to the usual: balanced, 3% inflation, 60% in stocks</Button></div>
    </Tile>
  );
}

/** Children planned, childcare and college: their costs come out of what
    you save in the years they run, as the Guide and Stages count them. */
function Children({ pr, set }: { pr: P; set: (f: (p: P) => P) => void }) {
  const put = (v: Partial<P["planned"]>) => set((p) => ({ ...p, planned: { ...p.planned, ...v } }));
  const any = pr.kids > 0 || pr.planned.count > 0;
  const [costs, setCosts] = useState(false);
  const C = pr.childCosts, n = (v: string) => (v.trim() === "" ? null : parseNum(v));
  const early = n(C.early) ?? earlyCost(pr.childcare, pr.careArea), school = n(C.school) ?? CHILD_COST.school, teen = n(C.teen) ?? CHILD_COST.teen;
  return (
    <Tile icon={BabyIcon} title="Children ahead" right={<span className="dsh-cap">Their costs come out of what you save</span>}>
      <div className="dsh-fields dsh-fields-sm">
        <div className="dsh-row3">
          <SelectField id="dshPPlanned" label="Children planned" value={String(pr.planned.count)} onChange={(v) => put({ count: Number(v) })}>
            {[0, 1, 2, 3, 4, 5, 6].map((n) => <option key={n} value={n}>{n}</option>)}
          </SelectField>
          {pr.planned.count > 0 ? <NumberField id="dshPFirstIn" label="The first in" unit="years" max={20} value={String(pr.planned.firstIn)} onValueChange={(v) => put({ firstIn: Math.max(0, Math.min(20, num(v) ?? 0)) })} /> : <div />}
          {pr.planned.count > 1 ? <NumberField id="dshPSpacing" label="Years apart" unit="years" max={10} value={String(pr.planned.spacing)} onValueChange={(v) => put({ spacing: Math.max(1, Math.min(10, num(v) ?? 1)) })} /> : <div />}
        </div>
        {any ? (
          <>
            <div className="dsh-row3">
              <SelectField id="dshPCare" label="Paid childcare before school" value={pr.childcare ? "yes" : "no"} onChange={(v) => set((p) => ({ ...p, childcare: v === "yes" }))}>
                <option value="yes">Yes</option><option value="no">No</option>
              </SelectField>
              {pr.childcare ? (
                <SelectField id="dshPArea" label="Where you live" value={pr.careArea} onChange={(v) => set((p) => ({ ...p, careArea: v as P["careArea"] }))}>
                  <option value="city">A big city</option><option value="suburb">A suburb</option><option value="rural">A small town</option>
                </SelectField>
              ) : <div />}
              <div />
            </div>
            <div className="dsh-row3">
              <SelectField id="dshPCollege" label="Helping with college" value={pr.college.help} onChange={(v) => set((p) => ({ ...p, college: { ...p.college, help: v as P["college"]["help"] } }))}>
                <option value="none">No</option><option value="part">Some of it (about half)</option><option value="all">All of it</option>
              </SelectField>
              {pr.college.help !== "none" ? (
                <SelectField id="dshPSchool" label="The kind of school" value={String(pr.college.cost)} onChange={(v) => set((p) => ({ ...p, college: { ...p.college, cost: Number(v) } }))}>
                  <option value="27000">Public, in state ($27,000 per year)</option><option value="59000">Private ($59,000 per year)</option><option value="82000">Elite ($82,000 per year)</option>
                </SelectField>
              ) : <div />}
              <div className="dsh-self-end">{pr.college.help !== "none" ? <Button variant="link" size="inline" nativeButton={false} render={<Link href={toolHref("college", "/dashboard/profile")} />}>Plan it in College Savings</Button> : null}</div>
            </div>
            <div className="dsh-readonly">
              <p className="dsh-cap dsh-flush">Each child costs about <b>{money(early)}</b> per month to age 5, <b>{money(school)}</b> to 12 and <b>{money(teen)}</b> to 18{pr.kids + pr.planned.count > 1 ? <>, and each later one <b>{pr.childCosts.later || "80"}%</b> of that</> : null}, in today&apos;s dollars.{pr.college.help !== "none" ? " College comes out of saving for four years from 18, unless you save ahead for it in Spending." : ""}</p>
              <Button variant="outline" size="sm" onClick={() => setCosts(true)}>Edit child costs</Button>
            </div>
            {costs ? <ChildCostsDialog close={() => setCosts(false)} /> : null}
          </>
        ) : null}
      </div>
    </Tile>
  );
}

export function Profile() {
  const { data, setProfile: set, update } = useDashboard();
  const pr = data.profile, two = couple(pr), H = holdings(data.entries, pr), F = flow(pr);
  const setP = (k: PKey, v: Partial<Person>) => set((p) => ({ ...p, [k]: { ...p[k], ...v } }));
  const keys: PKey[] = two ? ["p1", "p2"] : ["p1"];
  const accounts = hasAccounts(data.entries);
  return (
    <Frame current="profile" title="Profile" sub="Everything your plan is built on. Changes save as you go.">
      <div className="dsh-grid dsh-two dsh-flush">
        <Tile icon={two ? UsersRoundIcon : UserRoundIcon} title="Household">
          <div className="dsh-fields dsh-fields-sm">
            <div className="dsh-choices">
              <Choice on={pr.who === "single"} icon={<UserRoundIcon aria-hidden="true" />} title="Just me" sub="One income, one retirement" onClick={() => set((p) => ({ ...p, who: "single" }))} />
              <Choice on={pr.who === "couple"} icon={<UsersRoundIcon aria-hidden="true" />} title="Me and a partner" sub="Married or sharing finances" onClick={() => set((p) => ({ ...p, who: "couple" }))} />
            </div>
            {keys.map((k) => (
              <div className="dsh-row3" key={k}>
                <Field id={"dshPName" + k} label={k === "p1" ? "Your first name" : "Partner's first name"}><Input id={"dshPName" + k} value={pr[k].name} onChange={(e) => setP(k, { name: e.target.value })} /></Field>
                <BirthFields id={"dshPBirth" + k} label="Birth" bm={pr[k].bm} by={pr[k].by} from={THIS_YEAR - 90} to={THIS_YEAR - 16} onChange={(v) => setP(k, v)} />
              </div>
            ))}
            <div className="dsh-row"><StateField id="dshPState" value={pr.state} onChange={(v) => set((p) => ({ ...p, state: v }))} />
              <SelectField id="dshPKids" label="Children who depend on you" value={String(pr.kids)} onChange={(v) => set((p) => ({ ...p, kids: Number(v) }))}>
                {[0, 1, 2, 3, 4, 5, 6, 7, 8].map((n) => <option key={n} value={n}>{n}</option>)}
              </SelectField>
            </div>
            {Array.from({ length: pr.kids }, (_, i) => {
              const k = pr.kidList[i] ?? { name: "", bm: null, by: null };
              const put = (v: Partial<typeof k>) => set((p) => { const list = [...p.kidList]; while (list.length <= i) list.push({ name: "", bm: null, by: null }); list[i] = { ...list[i], ...v }; return { ...p, kidList: list }; });
              return (
                <div className="dsh-row3" key={i}>
                  <Field id={"dshPKid" + i} label={`Child ${i + 1}`}><Input id={"dshPKid" + i} value={k.name} placeholder="Name (optional)" onChange={(e) => put({ name: e.target.value })} /></Field>
                  <BirthFields id={"dshPKidBirth" + i} label="Birth" bm={k.bm} by={k.by} from={THIS_YEAR - 30} to={THIS_YEAR} optional onChange={put} />
                </div>
              );
            })}
          </div>
        </Tile>

        <div className="dsh-side">
          <Tile icon={SunsetIcon} title="Retirement">
            <div className="dsh-fields dsh-fields-sm"><div className="dsh-row">
              {keys.map((k) => <NumberField key={k} id={"dshPRet" + k} label={`${nameOf(pr, k === "p1" ? 0 : 1)} retires at age`} max={85} value={txt(pr[k].retire)} onValueChange={(v) => setP(k, { retire: num(v) })} />)}
            </div>
            <div className="dsh-row">
              <MoneyField id="dshPRetSpend" label="Spending once retired" unit="per month" value={txt(pr.retSpend)} placeholder={txt(spendMonth(pr))} onValueChange={(v) => set((p) => ({ ...p, retSpend: num(v) }))} />
              <div className="dsh-hint dsh-self-end">{pr.retSpend == null ? "Blank: the same as today." : "Today's spending is " + money(spendMonth(pr) ?? 0) + " per month."}</div>
            </div></div>
          </Tile>
          <Tile icon={WalletIcon} title="Saving">
            <div className="dsh-fields dsh-fields-sm">
              <div className="dsh-readonly">
                <div><div className="dsh-label">Saved so far</div><div className="dsh-fig dsh-md">{money(H.trad + H.roth + H.brok)}</div></div>
                <Button variant="outline" size="sm" nativeButton={false} render={<Link href="/dashboard/accounts" />}>{accounts ? "Change in Net worth" : "Split into accounts"}</Button>
              </div>
              <div className="dsh-readonly">
                <div><div className="dsh-label">Adding to it, with your employer&apos;s match</div><div className="dsh-fig dsh-md">{money10(F.invested + F.match)}<small>per month</small></div></div>
                <Button variant="outline" size="sm" nativeButton={false} render={<Link href="/dashboard/savings" />}>Change in Savings</Button>
              </div>
            </div>
          </Tile>
        </div>
      </div>

      <div className="dsh-grid dsh-two">
        <Tile icon={BanknoteIcon} title="Pay" right={<Button variant="link" size="inline" nativeButton={false} render={<Link href="/dashboard/income" />}>More in Income</Button>}>
          <div className="dsh-fields dsh-fields-sm">
            {keys.map((k) => <div className="dsh-person" key={k}><h3>{nameOf(pr, k === "p1" ? 0 : 1)}</h3><PayFields pr={pr} k={k} setP={setP} /></div>)}
          </div>
        </Tile>
        <div className="dsh-side">
          <Tile icon={ReceiptIcon} title="Spending">
            <div className="dsh-fields dsh-fields-sm">
              <div className="dsh-readonly"><div><div className="dsh-label">Spending, all together</div><div className="dsh-fig dsh-md">{money(spendMonth(pr) ?? 0)}<small>per month</small></div></div>
                <Button variant="outline" size="sm" nativeButton={false} render={<Link href="/dashboard/spending" />}>Change in Spending</Button></div>
            </div>
          </Tile>
          <Tile icon={pr.home === "rent" ? Building2Icon : HouseIcon} title="Home" right={<Button variant="link" size="inline" nativeButton={false} render={<Link href="/dashboard/home" />}>Mortgage details</Button>}>
            <div className="dsh-fields dsh-fields-sm">
              <div className="dsh-choices">
                <Choice on={pr.home === "own"} icon={<HouseIcon aria-hidden="true" />} title="Own" sub="With or without a mortgage" onClick={() => set((p) => ({ ...p, home: "own" }))} />
                <Choice on={pr.home === "rent"} icon={<Building2Icon aria-hidden="true" />} title="Rent" sub="A house or an apartment" onClick={() => set((p) => ({ ...p, home: "rent" }))} />
              </div>
              {pr.home === "own" ? (
                <div className="dsh-row3">
                  <MoneyField id="dshPValue" label="What it's worth" value={txt(H.home || null)} onValueChange={(v) => update((d) => ({ ...d, entries: withHome(d, { value: num(v) }) }))} />
                  <MoneyField id="dshPOwed" label="Left on the mortgage" value={txt(H.mortgage || null)} onValueChange={(v) => update((d) => ({ ...d, entries: withHome(d, { owed: num(v) }) }))} />
                  <NumberField id="dshPMRate" label="Its interest rate" unit="%" step={0.125} max={20} value={pctTxt(mortgage(pr, data.entries).rate)} onValueChange={(v) => { const r = v.trim() === "" ? null : (num(v) ?? 0) / 100; set((p) => ({ ...p, mortRate: r })); update((d) => ({ ...d, entries: withHome(d, { rate: r }) })); }} />
                </div>
              ) : pr.home === "rent" ? <div className="dsh-row"><MoneyField id="dshPRent" label="Rent" unit="per month" value={txt(pr.rent)} onValueChange={(v) => set((p) => ({ ...p, rent: num(v) }))} /><div /></div> : null}
            </div>
          </Tile>
        </div>
      </div>

      <div className="dsh-r4"><Children pr={pr} set={set} /></div>
      <div className="dsh-r4"><Assumptions pr={pr} set={set} /></div>
      {pr.state === OUTSIDE_US ? <div className="dsh-r4"><Note>Outside the US we don&apos;t work out taxes or Social Security: your plan&apos;s figures for retirement are <b>before taxes</b>.</Note></div> : null}
    </Frame>
  );
}
