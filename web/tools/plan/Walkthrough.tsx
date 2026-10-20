"use client";

/* Paycheck to Retirement (PAYCHECK_PLAN_BRIEF.md): from gross pay to a
   retirement plan in one place. A step rail, the running figures under it,
   then the step: Start (your ages, pay, filing status and state), then the
   real Budget, Paycheck tab, Advanced and Stages screens, each on the walkthrough's own copy of its
   inputs (a tool scope), and the Summary. Moving between steps fills each
   later one from the ones before (flow.ts). */

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { CheckIcon } from "lucide-react";
import { useHousehold } from "@/components/household/HouseholdProvider";
import { ScenarioBar } from "@/components/shell/ScenarioBar";
import { useToast } from "@/components/shell/Toast";
import { TAB_STORE, ToolScopeProvider, decodeHash, readScenarios, useRegisterTool, type ToolDef, type ToolInputs, type ToolScope } from "@/components/tools/ToolState";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { DASH, money } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Advanced } from "@/tools/advanced/Advanced";
import { Budget } from "@/tools/budget/Budget";
import { Stages } from "@/tools/stages/Stages";
import { fromOldTaxes, seedAdvanced, seedStages, startDone, strip } from "./flow";
import { PLAN_DEFAULTS, PLAN_STORE, STEPS, loadPlan, planHasWork, readPlan, rereadPlan, setPlan, stepIndex, subscribePlan, type PlanState, type PlanTool, type StepId } from "./model";
import { KidsCard } from "./KidsDialog";
import { StartStep, StepHead } from "./steps";
import { Summary } from "./Summary";

const PLAN_TOOLS: string[] = ["tax", "budget", "advanced", "stages"] satisfies PlanTool[];

/** The walkthrough as a tool, for the header's Save, Share and Reset. */
const PLAN_DEF: ToolDef<ToolInputs> = {
  id: PLAN_STORE.key, label: "Paycheck to Retirement", noun: "plan", defaults: PLAN_DEFAULTS as unknown as ToolInputs,
  hasWork: (s) => planHasWork(s as unknown as PlanState),
};

/** Where a tool's move to another page lands in the walkthrough. */
const PATH_STEP: Record<string, StepId> = {
  "/budget": "budget", "/budget#paycheck": "paycheck", "/advanced": "plan", "/stages": "stages",
};

const NONE = () => null;
const usePlan = () => useSyncExternalStore(subscribePlan, readPlan, NONE);

export function Walkthrough() {
  const plan = usePlan();
  const { profile } = useHousehold();
  // Bumped whenever the walkthrough changes a step's inputs from outside
  // the tool on screen (a load, a sync), so the step draws them afresh.
  const [rev, setRev] = useState(0);
  const top = useRef<HTMLDivElement>(null);

  /** Moves to a step, filling it (and anything it's built on) first. */
  const goTo = useCallback((to: StepId) => {
    setPlan((p) => {
      let n = fromOldTaxes(p);
      const i = stepIndex(to);
      if (i >= stepIndex("plan")) n = seedAdvanced(n, profile);
      if (to === "stages") n = { ...n, stagesOn: true };
      if (i >= stepIndex("stages")) n = seedStages(n, profile);
      // The Budget step is the Budget tab, the Paycheck step its Paycheck tab.
      if ((to === "budget" || to === "paycheck") && n.tools.budget) n = { ...n, tools: { ...n.tools, budget: { ...n.tools.budget, view: to === "budget" ? "budget" : "paycheck" } } };
      return { ...n, step: to, reached: i > stepIndex(n.reached) ? to : n.reached };
    });
    requestAnimationFrame(() => top.current?.scrollIntoView({ block: "start" }));
  }, [profile]);
  const goRef = useRef(goTo);
  useEffect(() => { goRef.current = goTo; });

  // The tools on screen read and write the walkthrough's copy (stable, so
  // a tool's own effects don't run again on every change).
  const scope = useMemo<ToolScope>(() => ({
    name: PLAN_STORE.key,
    read: (id) => (PLAN_TOOLS.includes(id) ? readPlan().tools[id as PlanTool] : undefined),
    write: (id, data) => {
      if (!PLAN_TOOLS.includes(id)) { TAB_STORE.write(id, data); return; }
      setPlan((p) => (p.tools[id as PlanTool] === data ? p : { ...p, tools: { ...p.tools, [id]: data } }));
    },
    go: (path) => {
      const to = PATH_STEP[path];
      if (!to) return false;
      goRef.current(to);
      return true;
    },
  }), []);

  // Save, Share and Reset in the tool bar act on the whole walkthrough.
  const load = useCallback((d: ToolInputs) => { loadPlan(d); setRev((r) => r + 1); }, []);
  useRegisterTool(PLAN_DEF, (plan ?? PLAN_DEFAULTS) as unknown as ToolInputs, load);

  // A plan saved when Taxes was a step of its own: its pay into the paycheck.
  useEffect(() => { setPlan(fromOldTaxes); }, [rev]);

  // A share link opens with its plan; the account's copy arriving is read again.
  useEffect(() => {
    const h = window.location.hash;
    if (!h.startsWith("#s=")) return;
    const v = decodeHash(h.slice(3)) as { t?: string; d?: unknown } | null;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- the link is only readable in the browser
    if (v?.t === PLAN_STORE.key && v.d) load(v.d as ToolInputs);
  }, [load]);
  const toast = useToast();
  useEffect(() => {
    const on = (e: Event) => {
      const keys = (e as CustomEvent<string[]>).detail ?? [];
      if (keys.includes(PLAN_STORE.key)) { rereadPlan(); setRev((r) => r + 1); }
      // Two devices both changed it: the other version is a saved plan now.
      if (keys.includes("scenarios-" + PLAN_STORE.key)) {
        const kept = readScenarios(PLAN_STORE.key).filter((x) => x.name.startsWith("Plan from")).pop();
        if (kept) toast("Your other version is saved as “" + kept.name + "”: pick it from your saved plans");
      }
    };
    window.addEventListener("retcalc:synced", on);
    return () => window.removeEventListener("retcalc:synced", on);
  }, [toast]);

  if (!plan) return <div className="min-h-96" aria-busy="true"></div>;
  const step = plan.step, idx = stepIndex(step);
  // A step redraws its tool when the walkthrough itself refilled it.
  const key = step + ":" + rev + ":" + (step === "stages" ? plan.from.stages ?? "" : step === "plan" ? plan.from.advanced ?? "" : "");

  return (
    <>
      <div ref={top} className="scroll-mt-24">
        <Header plan={plan} goTo={goTo} />
      </div>
      {step !== "start" && step !== "summary" ? <RunningStrip plan={plan} /> : null}
      <StepHead step={step} />
      <ToolScopeProvider value={scope}>
        <Body key={key} step={step} plan={plan} goTo={goTo} />
      </ToolScopeProvider>
      <Foot plan={plan} idx={idx} goTo={goTo} />
    </>
  );
}

/* ---- the title and the step rail ---- */
function Header({ plan, goTo }: { plan: PlanState; goTo: (s: StepId) => void }) {
  const reached = stepIndex(plan.reached), cur = stepIndex(plan.step);
  return (
    <div className="toolback">
      <h1 className="toolhead-name">Paycheck to Retirement</h1>
      <div className="toolbar mt-3 w-full">
      <nav aria-label="Steps" className="-mx-1 min-w-0 max-w-full overflow-x-auto pb-1">
        <ol className="m-0 flex min-w-max list-none gap-1 p-0">
          {STEPS.map((s, i) => {
            // Life stages, skipped, stays open to go into but isn't ticked off.
            const skipped = s.id === "stages" && !plan.stagesOn;
            const on = i === cur, done = !skipped && (i < cur || (i <= reached && i !== cur)), can = i <= reached && !(skipped && i > cur);
            return (
              <li key={s.id}>
                {/* The step you're on is a key held down; steps reached are
                    plain and can be gone back to; the rest wait. */}
                <Button variant={on ? "outline" : "ghost"} size="sm" disabled={!can && !on} aria-current={on ? "step" : undefined}
                  aria-pressed={on || undefined} onClick={() => { if (!on) goTo(s.id); }}>
                  <span className={cn("grid size-5 place-items-center rounded-full border text-fine tabular-nums",
                    on ? "border-foreground" : done && can ? "border-transparent bg-foreground text-background" : "border-input")}>
                    {done && can && !on ? <CheckIcon className="size-3" aria-hidden="true" /> : i === 0 ? "•" : i}
                  </span>
                  <span className={cn(on && "font-semibold")}>{s.name}</span>{s.id === "stages" ? <span className="font-normal text-muted-foreground">(optional)</span> : null}
                </Button>
              </li>
            );
          })}
        </ol>
      </nav>
        <ScenarioBar />
      </div>
    </div>
  );
}

/* ---- the running figures: the paycheck so far ---- */
function RunningStrip({ plan }: { plan: PlanState }) {
  const s = strip(plan);
  const per = s ? (s.per === "month" ? "per month" : "a paycheck") : "a paycheck";
  const fig = (label: string, v: number | null, note?: string) => (
    <div className="min-w-0">
      <div className="text-label text-muted-foreground">{label}</div>
      <div className="text-xl font-medium tabular-nums">{v == null ? DASH : money(v)}</div>
      {note ? <div className="text-label text-muted-foreground">{note}</div> : null}
    </div>
  );
  const left = s ? (Math.abs(s.left) < 0.01 ? 0 : s.left) : null;
  return (
    <Card size="flush" className="col-span-full">
      <CardContent className="grid grid-cols-3 gap-x-6 gap-y-3 px-5.5 py-3.5 max-sm:grid-cols-2 max-sm:px-4 lg:grid-cols-6">
        {fig("Gross pay", s?.gross ?? null, per)}
        {fig("Taxes", s?.taxes ?? null, s ? money(s.taxes * s.p) + " a year" : undefined)}
        {fig("Take-home", s?.takeHome ?? null, s ? money(s.takeHome * s.p) + " a year" : undefined)}
        {fig("Spending", s?.spend ?? null, s ? money((s.spend * s.p) / 12) + " per month" : undefined)}
        {fig(s?.planned ? "Saved and invested" : "Saved pre-tax", s?.saved ?? null, s?.planned ? money(s.saved * s.p) + " a year" : "Planned in step 2")}
        <div className="min-w-0">
          <div className="text-label text-muted-foreground">{left != null && left < 0 ? "Short" : "Left over"}</div>
          <div className={cn("text-xl font-medium tabular-nums", left != null && left < 0 && "text-loss")}>{left == null ? DASH : (left < 0 ? "−" : "") + money(Math.abs(left))}</div>
          <div className="text-label text-muted-foreground">{s?.planned ? "Not yet assigned" : "Before saving more"}</div>
        </div>
      </CardContent>
    </Card>
  );
}

/* ---- the step itself ---- */
function Body({ step, plan, goTo }: { step: StepId; plan: PlanState; goTo: (s: StepId) => void }) {
  switch (step) {
    case "start": return <StartStep plan={plan} />;
    case "budget": return <Budget />;
    case "paycheck": return <Budget />;
    case "plan": return <Advanced />;
    case "stages": return <><KidsCard plan={plan} /><Stages /></>;
    case "summary": return <Summary plan={plan} goTo={goTo} />;
  }
}

/* ---- Back and Next ---- */
function Foot({ plan, idx, goTo }: { plan: PlanState; idx: number; goTo: (s: StepId) => void }) {
  const step = plan.step;
  const prev = step === "summary" && !plan.stagesOn ? "plan" : idx > 0 ? STEPS[idx - 1].id : null;
  const blocked = step === "start" && !startDone(plan) ? "Enter your ages and your pay to go on." : null;
  if (step === "summary") return null;
  return (
    <Card className="col-span-full">
      <CardContent className="flex flex-wrap items-center gap-3">
        {prev ? <Button variant="outline" size="lg" onClick={() => goTo(prev)}><i className="arw back" aria-hidden="true"></i>Back</Button> : null}
        <span className="flex-1"></span>
        {blocked ? <span className="text-note text-muted-foreground">{blocked}</span> : null}
        {step === "paycheck" ? <Button variant="outline" size="lg" disabled={!!blocked} onClick={() => goTo("stages")}>Skip to Life stages</Button> : null}
        {step === "plan" ? <>
          <Button variant="outline" size="lg" onClick={() => goTo("stages")}>{plan.stagesOn ? "Back to Life stages" : "Plan for kids and other changes"}</Button>
          <Button size="lg" onClick={() => { if (plan.stagesOn) setPlan((p) => ({ ...p, stagesOn: false })); goTo("summary"); }}>See your summary<i className="arw" aria-hidden="true"></i></Button>
        </> : (
          <Button size="lg" disabled={!!blocked} onClick={() => goTo(step === "stages" ? "summary" : STEPS[idx + 1].id)}>
            {step === "start" ? "Start with your budget" : step === "stages" ? "See your summary" : "Next: " + STEPS[idx + 1].name.toLowerCase()}
            <i className="arw" aria-hidden="true"></i>
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
