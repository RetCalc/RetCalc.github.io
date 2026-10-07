"use client";

/* The Drawdown Simulator: once you start spending it, will it last? A
   portfolio and a withdrawal strategy, tested against every retirement
   since 1926 or thousands of Monte Carlo runs, with three views: your plan,
   every strategy compared at the same risk, and the most you could have
   spent. Ported from src/js/app/15-drawdown.js and its companions, and
   src/main/08-drawdown.html. */

import { useDeferredValue, useMemo, useRef, useState } from "react";
import { useHousehold, useHouseholdFill } from "@/components/household/HouseholdProvider";
import { usePopup } from "@/components/shell/Popup";
import { useToast } from "@/components/shell/Toast";
import { Tipped } from "@/components/shell/Tooltips";
import { toolInputs, useToolState } from "@/components/tools/ToolState";
import { HeroReading, PinnedReading, type HeroTone, type ReadingFigure } from "@/components/common/Reading";
import { Html } from "@/components/common/Html";
import { useJob } from "@/lib/engine/jobs";
import { project, projectBasic, projectSeries } from "@/lib/engine/typed";
import {
  HIST_START, HIST_STOCK, ddOptsFromState, ddScorecard, ddWindows, historicalBacktest,
  type DdMC, type DdOpts, type DdPrep,
} from "@/lib/engine/typed-drawdown";
import { dollarsField, money, pctStr } from "@/lib/format";
import { MC_RUNS, useMcSeed } from "@/lib/mc-seed";
import { useStoredText } from "@/lib/useStoredText";
import { ADVANCED_DEFAULTS, advancedPlan } from "@/tools/advanced/model";
import { BASIC_INPUTS, basicInput } from "@/tools/basic/model";
import { STAGES_DEFAULTS, stagesPlan } from "@/tools/stages/model";
import { CompareView } from "./CompareView";
import { DrawdownDialogs, type Dialog } from "./Dialogs";
import { DRAWDOWN_DEF, ddLanding, ddRaw, ddWrite, drawdownSetup, type DrawdownState } from "./fields";
import { Inputs } from "./Inputs";
import { DD_DRAGS, PlanView, deltaHtml, histExtras, ssRows, type PlanResult } from "./PlanView";
import { SafeView } from "./SafeView";
import { comfortNote, lineWords, mcWords, planLabel, startLabel, target } from "./text";
import { useShareKit } from "@/components/shell/share";
import { drawdownShare } from "./share";
import { useBusy } from "@/lib/busy";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { NativeSelect } from "@/components/ui/native-select";
import { CircleAlertIcon, CircleCheckIcon, CircleXIcon, XIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Segmented as SegmentedGroup, SegmentedItem } from "@/components/ui/segmented";

/** What the panels share: the inputs as typed and as the engine reads them,
    year one, the retirement age and the comfort line. */
export interface DDView {
  s: DrawdownState;
  set: (k: string) => (v: string | boolean) => void;
  setState: (f: (c: DrawdownState) => DrawdownState) => void;
  d: Record<string, unknown>; o: DdOpts; P: DdPrep; firstW: number; r1: number;
  /** The age typed (null when blank): ages replace years everywhere once set. */
  age: number | null;
  comfort: number | number[]; comfortNote: string;
  mode: "hist" | "mc"; inputs: "simple" | "adv"; setInputs: (m: "simple" | "adv") => void;
  lastMonthly: boolean; tracesOn: boolean; toggleTraces: () => void;
  detailTable: React.RefObject<HTMLTableElement | null>;
  copyFromPlan: () => void;
  /** Sets fields from saved values, shows the plan and says so. */
  apply: (f: Record<string, unknown>, msg: string) => void;
}

/* The strategies the picker offers, in its order. */
export const PICKER_IDS = ["fixed", "kitces", "pct", "clyatt", "oneovern", "rmd", "vpw", "guardrails", "riskgr", "floorceil", "vanguard", "yale", "hebeler", "sensible", "cape"];

export function Drawdown({ landing }: { landing?: string }) {
  const { state: s, set, setState } = useToolState(DRAWDOWN_DEF, landing ? (c) => ddLanding(c, landing) : undefined);
  const { profile } = useHousehold();
  const toast = useToast();
  const showPopup = usePopup();
  const seed = useMcSeed();
  const [mode, setMode] = useState<"hist" | "mc">("hist");
  const [tab, setTab] = useState<"plan" | "compare" | "safe">("plan");
  const [storedInputs, setStoredInputs] = useStoredText("retcalc-dd-inputs", "simple");
  const inputs = storedInputs === "adv" ? "adv" : "simple";
  const [introSeen, setIntroSeen] = useStoredText("retcalc-dd-intro-seen", "0", "1");
  const [tracesOn, setTracesOn] = useState(true);
  const [pinned, setPinned] = useState<{ state: Record<string, unknown>; label: string } | null>(null);
  const [sel, setSel] = useState<number | null>(null);
  const [view, setView] = useState<"all" | "year">("all");
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const detailTable = useRef<HTMLTableElement>(null);

  useHouseholdFill("drawdown", (h) => setState((c) => {
    const has = (x: number | null) => x != null && isFinite(x);
    const married = h.status === "m";
    const retire = has(h.retire) && h.retire! > 0 && h.retire! < 120 ? Math.round(h.retire!) : null;
    const d: Record<string, unknown> = { ssWho: married ? "couple" : "single" };
    if (retire) d.retireAge = String(retire);
    if (has(h.income)) d.ssIncome = h.income;
    if (married && has(h.income2)) d.ssIncome2 = h.income2;
    return ddWrite(c, d);
  }));

  /* Every run works from the inputs a moment behind the typing, so the
     fields keep up with the keyboard. */
  const typed = useDeferredValue(s);
  useBusy(typed !== s);
  const base = useMemo(() => drawdownSetup(typed), [typed]);
  const { d, o, P, comfort, age } = base;
  useShareKit(DRAWDOWN_DEF.id, drawdownShare(o, sel));

  /* ---- the historical test, and the baseline through it ---- */
  const hist = useMemo(() => {
    if (mode !== "hist" || !(o.initial > 0)) return null;
    const H = historicalBacktest(o);
    if (!H.total) return { H, R: null };
    let B = null;
    if (pinned) {
      const bo = ddOptsFromState(pinned.state);
      if (bo.initial > 0) {
        const BH = historicalBacktest(bo);
        if (BH.total) B = { o: bo, H: BH, sc: ddScorecard(BH.runs, bo, comfort, BH.prep.path) };
      }
    }
    const R: PlanResult = { kind: "hist", H, B, sc: ddScorecard(H.runs, o, comfort, H.prep.path), ...histExtras(o, d) };
    return { H, R };
  }, [mode, o, d, comfort, pinned]);

  /* ---- Monte Carlo, in the worker ---- */
  const mcOn = mode === "mc" && o.initial > 0;
  const ssx = mcOn ? ssRows(o, d) : null;
  const mc = useJob<DdMC>("mc", "mc", mcOn ? { o, trials: MC_RUNS, seed, comfort, extra: { sens: DD_DRAGS, ss: ssx ? ssx.flat : null } } : null,
    JSON.stringify([d, seed, comfort]));
  const bo = pinned ? ddOptsFromState(pinned.state) : null;
  const mcb = useJob<DdMC>("mcb", "mc", mcOn && bo && bo.initial > 0 ? { o: bo, trials: MC_RUNS, seed, comfort } : null,
    JSON.stringify([pinned?.state, seed, comfort]));
  const R: PlanResult | null = mode === "hist" ? hist?.R ?? null
    : mcOn && mc.res ? { kind: "mc", M: mc.res, Mb: pinned && mcb.res ? mcb.res : null, baseInitial: bo?.initial ?? 0 } : null;

  /* The start the plan view shows: the first that ran out, or the one that
     ended lowest, until one is picked; it stays picked while it's tested. */
  const H = hist?.H ?? null;
  if (H?.total && (sel === null || !H.runs.some((r) => r.startIdx === sel))) {
    const worst = H.runs.slice().sort((a, b) => a.endReal - b.endReal)[0];
    setSel((H.firstFail || worst).startIdx);
  }

  const T = target(d, comfort);
  const v: DDView = {
    s, set: set as DDView["set"], setState, ...base, comfortNote: comfortNote(o, P, age),
    mode, inputs, setInputs: setStoredInputs, lastMonthly: o.monthly, tracesOn, toggleTraces: () => setTracesOn((x) => !x), detailTable,
    copyFromPlan: async () => {
      // the three calculators' results, from their inputs as last left
      const b = basicInput(toolInputs("basic", BASIC_INPUTS));
      const sp = stagesPlan(toolInputs("stages", STAGES_DEFAULTS), profile);
      const sources = [
        { label: "Basic", value: b.years > 0 ? projectBasic(b).fv : 0 },
        { label: "Advanced", value: project(advancedPlan(toolInputs("advanced", ADVANCED_DEFAULTS), profile).p).fvReal },
        { label: "Stages", value: projectSeries(sp.g, sp.eff).fvReal },
      ].filter((x) => x.value > 0);
      if (!sources.length) {
        toast("Run a retirement projection first");
        return;
      }
      const i = sources.length === 1 ? 0 : await showPopup("Copy from which plan?", sources.map((x) => ({ label: x.label, desc: money(x.value), money: true })));
      if (i < 0) return;
      setState((c) => ({ ...c, initial: dollarsField(sources[i].value) }));
      toast("Copied " + money(sources[i].value) + " from " + sources[i].label);
    },
    apply: (f, msg) => {
      setState((c) => ddWrite(c, f));
      setTab("plan");
      try { window.scrollTo({ top: 0, behavior: "smooth" }); } catch { /* old browsers */ }
      toast(msg);
    },
  };

  /* ---- the inputs panel's notes on the history tested ---- */
  let fromNote = "", periods = "";
  if (mode === "hist" && H) {
    if (!H.total) {
      fromNote = "<b class='warn'>Too long for the " + HIST_START + "–" + (HIST_START + HIST_STOCK.length - 1) + " data</b>";
      periods = "no complete runs";
    } else {
      fromNote = "<b>" + H.total + "</b> periods, " + H.first + "–" + startLabel(H.runs[H.runs.length - 1], H.monthly);
      periods = H.total + (H.monthly ? " start months" : " start years");
    }
  } else if (mode === "mc" && o.initial > 0) {
    const W = ddWindows(o);
    fromNote = W.length ? "<b>" + W.length + "</b> periods, " + W[0].year + "–" + startLabel({ startYear: W[W.length - 1].year, startMonth: W[W.length - 1].month }, o.monthly)
      : "<b class='warn'>Too long for the " + HIST_START + "–" + (HIST_START + HIST_STOCK.length - 1) + " data</b>";
    periods = mc.res ? mc.res.trials.toLocaleString("en-US") + " runs" : "";
  }

  /* Nothing to show under the reading: no portfolio yet, or a retirement
     too long for the record. */
  const noRun = !(o.initial > 0) || (mode === "hist" && !!H && !H.total);
  const F = readoutFigures(o, mode, R, H, mcOn && mc.stale);

  return (
    <div className="col-span-full grid grid-cols-1 items-start gap-5 max-sm:gap-3.5 lg:grid-cols-3">
      <div className="min-w-0 lg:col-span-1 lg:self-stretch">
        {/* Phones and narrow screens: the answer leads, and stays under the
            tab rail while the inputs are on screen. */}
        <PinnedReading tone={F.tone} main={{ label: "Success rate", value: F.success }} side={{ label: "Median ending balance", value: F.median }} />
        <Inputs v={v} fromNote={fromNote} periods={periods} open={setDialog} />
      </div>
      <div className="stack min-w-0 lg:col-span-2" id="tab-drawdown" data-tab={tab}>
        <Readout v={v} F={F} pinned={pinned}
          setMode={setMode}
          pin={() => {
            if (!(o.initial > 0)) {
              toast("Enter a portfolio value first");
              return;
            }
            setPinned({ state: ddRaw(s), label: planLabel(o) });
            toast("Pinned. Change anything to compare");
          }}
          unpin={() => setPinned(null)} />

        {/* A strategy page's header already says what it's set up to answer. */}
        <Card id="ddIntro" hidden={introSeen === "1" || !!landing}>
          <CardContent className="flex items-start gap-3.5">
            <div className="min-w-0 flex-auto">
              <div className="mb-1.5 font-semibold text-foreground">New here? Here&apos;s the idea.</div>
              <div className="hint m-0 max-w-copy">
                Every other tool answers &quot;how much will I have?&quot; This one answers the
                harder question: once you start spending it, <b>will it last?</b> Set a
                portfolio value and a withdrawal strategy, then test it against every
                real retirement since 1926: not a guess, actual market history.
                Click any row in the table below to see exactly what that year looked
                like, year by year.
              </div>
            </div>
            <Button variant="ghost" size="icon-sm" id="ddIntroClose" aria-label="Dismiss" onClick={() => setIntroSeen("1")}><XIcon aria-hidden="true" /></Button>
          </CardContent>
        </Card>

        <div className="stack" hidden={noRun}>
          <div className="ddtabs" id="ddTabs">
            <SegmentedGroup size="tab" id="segDDTab" aria-label="Results">
              {([["plan", "Your plan"], ["compare", "Compare strategies"], ["safe", "Safe spending"]] as const).map(([k, label]) => (
                <SegmentedItem key={k} data-ddtab={k} pressed={tab === k} onClick={() => setTab(k)}>{label}</SegmentedItem>
              ))}
            </SegmentedGroup>
          </div>

          <Card id="ddTargetPanel" data-ddtabs="compare safe">
            <CardContent>
              <div className="ddtgt-row">
                <span className="ddtgt-k"><Tipped text="Risk target" k="ddtarget" /></span>
                <NativeSelect className="w-auto max-w-full" id="ddTCrit" aria-label="What the target asks" value={s.tCrit as string} onChange={(e) => set("tCrit")(e.target.value)}>
                  <option value="comfort">Never below the comfort line</option>
                  <option value="lasts">The money lasts</option>
                </NativeSelect>
                <span>in</span>
                <NativeSelect className="w-auto max-w-full" id="ddTConf" aria-label="How many historical starts" value={s.tConf as string} onChange={(e) => set("tConf")(e.target.value)}>
                  <option value="100">every</option>
                  <option value="95">95% of</option>
                  <option value="90">90% of</option>
                  <option value="85">85% of</option>
                </NativeSelect>
                <span id="ddTStarts">historical starts</span>
              </div>
              <Html className="hint mb-0" id="ddTargetNote" html={"Comfort line: <b>" + lineWords(comfort, age, " a year") + "</b>" +
                (o.comfort > 0 ? "" : " (set your own with Comfort line, in the inputs)") + ". These views use the historical record" +
                (mode === "mc" ? ", whatever the Historical / Monte Carlo switch says" : "") + ", " +
                (o.monthly ? "a retirement starting every month" : "a retirement starting each January") + " from " + o.fromYear + "."} />
            </CardContent>
          </Card>

          <PlanView v={v} R={R} ps={{ sel, setSel, view, setView }} />
          <CompareView v={v} T={T} active={tab === "compare"} />
          <SafeView v={v} T={T} active={tab === "safe"} />
        </div>
      </div>
      <DrawdownDialogs v={v} dialog={dialog} close={() => setDialog(null)} />
    </div>
  );
}

/* ---- the headline: success rate, median and worst, against the baseline ---- */
type Figures = { success: number; median: number; worst: number; legacy: number | null };
interface ReadoutFigures {
  success: string; tone: HeroTone; successNote: string; median: string; worst: string; worstLabel: string; worstNote: string;
  verdict: string; badge: string; legacy: { v: string; note: string } | null; cur: Figures | null; was: Figures | null;
}

function readoutFigures(o: DdOpts, mode: "hist" | "mc", R: PlanResult | null, H: ReturnType<typeof historicalBacktest> | null, running: boolean): ReadoutFigures {
  const lastYear = HIST_START + HIST_STOCK.length - 1;
  const F: ReadoutFigures = { success: "—", tone: "text", successNote: "", median: "—", worst: "—", worstLabel: mode === "mc" ? "10th percentile" : "Worst case", worstNote: "",
    verdict: "", badge: HIST_START + "–" + lastYear, legacy: null, cur: null, was: null };
  // The success rate is a rating: gain from 95%, plain text from 85%, loss below.
  const tone = (r: number): HeroTone => (r >= 0.95 ? "gain" : r >= 0.85 ? "text" : "loss");
  const legacyOf = (met: number, total: number, note: string) => ({ v: pctStr(met / total, 1), note });
  if (!(o.initial > 0)) F.verdict = "Enter your portfolio value to run the simulation.";
  else if (mode === "hist" && H) {
    if (!H.total) {
      F.badge = "—";
      F.verdict = "Nothing to test: a " + o.years + "-year retirement starting in " + o.fromYear + " has not finished yet.";
    } else {
      F.badge = H.first + "–" + lastYear + (H.monthly ? " · monthly" : "");
      F.success = pctStr(H.successRate, 1);
      F.tone = tone(H.successRate);
      F.successNote = H.survived + " of " + H.total + " retirements lasted " + o.years + " years";
      F.median = money(H.medianEnd);
      F.worst = money(H.worstEnd);
      F.worstNote = H.failCount ? "Ran out in " + H.failCount + " of " + H.total + " retirements" : "Never ran out";
      F.verdict = H.successRate >= 0.99
        ? "<b>This plan survived every historical period.</b> Including the Great Depression, the 1970s stagflation, and the 2008 crash."
        : H.successRate >= 0.9
          ? "<b>This plan survived most historical periods.</b> It failed only when retirement began in " + H.failYears.slice(0, 6).join(", ") +
            (H.failYears.length > 6 ? " and others" : "") + ", the worst sequences on record."
          : "<b>This plan ran out of money in " + H.failCount + " of " + H.total + " historical periods.</b> Consider a lower withdrawal rate or a strategy that adjusts spending.";
      const met = (h: typeof H) => h.runs.filter((r) => r.endReal >= o.legacyGoal).length;
      if (o.legacyGoal > 0) F.legacy = legacyOf(met(H), H.runs.length, met(H) + " of " + H.total + " periods");
      F.cur = { success: H.successRate, median: H.medianEnd, worst: H.worstEnd, legacy: o.legacyGoal > 0 ? met(H) / H.total : null };
      const B = R?.kind === "hist" ? R.B : null;
      if (B) F.was = { success: B.H.successRate, median: B.H.medianEnd, worst: B.H.worstEnd, legacy: o.legacyGoal > 0 ? met(B.H) / B.H.total : null };
    }
  } else if (mode === "mc" && R?.kind === "mc") {
    const M = R.M, t = M.trials.toLocaleString("en-US");
    F.badge = running ? "Running…" : t + " simulations";
    F.success = pctStr(M.successRate, 1);
    F.tone = tone(M.successRate);
    F.successNote = M.survived.toLocaleString("en-US") + " of " + t + " runs lasted " + o.years + " years";
    F.median = money(M.medianEnd);
    F.worst = money(M.p10End);
    F.worstNote = "10th percentile outcome";
    F.verdict = mcWords(o);
    if (o.legacyGoal > 0) F.legacy = legacyOf(M.legacy, M.trials, M.legacy.toLocaleString("en-US") + " of " + t + " simulations");
    F.cur = { success: M.successRate, median: M.medianEnd, worst: M.p10End, legacy: o.legacyGoal > 0 ? M.legacy / M.trials : null };
    const Mb = R.Mb;
    if (Mb) F.was = { success: Mb.successRate, median: Mb.medianEnd, worst: Mb.p10End, legacy: o.legacyGoal > 0 ? Mb.legacy / Mb.trials : null };
  } else if (mode === "mc") F.badge = "Running…";
  return F;
}

const TONE_ICON = { gain: CircleCheckIcon, text: CircleAlertIcon, loss: CircleXIcon, answer: CircleCheckIcon } as const;
const TONE_TEXT = { gain: "text-gain", text: "text-foreground", loss: "text-destructive", answer: "text-primary" } as const;

function Readout({ v, F, pinned, setMode, pin, unpin }: {
  v: DDView; F: ReadoutFigures;
  pinned: { state: Record<string, unknown>; label: string } | null;
  setMode: (m: "hist" | "mc") => void; pin: () => void; unpin: () => void;
}) {
  const { mode } = v;
  const delta = (id: string, k: keyof Figures, kind: "pts" | "money") => {
    const c = F.cur?.[k], b = F.was?.[k];
    const h = pinned && c != null && b != null ? deltaHtml(c, b, kind) : "";
    return <Html className="dddelta" id={id} hidden={!h} html={h} />;
  };
  const ToneIcon = TONE_ICON[F.tone];
  const figures: ReadingFigure[] = [
    { label: "Median ending balance", id: "ddMedian", value: F.median, note: "In today's dollars", extra: delta("ddMedianD", "median", "money") },
    { label: F.worstLabel, id: "ddWorst", value: F.worst, note: F.worstNote, noteId: "ddWorstNote", extra: delta("ddWorstD", "worst", "money") },
  ];
  if (F.legacy) figures.push({ label: "Meet legacy goal", id: "ddLegacy", wrapId: "ddLegacyWrap", value: F.legacy.v, note: F.legacy.note, noteId: "ddLegacyNote", extra: delta("ddLegacyD", "legacy", "pts") });
  return (
    <Card size="flush" className="min-w-0">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-border px-5.5 py-3 max-sm:px-4">
        <SegmentedGroup id="segDD" aria-label="How it's tested">
          <SegmentedItem data-dd="hist" pressed={mode === "hist"} onClick={() => setMode("hist")}>Historical</SegmentedItem>
          <SegmentedItem data-dd="mc" pressed={mode === "mc"} onClick={() => setMode("mc")}>Monte Carlo</SegmentedItem>
        </SegmentedGroup>
        <Badge variant="outline" id="ddBadge">{F.badge}</Badge>
        <Button variant="outline" size="sm" className="ml-auto" id="ddPin" title="Keep these results to compare your next changes against" onClick={pin}>{pinned ? "Pin again" : "Pin as baseline"}</Button>
      </div>
      <HeroReading tone={F.tone}
        hero={{
          label: <Tipped text="Success rate" k="successrate" />, id: "ddSuccess", value: F.success, noteId: "ddSuccessNote",
          note: F.successNote ? <span className="inline-flex items-center gap-1.5"><ToneIcon className={cn("size-3.5 shrink-0", TONE_TEXT[F.tone])} aria-hidden="true" />{F.successNote}</span> : null,
        }}
        figures={figures}>
        {delta("ddSuccessD", "success", "pts")}
      </HeroReading>
      <div className="border-t border-border px-5.5 py-3.5 max-sm:px-4" hidden={!F.verdict}>
        {/* The verdict reads as the reading's sentence; Monte Carlo's says how
            the runs are drawn, so it stays quieter. */}
        <Html className={mode === "mc" ? "max-w-copy text-note text-muted-foreground" : "max-w-copy text-body text-foreground"} id="ddVerdict" html={F.verdict} />
      </div>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 border-t border-border px-5.5 py-2.5 text-note max-sm:px-4" id="ddBaseBar" hidden={!pinned}>
        <span className="text-label text-muted-foreground">Baseline</span><span className="font-semibold text-foreground" id="ddBaseLabel">{pinned?.label ?? ""}</span>
        <span className="min-w-0 flex-auto text-muted-foreground">Changes since are marked <b className="pos">better</b> or <b className="neg">worse</b>; the charts draw it dashed.</span>
        <Button variant="outline" size="sm" id="ddBaseClear" onClick={unpin}>Clear</Button>
      </div>
    </Card>
  );
}

export type { DrawdownState };
