"use client";

/* The Stages calculator: a plan built from stages, each with its own
   contribution, return and length, worked backwards from a target by
   changing the final stage. Ported from src/js/app/08-stages.js and the
   Stages parts of src/main/02-calculator-inputs.html and
   03-calculator-results.html. */

import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { CheckToggle } from "@/components/fields/CheckToggle";
import { Affixed, Field, MoneyField, NumberField, SelectField } from "@/components/fields/Field";
import { MoneyInput } from "@/components/fields/NumberInput";
import { useHousehold, useHouseholdFill } from "@/components/household/HouseholdProvider";
import { useToast } from "@/components/shell/Toast";
import { TipDot, Tipped } from "@/components/shell/Tooltips";
import { AccountTable } from "@/components/tools/AccountTable";
import { ProjectionChart, ProjectionReading, SolveOption, bandLabel, emptyChart, fanPoints, histChart, type ChartData, type ChartMode } from "@/components/tools/Projection";
import { useToolNav, useToolScope, useToolState, useToolStore } from "@/components/tools/ToolState";
import { CsvButton } from "@/components/common/CsvButton";
import { Milestones } from "@/components/common/Milestones";
import { KV } from "@/components/common/Readout";
import { PPY, finalStageSolve, historicalRuns, monteCarlo, projectSeries } from "@/lib/engine/typed";
import { DASH, dollarsField, fmtNum, fmtYears, fraction, groupDigits, money, parseNum, pctStr } from "@/lib/format";
import { has } from "@/lib/household";
import { MC_RUNS, useMcSeed } from "@/lib/mc-seed";
import { PERIOD_ADV, PERIOD_SHORT } from "@/lib/periods";
import { STATE_OPTIONS } from "@/lib/states";
import { TAX_DEFAULTS } from "@/tools/tax/model";
import { StageCard, type StageEdit } from "./StageCard";
import { useShareKit } from "@/components/shell/share";
import { projectionShare } from "@/tools/advanced/share";
import { STAGES_DEF, stagesCompute, readStage, stageSplit, stagesLookEdited, stagesPlan, type StageInputs, type StagesInputs } from "./model";
import { KID_BASE, readCover, readKids, stagesFromKidsYears, stagesKidSegs, stagesMonthly, stagesYears } from "./kids";
import { CoverStagesDialog, KidsDialog, kidsLine } from "@/tools/plan/KidsDialog";
import { NO_KIDS, type PlanKids } from "@/tools/plan/model";
import type { Monthly } from "@/tools/plan/kids";
import { useBusy } from "@/lib/busy";
import { Button } from "@/components/ui/button";
import { InputGroupInput } from "@/components/ui/input-group";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { SERIES } from "@/lib/hues";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { PinnedReading } from "@/components/common/Reading";
import { cn } from "@/lib/utils";
import { ChevronDownIcon, CircleAlertIcon, PencilIcon, PlusIcon } from "lucide-react";
import { Modal, ModalTop } from "@/components/shell/Modal";
import { MixRows, mixForm, mixOk, type MixForm } from "@/tools/drawdown/MixRows";
import { ChevronRightIcon } from "lucide-react";
import { sendToDrawdown } from "@/tools/drawdown/fields";

const TARGET_LABEL = "(your target above)";

/** "1 yr", "2.5 yrs". */
const yrs = (y: number) => fmtNum(Math.max(0, y)) + (Math.max(0, y) === 1 ? " yr" : " yrs");

/** The stages along the years: one segment each, sized by its years, in
    alternating shades of one blue-gray, numbered; its name and span on
    hover. A click opens that stage. */
function StageBar({ nums, names, spans, onPick }: { nums: { years: number }[]; names: string[]; spans: string[]; onPick: (i: number) => void }) {
  const total = nums.reduce((a, x) => a + Math.max(0, x.years), 0);
  return (
    <div className="mb-3">
      <div className="flex h-9 gap-px overflow-hidden rounded-md" role="group" aria-label="Your stages, sized by their years">
        {nums.map((st, i) => (
          <button key={i} type="button" onClick={() => onPick(i)} title={names[i] + ", " + spans[i] + " (" + yrs(st.years) + ")"}
            aria-label={names[i] + ", " + spans[i]}
            className={cn("grid min-w-6 grow-(--g) basis-0 cursor-pointer place-items-center border-0 p-0 outline-none transition-opacity hover:opacity-85 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-solid focus-visible:outline-ring",
              i % 2 ? "bg-(--ds-acct-3)" : "bg-(--ds-acct-2)", !(st.years > 0) && "outline-2 outline-destructive")}
            style={{ "--g": Math.max(0, st.years) || (total ? 0 : 1) } as React.CSSProperties}>
            {/* The number on a chip of the card's own color, readable on either shade, in either theme. */}
            <span className="grid size-5 place-items-center rounded-full bg-card text-fine font-semibold text-foreground tabular-nums">{i + 1}</span>
          </button>
        ))}
      </div>
      <div className="mt-1 flex justify-between text-label text-muted-foreground tabular-nums"><span>Year 0</span><span>{yrs(total)} in all</span></div>
    </div>
  );
}

export function Stages() {
  const { state: s, set, setState } = useToolState(STAGES_DEF);
  const { profile } = useHousehold();
  const store = useToolStore(), go = useToolNav();
  // In a walkthrough, its Summary leads on to Drawdown, not this step.
  const scope = useToolScope();
  const dash = scope?.name === "dashboard";
  // Figures the page this runs in sets itself (the Dashboard's, from its
  // plan): said in its own words in place of their fields.
  const locked = new Set(scope?.locked ?? []);
  const toast = useToast();
  const seed = useMcSeed();
  const [mode, setMode] = useState<ChartMode>("band");
  const [band, setBand] = useState("2");
  const stageTable = useRef<HTMLTableElement>(null), yearTable = useRef<HTMLTableElement>(null);

  useHouseholdFill("stages", s, setState, (h, c) => {
    // A walkthrough fills these in from its own steps.
    if (scope) return c;
    const next = { ...c };
    if (c.saOn) {
      if (has(h.income)) next.saSalary = dollarsField(h.income!);
      next.saStatus = h.status === "m" ? "m" : "s";
      if (h.state) next.saState = h.state;
    } else if (has(h.saved)) next.initial = dollarsField(h.saved!);
    if (h.spend != null && h.spend > 0) Object.assign(next, { solveFor: "After-Tax Withdrawal", target: dollarsField(h.spend) });
    return next;
  });

  const setStages = (f: (list: StageInputs[]) => StageInputs[]) => setState((c) => ({ ...c, stages: f(c.stages) }));
  const editStage: StageEdit = (i, f) => setStages((list) => list.map((st, j) => (j === i ? f(st) : st)));

  /* ---- planning for kids: the walkthrough's children, in years from now ---- */
  const kids = readKids(s.kids), kidCover = readCover(s.kidCover), planYears = stagesYears(s.stages);
  const [kidStep, setKidStep] = useState<{ at: "kids" } | { at: "cover"; k: PlanKids } | null>(null);
  const buildKids = (k: PlanKids, cover: Record<string, Partial<Monthly>>) => {
    setKidStep(null);
    // Stages typed by hand, not built from children before: say they go.
    if (stagesLookEdited(s.stages) && !kids && !confirm("Replace your stages with ones built around your children? Your first stage's saving, return and pay schedule carry over, over the same " + fmtNum(planYears) + " years.")) return;
    const { stages, short } = stagesFromKidsYears(s, k, cover);
    setState((c) => ({ ...c, stages, kids: k, kidCover: cover }));
    // The Dashboard builds its stages again from its plan, with these.
    if (dash) { toast("Saved to your profile: your plan and these stages now use them"); return; }
    toast("Built " + stages.length + (stages.length === 1 ? " stage" : " stages") + " around your children" +
      (short === 1 ? ". In one of them the children cost more than you save, so that stage saves nothing" : short ? ". In " + short + " of them the children cost more than you save, so those stages save nothing" : ""));
  };
  const savedKids = (k: PlanKids) => {
    if (!k.now.length && !k.planned) {
      setKidStep(null);
      if (kids) { setState((c) => ({ ...c, kids: null, kidCover: {} })); toast("Children taken out; your stages stay as they are"); }
      return;
    }
    const costly = stagesKidSegs(s, k).some((x) => x.change > 0);
    if (split && costly) setKidStep({ at: "cover", k });
    else buildKids(k, {});
  };

  const typed = useDeferredValue(s);
  useBusy(typed !== s);
  const V = useMemo(() => stagesCompute(typed, profile), [typed, profile]);
  useShareKit(STAGES_DEF.id, projectionShare({ kind: "stages", g: V.P.g, eff: V.P.eff, R: V.R, mode }));
  const { P, R, F, portToday, rate } = V;
  const g = P.g;
  // The Dashboard marks where each scenario starts, in place of the stage boundaries.
  const scMarks = dash ? scope?.slots?.marks : undefined;
  const chart = useMemo(() => { const c = chartData(typed, V, mode, parseNum(band) / 100, seed); return scMarks ? { ...c, marks: scMarks } : c; }, [typed, V, mode, band, seed, scMarks]);
  const markWord = scMarks ? "Scenario starts" : "Stage boundary";
  const n = s.stages.length;
  const split = s.saOn;

  /* ---- account split on and off ---- */
  const toggleAccounts = () => {
    if (!split) {
      // Start with the whole balance in traditional and every stage's
      // contribution there too, so nothing moves until you split it.
      const blank = (["saTradBal", "saRothBal", "saBrokBal", "saHsaBal"] as const).every((k) => !(parseNum(s[k]) > 0));
      const tax = store.read("tax", TAX_DEFAULTS), H = profile;
      setState((c) => ({
        ...c, saOn: true, stages: c.stages.map(dropTyped),
        ...(blank ? {
          saTradBal: dollarsField(parseNum(c.initial)), saRothBal: "0", saBrokBal: "0", saHsaBal: "0", saBrokBasis: "", saSalary: dollarsField(H?.income || 0),
          saMatchPct: "0", saMatchCap: "6", saStatus: H?.status || tax.status, saState: H?.state || tax.state,
        } : {}),
      }));
      toast("Tax is now worked out from each account type");
    } else {
      // Back to one total: carry the balance and calculated rate across, and
      // fold any match into each stage's contribution so the answer holds.
      // The match field is cleared so switching back doesn't count it twice.
      const now = stagesPlan(s, profile);
      const matched = now.eff.some((st) => st.mf > 1);
      setState((c) => ({
        ...c, saOn: false, initial: dollarsField(now.g.initial), taxRate: String(+(now.g.taxRate * 100).toFixed(2)),
        ...(matched ? { saMatchPct: "0" } : {}),
        stages: c.stages.map((st, i) => ({
          ...dropTyped(st), contrib: dollarsField(now.stages[i].contrib * (now.eff[i].mf || 1)),
          growth: st.gRates ? String(+(now.stages[i].growth * 100).toFixed(6)) : st.growth,
        })),
      }));
      toast("Back to one total, with a " + pctStr(now.g.taxRate, 1) + " tax rate" +
        (matched ? "; the match is now part of each stage's contribution" : ""));
    }
  };

  const addStage = () => setStages((list) => {
    const last = list[list.length - 1];
    // A copy of the previous stage as a starting point, but never its name.
    const next: StageInputs = last
      ? { ...dropTyped(last), years: "10", adj: true }
      : { years: "10", contrib: "500", period: "Monthly", growth: "3", nominal: "7", vol: "12", adj: true, glideOn: false, glideEnd: "", glideYears: "" };
    delete next.name;
    return [...list, next];
  });
  const removeStage = (i: number) => {
    setStages((list) => list.filter((_, j) => j !== i));
    toast("Stage removed");
  };

  /* ---- the solve changes the final stage ---- */
  const applyContribution = () => {
    const i = n - 1;
    if (i < 0) return;
    // Split by account type, a bigger final stage shifts the account mix and
    // so the tax rate the target needs; a few passes settle it.
    let c = s, contrib = 0;
    for (let pass = 0; pass < (c.saOn ? 5 : 1); pass++) {
      const now = stagesCompute(c, profile);
      if (!now.F) return;
      // the solve works on the fee- and inflation-adjusted stage, so undo the
      // contribution adjustment before writing the number back
      const start = now.P.stages.slice(0, i).reduce((a, st) => a + st.years, 0);
      const factor = now.P.stages[i].adj && i > 0 ? Math.pow(1 + (now.P.g.inflation || 0), start) : 1;
      contrib = Math.round(now.F.perPeriod / factor / (now.P.eff[i].mf || 1));
      c = { ...c, stages: c.stages.map((st, j) => (j === i ? { ...dropTyped(st), contrib: groupDigits(contrib, true) } : st)) };
    }
    setState(() => c);
    toast("Final stage contribution set to " + money(contrib));
  };
  const applyYears = () => {
    if (!F?.reached) {
      toast("That target isn't reachable within 100 years");
      return;
    }
    editStage(n - 1, (st) => ({ ...st, years: String(F.stageYears) }));
    toast("Final stage set to " + fmtYears(F.stageYears!));
  };

  // The results' own count, which can trail the cards by a moment.
  const dn = P.stages.length;
  const last = P.stages[dn - 1];
  const mf = P.eff[dn - 1]?.mf || 1;
  // The cards follow the inputs as typed; the results catch up a moment later.
  const nums = s.stages.map(readStage);
  const spans = nums.map((st, i) => {
    const from = nums.slice(0, i).reduce((a, x) => a + x.years, 0);
    return "Year " + fmtNum(from) + " – " + fmtNum(from + st.years);
  });

  // The target beside the answer: what it asks for, in its own words.
  const target = parseNum(typed.target);
  const income = typed.solveFor === "After-Tax Withdrawal";
  // An after-tax income target can't be met by a portfolio that pays
  // nothing after tax: no contribution or length reaches it.
  const noPay = income && target > 0 && !(g.withdrawal > 0 && rate < 1);
  const payWarn = !noPay ? "" : g.withdrawal > 0
    ? "At a 100% tax rate nothing is left after tax, so no portfolio reaches an after-tax income. Lower the tax rate."
    : "At a 0% withdrawal rate the portfolio pays no income, so no amount reaches your target. Set a withdrawal rate above 0%.";
  const badWd = noPay && !(g.withdrawal > 0), badTax = noPay && !badWd && !split;

  const toDrawdown = () => {
    sendToDrawdown({ initial: Math.round(R.fvReal) });
    go("/drawdown");
    toast("Portfolio set to " + money(R.fvReal) + ", your balance in today's dollars");
  };

  /* Stages are edited in a pop-up (`editing`: the stage to open it at);
     the panel lists them. */
  const [editing, setEditing] = useState<number | null>(null);
  // The Dashboard's read-only view of the stages its scenarios build.
  const [behind, setBehind] = useState(false);
  const names = s.stages.map((st, i) => st.name || "Stage " + (i + 1));
  const stageCard = (i: number, st: StageInputs) => (
    <StageCard key={i} i={i} st={st} last={i === n - 1} split={split} mc={mode === "mc"} span={spans[i]}
      adjNote={st.adj && i > 0 && P.eff[i] ? money(P.eff[i].contrib / (P.eff[i].mf || 1)) : ""}
      num={nums[i]} blend={split && st.gRates ? P.stages[i]?.growth : undefined} fees={parseNum(s.fees) / 100} inflation={parseNum(s.inflation) / 100}
      matchOn={parseNum(s.saMatchPct) > 0} edit={editStage} remove={removeStage} />
  );
  /** In the pop-up, a stage's card brought into view. */
  const scrollToStage = (i: number) => {
    const el = document.querySelector<HTMLInputElement>(`#stageList [data-f='years'][data-i='${i}']`);
    el?.closest(".stagecard")?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    el?.focus({ preventScroll: true });
  };

  // Opening the pop-up brings the stage it was opened at into view.
  const opened = editing != null;
  useEffect(() => {
    if (opened) requestAnimationFrame(() => scrollToStage(editing!));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opened]);

  /** A new stage, opened in the pop-up. */
  const addAndOpen = () => {
    addStage();
    if (editing == null) setEditing(n);
    else setTimeout(() => scrollToStage(n), 60);
  };

  return (
    <div className="col-span-full grid grid-cols-1 items-start gap-5 max-sm:gap-3.5 lg:grid-cols-3">
      <div className="min-w-0 lg:col-span-1 lg:self-stretch">
        {/* Phones and narrow screens: the answer leads, and stays under the
            tab rail while the inputs are on screen. */}
        <PinnedReading main={{ label: "After-tax income, per year", value: money(R.afterTax) }} side={{ label: "Inflation adjusted", value: money(R.fvReal) }} />

        <aside id="asideSeries" className="max-lg:static max-lg:max-h-none max-lg:overflow-visible">
          <Card>
            <CardContent>
              {/* The Dashboard's children come from its profile: their costs
                  are changed here, the children themselves there. */}
              {/* The Dashboard: its scenarios in place of the stage list; the
                  stages they build are read, not edited. */}
              {dash ? <>
                {scope?.slots?.scenarios}
                <GroupHead>The stages behind this</GroupHead>
                <p className="hint mt-0 mb-2.5">Your plan and your scenarios, year by year, as the {n === 1 ? "stage" : n + " stages"} the calculator runs. Change a scenario to change them.</p>
                <Button variant="outline" className="w-full" id="btnStagesBehind" disabled={!n} onClick={() => setBehind(true)}>{n === 1 ? "See the stage" : "See the " + n + " stages"}</Button>
                {behind && n ? (
                  <Modal size="table" onClose={() => setBehind(false)}>
                    <ModalTop title="The stages behind your plan" onClose={() => setBehind(false)} />
                    <StagesBehind s={s} nums={nums} names={names} age={scope?.slots?.stagesAge} />
                  </Modal>
                ) : null}
              </> : null}
              {dash ? null : <>
              <GroupHead first>Your stages</GroupHead>
              {n ? <StageBar nums={nums} names={names} spans={spans} onPick={(i) => setEditing(i)} /> : null}
              {n ? (
                <ol className="m-0 mb-3 list-none p-0" aria-label="Your stages">
                  {nums.map((st, i) => (
                    <li key={i}>
                      <button type="button" onClick={() => setEditing(i)}
                        className="flex w-full cursor-pointer items-baseline gap-2 border-0 border-b border-solid border-border bg-transparent px-1 py-1.5 text-left text-note text-foreground outline-none hover:bg-muted focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-ring pointer-coarse:min-h-11">
                        <span className="w-4 flex-none text-label text-muted-foreground tabular-nums">{i + 1}</span>
                        <span className="min-w-0 flex-1 truncate">{names[i]}</span>
                        <span className="flex-none text-muted-foreground tabular-nums">{yrs(st.years)}</span>
                        <span className="w-24 flex-none text-right tabular-nums">{money(st.contrib)}{PERIOD_SHORT[st.period] ?? ""}</span>
                      </button>
                    </li>
                  ))}
                </ol>
              ) : null}
              <div className={n ? "hint hidden" : "hint mt-0 block"} id="stageEmpty">
                No stages yet. Add one to start building a run.
              </div>
              {n
                ? <Button variant="outline" className="mt-1 w-full" id="btnEditStages" onClick={() => setEditing(0)}><PencilIcon aria-hidden="true" />Edit stages</Button>
                : <Button variant="outline" className="mt-1 w-full" id="btnAddStage" onClick={addAndOpen}><PlusIcon aria-hidden="true" />Add stage</Button>}
              {editing != null && n ? (
                <Modal size="table" onClose={() => setEditing(null)}>
                  <ModalTop title="Your stages" onClose={() => setEditing(null)} />
                  <StageBar nums={nums} names={names} spans={spans} onPick={(i) => scrollToStage(i)} />
                  <div id="stageList" className="mt-1">
                    {s.stages.map((st, i) => stageCard(i, st))}
                  </div>
                  <div className="formactions mt-4">
                    <Button variant="outline" className="flex-1" onClick={addAndOpen}><PlusIcon aria-hidden="true" />Add stage</Button>
                    <Button className="flex-1" onClick={() => setEditing(null)}>Done</Button>
                  </div>
                </Modal>
              ) : null}
              </>}
              <div className="derived mb-1">
                <div><span>Stages</span><span className="num" id="gStages">{n}</span></div>
                <div><span>Fees</span><span className="num" id="gFeeNote">{(g.fees || 0) > 0 ? pctStr(g.fees, 2) + " off every stage" : "none"}</span></div>
                <div><span>Total horizon</span><span className="num" id="gTotalYears">{fmtNum(R.totalYears) + (R.totalYears === 1 ? " yr" : " yrs")}</span></div>
                <div><span>Total contributed</span><span className="num" id="gTotalContrib">{money(R.contribTotal)}</span></div>
              </div>

              {locked.has("savings") ? <><GroupHead>Your savings</GroupHead>{scope?.slots?.facts}</> : <>
              <GroupHead>Your savings</GroupHead>
              <div className="glidewrap acwrap mt-0">
                <CheckToggle id="saToggle" on={split} onToggle={toggleAccounts} controls="saFields" tip={<TipDot k="staccttypes" />}>Split by account type</CheckToggle>
                <div className="acfields" id="saFields" hidden={!split}>
                  <AcHead>Starting balances</AcHead>
                  <div className="two max-sm:grid-cols-2">
                    <MoneyField id="saTradBal" label="Traditional" value={s.saTradBal} onValueChange={set("saTradBal")} />
                    <MoneyField id="saRothBal" label="Roth" value={s.saRothBal} onValueChange={set("saRothBal")} />
                  </div>
                  <div className="two bottomalign max-sm:grid-cols-2">
                    <MoneyField id="saBrokBal" label="Brokerage" value={s.saBrokBal} onValueChange={set("saBrokBal")} />
                    <MoneyField id="saBrokBasis" label={<Tipped text="Cost basis" k="acbasis" />} value={s.saBrokBasis} onValueChange={set("saBrokBasis")} />
                  </div>
                  <div className="two bottomalign max-sm:grid-cols-2">
                    <MoneyField id="saHsaBal" label={<Tipped text="HSA" k="achsa" />} value={s.saHsaBal} onValueChange={set("saHsaBal")} />
                  </div>
                  <div className="mb-3.5 border-t border-border pt-2.5" aria-live="polite">
                    <div className="actot flex-row items-baseline justify-between"><span className="k">Total starting balance</span><span className="v pr-0" id="saTotBal">{P.B ? money(g.initial) : ""}</span></div>
                  </div>
                  <AcHead note="paid into traditional" rule>Employer match</AcHead>
                  <MoneyField id="saSalary" label={<Tipped text="Your salary today" k="stsalary" />} unit="/yr" value={s.saSalary} onValueChange={set("saSalary")} />
                  <div className="two bottomalign max-sm:grid-cols-2">
                    <NumberField id="saMatchPct" label="Match rate" unit="%" step={10} value={s.saMatchPct} onValueChange={set("saMatchPct")} />
                    <NumberField id="saMatchCap" label="On the first" unit="% of salary" value={s.saMatchCap} onValueChange={set("saMatchCap")} />
                  </div>
                  <div className="hint -mt-1.5 empty:hidden" id="saMatchNote" aria-live="polite">{P.B ? matchNote(P) : ""}</div>
                  <AcHead rule>Taxes in retirement</AcHead>
                  <div className="two max-sm:grid-cols-2">
                    <SelectField id="saStatus" label="Filing status" value={s.saStatus} onChange={set("saStatus")}>
                      <option value="s">Single</option>
                      <option value="m">Married filing jointly</option>
                    </SelectField>
                    <SelectField id="saState" label="State" value={s.saState} onChange={set("saState")}>
                      {STATE_OPTIONS.map((o) => <option key={o.code} value={o.code}>{o.name}</option>)}
                    </SelectField>
                  </div>
                </div>
              </div>
              <MoneyField id="gInitial" wrapId="gInitialField" hidden={split} label="Starting value" value={s.initial} onValueChange={set("initial")} />

              </>}
              <GroupHead>Markets</GroupHead>
              <div className="two bottomalign max-sm:grid-cols-2">
                {locked.has("inflation") ? null : <NumberField id="gInflation" label="Inflation" unit="%" value={s.inflation} onValueChange={set("inflation")} />}
                <NumberField id="gFees" label={<>Fees <span className="tipglue"><Badge variant="outline" className="ml-1.25">optional</Badge><TipDot k="fees" /></span></>} unit="%/yr" step={0.1} value={s.fees} onValueChange={set("fees")} />
              </div>

              <GroupHead>Your goal</GroupHead>
              <div className="two bottomalign">
                <SelectField id="solveForS" label="Solve for" value={s.solveFor} onChange={set("solveFor")}>
                  <option value="After-Tax Withdrawal">After-tax income</option>
                  <option value="Portfolio Value">Portfolio value</option>
                </SelectField>
                <Field id="targetS" label="Target, inflation adjusted">
                  <Affixed prefix="$"><MoneyInput id="targetS" nonNeg value={s.target} onValueChange={set("target")} /></Affixed>
                </Field>
              </div>
              <div className="hint -mt-2 mb-3.5 empty:hidden" id="targetHintS">{F ? (s.solveFor === "After-Tax Withdrawal"
                ? "The after-tax income you want each year, in today's spending power."
                : "The portfolio balance you want, in today's spending power.") : ""}</div>
              <div className="two bottomalign max-sm:grid-cols-2">
                <NumberField id="gWithdrawal" label="Withdrawal rate" unit="%" value={s.withdrawal} onValueChange={set("withdrawal")}
                  aria-invalid={badWd || undefined} aria-describedby={badWd ? "payWarnTextS" : undefined} />
                <NumberField id="gTaxrate" wrapId="gTaxrateField" hidden={split} label={<Tipped text="Effective tax rate" k="efftaxrate" />} unit="%" value={s.taxRate} onValueChange={set("taxRate")}
                  aria-invalid={badTax || undefined} aria-describedby={badTax ? "payWarnTextS" : undefined} />
                <div className="field" id="saTaxField" hidden={!split}>
                  <Label className="mb-1.5"><span><Tipped text="Tax on withdrawals" k="actax" /></span></Label>
                  <Affixed suffix="calc">
                    <InputGroupInput variant="numeric" id="saTaxOut" type="text" readOnly tabIndex={-1} aria-label="Tax on withdrawals, calculated" value={V.saRate != null ? pctStr(V.saRate, 1) : ""} /></Affixed>
                </div>
              </div>
              <div className="-mt-1 mb-1 flex items-start gap-2 text-note text-destructive" id="payWarnS" hidden={!noPay}>
                <CircleAlertIcon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                <span id="payWarnTextS" role="alert">{payWarn}</span>
              </div>

              {dash ? null : <>
              <GroupHead>Planning for kids?</GroupHead>
              <p className="hint mt-0 mb-2.5" id="kidsLineS">{kids ? kidsLine(kids) + " The stages are built around them; change a stage to plan other changes too."
                : "Add the children you have or plan, and the stages are rebuilt around what they cost: less saving in the childcare years, more again once they're grown."}</p>
              <Button variant="outline" className="w-full" id="btnKidsS" disabled={!(planYears > 0)} onClick={() => setKidStep({ at: "kids" })}>{kids ? "Edit children" : "Add children"}</Button>
              </>}
              {kidStep?.at === "kids" ? (
                <KidsDialog kids={kids ?? NO_KIDS} age={KID_BASE} retire={KID_BASE + planYears} base={KID_BASE} cover={split} close={() => setKidStep(null)} save={savedKids}
                  {...(dash ? { costsOnly: scope?.slots?.kidsSummary, withLater: true } : {})} />
              ) : null}
              {kidStep?.at === "cover" ? (() => {
                const { today, ppy } = stagesMonthly(s), C = scope?.cover;
                // The Dashboard covers costs its own way, from today's saving.
                return <CoverStagesDialog segs={stagesKidSegs(s, kidStep.k).filter((x) => x.change !== 0)} today={C ? C.today : today} ppy={C ? 12 : ppy} initial={kidCover} base={KID_BASE}
                  {...(C ? { coverFn: C.fn, order: C.order } : {})}
                  close={() => setKidStep(null)} save={(cover) => buildKids(kidStep.k, cover)} />;
              })() : null}
            </CardContent>
          </Card>
        </aside>
      </div>

      <div className="stack min-w-0 lg:col-span-2" role="tabpanel" aria-labelledby="tabbtn-calc" id="tab-series">
        {/* With no stages the figures are only the starting value's; they
            stay, dimmed, and everything under them gives way to one prompt. */}
        <div className={cn("min-w-0", !n && "opacity-60")}>
          <ProjectionReading p="x" R={R} lastPeriod={R.lastPeriod}
            fvNote={dn ? "Across " + dn + (dn === 1 ? " stage, " : " stages, ") + fmtNum(R.totalYears) + " years" : "Add a stage to begin"}
            realNote={"Inflation of " + pctStr(g.inflation, 2) + " over " + fmtNum(R.inflYears) + " years"}>
            {target > 0 ? (
              <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5 text-note">
                <span className="text-muted-foreground">Your target</span>
                <span className="font-medium whitespace-nowrap tabular-nums">{money(target) + (income ? " per year, after tax" : " portfolio, in today's dollars")}</span>
              </div>
            ) : null}
          </ProjectionReading>
        </div>

        {!n ? (
          <Card>
            <CardHeader><CardTitle>Start with a stage</CardTitle>
              <CardDescription>Add a stage to see your balance over time, stage by stage.</CardDescription></CardHeader>
            <CardContent><Button variant="outline" onClick={addAndOpen}><PlusIcon aria-hidden="true" />Add stage</Button></CardContent>
          </Card>
        ) : null}

        <Card id="saPanel" hidden={!split}>
          {P.B ? <AccountTable id="saResults" B={P.B} years={P.B.years ?? R.totalYears} /> : null}
        </Card>

        <Card hidden={!n}>
          <CardHeader><CardTitle>Reach your target</CardTitle></CardHeader>
          <div className="grid grid-cols-1 border-t border-border sm:grid-cols-2">
            <SolveOption label="Change the final stage's contribution" id="tPerPeriod" value={F ? money(F.perPeriod / mf, 2) : DASH} sized={!!F} noteId="tPerPeriodNote"
              note={F && last ? "Stage " + dn + ", paid " + PERIOD_ADV[last.period] + " for " + fmtYears(last.years) + (mf > 1 ? ", plus the match" : "") : ""}>
              <KV k="Per year" id="tPerYear" v={F ? money(F.perYear / mf) : ""} />
              <StageChange F={F} contrib={P.eff[dn - 1]?.contrib ?? 0} mf={mf} />
              {dash ? null : <Button variant="outline" className="mt-3.5 self-start max-sm:self-stretch" id="btnApplyS" disabled={!n || noPay} onClick={applyContribution}>Use this contribution</Button>}
            </SolveOption>
            <SolveOption label="Change the final stage's length" id="tYears" value={!F ? DASH : F.reached ? fmtYears(F.stageYears!) : "Out of reach"} sized={!!F} noteId="tYearsNote" className="max-sm:border-t sm:border-l"
              note={!F ? "" : F.reached ? "Keeping " + money(P.eff[dn - 1].contrib / mf, 2) + " " + PERIOD_ADV[last.period] : "Not reached within 100 years at this contribution."}>
              <KV k="Final stage now" id="tYearsNow" v={F && last ? fmtYears(last.years) : ""} />
              <KV k="Whole run becomes" id="tYearsTotal" v={!F ? "" : F.reached ? fmtYears(F.totalIfStretched!) : DASH} />
              {dash ? null : <Button variant="outline" className="mt-3.5 self-start max-sm:self-stretch" id="btnApplyYearsS" disabled={!n || (!!F && !F.reached) || noPay} onClick={applyYears}>Use this length</Button>}
            </SolveOption>
          </div>
          <div className="-mb-1 border-t border-border px-4.5 pt-1 max-sm:px-3.5">
            <div className="grid2">
              <div>
                <KV k="Portfolio needed, inflation adjusted" id="tPortToday" v={F ? money(portToday) : ""} />
                <KV k="That pays, after tax" id="tPays" v={F ? money(portToday * g.withdrawal * (1 - rate)) + " per year" : ""} />
                <KV k="Portfolio needed at retirement" id="tPortFuture" v={F ? money(F.targetFuture) : ""} />
              </div>
              <div>
                <KV k="Balance entering the final stage" id="tStartBal" v={F ? money(F.startBal) : ""} />
                <KV k="That balance alone grows to" id="tGrown" v={F ? money(F.grown) : ""} />
              </div>
            </div>
          </div>
        </Card>

        <div className="min-w-0" hidden={!n}>
          <ProjectionChart sfx="S" segId="segSeries" ariaLabel="Projected inflation-adjusted balance across stages"
            mode={mode} setMode={setMode} band={band} setBand={setBand}
            histMix={s.histMix} setHistMix={set("histMix")} histMixEnd={s.histMixEnd} setHistMixEnd={set("histMixEnd")}
            glides={mode === "hist" && R.rows.length > 0 && !!last?.glide?.on}
            mixButton={dash ? <HistMixButton s={s} setState={setState} /> : undefined}
            mcHint={<>5,000 simulations per redraw. Volatility is
              set per stage, in your plan.</>}
            chart={chart} maxX={R.totalYears} bandItems={bandLegend(parseNum(band) / 100, markWord)} legendExtra={markWord}
            tipHead={(b) => <><b>Year {fmtNum(b.year)}</b> <span className="text-dim">&middot; stage {String(b.stage)}</span></>}
            target={portToday} targetLabel={TARGET_LABEL} />
          {dash ? scope?.slots?.underChart : null}
        </div>

        {/* Milestones at full width, and Take it further under it as a slim
            strip: its one line and button no longer stretch to the list's
            height (beside it, the card stood three-quarters empty). */}
        <div className="grid min-w-0 grid-cols-1 gap-5 max-sm:gap-3.5" hidden={!n}>
          <Card>
            <CardHeader><CardTitle>Milestones</CardTitle></CardHeader>
            <CardContent id="msBodyS">
              <Milestones rows={R.rows.map((r) => ({ year: r.endYear, end: r.end, growth: r.growth, contrib: r.contrib }))}
                infl={g.inflation} feeCost={V.feeCost} horizon={R.totalYears} wholeYears />
            </CardContent>
          </Card>

          <Card hidden={!!scope}>
            <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
              <div className="min-w-0">
                <CardTitle>Take it further</CardTitle>
                <p className="hint mt-1 mb-0 max-w-copy">See how long this balance lasts once you start
                  drawing on it. This carries your inflation-adjusted balance into the
                  Drawdown Simulator.</p>
              </div>
              <Button variant="outline" className="self-start sm:self-center" id="toDrawdownS" onClick={toDrawdown}>Test withdrawals</Button>
            </CardContent>
          </Card>
        </div>

        <Card hidden={!n}>
          <CardHeader><CardTitle>Stage by stage</CardTitle><CardAction><CsvButton table={stageTable} label="Stage by stage" /></CardAction></CardHeader>
          <div className="swipehint">Swipe the table sideways to see every column.</div>
          <div className="scroll" tabIndex={0} role="region" aria-label="Stage by stage">
            <table id="stageTable" ref={stageTable}>
              <thead><tr><th>Stage</th><th>Years</th><th>Return</th><th>Start balance</th><th>Contributions</th><th>Growth</th><th>End balance</th></tr></thead>
              <tbody>
                {R.summary.map((x) => (
                  <tr key={x.stage}><td>{x.stage}</td><td>{fmtNum(x.years)}</td><td>{pctStr(x.nominal, 2)}</td><td>{money(x.start)}</td>
                    <td>{money(x.contrib)}</td><td className="pos">{money(x.growth)}</td><td>{money(x.end)}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <Collapsible className="min-w-0" hidden={!n} render={<Card />}>
          <CardHeader>
            <CardTitle><CollapsibleTrigger>Year by year<ChevronDownIcon aria-hidden="true" /></CollapsibleTrigger></CardTitle>
            <CardAction><CsvButton table={yearTable} label="Year by year" /></CardAction>
          </CardHeader>
          <CollapsibleContent keepMounted>
            <div className="swipehint">Swipe the table sideways to see every column.</div>
            <div className="scroll" tabIndex={0} role="region" aria-label="Year by year">
              <table id="xYearTable" ref={yearTable}>
                <thead><tr><th>Year</th><th>Stage</th><th>Start balance</th><th>Contributions</th><th>Growth</th><th>End balance</th><th>Inflation adj.</th></tr></thead>
                <tbody>
                  {R.calRows.map((r) => (
                    <tr key={r.year}><td>{r.year}</td><td>{r.stageFrom === r.stage ? r.stage : r.stageFrom + "–" + r.stage}</td><td>{money(r.start)}</td>
                      <td>{money(r.contrib)}</td><td className="pos">{money(r.growth)}</td><td>{money(r.end)}</td><td>{money(r.end / Math.pow(1 + g.inflation, r.t))}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CollapsibleContent>
        </Collapsible>
      </div>
    </div>
  );
}

/** A heading over one group of the inputs, on a rule after the first. */
function GroupHead({ first, children }: { first?: boolean; children: React.ReactNode }) {
  return <h3 className={cn("m-0 mb-3 text-sm font-semibold", !first && "mt-1 border-t border-border pt-4")}>{children}</h3>;
}

/** A heading inside the account split, at Title size, with what it's for
    in Label/Muted after it. */
function AcHead({ note, rule, children }: { note?: string; rule?: boolean; children: React.ReactNode }) {
  return (
    <div className={cn("mb-2 text-sm font-semibold", rule && "mt-1 border-t border-border pt-3.5")}>
      {children}{note ? <span className="ml-1.5 text-label font-normal text-muted-foreground">{note}</span> : null}
    </div>
  );
}

/** The cached split amounts go when a stage is rebuilt from its numbers. */
function dropTyped(st: StageInputs): StageInputs {
  const { cT: _t, cR: _r, cB: _b, cH: _h, ...rest } = st;
  return rest;
}

function StageChange({ F, contrib, mf }: { F: ReturnType<typeof finalStageSolve>; contrib: number; mf: number }) {
  if (!F) return <KV k="Change from current" id="tChange" v="" />;
  const delta = (F.perPeriod - contrib) / mf;
  return <KV k="Change from current" id="tChange" v={(delta >= 0 ? "+" : "") + money(delta, 2)} />;
}

/* The match stage 1 earns in its first year, restated biweekly, beside the
   most the salary allows. */
function matchNote(P: ReturnType<typeof stagesPlan>): string {
  const a = P.g.acct, st = P.stages[0];
  if (!a || !st || !(a.salary > 0) || !(a.matchPct > 0)) return "";
  const sp = stageSplit(st), ppy = (PPY as Record<string, number>)[st.period];
  const capPer = a.salary * (a.matchCap || 0) / 100 / ppy;
  const per = Math.min(Math.max(0, st.contrib) * (sp.t + sp.r), capPer) * a.matchPct / 100;
  const bi = per * ppy / 26, full = capPer * a.matchPct / 100 * ppy / 26;
  return "Stage 1 match: " + money(bi, 2) + " biweekly" + (bi < full - 0.005 ? " (the full match is " + money(full, 2) + ")" : "") + ".";
}

function bandLegend(band: number, markWord = "Stage boundary"): [string, string][] {
  const lbl = bandLabel(band);
  return [
    [SERIES.teal, band > 0 ? "Every stage +" + lbl + "%" : "Higher"],
    [SERIES.plan, "As entered"],
    [SERIES.rose, band > 0 ? "Every stage −" + lbl + "%" : "Lower"],
    ["var(--stageline)", markWord],
  ];
}

/** The Dashboard's stages, read-only: each one's ages, length, saving a
    month by account (your own, before the match), return and what's going
    on, as the plan and the scenarios build them. */
function StagesBehind({ s, nums, names, age }: { s: StagesInputs; nums: ReturnType<typeof readStage>[]; names: string[]; age?: number }) {
  const split = s.saOn, hsa = split && nums.some((st) => stageSplit(st).h > 0), infl = parseNum(s.inflation) / 100;
  const starts = nums.reduce<number[]>((acc, st) => [...acc, acc[acc.length - 1] + st.years], [0]);
  const rows = nums.map((st, i) => {
    const start = starts[i], from = starts[i + 1];
    const ppy = (PPY as Record<string, number>)[st.period] ?? 12, mo = (st.contrib * ppy) / 12, sp = stageSplit(st);
    const ages = age != null ? fmtNum(age + start) + " to " + fmtNum(age + from) : "Year " + fmtNum(start) + " – " + fmtNum(from);
    // The rise after inflation: the stage's rate is kept before it.
    const rises = (1 + st.growth) / (1 + infl) - 1;
    return { i, ages, years: st.years, mo, t: mo * sp.t, r: mo * sp.r, b: mo * sp.b, h: mo * sp.h, nominal: st.nominal, rises, name: names[i] };
  });
  return (
    <>
      <p className="hint mt-0 mb-3">Amounts are a month, in today&apos;s dollars, your own money before the match. Rises is how much a stage&apos;s saving grows each year, after inflation.</p>
      <div className="swipehint">Swipe the table sideways to see every column.</div>
      <div className="scroll" tabIndex={0} role="region" aria-label="The stages behind your plan">
        <table id="stagesBehind">
          <thead><tr><th>Stage</th><th>{age != null ? "Ages" : "Years"}</th><th>Years</th><th>Per month</th>{split ? <><th>Traditional</th><th>Roth</th><th>Brokerage</th>{hsa ? <th>HSA</th> : null}</> : null}<th><Tipped text="Rises" k="stagerises" /></th><th>Return</th><th>What&apos;s going on</th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.i}><td>{r.i + 1}</td><td>{r.ages}</td><td>{fmtNum(r.years)}</td><td><b>{money(r.mo)}</b></td>
                {split ? <><td>{money(r.t)}</td><td>{money(r.r)}</td><td>{money(r.b)}</td>{hsa ? <td>{money(r.h)}</td> : null}</> : null}
                <td>{Math.abs(r.rises) < 0.0005 ? "none" : pctStr(r.rises, 1) + "/yr"}</td><td>{pctStr(r.nominal, 2)}</td><td className="text-left whitespace-normal">{r.name}</td></tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

/* ---- the numbers ---- */

function chartData(s: StagesInputs, V: ReturnType<typeof stagesCompute>, mode: ChartMode, band: number, seed: number): ChartData {
  const { P, R } = V, g = P.g;
  if (!R.rows.length) return emptyChart();
  const defl = (yr: number) => Math.pow(1 + g.inflation, yr);
  const marks = R.summary.slice(0, -1).map((x) => ({ year: x.endYear, label: String(x.stage + 1) }));
  const start = { year: 0, stage: 1, base: g.initial, hi: g.initial, lo: g.initial, p25: g.initial, p75: g.initial };
  if (mode === "hist") {
    // US stocks and small-cap value together are the stocks; small value's
    // share of them and cash's share of the rest (bonds are what's left).
    const us = fraction(s.histMix), svP = fraction(s.histSv ?? "0"), cashP = fraction(s.histCash ?? "0"), stocks = Math.min(1, us + svP);
    const mix = stocks, endMix = fraction(s.histMixEnd);
    const full = svP > 0 || cashP > 0 ? { sv: stocks > 0 ? svP / stocks : 0, cash: stocks < 1 ? cashP / (1 - stocks) : 0 } : {};
    const H = historicalRuns({ initial: g.initial, fees: g.fees }, P.eff.map((st) => ({ ...st, mix, ...full, ...(st.glide?.on ? { glide: { ...st.glide, endMix } } : {}) })));
    return histChart(start, H, marks, (b) => ({ stage: (b as { stage?: number }).stage }));
  }
  if (mode === "mc") {
    const mc = monteCarlo(g, P.eff, MC_RUNS, seed);
    const pts = fanPoints({ ...start, det: g.initial }, mc.bands, (b, i) => ({
      stage: R.chartRows[i] ? R.chartRows[i].stage : 1,
      det: R.chartRows[i] ? R.chartRows[i].end / defl(R.chartRows[i].year) : b.p50,
    }));
    return { ...emptyChart(true), pts, marks, legend: "mc", mc };
  }
  const shift = (d: number) => P.eff.map((st) => ({ ...st, nominal: Math.max(-0.99, st.nominal + d) }));
  const hiR = projectSeries(g, shift(band)), loR = projectSeries(g, shift(-band));
  const pts = [{ year: 0, stage: 1, base: g.initial, hi: g.initial, lo: g.initial }, ...R.chartRows.map((r, i) => ({
    year: r.year, stage: r.stage, base: r.end / defl(r.year),
    hi: (hiR.chartRows[i] ? hiR.chartRows[i].end : r.end) / defl(r.year),
    lo: (loR.chartRows[i] ? loR.chartRows[i].end : r.end) / defl(r.year),
  }))];
  return { ...emptyChart(), pts, marks, legend: "band" };
}

/* Historical mode's mix in the Dashboard's Calculator: the four holdings of
   the Drawdown Simulator's and the Backtest's pop-ups, adding up to 100%,
   each earning its actual returns. */
function mixWords(s: StagesInputs): string {
  const us = parseNum(s.histMix), sv = parseNum(s.histSv ?? "0"), cash = parseNum(s.histCash ?? "0"), bond = Math.max(0, 100 - us - sv - cash);
  const parts: [number, string][] = [[us, "US stocks"], [sv, "small-cap value"], [bond, "bonds"], [cash, "cash"]];
  return parts.filter(([v]) => v > 0).map(([v, n]) => fmtNum(v) + "% " + n).join(", ") || "Nothing invested";
}
function HistMixButton({ s, setState }: { s: StagesInputs; setState: (f: (c: StagesInputs) => StagesInputs) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <Field id="histMixBtnS" label={<Tipped text="Asset mix" k="histmix" />}>
      <Button variant="outline" className="w-full max-w-90 justify-between" id="histMixBtnS" onClick={() => setOpen(true)}>
        <span className="min-w-0 flex-1 truncate text-left">{mixWords(s)}</span><ChevronRightIcon className="text-muted-foreground" aria-hidden="true" /></Button>
      {open ? <HistMixDialog s={s} close={() => setOpen(false)} save={(f) => setState((c) => ({ ...c, histMix: f.stock, histSv: f.sv, histCash: f.cash }))} /> : null}
    </Field>
  );
}
function HistMixDialog({ s, close, save }: { s: StagesInputs; close: () => void; save: (f: MixForm) => void }) {
  const [f, setF] = useState<MixForm>(() => {
    const stock = parseNum(s.histMix), sv = parseNum(s.histSv ?? "0"), cash = parseNum(s.histCash ?? "0");
    return mixForm({ stock, sv, bond: Math.max(0, 100 - stock - sv - cash), cash });
  });
  const up = (k: keyof MixForm) => (v: string) => setF((c) => ({ ...c, [k]: v }));
  const ok = mixOk(f);
  return (
    <Modal size="wide" onClose={close} focus="[data-mix]">
      <h3>Asset mix</h3>
      <div className="formhint">How your savings are invested while you save. Each holding earns its actual monthly returns; small-cap value and cash start in July 1926, so a mix with either starts its runs there. A glide in your last stage moves the stocks&apos; total, small-cap value keeping its share of them.</div>
      <MixRows f={f} up={up} totId="histMixTotS" />
      <div className="formactions"><Button variant="outline" className="flex-1" data-mixcancel onClick={close}>Cancel</Button>
        <Button className="flex-1" data-mixok disabled={!ok} onClick={() => {
          if (!ok) return;
          save({ stock: String(parseNum(f.stock)), sv: String(parseNum(f.sv)), bond: f.bond, cash: String(parseNum(f.cash)) });
          close();
        }}>Use this mix</Button></div>
    </Modal>
  );
}
