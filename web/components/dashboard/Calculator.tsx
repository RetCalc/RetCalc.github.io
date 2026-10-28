"use client";

/* Calculator: the Stages calculator on your plan, driven by scenarios.
   Its stages are the plan's own saving year by year (children, college
   years, saving that grows to its limits, both employers' match) with your
   scenarios on top: a change in saving from an age on, a lump sum, a
   different return, and the children themselves, each one sentence here
   and a set of stages underneath (scenarios.ts, calc.ts). The stages are
   read, not edited. Scenarios are saved to the profile, so the plan on
   every tab follows them. Balances, saving by account and the assumptions
   come from the dashboard; the children's costs and how they're covered
   are the profile's. Everything else changed here (fees, the goal,
   historical mode's mix) is saved to the plan in place of its figures, and
   the Calculator's result becomes the plan's savings at retirement. "Use
   the plan's figures" lets go of them. */

import Link from "next/link";
import { Button } from "@/components/ui/button";
import dynamic from "next/dynamic";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { GiftIcon, LineChartIcon, PencilIcon, PlusIcon, TrendingUpIcon } from "lucide-react";
import type { ToolInputs } from "@/components/tools/ToolState";
import type { LumpAccount, StagesInputs } from "@/tools/stages/model";
import { CheckToggle } from "@/components/fields/CheckToggle";
import { Field, MoneyField, NumberField, SelectField } from "@/components/fields/Field";
import { Modal, ModalTop } from "@/components/shell/Modal";
import { Segmented } from "@/components/common/Readout";
import { Input } from "@/components/ui/input";
import { sim } from "@/tools/guide/calc";
import { kidStages } from "@/tools/plan/kids";
import { COVER_ORDER, type CoverLine } from "@/tools/plan/model";
import { Frame } from "./Frame";
import { CALC_LOCKED, CALC_LOCKED_KEYS, calcInputs, calcOwnOf, lumpShortfalls, planKidsOf } from "./calc";
import { ChildCostsDialog, childrenSentence } from "./children";
import { coverScope, shiftCover } from "./cover";
import { Choice } from "./fields";
import { budgetFor, flow, taxFor } from "./flows";
import { ageOf, answers, holdings, realGrowth } from "./model";
import { money } from "./format";
import { PlanFacts, TipLabel, To } from "./ui";
import { STATE_OPTIONS } from "@/lib/states";
import { parseNum } from "@/lib/format";
import { KID_BASE } from "@/tools/stages/kids";
import { Hosted } from "./host";
import { newId, useDashboard, type Entry, type Profile } from "./store";
import { ACCT_NAMES, CHILDREN_ID, acctWord, liveScenarios, newScenario, pctOf, scenarioName, scenarioSentence, spanOf, type Scenario, type ScenarioKind } from "./scenarios";

const Stages = dynamic(() => import("@/tools/stages/Stages").then((m) => m.Stages), { ssr: false });

/** What the profile keeps from the calculator: historical mode's mix, the
    children's costs, and how they're covered (by your age, where the
    calculator counts years). Everything else changed here is kept too
    (calcOwn), and the Calculator's result is then the plan's savings at
    retirement (calc.ts). */
function fromStages(p0: Profile, s: StagesInputs): Profile {
  const mix = { stock: s.histMix, sv: s.histSv ?? "0", cash: s.histCash ?? "0", end: s.histMixEnd };
  const p = JSON.stringify(mix) === JSON.stringify(p0.calcMix ?? { stock: "80", sv: "0", cash: "0", end: "40" }) ? p0 : { ...p0, calcMix: mix };
  const k = s.kids;
  if (!k) return p;
  const next = {
    childcare: k.childcare, careArea: k.area ?? p.careArea, childCosts: { early: k.early, school: k.school, teen: k.teen ?? "", later: k.later ?? p.childCosts.later },
    kidCover: shiftCover((s.kidCover ?? {}) as Profile["kidCover"], (ageOf(p.p1) ?? KID_BASE) - KID_BASE) as Profile["kidCover"],
  };
  return costsKey(next) === costsKey(p) ? p : { ...p, ...next };
}
const costsKey = (p: Pick<Profile, "childcare" | "careArea" | "childCosts" | "kidCover">) => JSON.stringify([p.childcare, p.careArea, p.childCosts, p.kidCover ?? {}]);

/** Your age now and at retirement, as the scenarios count. */
function agesOf(pr: Profile): { age: number; retire: number } {
  const age = ageOf(pr.p1) ?? 40;
  return { age, retire: Math.max(age + 1, pr.p1.retire ?? age + 25) };
}

/** The rows shown: the children's (when the profile has any), then the
    saved scenarios in their order. */
function rowsOf(pr: Profile): Scenario[] {
  const saved = pr.scenarios ?? [], kids = planKidsOf(pr);
  const rest = saved.filter((s) => s.kind !== "children");
  if (!kids) return rest;
  const row = saved.find((s) => s.kind === "children") ?? newScenario(CHILDREN_ID, "children", 0, 0);
  return [row, ...rest];
}
/** The profile with one scenario added or replaced. */
function withRow(pr: Profile, s: Scenario): Profile {
  const list = pr.scenarios ?? [], i = list.findIndex((x) => x.id === s.id);
  return { ...pr, scenarios: i >= 0 ? list.map((x, j) => (j === i ? s : x)) : [...list, s] };
}
const withoutRow = (pr: Profile, id: string): Profile => ({ ...pr, scenarios: (pr.scenarios ?? []).filter((x) => x.id !== id) });

/** The plan under a profile: savings at retirement in today's dollars (the
    plan's, or the Calculator's own when a returns scenario or its own
    changes set it), and what each year falls short by, a month, where the
    costs come to more than the saving. */
function planOf(pr: Profile, entries: Entry[]): { fv: number | null; short: number[] } {
  const a = answers(pr, entries);
  return { fv: a.fvTo ?? sim(a)?.fv ?? null, short: (a.yearly ?? []).map((y) => y.short) };
}
const fvOf = (pr: Profile, entries: Entry[]) => planOf(pr, entries).fv;

/** Why a scenario can't be kept: a saving cut that takes more than is
    saved from some age (by so much a month), or a lump sum taken out of
    an account that doesn't hold it that day. */
type Short = { kind: "save"; from: number; most: number } | { kind: "lump"; from: number; have: number; need: number; acct: LumpAccount };

/** Where a scenario takes more than is saved: the first age it does, and
    the most it falls short by a month, against the plan without it (the
    children's own shortfalls are already the plan's). Null when it fits. */
function shortfall(withIt: number[], without: number[], age: number): Short | null {
  let from = -1, most = 0;
  withIt.forEach((s, k) => { const d = s - (without[k] ?? 0); if (d > 0.5) { if (from < 0) from = age + k; most = Math.max(most, d); } });
  return from < 0 ? null : { kind: "save", from, most };
}
/** A lump sum taken out that its account can't cover, when `s` is on. */
function lumpShort(pr: Profile, entries: Entry[], s: Scenario, age: number): Short | null {
  if (s.kind !== "lump" || !(s.amount < 0)) return null;
  const l = lumpShortfalls(withRow(pr, { ...s, on: true }), entries, age)[s.id];
  return l ? { kind: "lump", from: s.from, have: l.have, need: l.need, acct: l.acct } : null;
}
const ACCT_WORDS: Record<LumpAccount, string> = { t: "traditional", r: "Roth", b: "brokerage", h: "HSA" };
/** The shortfall in words. */
function shortWords(sf: Short): string {
  if (sf.kind === "save") return `More than you save from ${sf.from}: ${money(sf.most)} per month short. Saving stops at $0 there; lower it or start it later.`;
  return `Not enough in ${ACCT_WORDS[sf.acct]} on the day you turn ${sf.from}: about ${money(sf.have)} there then, ${money(sf.need)} asked for. Lower it, or take it later.`;
}

/** The kind's colour, as a class on the row's mark and lane. */
function kindClass(s: Scenario): string {
  if (s.kind === "children") return "dsh-sc-children";
  if (s.kind === "returns") return "dsh-sc-returns";
  if (s.kind === "lump") return s.amount < 0 ? "dsh-sc-down" : "dsh-sc-lump";
  return s.amount < 0 ? "dsh-sc-down" : "dsh-sc-up";
}

/** "+$1.2M", "−$472K", for an effect at retirement. */
function fx(v: number): string {
  const a = Math.abs(v), sign = v < 0 ? "−" : "+";
  if (a < 500) return sign + "$0";
  return sign + (a >= 1e6 ? "$" + (a / 1e6).toFixed(a >= 1e7 ? 0 : 1) + "M" : a >= 1e3 ? "$" + Math.round(a / 1e3) + "K" : "$" + Math.round(a));
}

/** A lane's short figure: the change it makes, in a few characters. */
function laneFigure(s: Scenario, kids: { peak: number } | null): string {
  if (s.kind === "children") return kids && kids.peak ? "up to " + (kids.peak < 0 ? "−" : "+") + "$" + Math.round(Math.abs(kids.peak)).toLocaleString("en-US") + "/mo" : "";
  if (s.kind === "returns") return pctOf(s.nominal);
  if (s.kind === "lump") return (s.amount < 0 ? "−" : "+") + "$" + Math.round(Math.abs(s.amount)).toLocaleString("en-US");
  const sign = s.amount < 0 ? "−" : "+";
  if (s.mode === "amount") return sign + "$" + Math.round(Math.abs(s.amount)).toLocaleString("en-US") + "/mo";
  return sign + Math.abs(s.amount) + "%" + (s.mode === "pctYearly" ? "/yr" : "");
}

export function Calculator() {
  const { data, setProfile } = useDashboard();
  const pr = data.profile, entries = data.entries;
  // Bumped by "Use the plan's figures", so the calculator opens again from the plan.
  const [rev, setRev] = useState(0);
  const [dlg, setDlg] = useState<{ at: "pick" } | { at: "list" } | { at: "edit"; s: Scenario; fresh: boolean } | { at: "kids" } | null>(null);
  const { age, retire } = agesOf(pr);
  const nominal = (1 + realGrowth(pr)) * (1 + pr.assume.inflation) - 1;
  const rows = useMemo(() => rowsOf(pr), [pr]);
  const kids = planKidsOf(pr);
  // The children's stages: where their costs differ from today's, and the biggest difference.
  const kidSpan = useMemo(() => {
    if (!kids) return null;
    const segs = kidStages(kids, age, retire).filter((s) => s.change !== 0);
    if (!segs.length) return null;
    return { from: Math.min(...segs.map((s) => s.from)), to: Math.max(...segs.map((s) => s.to)), peak: -segs.reduce((m, s) => (Math.abs(s.change) > Math.abs(m) ? s.change : m), 0) };
  }, [kids, age, retire]);

  // What each scenario does to savings at retirement, with the others as
  // they are: the plan with it against the plan without it. Worked out
  // after the page draws (each is a run of the plan).
  const fxKey = JSON.stringify([pr, entries]);
  const [fxState, setFxState] = useState<{ key: string; map: Record<string, number>; short: Record<string, Short> }>({ key: "", map: {}, short: {} });
  useEffect(() => {
    const t = setTimeout(() => {
      const out: Record<string, number> = {}, shorts: Record<string, Short> = {};
      const list = rowsOf(pr), now = planOf(pr, entries);
      if (now.fv != null) {
        for (const r of list) {
          const flipped = planOf(withRow(pr, { ...r, on: !r.on }), entries);
          if (flipped.fv != null) out[r.id] = r.on ? now.fv - flipped.fv : flipped.fv - now.fv;
          // A saving cut that takes more than is saved, or a lump sum its
          // account can't cover, on or off.
          const sf = r.kind === "saving" ? shortfall(r.on ? now.short : flipped.short, r.on ? flipped.short : now.short, age) : r.kind === "lump" ? lumpShort(pr, entries, r, age) : null;
          if (sf) shorts[r.id] = sf;
        }
        // All the scenarios together (the children are the plan's own).
        if (liveScenarios(list).length) {
          const f = fvOf({ ...pr, scenarios: (pr.scenarios ?? []).map((s) => (s.kind === "children" ? s : { ...s, on: false })) }, entries);
          if (f != null) out.all = now.fv - f;
        }
      }
      setFxState({ key: fxKey, map: out, short: shorts });
    }, 0);
    return () => clearTimeout(t);
  }, [fxKey, pr, entries, age]);
  const effects = fxState.map, shorts = fxState.short, stale = fxState.key !== fxKey;

  // Read when a tool opens: the stages are worked out then, not on every change.
  const seed = (id: string): ToolInputs | undefined =>
    id === "stages" ? (calcInputs(pr, entries) as unknown as ToolInputs) : id === "tax" ? (taxFor(pr) as unknown as ToolInputs) : id === "budget" ? (budgetFor(pr) as unknown as ToolInputs) : undefined;
  const keep = (id: string, d: ToolInputs) => {
    if (id !== "stages") return;
    setProfile((p) => {
      const q = fromStages(p, d as unknown as StagesInputs), own = calcOwnOf(q, entries, d as unknown as StagesInputs);
      return JSON.stringify(own ?? null) === JSON.stringify(q.calcOwn ?? null) ? q : { ...q, calcOwn: own ?? undefined };
    });
  };
  const changed = Object.keys(pr.calcOwn ?? {}).some((k) => !CALC_LOCKED_KEYS.includes(k) && k !== "stages");
  const toggle = (s: Scenario) => setProfile((p) => withRow(p, { ...s, on: !s.on }));
  const edit = (s: Scenario) => setDlg(s.kind === "children" ? { at: "kids" } : { at: "edit", s, fresh: false });
  const pick = (kind: ScenarioKind, over: Partial<Scenario>) => setDlg({ at: "edit", s: { ...newScenario(newId(), kind, age, nominal), ...over }, fresh: true });

  // Where each scenario starts, on the chart (year 0 is now).
  const marks = rows.map((r, i) => ({ r, i })).filter((x) => x.r.on).map(({ r, i }) => ({ year: (r.kind === "children" ? kidSpan?.from ?? age : r.from) - age, label: String(i + 1) })).filter((m) => m.year > 0)
    // Two starting the same year share one mark.
    .reduce<{ year: number; label: string }[]>((acc, m) => { const same = acc.find((x) => x.year === m.year); if (same) same.label += ", " + m.label; else acc.push(m); return acc; }, []);
  const live = liveScenarios(rows).length, onCount = rows.filter((r) => r.on).length;

  const panel = (
    <div className="dsh-sc">
      <h3 className="m-0 mb-1 text-sm font-semibold">Your scenarios</h3>
      <p className="hint mt-0 mb-2.5">The things you see coming, each a sentence here and stages underneath. Switch one off to see your plan without it; later ones build on earlier ones.</p>
      {rows.length ? (
        <ol className="dsh-sc-rows" aria-label="Your scenarios">
          {rows.map((r, i) => {
            const e = effects[r.id], sf = shorts[r.id];
            // Each row one line: the switch, the name, and what it does at
            // retirement (a marker when it takes more than is saved).
            const figure = <span className={"dsh-sc-fig" + (e == null ? "" : e < 0 ? " dsh-dn" : e > 0 ? " dsh-up" : "")} aria-live="polite" title={e == null ? undefined : fx(e) + " at retirement" + (r.on ? "" : " if switched on") + (sf ? ". More than you save from " + sf.from : "")}>
              {e == null ? (stale ? "…" : "") : fx(e)}{sf ? <span className="dsh-sc-flag" aria-label="More than you save">!</span> : null}
            </span>;
            return (
              <li key={r.id} className={"dsh-sc-row dsh-sc-line" + (r.on ? "" : " dsh-sc-off")}>
                <CheckToggle id={"sc-" + r.id} on={r.on} onToggle={() => toggle(r)} tip={figure}><span className={"dsh-sc-mark " + kindClass(r)} aria-hidden="true" /><span className="dsh-sc-n">{i + 1}.&nbsp;</span>{scenarioName(r)}</CheckToggle>
              </li>
            );
          })}
        </ol>
      ) : (
        <p className="hint mt-0 mb-2.5">None yet. A bigger house at 40, a promotion, easing off before you retire, an inheritance, or a different view on returns: add one and see what it does.{kids ? "" : " Children are added in Profile; they show here once they are."}</p>
      )}
      {live > 0 && effects.all != null ? <p className={"dsh-sc-all" + (effects.all < 0 ? " dsh-dn" : effects.all > 0 ? " dsh-up" : "")}><b>{fx(effects.all)}</b> at retirement from your {live === 1 ? "scenario" : live + " scenarios"} together</p> : null}
      <div className="dsh-sc-btns">
        {rows.length ? <Button variant="outline" className="flex-1" id="btnViewScenarios" onClick={() => setDlg({ at: "list" })}><PencilIcon aria-hidden="true" />View or edit</Button> : null}
        <Button variant="outline" className="flex-1" id="btnAddScenario" onClick={() => setDlg({ at: "pick" })}><PlusIcon aria-hidden="true" />Add a scenario</Button>
      </div>
    </div>
  );

  /* The pop-up: every scenario with its sentence, its effect and any
     shortfall, each with its own Edit. */
  const list = (
    <Modal size="wide" onClose={() => setDlg(null)}>
      <ModalTop title="Your scenarios" onClose={() => setDlg(null)} />
      <ol className="dsh-sc-rows dsh-sc-list" aria-label="Your scenarios">
        {rows.map((r, i) => {
          const e = effects[r.id], sf = shorts[r.id];
          return (
            <li key={r.id} className={"dsh-sc-row" + (r.on ? "" : " dsh-sc-off")}>
              <div className="dsh-sc-top">
                <div className="dsh-sc-nm"><span className={"dsh-sc-mark " + kindClass(r)} aria-hidden="true" /><span className="dsh-sc-n">{i + 1}.&nbsp;</span>{scenarioName(r)}{r.on ? "" : <span className="dsh-sc-offtag"> (off)</span>}</div>
                <Button variant="outline" size="sm" onClick={() => edit(r)}><PencilIcon aria-hidden="true" />Edit</Button>
              </div>
              <p className="dsh-sc-sent">{r.kind === "children" ? childrenSentence(pr) + (kidSpan ? " Their costs come out of saving as they change." : "") : scenarioSentence(r, retire, nominal)}</p>
              <div className={"dsh-sc-eff" + (e == null ? " dsh-sc-wait" : e < 0 ? " dsh-dn" : e > 0 ? " dsh-up" : "")}>{e == null ? (stale ? "Working it out…" : "") : <><b>{fx(e)}</b> at retirement{r.on ? "" : " if switched on"}</>}</div>
              {sf ? <p className="dsh-sc-warn">{shortWords(sf)}</p> : null}
            </li>
          );
        })}
      </ol>
      <div className="formactions mt-4">
        <Button variant="outline" className="flex-1" onClick={() => setDlg({ at: "pick" })}><PlusIcon aria-hidden="true" />Add a scenario</Button>
        <Button className="flex-1" onClick={() => setDlg(null)}>Done</Button>
      </div>
    </Modal>
  );

  const lanes = rows.length ? (
    <div className="dsh-sc-lanes" role="group" aria-label="Your scenarios across your ages">
      {rows.map((r, i) => {
        const [f, t] = r.kind === "children" ? [kidSpan?.from ?? age, kidSpan?.to ?? retire] : spanOf(r, retire);
        const left = ((Math.max(age, f) - age) / (retire - age)) * 100, width = ((Math.min(retire, t) - Math.max(age, f)) / (retire - age)) * 100;
        if (!(width > 0)) return null;
        const fig = laneFigure(r, kidSpan);
        return (
          <div key={r.id} className="dsh-sc-lane">
            <button type="button" className={"dsh-sc-bar " + kindClass(r) + (r.on ? "" : " dsh-sc-off")} style={{ "--sc-l": left + "%", "--sc-w": width + "%" } as React.CSSProperties} onClick={() => edit(r)}
              title={scenarioName(r) + ": " + (r.kind === "children" ? childrenSentence(pr) : scenarioSentence(r, retire, nominal))}>
              <span className="dsh-sc-n">{i + 1}.</span> {scenarioName(r)}{fig ? <span className="dsh-sc-fig">{fig}</span> : null}
            </button>
          </div>
        );
      })}
      <div className="dsh-sc-axis"><span>Age {age}, today</span><span>{Math.round((age + retire) / 2)}</span><span>Retiring at {retire}</span></div>
    </div>
  ) : null;

  const summary = <>{childrenSentence(pr)} <Button variant="link" size="inline" nativeButton={false} render={<Link href="/dashboard/profile#children" />}>Change them in Profile</Button></>;
  return (
    <Frame current="calculator" title="Calculator" sub="Filled in from your plan. Your scenarios and what you change here are saved to your plan, and its result is your savings at retirement everywhere.">
      {changed ? (
        <p className="dsh-cap dsh-mt6">Your own changes here are saved in place of the plan&apos;s figures, and this result is your savings at retirement on every tab.{" "}
          <Button variant="link" size="inline" onClick={() => { setProfile((p) => ({ ...p, calcOwn: undefined })); setRev((r) => r + 1); }}>Use the plan&apos;s figures</Button></p>
      ) : null}
      {/* New child costs or scenarios build the stages again, from the plan. */}
      <Hosted key={costsKey(pr) + "|" + JSON.stringify(pr.scenarios ?? []) + "|" + rev} household={null} cover={coverScope(flow(pr))} seed={seed} keep={keep}
        locked={CALC_LOCKED} slots={{ kidsSummary: summary, facts: <CalcFacts pr={pr} entries={entries} />, scenarios: panel, underChart: lanes, marks: onCount ? marks : undefined, stagesAge: age }}>
        <Stages />
      </Hosted>
      {dlg?.at === "list" ? list : null}
      {dlg?.at === "kids" ? <ChildCostsDialog close={() => setDlg(null)} /> : null}
      {dlg?.at === "pick" ? <PickKind close={() => setDlg(null)} pick={pick} /> : null}
      {dlg?.at === "edit" ? (
        <ScenarioDialog s={dlg.s} fresh={dlg.fresh} pr={pr} entries={entries} age={age} retire={retire} nominal={nominal} close={() => setDlg(null)}
          save={(s) => { setProfile((p) => withRow(p, s)); setDlg(null); }}
          remove={() => { setProfile((p) => withoutRow(p, dlg.s.id)); setDlg(null); }} />
      ) : null}
    </Frame>
  );
}

/* ---------- adding one: the kind, then its form ---------- */

const KINDS: { kind: ScenarioKind; icon: ReactNode; title: string; sub: string; over: Partial<Scenario> }[] = [
  { kind: "saving", icon: <TrendingUpIcon aria-hidden="true" />, title: "Save more or less", sub: "A raise, a bigger house, easing off: more or less saving from an age on, by dollars a month or a share, all at once or phased in.", over: { name: "", amount: 500, acct: "auto" } },
  { kind: "lump", icon: <GiftIcon aria-hidden="true" />, title: "A lump sum", sub: "An inheritance or a home sale put in, or a big expense taken out, at an age.", over: {} },
  { kind: "returns", icon: <LineChartIcon aria-hidden="true" />, title: "Different returns", sub: "A higher or lower return from an age on, stepped or climbing.", over: {} },
];

function PickKind({ close, pick }: { close: () => void; pick: (kind: ScenarioKind, over: Partial<Scenario>) => void }) {
  return (
    <Modal size="wide" onClose={close}>
      <ModalTop title="Add a scenario" onClose={close} />
      <p className="hint mt-0 mb-3">What do you see coming? Pick one; you&apos;ll name it and put ages and amounts to it next. Children are added in Profile.</p>
      <div className="dsh-choices dsh-sc-kinds">
        {KINDS.map((k) => <Choice key={k.title} on={false} icon={k.icon} title={k.title} sub={k.sub} onClick={() => pick(k.kind, k.over)} />)}
      </div>
    </Modal>
  );
}

const ages = (from: number, to: number) => { const o: number[] = []; for (let a = from; a <= to; a++) o.push(a); return o; };

function ScenarioDialog({ s: s0, fresh, pr, entries, age, retire, nominal, close, save, remove }: {
  s: Scenario; fresh: boolean; pr: Profile; entries: Entry[]; age: number; retire: number; nominal: number;
  close: () => void; save: (s: Scenario) => void; remove: () => void;
}) {
  const [s, setS] = useState<Scenario>(s0);
  // Typed figures as typed, so a sign or a decimal point can be entered.
  const [txt, setTxt] = useState({ amount: String(s0.amount), ramp: String(s0.ramp), nominal: (s0.nominal * 100).toFixed(2) });
  const up = (patch: Partial<Scenario>) => setS((c) => ({ ...c, ...patch }));
  const typed = (k: "amount" | "ramp" | "nominal") => (v: string) => {
    setTxt((c) => ({ ...c, [k]: v }));
    const n = parseNum(v);
    if (!isFinite(n)) return;
    up(k === "nominal" ? { nominal: n / 100 } : k === "ramp" ? { ramp: Math.max(0, Math.round(n)) } : { amount: n });
  };
  // The effect, with the other scenarios as they are, worked out a moment behind the typing.
  const [effect, setEffect] = useState<{ fv: number | null; short: Short | null } | null>(null);
  const sKey = JSON.stringify(s);
  useEffect(() => {
    const t = setTimeout(() => {
      const on = planOf(withRow(pr, { ...s, on: true }), entries), off = planOf(withoutRow(pr, s.id), entries);
      setEffect({ fv: on.fv != null && off.fv != null ? on.fv - off.fv : null, short: s.kind === "lump" ? lumpShort(pr, entries, s, age) : s.kind === "saving" ? shortfall(on.short, off.short, age) : null });
    }, 150);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- the draft as a whole, by its key
  }, [sKey, pr, entries, age]);
  // A cut that takes more than is saved can't be kept: saving never goes below $0.
  const cant = !!effect?.short;
  const less = s.amount < 0;
  const acctOpts = (lead: string) => <>
    <option value="auto">{lead}</option>
    {COVER_ORDER.map((k: CoverLine) => <option key={k} value={k}>{ACCT_NAMES[k]}</option>)}
  </>;
  const from = <SelectField id="scFrom" label={<TipLabel text={s.kind === "lump" ? "At age" : "Starting at age"} id="scFrom" />} value={String(s.from)} onChange={(v) => up({ from: parseNum(v), until: s.until > parseNum(v) || s.until === 0 ? s.until : 0 })}>
    {ages(age, retire - 1).map((a) => <option key={a} value={a}>{a}</option>)}
  </SelectField>;
  const name = <Field id="scName" label="Name" className="dsh-sc-full"><Input id="scName" value={s.name} placeholder={scenarioName(s)} onChange={(e) => up({ name: e.target.value })} /></Field>;
  let form: ReactNode;
  if (s.kind === "returns") {
    form = <>
      {from}
      <NumberField id="scNominal" label={<TipLabel text="Return, before inflation" id="scReturn" />} unit="%" step={0.25} value={txt.nominal} onValueChange={typed("nominal")} />
      <Field id="scHow" label="How">
        <Segmented id="scHow" size="fill" attr="data-how" options={[["0", "All at once"], ["1", "Climb over"]] as const} value={s.ramp > 0 ? "1" : "0"} onChange={(v) => { const r = v === "1" ? Math.max(1, s.ramp || 10) : 0; up({ ramp: r }); setTxt((c) => ({ ...c, ramp: String(r) })); }} />
      </Field>
      {s.ramp > 0 ? <NumberField id="scRamp" label="Years to climb" unit="years" value={txt.ramp} onValueChange={typed("ramp")} /> : null}
    </>;
  } else if (s.kind === "lump") {
    form = <>
      {from}
      <MoneyField id="scAmount" label={<TipLabel text="Amount" id="scLump" />} value={txt.amount.replace(/^-/, "")} onValueChange={(v) => typed("amount")((less ? "-" : "") + v)} />
      <Field id="scSign" label="Which way">
        <Segmented id="scSign" size="fill" attr="data-sign" options={[["in", "Put in"], ["out", "Taken out"]] as const} value={less ? "out" : "in"} onChange={(v) => typed("amount")((v === "out" ? "-" : "") + txt.amount.replace(/^-/, ""))} />
      </Field>
      <SelectField id="scAcct" label={<TipLabel text={less ? "Taken out of" : "Put into"} id="scAcct" />} value={s.acct} onChange={(v) => up({ acct: v as Scenario["acct"] })}>{acctOpts("Brokerage")}</SelectField>
    </>;
  } else {
    form = <>
      {from}
      <SelectField id="scUntil" label="Until" value={String(s.until)} onChange={(v) => up({ until: parseNum(v) })}>
        <option value="0">Retirement</option>
        {ages(s.from + 1, retire - 1).map((a) => <option key={a} value={a}>Age {a}</option>)}
      </SelectField>
      <Field id="scMode" label="As" className="dsh-sc-full">
        <Segmented id="scMode" size="fill" attr="data-mode" options={[["amount", "$ per month"], ["pct", "% of saving"], ["pctYearly", "% each year"]] as const} value={s.mode}
          onChange={(v) => { const m = v as Scenario["mode"]; const a = m === "amount" ? (less ? -500 : 500) : less ? -10 : 10; up({ mode: m, amount: a }); setTxt((c) => ({ ...c, amount: String(a) })); }} />
      </Field>
      <div className="dsh-sc-amt">
        {s.mode === "amount"
          ? <MoneyField id="scAmount" label={<TipLabel text="Change saving by" id="scAmount" />} unit="/mo" value={txt.amount.replace(/^-/, "")} onValueChange={(v) => typed("amount")((less ? "-" : "") + v)} />
          : <NumberField id="scAmount" label={<TipLabel text="Change saving by" id="scPct" />} unit="%" max={100} value={txt.amount.replace(/^-/, "")} onValueChange={(v) => typed("amount")((less ? "-" : "") + v)} />}
        <Field id="scSign" label="Which way">
          <Segmented id="scSign" size="fill" attr="data-sign" options={[["more", "More"], ["less", "Less"]] as const} value={less ? "less" : "more"} onChange={(v) => typed("amount")((v === "less" ? "-" : "") + txt.amount.replace(/^-/, ""))} />
        </Field>
      </div>
      {s.mode !== "pctYearly" ? <Field id="scHow" label="How">
        <Segmented id="scHow" size="fill" attr="data-how" options={[["0", "All at once"], ["1", "Phased in"]] as const} value={s.ramp > 0 ? "1" : "0"} onChange={(v) => { const r = v === "1" ? Math.max(1, s.ramp || 3) : 0; up({ ramp: r }); setTxt((c) => ({ ...c, ramp: String(r) })); }} />
      </Field> : null}
      {s.mode !== "pctYearly" && s.ramp > 0 ? <NumberField id="scRamp" label="Over" unit="years" value={txt.ramp} onValueChange={typed("ramp")} /> : null}
      <SelectField id="scAcct" label={<TipLabel text={less ? "Comes out of" : "Goes into"} id="scAcct" />} value={s.acct} onChange={(v) => up({ acct: v as Scenario["acct"] })} className="dsh-sc-full">
        {acctOpts(less ? "Brokerage first, then the others" : "Brokerage")}
      </SelectField>
    </>;
  }
  const where = s.kind === "saving" && s.acct !== "auto" && less ? ` The rest comes out of the others in the dashboard's order once ${acctWord(s.acct)} runs out.` : "";
  return (
    <Modal size="wide" onClose={close} focus="#scName">
      <ModalTop title={fresh ? KINDS.find((k) => k.kind === s.kind)?.title ?? "Add a scenario" : scenarioName(s)} onClose={close} />
      <div className="dsh-sc-form">
        {name}
        {form}
      </div>
      <div className="dsh-sc-preview" aria-live="polite">
        <b>{scenarioSentence(s, retire, nominal)}</b>{where}
        <div className="dsh-sc-pe">At retirement: {effect == null ? <span className="dsh-muted">working it out…</span> : effect.fv == null ? <span className="dsh-muted">not known yet</span> : <b className={effect.fv < 0 ? "dsh-dn" : effect.fv > 0 ? "dsh-up" : ""}>{fx(effect.fv)}</b>} in today&apos;s dollars, with your other scenarios as they are.</div>
        {effect?.short ? <div className="dsh-sc-pe dsh-sc-warn">You can&apos;t afford this as it stands. {shortWords(effect.short)}</div> : null}
      </div>
      <div className="formactions mt-4">
        {!fresh ? <Button variant="link" className="mr-auto" onClick={remove}>Remove this scenario</Button> : null}
        <Button variant="outline" onClick={close}>Cancel</Button>
        <Button disabled={cant} onClick={() => { if (!cant) save({ ...s, name: s.name.trim() }); }}>{fresh ? "Add it" : "Save"}</Button>
      </div>
    </Modal>
  );
}

/** What the Calculator takes from the plan, in place of its fields: the
    balances today, pay and the match, how retirement's taxes are figured,
    and inflation. */
function CalcFacts({ pr, entries }: { pr: Profile; entries: Entry[] }) {
  const s = calcInputs(pr, entries), H = holdings(entries, pr), F = flow(pr);
  const m = (v: string) => money(parseNum(v));
  const rows: [string, string][] = [
    ["Traditional", m(s.saTradBal)],
    ["Roth", m(s.saRothBal)],
    ["Brokerage", m(s.saBrokBal) + (parseNum(s.saBrokBal) > 0 ? `, cost basis ${m(s.saBrokBasis)}${H.brokBasis == null ? " (estimated)" : ""}` : "")],
    ...(parseNum(s.saHsaBal) > 0 ? [["HSA", m(s.saHsaBal)] as [string, string]] : []),
    ["Pay", F.gross > 0 ? `${money(F.gross * 12)} per year, the match adding ${money(F.match)} per month` : "Not given yet"],
    ["Taxes in retirement", `${s.saStatus === "m" ? "Married filing jointly" : "Single"}, ${STATE_OPTIONS.find((o) => o.code === s.saState)?.name ?? s.saState}`],
    ["Inflation", `${+(pr.assume.inflation * 100).toFixed(2)}% per year`],
  ];
  return <PlanFacts id="calcFacts" rows={rows} note={<>Balances and cost basis come from <To href="/dashboard/accounts#assets">Net worth</To>, pay and the match from <To href="/dashboard/income#pay">Income</To>, filing status, state and inflation from <To href="/dashboard/profile">Profile</To>. Change them there.</>} />;
}
