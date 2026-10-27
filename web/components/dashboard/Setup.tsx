"use client";

/* Setting up the dashboard: full screen, a question or two at a time, each
   answer saved as it's given, any step skippable, "Your plan so far"
   filling in beside it. The approved mock A (.impeccable/mocks/dashboard). */

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, type ReactNode } from "react";
import { HouseIcon, Building2Icon, UserRoundIcon, UsersRoundIcon } from "lucide-react";
import { Brandmark } from "@/components/shell/Brandmark";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, MoneyField, NumberField, SelectField } from "@/components/fields/Field";
import { NetWorthChart } from "./charts";
import { Note } from "./ui";
import { BirthFields, Choice, PayFields, StateField, THIS_YEAR, num, txt, type PKey } from "./fields";
import { money, shortMoney } from "./format";
import { ageOf, couple, nowYear, payYear, people, results } from "./model";
import { OUTSIDE_US, entryFrom, hasAccounts, useDashboard, withEntry, type DashData, type Person, type Profile } from "./store";


interface Ctx { pr: Profile; set: (f: (p: Profile) => Profile) => void; setP: (k: PKey, f: Partial<Person>) => void }
interface Step { id: string; label: string; title: (pr: Profile) => string; help: string; hidden?: (pr: Profile) => boolean; body: (c: Ctx) => ReactNode }

const nameOf = (pr: Profile, k: PKey) => pr[k].name.trim() || (k === "p1" ? "You" : "Your partner");
const keys = (pr: Profile): PKey[] => (couple(pr) ? ["p1", "p2"] : ["p1"]);

const STEPS: Step[] = [
  {
    id: "who", label: "Household", title: () => "Who is this plan for?", help: "We'll plan for everyone who shares your money.",
    body: ({ pr, set }) => (
      <>
        <div className="dsh-choices">
          <Choice on={pr.who === "single"} icon={<UserRoundIcon aria-hidden="true" />} title="Just me" sub="One income, one retirement" onClick={() => set((p) => ({ ...p, who: "single" }))} />
          <Choice on={pr.who === "couple"} icon={<UsersRoundIcon aria-hidden="true" />} title="Me and a partner" sub="Married or sharing finances" onClick={() => set((p) => ({ ...p, who: "couple" }))} />
        </div>
        <Field id="dshKids" label="Children who depend on you">
          <div className="dsh-inline">
            <span className="dsh-stepper">
              <button type="button" aria-label="Fewer children" onClick={() => set((p) => ({ ...p, kids: Math.max(0, p.kids - 1) }))}>−</button>
              <output id="dshKids" aria-live="polite">{pr.kids}</output>
              <button type="button" aria-label="More children" onClick={() => set((p) => ({ ...p, kids: Math.min(8, p.kids + 1) }))}>+</button>
            </span>
            <span className="dsh-cap">Used for college and family costs. You can add them later.</span>
          </div>
        </Field>
        <Field id="dshPlanned" label="Planning on more children?">
          <div className="dsh-inline">
            <span className="dsh-stepper">
              <button type="button" aria-label="Fewer planned children" onClick={() => set((p) => ({ ...p, planned: { ...p.planned, count: Math.max(0, p.planned.count - 1) } }))}>−</button>
              <output id="dshPlanned" aria-live="polite">{pr.planned.count}</output>
              <button type="button" aria-label="More planned children" onClick={() => set((p) => ({ ...p, planned: { ...p.planned, count: Math.min(6, p.planned.count + 1) } }))}>+</button>
            </span>
            {pr.planned.count > 0 ? (
              <span className="dsh-inline"><span className="dsh-cap">The first in about</span>
                <span className="dsh-narrow"><NumberField id="dshFirstIn" label="Years until the first" max={20} value={String(pr.planned.firstIn)} onValueChange={(v) => set((p) => ({ ...p, planned: { ...p.planned, firstIn: Math.max(0, Math.min(20, num(v) ?? 0)) } }))} unit="years" /></span></span>
            ) : <span className="dsh-cap">Their costs come out of what you save, in the years they arrive.</span>}
          </div>
        </Field>
      </>
    ),
  },
  {
    id: "you", label: "About you", title: (pr) => (couple(pr) ? "Tell us about the two of you" : "Tell us about you"),
    help: "Your birth month and year keep every age right as time passes.",
    body: ({ pr, setP }) => keys(pr).map((k) => (
      <div className="dsh-person" key={k}>
        <h3>{k === "p1" ? "You" : "Your partner"}</h3>
        <div className="dsh-row3 dsh-pair">
          <Field id={"dshName" + k} label="First name"><Input id={"dshName" + k} value={pr[k].name} autoComplete={k === "p1" ? "given-name" : "off"} onChange={(e) => setP(k, { name: e.target.value })} /></Field>
          <BirthFields id={"dshBirth" + k} label="Birth" bm={pr[k].bm} by={pr[k].by} from={THIS_YEAR - 90} to={THIS_YEAR - 16} onChange={(v) => setP(k, v)} />
        </div>
      </div>
    )),
  },
  {
    id: "kids", label: "Children", hidden: (pr) => pr.kids === 0, title: (pr) => (pr.kids > 1 ? "Your children" : "Your child"),
    help: "All optional. Birth dates let us plan college and the costs that end when they leave home.",
    body: ({ pr, set }) => Array.from({ length: pr.kids }, (_, i) => {
      const k = pr.kidList[i] ?? { name: "", bm: null, by: null };
      const put = (v: Partial<typeof k>) => set((p) => { const list = [...p.kidList]; while (list.length <= i) list.push({ name: "", bm: null, by: null }); list[i] = { ...list[i], ...v }; return { ...p, kidList: list }; });
      return (
        <div className="dsh-row3 dsh-pair" key={i}>
          <Field id={"dshKid" + i} label={`Child ${i + 1}`}><Input id={"dshKid" + i} value={k.name} placeholder="Name (optional)" onChange={(e) => put({ name: e.target.value })} /></Field>
          <BirthFields id={"dshKidBirth" + i} label="Birth" bm={k.bm} by={k.by} from={THIS_YEAR - 30} to={THIS_YEAR} optional onChange={put} />
        </div>
      );
    }),
  },
  {
    id: "retire", label: "Retirement", title: () => "When do you hope to retire?", help: "A goal, not a promise. You can try other ages on the dashboard.",
    body: ({ pr, setP }) => (
      <div className="dsh-row">
        {keys(pr).map((k) => {
          const p = pr[k], at = p.by && p.retire ? p.by + p.retire : null;
          return (
            <div key={k}>
              <NumberField id={"dshRet" + k} label={`${nameOf(pr, k)} retires at age`} max={85} value={txt(p.retire)} onValueChange={(v) => setP(k, { retire: num(v) })} />
              <div className="dsh-hint">{at ? `That's ${at}, in ${Math.max(0, at - THIS_YEAR)} years` : " "}</div>
            </div>
          );
        })}
      </div>
    ),
  },
  {
    id: "pay", label: "Pay", title: () => "What do you earn?",
    help: "Before taxes, the way it shows on your offer letter or pay stub, and where you live, for the taxes on it.",
    body: ({ pr, set, setP }) => {
      const abroad = pr.state === OUTSIDE_US;
      return (
        <>
          <div className="dsh-row"><StateField id="dshState" value={pr.state} onChange={(v) => set((p) => ({ ...p, state: v }))} /><div /></div>
          {keys(pr).map((k) => (
            <div className="dsh-person" key={k}>
              <h3>{nameOf(pr, k)}</h3>
              <PayFields pr={pr} k={k} setP={setP} />
            </div>
          ))}
          {abroad ? <Note>Outside the US, we don&apos;t work out taxes or Social Security. Enter your pay after taxes; figures for retirement are <b>before taxes</b>.</Note>
            : <Note>Not sure of your take-home pay? <b>We estimate it</b> from this, with the taxes on it.</Note>}
        </>
      );
    },
  },
  {
    id: "saved", label: "Savings", title: () => "What have you saved so far?", help: "One number for now: retirement accounts, investments and savings, all added up.",
    body: ({ pr, set }) => (
      <>
        <div className="dsh-row">
          <MoneyField id="dshSaved" label="Saved, all together" value={txt(pr.saved)} onValueChange={(v) => set((p) => ({ ...p, saved: num(v) }))} />
          <div className="dsh-row">
            <MoneyField id="dshContrib" label="Adding to it" value={txt(pr.contrib)} onValueChange={(v) => set((p) => ({ ...p, contrib: num(v) }))} />
            <SelectField id="dshCper" label="How often" value={pr.cper} onChange={(v) => set((p) => ({ ...p, cper: v as Profile["cper"] }))}>
              <option value="month">per month</option><option value="2weeks">every two weeks</option><option value="year">per year</option>
            </SelectField>
          </div>
        </div>
        <Note>Until you split it into accounts, we treat it all as a 401(k). <b>Splitting it later</b> makes the tax math exact.</Note>
      </>
    ),
  },
  {
    id: "spend", label: "Spending", title: () => "What do you spend each month?", help: "Everything that leaves your checking account, housing included. A rough number is fine.",
    body: ({ pr, set }) => (
      <>
        <div className="dsh-row"><MoneyField id="dshSpend" label="Spending" unit="per month" value={txt(pr.spend)} onValueChange={(v) => set((p) => ({ ...p, spend: num(v) }))} /><div /></div>
        <Note>Not sure? Take what you earn after taxes, minus what you save. <b>A full budget</b> comes later, in Spending.</Note>
      </>
    ),
  },
  {
    id: "home", label: "Home", title: () => "Do you own or rent your home?", help: "Your home is part of what you're worth, and a mortgage is part of what you owe.",
    body: ({ pr, set }) => {
      const we = couple(pr) ? "We" : "I";
      return (
        <>
          <div className="dsh-choices">
            <Choice on={pr.home === "own"} icon={<HouseIcon aria-hidden="true" />} title={`${we} own`} sub="With or without a mortgage" onClick={() => set((p) => ({ ...p, home: "own" }))} />
            <Choice on={pr.home === "rent"} icon={<Building2Icon aria-hidden="true" />} title={`${we} rent`} sub="A house or an apartment" onClick={() => set((p) => ({ ...p, home: "rent" }))} />
          </div>
          {pr.home === "own" ? (
            <div className="dsh-row">
              <MoneyField id="dshValue" label="What it's worth today" value={txt(pr.value)} onValueChange={(v) => set((p) => ({ ...p, value: num(v) }))} />
              <div>
                <MoneyField id="dshOwed" label="Left on the mortgage" value={txt(pr.owed)} onValueChange={(v) => set((p) => ({ ...p, owed: num(v) }))} />
                <div className="dsh-hint">0 if it&apos;s paid off</div>
              </div>
            </div>
          ) : pr.home === "rent" ? (
            <div className="dsh-row"><MoneyField id="dshRent" label="Rent" unit="per month" value={txt(pr.rent)} onValueChange={(v) => set((p) => ({ ...p, rent: num(v) }))} /><div /></div>
          ) : null}
        </>
      );
    },
  },
];
const shown = (pr: Profile) => STEPS.filter((s) => !s.hidden?.(pr));

/** "Your plan so far": what's known, and the projection once savings is in. */
function Summary({ pr, done }: { pr: Profile; done: (id: string) => boolean }) {
  const ppl = people(pr);
  const R = useMemo(() => (done("saved") ? results(pr, []) : null), [pr, done]);
  const kids = pr.kids ? `, ${pr.kids} ${pr.kids > 1 ? "children" : "child"}` : "";
  const named = ppl.map((p, i) => p.name.trim() || (i ? "partner" : "You")).join(" and ");
  const rows: [string, string | null][] = [
    ["Household", pr.who ? named + kids : null],
    ["Ages today", ppl.every((p) => p.by) ? ppl.map((p) => ageOf(p)).join(" and ") : null],
    ["Retiring", done("retire") && ppl.some((p) => p.retire) ? ppl.map((p, i) => `${p.name.trim() || (i ? "Partner" : "You")} at ${p.retire ?? "—"}`).join(", ") : null],
    pr.state === OUTSIDE_US
      ? ["Pay after taxes", done("pay") ? money(ppl.reduce((s, p) => s + (payYear(p) ?? 0), 0)) + " per year" : null]
      : ["Pay before taxes", done("pay") ? money(ppl.reduce((s, p) => s + (payYear(p) ?? 0) / (p.taxed === "after" ? 0.76 : 1), 0)) + " per year" : null],
    ["Saved", done("saved") && pr.saved != null ? money(pr.saved) : null],
    ["Spending", done("spend") && pr.spend != null ? money(pr.spend) + " per month" : null],
    ["Home equity", done("home") && pr.home ? (pr.home === "own" ? money((pr.value ?? 0) - (pr.owed ?? 0)) : "Renting") : null],
  ];
  const atRet = R?.atRetire != null ? R.atRetire + R.equity : null;
  return (
    <div className="dsh-sum">
      <h2>Your plan so far</h2>
      <div className="dsh-cap">Fills in as you go</div>
      <dl className="dsh-facts">
        {rows.map(([k, v]) => <div key={k} className={v == null ? "dsh-todo" : undefined}><dt>{k}</dt><dd>{v ?? "—"}</dd></div>)}
      </dl>
      <div className="dsh-mini">
        {R && atRet != null && R.retireYear ? (
          <>
            <div className="dsh-label">Net worth at retirement, projected</div>
            <div className="dsh-fig dsh-md dsh-mt6">{shortMoney(atRet)}</div>
            <NetWorthChart height={130} hist={[{ t: nowYear(), v: (pr.saved ?? 0) + R.equity }]} proj={R.path} marks={[]} until={R.retireYear + 0.5} />
          </>
        ) : <div className="dsh-cap">Your projection appears once we know what you&apos;ve saved and when you&apos;ll retire.</div>}
      </div>
    </div>
  );
}

export function Setup() {
  const { data, update } = useDashboard();
  const router = useRouter();
  const pr = data.profile, list = shown(pr);
  // The step reached, among those that apply now (a step can drop out,
  // as Children does with no children).
  const at = Math.min(list.length, Math.max(0, list.findIndex((s) => STEPS.indexOf(s) >= data.step) === -1 ? list.length : list.findIndex((s) => STEPS.indexOf(s) >= data.step)));
  const step = list[at];
  const last = at >= list.length;

  const save = (f: (d: DashData) => DashData) => update(f);
  const set = (f: (p: Profile) => Profile) => save((d) => ({ ...d, profile: f(d.profile) }));
  const setP = (k: PKey, v: Partial<Person>) => set((p) => ({ ...p, [k]: { ...p[k], ...v } }));
  const goTo = (i: number, skip?: string) => save((d) => ({
    ...d,
    step: i >= list.length ? STEPS.length : STEPS.indexOf(list[Math.max(0, i)]),
    skipped: skip ? [...new Set([...d.skipped, skip])] : step ? d.skipped.filter((x) => x !== step.id) : d.skipped,
  }));
  const done = (id: string) => { const i = list.findIndex((s) => s.id === id); return i >= 0 && i < at && !data.skipped.includes(id); };
  // Leaving setup records today's entry of what's saved and owed.
  const finish = () => {
    // Once accounts are in, they're the record; setup's one number isn't.
    save((d) => { const e = hasAccounts(d.entries) ? null : entryFrom(d.profile); return { ...d, done: true, entries: e ? withEntry(d.entries, e) : d.entries }; });
    router.push("/dashboard");
  };
  // Leaving partway: the steps not reached yet count as skipped, so the
  // dashboard still asks for them.
  const later = () => {
    save((d) => ({ ...d, skipped: [...new Set([...d.skipped, ...list.slice(at).map((s) => s.id)])] }));
    finish();
  };

  let body: ReactNode;
  if (last) {
    const R = results(pr, []);
    const nw = (pr.saved ?? 0) + R.equity;
    body = (
      <div>
        <div className="dsh-q-eyebrow">All set</div>
        <h1 className="dsh-q-title">Here&apos;s your starting point{pr.p1.name.trim() ? ", " + pr.p1.name.trim() : ""}</h1>
        <p className="dsh-q-help">Your dashboard is ready. Some tiles start empty; filling them in sharpens every number.</p>
        <div className="dsh-ready">
          <div className="dsh-tile"><div className="dsh-label">Net worth today</div><div className="dsh-fig dsh-key dsh-mt6">{shortMoney(nw)}</div></div>
          <div className="dsh-tile"><div className="dsh-label">At retirement{R.retireYear ? ", " + R.retireYear : ""}</div><div className="dsh-fig dsh-mt6">{R.atRetire != null ? shortMoney(R.atRetire + R.equity) : "—"}</div></div>
          <div className="dsh-tile"><div className="dsh-label">Chance of success</div><div className="dsh-fig dsh-mt6">{R.success != null ? Math.round(R.success * 100) + "%" : "—"}</div></div>
        </div>
        {R.S ? <p className="dsh-cap dsh-mt">Your plan pays about <b>{money(R.S.spend / 12)}</b> per month to spend in retirement, with taxes on top, in today&apos;s dollars.</p> : null}
        <div className="dsh-navbtns">
          <Button variant="outline" size="lg" onClick={() => goTo(at - 1)}>Back</Button>
          <Button size="lg" onClick={finish}>Open my dashboard</Button>
        </div>
      </div>
    );
  } else {
    body = (
      <div>
        <div className="dsh-q-eyebrow">Step {at + 1} of {list.length} · {step.label}</div>
        <h1 className="dsh-q-title">{step.title(pr)}</h1>
        <p className="dsh-q-help">{step.help}</p>
        <div className="dsh-fields">{step.body({ pr, set, setP })}</div>
        <div className="dsh-navbtns">
          {at > 0 ? <Button variant="outline" size="lg" onClick={() => goTo(at - 1)}>Back</Button> : null}
          <Button size="lg" onClick={() => goTo(at + 1)}>Continue</Button>
          <span className="dsh-skip"><Button variant="link" onClick={() => goTo(at + 1, step.id)}>Skip for now</Button></span>
        </div>
      </div>
    );
  }

  return (
    <div className="dsh-setup">
      <header className="dsh-setup-top">
        <Link href="/" className="dsh-brand" aria-label="RetCalc home"><Brandmark /><span>RetCalc</span></Link>
        <span className="dsh-cap">Set up your dashboard</span>
        <div className="dsh-r"><Button variant="link" onClick={later}>Save and finish later</Button></div>
      </header>
      <div className="dsh-prog" aria-hidden="true">
        {list.map((s, i) => <i key={s.id} className={i < at ? "dsh-on" : i === at ? "dsh-cur" : undefined} title={s.label} />)}
        <i className={last ? "dsh-cur" : undefined} />
      </div>
      <div className="dsh-sbody">{body}<Summary pr={pr} done={done} /></div>
    </div>
  );
}

