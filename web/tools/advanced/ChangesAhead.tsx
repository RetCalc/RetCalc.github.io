"use client";

/* Changes ahead on the Advanced calculator: the list under the inputs,
   its forms (the Dashboard's, shared), the children walkthrough Stages
   uses, the stages the plan becomes, and the two answers over the chart:
   when you could stop saving, and when you could retire. The changes'
   years are kept from now (changes.ts); here they read as ages when your
   age is in, years from now when it isn't. */

import { useCallback, useEffect, useMemo, useState } from "react";
import { CheckIcon, PencilIcon, PlusIcon, Undo2Icon, XIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckToggle } from "@/components/fields/CheckToggle";
import { Modal, ModalTop } from "@/components/shell/Modal";
import { Tipped } from "@/components/shell/Tooltips";
import { KV } from "@/components/common/Readout";
import { CHILDREN_KIND, ChangeDialog, ChangesDialog, LUMP_KIND, PickKind, RETURNS_KIND, SAVING_KIND, fx, kindClass, type ChangeTip, type Kind, type Years } from "@/components/changes/ChangeUI";
import { CHILDREN_ID, acctWord, newScenario, scenarioName, scenarioSentence, type Scenario } from "@/components/dashboard/scenarios";
import { DASH, fmtNum, money, parseNum, pctStr } from "@/lib/format";
import { PER_YEAR } from "@/lib/engine/typed";
import type { Household } from "@/lib/household";
import { NO_KIDS, type PlanKids } from "@/tools/plan/model";
import { kidStages, type Monthly } from "@/tools/plan/kids";
import { CoverStagesDialog, KidsDialog, kidsLine } from "@/tools/plan/KidsDialog";
import { KID_BASE } from "@/tools/stages/kids";
import { advancedCompute, advancedPlan, type AdvancedInputs } from "./model";
import { COAST_ID, changesCompute, changesOn, coastAnswer, coastChange, compileChanges, lumpShorts, retireAnswer, withChange, withoutChange, yearsTo, type CoastAnswer, type RetireAnswer, type ShownStage } from "./changes";

type SetState = (f: (c: AdvancedInputs) => AdvancedInputs) => void;

/** Your age as typed, when it's one. */
export function ageOf(s: AdvancedInputs): number | null {
  const a = Math.round(parseNum(s.age));
  return s.age.trim() !== "" && a > 0 && a < 120 ? a : null;
}
/** How the changes' years read: by age with it in, from now without. */
export function yearsOf(s: AdvancedInputs): Years {
  const age = ageOf(s), base = age ?? 0;
  return { base, end: base + Math.max(1, Math.round(parseNum(s.years))), ages: age != null };
}
/** A change as its form shows it (ages), and back (years from now). */
const shown = (c: Scenario, Y: Years): Scenario => ({ ...c, from: c.from + Y.base, until: c.until > 0 ? c.until + Y.base : 0 });
const stored = (c: Scenario, Y: Years): Scenario => ({ ...c, from: Math.max(0, c.from - Y.base), until: c.until > 0 ? Math.max(0, c.until - Y.base) : 0 });

/** Savings at the end in today's dollars: Advanced's own with no change on. */
function fvOf(s: AdvancedInputs, household: Household | null): number {
  return changesOn(s) ? changesCompute(s, household).V.R.fvReal : advancedCompute(s, household).R.fvReal;
}

const newId = () => "c" + Math.random().toString(36).slice(2, 9);
const TIPS: Record<ChangeTip, string> = { from: "chgfrom", amount: "chgamount", pct: "chgpct", acct: "chgacct", lump: "chglump", return: "chgreturn" };
const tipLabel = (text: string, tip: ChangeTip) => <Tipped text={text} k={TIPS[tip]} />;

/** The rows shown: the children's first, then the changes in their order. */
function rowsOf(s: AdvancedInputs): Scenario[] {
  const list = s.changes ?? [];
  const kids = list.find((c) => c.kind === "children");
  return [...(kids && s.kids ? [kids] : []), ...list.filter((c) => c.kind !== "children")];
}

/** The children's costs over the plan: where they differ from today's, and the biggest difference a month. */
function kidSpanOf(s: AdvancedInputs, Y: Years): { from: number; to: number; peak: number } | null {
  if (!s.kids) return null;
  const segs = kidStages(s.kids, KID_BASE, KID_BASE + (Y.end - Y.base)).filter((x) => x.change !== 0);
  if (!segs.length) return null;
  return { from: Y.base + Math.min(...segs.map((x) => x.from)) - KID_BASE, to: Y.base + Math.max(...segs.map((x) => x.to)) - KID_BASE, peak: -segs.reduce((m, x) => (Math.abs(x.change) > Math.abs(m) ? x.change : m), 0) };
}

/** What saving was a month by account, for the children's "How will you cover this?". */
function todayMonthly(s: AdvancedInputs, household: Household | null): Monthly {
  const P = advancedPlan(s, household), ppy = PER_YEAR[P.p.period] ?? 12, mo = (v: number) => (v * ppy) / 12;
  return P.a ? { brok: mo(P.a.brokC), roth: mo(P.a.rothC), trad: mo(P.a.tradC), hsa: mo(P.a.hsaC) } : { brok: mo(P.p.contrib), roth: 0, trad: 0, hsa: 0 };
}

type Dlg = { at: "pick" } | { at: "list" } | { at: "edit"; c: Scenario; fresh: boolean } | { at: "kids" } | { at: "cover"; k: PlanKids } | { at: "stages" } | null;

/** The Changes ahead group, under the inputs. */
export function ChangesAhead({ s, setState, household }: { s: AdvancedInputs; setState: SetState; household: Household | null }) {
  const [dlg, setDlg] = useState<Dlg>(null);
  const Y = yearsOf(s), rows = rowsOf(s), acOn = s.acOn;
  const nominal = parseNum(s.nominal) / 100;
  const kidSpan = useMemo(() => kidSpanOf(s, Y), [s, Y]);

  // What each change does to savings at the end, with the others as they
  // are: the plan with it against the plan without it, after the page draws.
  const key = JSON.stringify(s);
  const [fxs, setFxs] = useState<{ key: string; map: Record<string, number> }>({ key: "", map: {} });
  useEffect(() => {
    const t = setTimeout(() => {
      const now = fvOf(s, household), out: Record<string, number> = {};
      for (const r of rowsOf(s)) {
        const flipped = fvOf(withChange(s, { ...r, on: !r.on }), household);
        out[r.id] = r.on ? now - flipped : flipped - now;
      }
      setFxs({ key, map: out });
    }, 0);
    return () => clearTimeout(t);
  }, [key, s, household]);
  const stale = fxs.key !== key;

  // What can't be kept as it stands: a cut that takes more than is saved,
  // a lump sum taken out of more than is there that day.
  const warns = useMemo(() => {
    const out: Record<string, string> = {};
    if (!changesOn(s)) return out;
    const { C, V } = changesCompute(s, household);
    if (C.cutShort) for (const r of rows) if (r.on && r.kind === "saving" && r.amount < 0) {
      const off = compileChanges(withChange(s, { ...r, on: false }), household).cutShort;
      if (!off || off.most < C.cutShort.most - 0.5) out[r.id] = `More than you save from ${Y.ages ? Y.base + C.cutShort.from : "year " + C.cutShort.from}: ${money(C.cutShort.most)} per month short. Saving stops at $0 there; lower it or start it later.`;
    }
    for (const L of lumpShorts(C, V)) for (const r of rows) if (r.on && r.kind === "lump" && r.amount < 0 && r.from === L.from) {
      const where = L.acct ? ({ t: "traditional", r: "Roth", b: "brokerage", h: "HSA" } as const)[L.acct] : "your savings";
      out[r.id] = `Not enough in ${where} ${Y.ages ? "at " + (Y.base + L.from) : L.from === 0 ? "today" : "in year " + L.from}: about ${money(L.have)} there then, ${money(L.need)} asked for. Lower it, or take it later.`;
    }
    return out;
  }, [s, household, rows, Y.ages, Y.base]);

  const sentenceOf = (r: Scenario) => (r.kind === "children" ? (s.kids ? kidsLine(s.kids) : "") : scenarioSentence(shown(r, Y), Y.end, nominal, { years: !Y.ages, pot: !acOn }));
  const figureOf = (r: Scenario) => {
    const e = fxs.map[r.id], w = warns[r.id];
    return <span className={"dsh-sc-fig" + (e == null ? "" : e < 0 ? " dsh-dn" : e > 0 ? " dsh-up" : "")} aria-live="polite" title={e == null ? undefined : fx(e) + " at the end" + (r.on ? "" : " if switched on") + (w ? ". " + w : "")}>
      {e == null || stale ? (stale ? "…" : "") : fx(e)}{w ? <span className="dsh-sc-flag" aria-label="Can't be kept as it stands">!</span> : null}
    </span>;
  };

  const toggle = (r: Scenario) => setState((c) => withChange(c, { ...r, on: !r.on }));
  const remove = (id: string) => setState((c) => ({ ...withoutChange(c, id), ...(id === CHILDREN_ID ? { kids: null, kidCover: {} } : {}) }));
  const edit = (r: Scenario) => setDlg(r.kind === "children" ? { at: "kids" } : { at: "edit", c: shown(r, Y), fresh: false });
  const pick = (k: Kind) => {
    if (k.kind === "children") { setDlg({ at: "kids" }); return; }
    const c = { ...newScenario(newId(), k.kind, Y.base, nominal), ...k.over };
    c.from = Math.min(c.from, Y.end - 1);
    setDlg({ at: "edit", c, fresh: true });
  };
  // The children: saved with their row switched on.
  const keepKids = (k: PlanKids, cover: Record<string, Partial<Monthly>>) => {
    setDlg(null);
    const empty = !k.now.length && !k.planned;
    setState((c) => empty ? { ...withoutChange(c, CHILDREN_ID), kids: null, kidCover: {} }
      : { ...withChange(c, { ...newScenario(CHILDREN_ID, "children", 0, 0), on: true }), kids: k, kidCover: cover });
  };
  const savedKids = (k: PlanKids) => {
    const costly = kidStages(k, KID_BASE, KID_BASE + (Y.end - Y.base)).some((x) => x.change > 0);
    if (acOn && costly && (k.now.length || k.planned)) setDlg({ at: "cover", k });
    else keepKids(k, {});
  };

  // A change's effect in its form: the plan with it against without it.
  const effectOf = useCallback((x: Scenario) => {
    const c = stored(x, Y), on = withChange(s, { ...c, on: true }), off = withoutChange(s, c.id);
    const fv = fvOf(on, household) - fvOf(off, household);
    let cant: string | null = null;
    if (c.kind === "saving" && c.amount < 0) {
      const a = compileChanges(on, household).cutShort, b = changesOn(off) ? compileChanges(off, household).cutShort : null;
      if (a && (!b || b.most < a.most - 0.5)) cant = `More than you save from ${Y.ages ? Y.base + a.from : "year " + a.from}: ${money(a.most)} per month short. Saving stops at $0 there; lower it or start it later.`;
    }
    if (c.kind === "lump" && c.amount < 0) {
      const R = changesCompute(on, household), L = lumpShorts(R.C, R.V).find((y) => y.from === c.from);
      if (L) cant = `Not enough in ${L.acct ? ({ t: "traditional", r: "Roth", b: "brokerage", h: "HSA" } as const)[L.acct] : "your savings"} then: about ${money(L.have)} there, ${money(L.need)} asked for. Lower it, or take it later.`;
    }
    return { fv, cant };
  }, [s, household, Y]);

  const C = useMemo(() => (rows.length ? compileChanges(s, household) : null), [rows.length, s, household]);
  const n = C?.shown.length ?? 0;

  return (
    <>
      <h3 className="m-0 mt-1 mb-1 border-t border-border pt-4 text-sm font-semibold">Changes ahead</h3>
      <p className="hint mt-0 mb-2.5">What you see coming, and what each does to your savings at the end. The figures above are where the plan starts.</p>
      {rows.length ? (
        <ol className="dsh-sc-rows" aria-label="Changes ahead">
          {rows.map((r, i) => (
            <li key={r.id} className={"dsh-sc-row dsh-sc-line" + (r.on ? "" : " dsh-sc-off")}>
              <CheckToggle id={"sc-" + r.id} on={r.on} onToggle={() => toggle(r)} tip={figureOf(r)}><span className={"dsh-sc-mark " + kindClass(r)} aria-hidden="true" /><span className="dsh-sc-n">{i + 1}.&nbsp;</span>{scenarioName(r)}</CheckToggle>
            </li>
          ))}
        </ol>
      ) : (
        <p className="hint mt-0 mb-2.5">None yet. A raise, a bigger house, easing off before you retire, an inheritance, children, or a different view on returns: add one and see what it does.</p>
      )}
      <div className="dsh-sc-btns mb-3.5">
        {rows.length ? <Button variant="outline" className="flex-1" id="btnViewChanges" onClick={() => setDlg({ at: "list" })}><PencilIcon aria-hidden="true" />View or edit</Button> : null}
        <Button variant="outline" className="flex-1" id="btnAddChange" onClick={() => setDlg({ at: "pick" })}><PlusIcon aria-hidden="true" />Add a change</Button>
      </div>
      {rows.length ? <>
        <h4 className="m-0 mb-1 text-sm font-semibold">The stages behind this</h4>
        <p className="hint mt-0 mb-2.5">Your figures above and the changes ahead, as the {n === 1 ? "stage" : n + " stages"} the calculator runs.</p>
        <Button variant="outline" className="mb-3.5 w-full" id="btnStagesBehind" onClick={() => setDlg({ at: "stages" })}>{n === 1 ? "See the stage" : "See the " + n + " stages"}</Button>
      </> : null}

      {dlg?.at === "list" ? (
        <ChangesDialog rows={rows.map((r) => shown(r, Y))} years={Y} kidSpan={kidSpan}
          figureOf={(r) => figureOf(stored(r, Y))} sentenceOf={(r) => sentenceOf(stored(r, Y))} warnOf={(r) => warns[r.id] ?? null}
          toggle={(r) => toggle(stored(r, Y))} edit={(r) => edit(stored(r, Y))} remove={remove} add={() => setDlg({ at: "pick" })} close={() => setDlg(null)} />
      ) : null}
      {dlg?.at === "pick" ? (
        <PickKind kinds={[SAVING_KIND, LUMP_KIND, RETURNS_KIND, CHILDREN_KIND]} close={() => setDlg(null)} pick={pick}
          note={"What do you see coming? Pick one, then put a name, " + (Y.ages ? "ages" : "years") + " and amounts to it." + (Y.ages ? "" : " Your age, under Your savings, lets the changes read by age.")} />
      ) : null}
      {dlg?.at === "edit" ? (
        <ChangeDialog s={dlg.c} fresh={dlg.fresh} years={Y} accounts={acOn} label={tipLabel} effectOf={effectOf}
          sentence={(x) => scenarioSentence(x, Y.end, nominal, { years: !Y.ages, pot: !acOn })}
          where={(k) => `The rest comes out of the others once ${acctWord(k)} runs out: brokerage, Roth, traditional, then the HSA.`}
          close={() => setDlg(null)} save={(x) => { setState((c) => withChange(c, stored(x, Y))); setDlg(null); }}
          remove={() => { remove(dlg.c.id); setDlg(null); }} />
      ) : null}
      {dlg?.at === "kids" ? (
        <KidsDialog kids={s.kids ?? NO_KIDS} age={KID_BASE} retire={KID_BASE + (Y.end - Y.base)} base={KID_BASE} cover={acOn} close={() => setDlg(null)} save={savedKids} saveLabel={acOn ? undefined : s.kids ? "Save" : "Add them"} />
      ) : null}
      {dlg?.at === "cover" ? (
        <CoverStagesDialog segs={kidStages(dlg.k, KID_BASE, KID_BASE + (Y.end - Y.base)).filter((x) => x.change !== 0)} today={todayMonthly(s, household)} ppy={12}
          initial={s.kidCover ?? {}} base={KID_BASE} close={() => setDlg(null)} save={(cover) => keepKids(dlg.k, cover)} saveLabel={s.kids ? "Save" : "Add them"} />
      ) : null}
      {dlg?.at === "stages" && C ? (
        <Modal size="table" onClose={() => setDlg(null)}>
          <ModalTop title="The stages behind this" onClose={() => setDlg(null)} />
          <StagesTable shown={C.shown} Y={Y} split={acOn} />
        </Modal>
      ) : null}
    </>
  );
}

/** The stages the plan runs as, read-only: where each runs, what it saves a
    month by account (your own, before the match), how that rises, its
    return, a lump sum on its first day and what's going on. */
function StagesTable({ shown: list, Y, split }: { shown: ShownStage[]; Y: Years; split: boolean }) {
  const hsa = split && list.some((x) => x.monthly.hsa > 0), anyLump = list.some((x) => x.lump);
  const span = (x: ShownStage) => (Y.ages ? fmtNum(Y.base + x.from) + " to " + fmtNum(Y.base + x.to) : "Year " + fmtNum(x.from) + " – " + fmtNum(x.to));
  const total = (m: Monthly) => m.brok + m.roth + m.trad + m.hsa;
  return (
    <>
      <p className="hint mt-0 mb-3">Amounts are a month, in today&apos;s dollars, at the start of each stage: your own money{split ? ", before the match" : ""}. Rises is how much that grows each year, after inflation.{anyLump ? " On day one is a lump sum put in or taken out on the stage's first day." : ""}</p>
      <div className="swipehint">Swipe the table sideways to see every column.</div>
      <div className="scroll" tabIndex={0} role="region" aria-label="The stages behind your plan">
        <table id="stagesBehindA">
          <thead><tr><th>Stage</th><th>{Y.ages ? "Ages" : "Years"}</th><th>Years</th><th>Per month</th>{split ? <><th>Traditional</th><th>Roth</th><th>Brokerage</th>{hsa ? <th>HSA</th> : null}</> : null}<th><Tipped text="Rises" k="stagerises" /></th>{anyLump ? <th><Tipped text="On day one" k="stagelump" /></th> : null}<th>Return</th><th className="text-center">What&apos;s going on</th></tr></thead>
          <tbody>
            {list.map((x, i) => (
              <tr key={i}><td>{i + 1}</td><td>{span(x)}</td><td>{fmtNum(Math.round((x.to - x.from) * 100) / 100)}</td><td><b>{money(total(x.monthly))}</b></td>
                {split ? <><td>{money(x.monthly.trad)}</td><td>{money(x.monthly.roth)}</td><td>{money(x.monthly.brok)}</td>{hsa ? <td>{money(x.monthly.hsa)}</td> : null}</> : null}
                <td>{Math.abs(x.rises) < 0.0005 ? "none" : pctStr(x.rises, 1) + "/yr"}</td>
                {anyLump ? <td className={x.lump ? (x.lump.amount < 0 ? "neg" : "pos") : undefined}>{x.lump ? <><b>{(x.lump.amount < 0 ? "−" : "+") + money(Math.abs(x.lump.amount))}</b> {x.lump.amount < 0 ? "out of" : "into"} {split ? ({ t: "traditional", r: "Roth", b: "brokerage", h: "HSA" } as const)[x.lump.to] : "savings"}</> : DASH}</td> : null}
                <td>{pctStr(x.nominal, 2)}</td><td className="text-left whitespace-normal">{x.names.length ? x.names.join(", ") : "Saving"}</td></tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

/* ---------- the answers ---------- */

/** When you could stop saving, and when you could retire: worked out after
    the page draws (each is several runs of the plan), with a button each
    that puts the answer in the plan. */
export function ReachCard({ s, setState, household, need, pays }: { s: AdvancedInputs; setState: SetState; household: Household | null; need: number; pays: number | null }) {
  const Y = yearsOf(s), key = JSON.stringify(s);
  const [ans, setAns] = useState<{ key: string; coast: CoastAnswer | null; retire: RetireAnswer | null } | null>(null);
  useEffect(() => {
    const t = setTimeout(() => setAns({ key, coast: coastAnswer(s, household), retire: retireAnswer(s, household) }), 0);
    return () => clearTimeout(t);
  }, [key, s, household]);
  const busy = ans?.key !== key;
  // Retiring sooner or later is undone here (a toast has no button).
  const [undo, setUndo] = useState<{ was: string; now: string } | null>(null);

  const word = (y: number) => (Y.ages ? String(Y.base + y) : "year " + y);
  const end = Y.end - Y.base, match = s.acOn && parseNum(s.matchPct) > 0;
  const row = (s.changes ?? []).find((c) => c.id === COAST_ID);

  // Left: stopping saving.
  const co = ans?.coast, at = co?.at ?? null;
  const hasCoast = !!row && row.on && at != null && row.from === at;
  const coastHead = ans == null ? "Working it out…" : !co ? DASH : at == null ? (co.keep < co.need ? "Not before " + (Y.ages ? Y.end : "the end") : "Keep saving to the end") : at === 0 ? "You could stop today" : Y.ages ? "Stop saving at " + (Y.base + at) : "Stop saving after " + at + (at === 1 ? " year" : " years");
  const coastNote = !co ? "" : at == null && row ? "Your change to stop saving at " + word(row.from) + " no longer gets you there: saving as you are, you reach " + money(co.keep) + " of the " + money(co.need) + " your target needs."
    : at == null ? (co.keep < co.need ? "Saving as you are, you reach " + money(co.keep) + " of the " + money(co.need) + " your target needs by " + word(end) + "." : "Saving as you are, you only just reach your target by " + word(end) + ".")
      : (at === 0 ? "Put nothing more in from now on" : "Put nothing more in from " + word(at)) + (match ? ", the match included" : "") + ", and your savings still grow to " + money(co.stop ?? 0) + " by " + word(end) + ", enough for your target.";

  // Right: retiring sooner or later.
  const re = ans?.retire, yrs = re?.years ?? null, now = Math.max(1, Math.round(parseNum(s.years)));
  const retireHead = ans == null ? "Working it out…" : !re ? DASH : yrs == null ? "Not within 100 years" : Y.ages ? "Retire at " + (Y.base + yrs) : "Retire in " + yrs + (yrs === 1 ? " year" : " years");
  const diff = yrs == null ? 0 : yrs - now;
  const retireNote = !re ? "" : yrs == null ? "Saving as you are, even 100 years doesn't reach your target. Save more, or lower the target."
    : "Saving as you are" + ((s.changes ?? []).some((c) => c.on) ? ", with your changes" : "") + ", you'd have " + money(re.fv) + " by " + word(yrs) + ", enough for your target" + (diff === 0 ? ": your plan as it stands." : ": " + Math.abs(diff) + (Math.abs(diff) === 1 ? " year " : " years ") + (diff < 0 ? "sooner" : "later") + " than the " + now + " planned.");

  return (
    <Card id="reachCard">
      <CardHeader><CardTitle>Reach your target</CardTitle></CardHeader>
      <div className="grid grid-cols-1 border-t border-border sm:grid-cols-2">
        <div className="flex min-w-0 flex-col px-4.5 pt-4 pb-4.5 max-sm:px-3.5">
          <div className="mb-1.5 text-label text-muted-foreground"><Tipped text="When you could stop saving" k="coast" /></div>
          <div className="text-3xl leading-tight font-medium tabular-nums" aria-live="polite">{coastHead}</div>
          <p className="hint mt-1.5 mb-3">{coastNote}</p>
          {at != null ? (
            <Button variant="outline" className="mt-auto self-start max-sm:self-stretch" id="btnCoast" disabled={hasCoast || busy} onClick={() => setState((c) => withChange(c, coastChange(at)))}>
              {hasCoast ? <><CheckIcon aria-hidden="true" />In your changes</> : row ? "Update my change" : <><PlusIcon aria-hidden="true" />Add to my changes</>}</Button>
          ) : row && co ? (
            <Button variant="outline" className="mt-auto self-start max-sm:self-stretch" id="btnCoast" disabled={busy} onClick={() => setState((c) => withoutChange(c, COAST_ID))}><XIcon aria-hidden="true" />Remove my change</Button>
          ) : null}
        </div>
        <div className="flex min-w-0 flex-col border-border px-4.5 pt-4 pb-4.5 max-sm:border-t max-sm:px-3.5 sm:border-l">
          <div className="mb-1.5 text-label text-muted-foreground">When you could retire</div>
          <div className="text-3xl leading-tight font-medium tabular-nums" aria-live="polite">{retireHead}</div>
          <p className="hint mt-1.5 mb-3">{retireNote}</p>
          {undo && s.years === undo.now ? (
            <Button variant="outline" className="mt-auto self-start max-sm:self-stretch" id="btnRetireUndo" onClick={() => { setState((c) => yearsTo(c, parseNum(undo.was))); setUndo(null); }}>
              <Undo2Icon aria-hidden="true" />Back to {undo.was} years</Button>
          ) : yrs != null && diff !== 0 ? (
            <Button variant="outline" className="mt-auto self-start max-sm:self-stretch" id="btnRetire" disabled={busy} onClick={() => { setUndo({ was: s.years, now: String(yrs) }); setState((c) => yearsTo(c, yrs)); }}>
              {Y.ages ? "Retire at " + (Y.base + yrs) : "Use " + yrs + (yrs === 1 ? " year" : " years")}</Button>
          ) : null}
        </div>
      </div>
      <div className="-mb-1 border-t border-border px-4.5 pt-1 max-sm:px-3.5">
        <div className="grid2">
          <KV k="Portfolio needed, inflation adjusted" id="sPortToday" v={money(need)} />
          {pays != null ? <KV k="That pays, after tax" id="sPays" v={money(pays) + " per year"} /> : <KV k="Your plan now" v={fmtNum(now) + (now === 1 ? " year" : " years")} />}
        </div>
      </div>
    </Card>
  );
}
