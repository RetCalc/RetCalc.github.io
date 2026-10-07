"use client";

/* The Retirement Readiness Guide's page: the top bar (Top.tsx), the card,
   and the rail with your number, the score and the route (Rail.tsx). What
   each card is lives in steps/decl.ts and its screen in steps/index.tsx; the
   order cards come in, for this person and pace, in route.ts. Every
   historical test runs in the worker (usePlan.ts); the page shows the last
   answer while a newer one is on its way. From
   src/main/17-guide.html, gdRender(), gdRenderSide() and the guide's
   controls in src/js/app/30-guide-steps.js and 33-guide-share-controls.js. */

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useHousehold } from "@/components/household/HouseholdProvider";
import { printSheet } from "@/components/shell/Sheet";
import { sendLink, useShareKit } from "@/components/shell/share";
import { useToast } from "@/components/shell/Toast";
import { decodeHash, encodeHash, useRegisterTool, type ToolDef, type ToolInputs } from "@/components/tools/ToolState";
import { fmtNum, money, pctStr } from "@/lib/format";
import { useClient } from "@/lib/useClient";
import { useOptimizer } from "@/tools/optimizer/run";
import { lowerFirst, opClaims, opTacticsLine } from "@/tools/optimizer/words";
import { finishTrip, seedFromHousehold, startTrip, syncHousehold } from "./actions";
import { mar, ok, rating, score, sim, target, withGuess, type Sim } from "./calc";
import { cleanLink, deriveSources, doneFromV1, linkPayload, migrateAnswers } from "./migrate";
import { after, applies, before, current, firstOpen, landing, minutesLeft, numbered, stepById, type RouteFacts, type StepDecl } from "./route";
import { Rail, type RailPlan } from "./Rail";
import { GuideSheet } from "./sheet";
import { mark, putter, setAnswer, stamp } from "./sources";
import { VIEWS } from "./steps";
import { freshGuide, guide, replaceGuide, setGuide, useGuide, type Answers, type GuideState, type Pace, type Sources } from "./store";
import { curOpt, setTune } from "./tune";
import { Strip, Top } from "./Top";
import { GuideCtx, type GuideView } from "./ui";
import { usePlanJob } from "./usePlan";
import { usePopup } from "@/components/shell/Popup";
import { setNavDir } from "@/lib/nav-motion";
import { Button } from "@/components/ui/button";
import { TriangleAlertIcon } from "lucide-react";

/** The guide as a tool, for the header's Save: every answer, where each
    came from, which steps are done and the pace. Where you were and any
    trip into a tool are left out. */
const GUIDE_DEF: ToolDef<ToolInputs> = { id: "guide", label: "Guide", noun: "plan", defaults: {} };

/** The plan on one printed page, or why there isn't one yet. */
function planSheet(): React.ReactNode | string {
  const a = guide().a;
  return score(a).score == null || !sim(a) ? "Answer more of the guide to print a plan" : <GuideSheet a={a} />;
}

/** What the route needs to know from the plan: whether it falls short. */
const factsFrom = (a: Answers, S: Sim | null | undefined): RouteFacts => ({ behind: !!S && S.success < target(a) - 1e-9 });
/** The same, worked out here: only for a guide opened whole (a link, a
    saved plan), whose done cards depend on it. */
const factsFor = (a: Answers) => factsFrom(a, sim(withGuess(a)));

/** A card's arrival: the answers it assumes, and the card. */
function arrive(g: GuideState, id: string) {
  g.cur = id;
  stepById(id)?.prep?.(g.a, putter(g));
}

/** A guide opened from a link or a saved plan, done up to its plan card. */
function opened(a: Answers, src: Sources, pace: Pace, done?: Record<string, boolean>): GuideState {
  const n = freshGuide();
  n.a = a; n.src = src; n.pace = pace;
  const L = numbered(a, pace, factsFor(a));
  if (done) n.done = done;
  else L.forEach((st) => { if (st.id !== "plan") n.done[st.id] = true; });
  n.cur = L.every((st) => st.id === "plan" || n.done[st.id]) ? "plan" : firstOpen(n, factsFor(a));
  return n;
}

export function Guide() {
  const client = useClient();
  const g = useGuide(), router = useRouter(), toast = useToast(), { profile, save } = useHousehold();
  const H = useOptimizer("guide");
  const [v, setV] = useState<Answers>(() => guide().a);
  const [focusKey, setFocusKey] = useState(0);
  const card = useRef<HTMLDivElement>(null);
  const sync = () => syncHousehold(guide().a, save);
  const popup = usePopup();

  /* The plan as it stands, from the worker, with retirement spending's
     placeholder standing in until it's entered (D5): the rail's number and
     score, and whether the plan falls short (which brings Adjust your plan
     into the Quick check). */
  const pa = useMemo(() => (ok(g.a.age) ? withGuess(g.a) : null), [g.a]);
  const simJ = usePlanJob<Sim>("sim", pa, { slot: "rail", prio: 1 });
  const needJ = usePlanJob<number>("need", pa, { slot: "rail-need", prio: 2 });
  const S = simJ.res;
  const facts = useMemo(() => factsFrom(g.a, S), [g.a, S]);
  const factsNow = useRef(facts);
  useEffect(() => { factsNow.current = facts; }, [facts]);
  const railPlan: RailPlan = { S, need: needJ.res, stale: simJ.stale || needJ.stale, score: S === undefined ? null : score(g.a, S) };

  /* On arrival: a trip's result comes back with it; a shared plan opens on
     its plan card; a first visit starts from the household bar. */
  const arrived = useRef(false);
  useEffect(() => {
    if (arrived.current) return;
    arrived.current = true;
    if (finishTrip()) syncHousehold(guide().a, save);
    const hash = window.location.hash;
    if (hash.startsWith("#g=")) {
      const L = cleanLink(decodeHash(hash.slice(3)), stamp());
      try { history.replaceState(history.state, "", window.location.pathname + window.location.search); } catch { /* old browsers */ }
      if (L && Object.keys(L.a).length) {
        const open = () => { replaceGuide(opened(L.a, L.src, L.pace)); setV(guide().a); setFocusKey((k) => k + 1); };
        if (!Object.keys(guide().done).length) open();
        else void popup("This link opens a shared retirement plan. Replace your own guide answers with it?", [
          { label: "Replace my answers with the shared plan", desc: "Your household bar and tools won't change." },
          { label: "Keep my own answers" },
        ]).then((i) => { if (i === 0) open(); });
      }
    }
    setGuide((x) => { stepById(current(x).id)?.prep?.(x.a, putter(x)); });
    setV(guide().a);
  }, [save, popup]);
  // The household bar loads after the page: a first visit starts from it.
  useEffect(() => {
    if (!profile || Object.keys(guide().a).length) return;
    setGuide((x) => {
      seedFromHousehold(x.a, profile);
      for (const k of Object.keys(x.a) as (keyof Answers)[]) mark(x, k, "entered");
    });
    // eslint-disable-next-line react-hooks/set-state-in-effect -- the profile arrives after the page
    setV(guide().a);
  }, [profile]);

  const redraw = () => setV(guide().a);
  const go = (id: string) => {
    const st = stepById(id);
    if (!st || !applies(st, guide().a)) return;
    setGuide((x) => { if (x.back && x.back.step !== id) x.back = null; arrive(x, id); });
    redraw();
    setFocusKey((k) => k + 1);
  };
  const trip = (id: string, from?: string) => {
    const r = startTrip(id, from);
    if (!r) return;
    if (r.sync) sync();
    setNavDir("fwd");
    router.push(r.path);
  };
  const act = (what: string) => {
    const x0 = guide(), f = factsNow.current, cur = current(x0, f);
    if (what === "next") {
      if (cur.needs?.(x0.a)) return;
      setGuide((x) => {
        cur.commit?.(x.a, putter(x));
        if (cur.type !== "welcome") x.done[cur.id] = true;
        if (cur.id === "plan") x.finishedAt = stamp();
        x.back = null;
        arrive(x, after(x, f).id);
      });
      if (cur.sync) sync();
    } else if (what === "prev") {
      setGuide((x) => { x.back = null; arrive(x, before(x, f).id); });
    } else if (what === "resume") return go(firstOpen(x0, f));
    else if (what.startsWith("pace:")) {
      const p = what.slice(5) as Pace;
      if (p !== "quick" && p !== "full") return;
      setGuide((x) => { const to = landing(x, p, f); x.pace = p; if (to !== x.cur) arrive(x, to); });
    } else if (what === "restart") {
      void popup("Start the guide over?", [{ label: "Start over", desc: "Your answers here are cleared. The household bar and the tools keep their numbers." }])
        .then((i) => {
          if (i !== 0) return;
          const n = freshGuide();
          n.pace = guide().pace;
          if (profile) {
            seedFromHousehold(n.a, profile);
            for (const k of Object.keys(n.a) as (keyof Answers)[]) mark(n, k, "entered");
          }
          replaceGuide(n);
          redraw();
          setFocusKey((k) => k + 1);
        });
      return;
    } else if (what === "undo") {
      const B = x0.back;
      if (!B?.undo) return;
      setGuide((x) => {
        Object.assign(x.a, B.undo);
        for (const k of Object.keys(B.undo!) as (keyof Answers)[]) {
          const s = B.undoSrc?.[k];
          if (s) x.src[k] = s; else delete x.src[k];
        }
        x.back = { step: B.step, msg: "Undone. Your answers are back to what they were." };
      });
      sync();
      redraw();
      return;
    } else if (what === "apply") return applyOpt();
    else if (what === "optapply") return optApply();
    else if (what === "optclear") return optClear();
    else if (what === "print") {
      const sheet = planSheet();
      if (typeof sheet === "string") toast(sheet); else printSheet(sheet);
      return;
    } else if (what === "share") {
      sendLink(window.location.origin + "/guide#g=" + encodeHash(linkPayload(guide())), "Link copied. It opens this plan in the guide, with your numbers.", toast);
      return;
    }
    redraw();
    setFocusKey((k) => k + 1);
  };

  /* Adjusting the plan: the option picked, written into the answers. */
  const applyOpt = () => {
    const a = guide().a, o = curOpt(a);
    if (!o || !o.T || !Object.keys(o.set).length) return;
    const undo: Partial<Answers> = {}, undoSrc: Sources = {}, ch: string[] = [], set = o.set;
    (Object.keys(set) as (keyof typeof set)[]).forEach((k) => { (undo as Record<string, unknown>)[k] = a[k] ?? null; if (guide().src[k]) undoSrc[k] = guide().src[k]; });
    const success = o.T.success;
    setGuide((x) => {
      const y = x.a;
      if ("retire" in set) { ch.push("retire at <b>" + fmtNum(set.retire!) + "</b>"); setAnswer(x, "retire", set.retire); }
      if ("contrib" in set) { ch.push("save <b>" + money(set.contrib! + (y.employer || 0)) + "/mo</b>"); setAnswer(x, "contrib", set.contrib); }
      if ("stopAge" in set) {
        ch.push(set.stopAge == null ? "save until you retire" : set.stopAge <= y.age! ? "<b>stop saving now</b>" : "<b>stop saving at " + fmtNum(set.stopAge) + "</b>");
        setAnswer(x, "stopAge", set.stopAge);
      }
      if ("retSpend" in set) { ch.push("spend <b>" + money(set.retSpend!) + " a year</b>"); setAnswer(x, "retSpend", set.retSpend); }
      if (ok(y.stopAge) && y.stopAge >= y.retire!) {
        if (undo.stopAge === undefined) { undo.stopAge = y.stopAge; if (x.src.stopAge) undoSrc.stopAge = x.src.stopAge; }
        setAnswer(x, "stopAge", null);
      }
      x.back = { step: "adjust", undo, undoSrc, msg: "Applied. Your plan now has you " + ch.join(", ").replace(/, ([^,]*)$/, " and $1") +
        ". Your projection, success rate, score and household bar all use it now, and it lasted in <b>" + pctStr(success, 0) + "</b> of historical retirements.",
      see: ok(y.stopAge) ? { trip: "stages", label: "See it in Stages" } : { trip: "basic", label: "See it in Basic" } };
    });
    setTune((t) => { t.sel = null; t.draft = null; });
    sync();
    redraw();
    setTimeout(() => card.current?.querySelector(".gd-callout.ok")?.scrollIntoView({ block: "nearest" }), 0);
  };
  /* The Plan Optimizer's roadmap, applied to the plan, or taken back off. */
  const OPT_KEYS = ["optC1", "optC2", "optF", "optU", "optIm", "optAc"] as const;
  const optApply = () => {
    const res = H.res;
    if (!res || res.same) return;
    const T = res.best.T, undo: Partial<Answers> = {};
    setGuide((x) => {
      OPT_KEYS.forEach((k) => { (undo as Record<string, unknown>)[k] = x.a[k] ?? null; });
      Object.assign(x.a, { optC1: T.c1, optC2: T.c2, optF: T.f, optU: T.u, optIm: T.im, optAc: T.ac });
    });
    const a = guide().a, S = sim(a), C = S ? S.C : { married: mar(a), rmdAge: 75, gap: 0 };
    setGuide((x) => {
      x.back = { step: "optimize", undo, msg: "Applied. Your plan now claims Social Security at " + opClaims(T, C) +
        " and " + lowerFirst(opTacticsLine(T, C)) + ". Your projection, score and plan use it" +
        (S ? ": it lasted in <b>" + pctStr(S.success, 0) + "</b> of historical retirements, paying about " + money(S.lifeTax) + " in tax over retirement." : ".") };
    });
    redraw();
  };
  const optClear = () => {
    setGuide((x) => {
      const undo: Partial<Answers> = {};
      OPT_KEYS.forEach((k) => { (undo as Record<string, unknown>)[k] = x.a[k] ?? null; (x.a as Record<string, unknown>)[k] = null; });
      x.back = { step: "optimize", undo, msg: "Back to the usual way: Social Security at the age you chose, and brokerage, then traditional, then Roth." };
    });
    redraw();
  };

  const view: GuideView = {
    g, a: g.a, v, redraw, go, trip, act,
    set: (k, val, again, kind = "entered") => {
      setGuide((x) => setAnswer(x, k, val, kind));
      if (again) redraw();
    },
  };

  /* A new step: its question gets focus, and the card's top comes back
     into view if it had scrolled above the tab rail. */
  useLayoutEffect(() => {
    if (!focusKey || !card.current) return;
    const h = card.current.querySelector<HTMLElement>(".gd-q");
    try { (h || card.current).focus({ preventScroll: true }); } catch { /* old browsers */ }
    const top = card.current.getBoundingClientRect().top, css = getComputedStyle(document.documentElement);
    const rail = (parseFloat(css.getPropertyValue("--navh")) || 44) + (parseFloat(css.getPropertyValue("--gd-stick")) || 0) + 12;
    if (top < rail) window.scrollBy({ top: top - rail, behavior: "auto" });
  }, [focusKey]);

  // The header's Save keeps the plan; loading one starts there. A plan
  // saved before v2 ({ v: 1, a, done }) gets its sources worked out.
  const plan = useMemo(() => ({ v: 2, a: g.a, src: g.src, done: g.done, pace: g.pace }) as ToolInputs, [g.a, g.src, g.done, g.pace]);
  useRegisterTool(GUIDE_DEF, plan, (d) => {
    const data = d as { v?: number; a?: Answers; src?: Sources; done?: Record<string, boolean>; pace?: Pace };
    if (!data || !data.a || typeof data.a !== "object") return;
    const a = structuredClone(data.a);
    migrateAnswers(a as Answers & Record<string, unknown>);
    const v2 = data.v === 2;
    const n = opened(a, v2 && data.src ? structuredClone(data.src) : deriveSources(a, stamp()), v2 && data.pace === "quick" ? "quick" : "full",
      v2 ? { ...(data.done || {}) } : doneFromV1(data.done || {}));
    replaceGuide(n);
    setTune((t) => { t.sel = null; t.draft = null; });
    syncHousehold(n.a, save);
    redraw();
  });

  // The header's Share: the plan's link, and the plan on one page.
  useShareKit("guide", {
    link: { title: "Share your plan", run: () => act("share"), desc: ["Text or send your answers and plan", "Opens your answers and plan in the guide"] },
    sheetLabel: ["Print or save as PDF", "Your score, plan and next moves on one page"],
    sheet: () => planSheet(),
  });

  // The count and the card follow the answers as the card was drawn; the
  // score and the route follow every keystroke.
  const st = current(g, facts), L = numbered(v, g.pace, facts), idx = L.findIndex((s) => s.id === st.id);
  const rt = rating(railPlan.score?.score ?? null), View = VIEWS[st.id];
  const left = minutesLeft({ ...g, a: v }, facts), about = "about " + left + (left === 1 ? " minute" : " minutes") + " left";
  const count = st.type === "welcome" ? "" : idx >= 0 ? "Step " + (idx + 1) + " of " + L.length + " · " + about : "A deeper card · " + about;
  return (
    <GuideCtx value={view}>
      <div className="stack solo" role="tabpanel" id="tab-guide">
        <Top g={g} st={st} facts={facts} score={railPlan.score?.score ?? null} color={rt.color} count={count} step={idx + 1} steps={L.length} client={client} go={go} act={act}>
          {client ? <Strip g={g} cur={st} facts={facts} plan={railPlan} go={go} act={act} /> : null}
        </Top>
        <div className="gd-grid">
          <div className="panel gd-card" id="gdCard" tabIndex={-1} ref={card}
            onKeyDown={(e) => {
              const t = e.target as HTMLElement;
              if (e.key !== "Enter" || t.tagName !== "INPUT" || t.hasAttribute("data-d")) return;
              if (st.needs?.(g.a)) return;
              e.preventDefault();
              act("next");
            }}>
            {client && View ? (
              <>
                <View.Body />
                <div className="gd-foot">{View.Foot ? <View.Foot /> : <Foot st={st} a={g.a} last={idx === L.length - 2} act={act} />}</div>
              </>
            ) : null}
          </div>
          {client ? <Rail g={g} cur={st} facts={facts} plan={railPlan} go={go} act={act} /> : <div className="gd-side"></div>}
        </div>
      </div>
    </GuideCtx>
  );
}

function Foot({ st, a, last, act }: { st: StepDecl; a: Answers; last: boolean; act: (w: string) => void }) {
  const why = st.needs?.(a) ?? null;
  return (
    <>
      <Button variant="outline" size="lg" data-gd="prev" onClick={() => act("prev")}><i className="arw back" aria-hidden="true"></i>Back</Button><span className="sp"></span>
      <span className="gd-why" data-why="" hidden={!why}><TriangleAlertIcon className="size-4 shrink-0" aria-hidden="true" />{why ?? ""}</span>
      <Button size="lg" className="max-sm:flex-auto" data-gd="next" disabled={!!why} onClick={() => act("next")}>{last ? "See my score" : "Continue"}<i className="arw" aria-hidden="true"></i></Button>
    </>
  );
}
