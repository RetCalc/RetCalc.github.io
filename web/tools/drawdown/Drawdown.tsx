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
import { BigValue } from "@/components/common/BigValue";
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

  return (
    <>
      <Inputs v={v} fromNote={fromNote} periods={periods} open={setDialog} />
      <div className="stack" id="tab-drawdown" data-tab={tab}>
        <Card id="ddIntro" hidden={introSeen === "1"}>
          <CardContent className="flex gap-3.5 items-start">
            <div className="flex-auto min-w-0">
              <div className="font-semibold text-text mb-1.5">New here? Here&apos;s the idea.</div>
              <div className="hint m-0">
                Every other tool answers &quot;how much will I have?&quot; This one answers the
                harder question: once you start spending it, <b>will it last?</b> Set a
                portfolio value and a withdrawal strategy, then test it against every
                real retirement since 1926: not a guess, actual market history.
                Click any row in the table below to see exactly what that year looked
                like, year by year.
              </div>
            </div>
            <Button variant="ghost" size="icon-sm" id="ddIntroClose" aria-label="Dismiss" onClick={() => setIntroSeen("1")}>&times;</Button>
          </CardContent>
        </Card>
        <Readout v={v} R={R} H={H} running={mcOn && mc.stale} pinned={pinned}
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

        <div className="ddtabs" id="ddTabs">
          <span className="seg" id="segDDTab" aria-label="Results">
            {([["plan", "Your plan"], ["compare", "Compare strategies"], ["safe", "Safe spending"]] as const).map(([k, label]) => (
              <button key={k} type="button" data-ddtab={k} className={tab === k ? "on" : undefined} aria-pressed={tab === k} onClick={() => setTab(k)}>{label}</button>
            ))}
          </span>
        </div>

        <Card id="ddTargetPanel" data-ddtabs="compare safe">
          <CardContent>
            <div className="ddtgt-row">
              <span className="ddtgt-k"><Tipped text="Risk target" k="ddtarget" /></span>
              <select id="ddTCrit" aria-label="What the target asks" value={s.tCrit as string} onChange={(e) => set("tCrit")(e.target.value)}>
                <option value="comfort">Never below the comfort line</option>
                <option value="lasts">The money lasts</option>
              </select>
              <span>in</span>
              <select id="ddTConf" aria-label="How many historical starts" value={s.tConf as string} onChange={(e) => set("tConf")(e.target.value)}>
                <option value="100">every</option>
                <option value="95">95% of</option>
                <option value="90">90% of</option>
                <option value="85">85% of</option>
              </select>
              <span id="ddTStarts">historical starts</span>
            </div>
            <Html className="hint" id="ddTargetNote" html={"Comfort line: <b>" + lineWords(comfort, age, " a year") + "</b>" +
              (o.comfort > 0 ? "" : " (set your own with Comfort line, in the inputs)") + ". These views use the historical record" +
              (mode === "mc" ? ", whatever the Historical / Monte Carlo switch says" : "") + ", " +
              (o.monthly ? "a retirement starting every month" : "a retirement starting each January") + " from " + o.fromYear + "."} />
          </CardContent>
        </Card>

        <PlanView v={v} R={R} ps={{ sel, setSel, view, setView }} />
        <CompareView v={v} T={T} active={tab === "compare"} />
        <SafeView v={v} T={T} active={tab === "safe"} />
      </div>
      <DrawdownDialogs v={v} dialog={dialog} close={() => setDialog(null)} />
    </>
  );
}

/* ---- the headline: success rate, median and worst, against the baseline ---- */
function Readout({ v, R, H, running, pinned, setMode, pin, unpin }: {
  v: DDView; R: PlanResult | null; H: ReturnType<typeof historicalBacktest> | null; running: boolean;
  pinned: { state: Record<string, unknown>; label: string } | null;
  setMode: (m: "hist" | "mc") => void; pin: () => void; unpin: () => void;
}) {
  const { o, mode } = v;
  const lastYear = HIST_START + HIST_STOCK.length - 1;
  let success = "—", successCls = "v gold", successNote = "", median = "—", worst = "—", worstNote = "", verdict = "", badge = HIST_START + "–" + lastYear;
  let legacy: { v: string; cls: string; note: string } | null = null;
  type Figures = { success: number; median: number; worst: number; legacy: number | null };
  let cur: Figures | null = null, was: Figures | null = null;
  const cls = (r: number) => "v " + (r >= 0.95 ? "pos" : r >= 0.85 ? "gold" : "neg");
  const legacyOf = (met: number, total: number, note: string) => ({ v: pctStr(met / total, 1), cls: "v " + (met / total >= 0.75 ? "pos" : met / total >= 0.5 ? "gold" : "neg"), note });
  if (!(o.initial > 0)) verdict = "<div class='hint' style='margin:0'>Enter your portfolio value to run the simulation.</div>";
  else if (mode === "hist" && H) {
    if (!H.total) {
      badge = "—";
      verdict = "<div class='hint' style='margin:0'>Nothing to test: a " + o.years + "-year retirement starting in " + o.fromYear + " has not finished yet.</div>";
    } else {
      badge = H.first + "–" + lastYear + (H.monthly ? " · monthly" : "");
      success = pctStr(H.successRate, 1);
      successCls = cls(H.successRate);
      successNote = H.survived + " of " + H.total + " retirements lasted " + o.years + " years";
      median = money(H.medianEnd);
      worst = money(H.worstEnd);
      worstNote = H.failCount ? "Ran out in " + H.failCount + " of " + H.total + " retirements" : "Never ran out";
      verdict = "<div class='hint' style='margin:0;font-size:13px'>" + (H.successRate >= 0.99
        ? "<b class='pos'>This plan survived every historical period.</b> Including the Great Depression, the 1970s stagflation, and the 2008 crash."
        : H.successRate >= 0.9
          ? "<b class='gold'>This plan survived most historical periods.</b> It failed only when retirement began in " + H.failYears.slice(0, 6).join(", ") +
            (H.failYears.length > 6 ? " and others" : "") + ", the worst sequences on record."
          : "<b class='neg'>This plan ran out of money in " + H.failCount + " of " + H.total + " historical periods.</b> Consider a lower withdrawal rate or a strategy that adjusts spending.") + "</div>";
      const met = (h: typeof H) => h.runs.filter((r) => r.endReal >= o.legacyGoal).length;
      if (o.legacyGoal > 0) legacy = legacyOf(met(H), H.runs.length, met(H) + " of " + H.total + " periods");
      cur = { success: H.successRate, median: H.medianEnd, worst: H.worstEnd, legacy: o.legacyGoal > 0 ? met(H) / H.total : null };
      const B = R?.kind === "hist" ? R.B : null;
      if (B) was = { success: B.H.successRate, median: B.H.medianEnd, worst: B.H.worstEnd, legacy: o.legacyGoal > 0 ? met(B.H) / B.H.total : null };
    }
  } else if (mode === "mc" && R?.kind === "mc") {
    const M = R.M, t = M.trials.toLocaleString("en-US");
    badge = running ? "Running…" : t + " simulations";
    success = pctStr(M.successRate, 1);
    successCls = cls(M.successRate);
    successNote = M.survived.toLocaleString("en-US") + " of " + t + " runs lasted " + o.years + " years";
    median = money(M.medianEnd);
    worst = money(M.p10End);
    worstNote = "10th percentile outcome";
    verdict = "<div class='hint' style='margin:0;font-size:13px'>" + mcWords(o) + "</div>";
    if (o.legacyGoal > 0) legacy = legacyOf(M.legacy, M.trials, M.legacy.toLocaleString("en-US") + " of " + t + " simulations");
    cur = { success: M.successRate, median: M.medianEnd, worst: M.p10End, legacy: o.legacyGoal > 0 ? M.legacy / M.trials : null };
    const Mb = R.Mb;
    if (Mb) was = { success: Mb.successRate, median: Mb.medianEnd, worst: Mb.p10End, legacy: o.legacyGoal > 0 ? Mb.legacy / Mb.trials : null };
  } else if (mode === "mc") badge = "Running…";
  const delta = (id: string, k: keyof Figures, kind: "pts" | "money") => {
    const c = cur?.[k], b = was?.[k];
    const h = pinned && c != null && b != null ? deltaHtml(c, b, kind) : "";
    return <Html className="dddelta" id={id} hidden={!h} html={h} />;
  };
  return (
    <Card size="flush">
      <div className="readout">
        <div className="txhead">
          <span className="seg" id="segDD">
            <button type="button" data-dd="hist" className={mode === "hist" ? "on" : undefined} onClick={() => setMode("hist")}>Historical</button>
            <button type="button" data-dd="mc" className={mode === "mc" ? "on" : undefined} onClick={() => setMode("mc")}>Monte Carlo</button>
          </span>
          <Badge variant="outline" id="ddBadge">{badge}</Badge>
          <Button variant="outline" size="sm" className="ml-2" id="ddPin" title="Keep these results to compare your next changes against" onClick={pin}>{pinned ? "Pin again" : "Pin as baseline"}</Button>
        </div>
        <div className="headline">
          <div><div className="k"><Tipped text="Success rate" k="successrate" /></div><BigValue className={successCls} id="ddSuccess" text={success} sized={success !== "—"} />
            {delta("ddSuccessD", "success", "pts")}<div className="note" id="ddSuccessNote">{successNote}</div></div>
          <div><div className="k">Median ending balance</div><BigValue className="v" id="ddMedian" text={median} sized={median !== "—"} />
            {delta("ddMedianD", "median", "money")}<div className="note">In today&apos;s dollars</div></div>
          <div><div className="k">Worst case</div><BigValue className="v" id="ddWorst" text={worst} sized={worst !== "—"} />
            {delta("ddWorstD", "worst", "money")}<div className="note" id="ddWorstNote">{worstNote}</div></div>
          <div id="ddLegacyWrap" hidden={!legacy}><div className="k">Meet legacy goal</div><div className={legacy?.cls ?? "v"} id="ddLegacy">{legacy?.v ?? "—"}</div>
            {delta("ddLegacyD", "legacy", "pts")}<div className="note" id="ddLegacyNote">{legacy?.note ?? ""}</div></div>
        </div>
      </div>
      <div className="ddbase" id="ddBaseBar" hidden={!pinned}>
        <span className="ddbase-k">Baseline</span><span className="ddbase-v" id="ddBaseLabel">{pinned?.label ?? ""}</span>
        <span className="ddbase-n">Changes since are marked <b className="pos">better</b> or <b className="neg">worse</b>; the charts draw it dashed.</span>
        <Button variant="outline" size="sm" id="ddBaseClear" onClick={unpin}>Clear</Button>
      </div>
      <CardContent><Html id="ddVerdict" html={verdict} /></CardContent>
    </Card>
  );
}

export type { DrawdownState };
