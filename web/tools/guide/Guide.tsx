"use client";

/* The Retirement Readiness Guide's page: the progress bar with its arrow,
   the pace switch, the step card, the score and the route. What each card
   is lives in steps/decl.ts and its screen in steps/index.tsx; the order
   cards come in, for this person and pace, in route.ts. From
   src/main/17-guide.html, gdRender(), gdRenderSide() and the guide's
   controls in src/js/app/30-guide-steps.js and 33-guide-share-controls.js. */

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useHousehold } from "@/components/household/HouseholdProvider";
import { printSheet } from "@/components/shell/Sheet";
import { sendLink, useShareKit } from "@/components/shell/share";
import { useToast } from "@/components/shell/Toast";
import { decodeHash, encodeHash, useRegisterTool, type ToolDef, type ToolInputs } from "@/components/tools/ToolState";
import { Segmented } from "@/components/common/Readout";
import { fmtNum, money, pctStr } from "@/lib/format";
import { useClient } from "@/lib/useClient";
import { useOptimizer } from "@/tools/optimizer/run";
import { lowerFirst, opClaims, opTacticsLine } from "@/tools/optimizer/words";
import { finishTrip, seedFromHousehold, startTrip, syncHousehold } from "./actions";
import { FACTORS, barColor, mar, ok, rating, score, sim, target } from "./calc";
import { cleanLink, deriveSources, doneFromV1, linkPayload, migrateAnswers } from "./migrate";
import { Ring } from "./results";
import {
  CHAPTERS, STEPS, after, applies, before, current, deeper, firstOpen, landing, minutesLeft, numbered, route, stepById,
  type RouteFacts, type StepDecl,
} from "./route";
import { GuideSheet } from "./sheet";
import { mark, putter, setAnswer, stamp } from "./sources";
import { VIEWS } from "./steps";
import { freshGuide, guide, replaceGuide, setGuide, useGuide, type Answers, type GuideState, type Pace, type Sources } from "./store";
import { curOpt, setTune } from "./tune";
import { GuideCtx, type GuideView } from "./ui";
import { setNavDir } from "@/lib/nav-motion";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDownIcon, TriangleAlertIcon } from "lucide-react";

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
function factsFor(a: Answers): RouteFacts {
  const S = sim(a);
  return { behind: !!S && S.success < target(a) - 1e-9 };
}

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
  const facts = useMemo(() => factsFor(g.a), [g.a]);

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
      if (L && Object.keys(L.a).length && (!Object.keys(guide().done).length ||
        confirm("This link opens a shared retirement plan in the guide. Replace your own guide answers with it? Your household bar and tools won't change.")))
        replaceGuide(opened(L.a, L.src, L.pace));
    }
    setGuide((x) => { stepById(current(x, factsFor(x.a)).id)?.prep?.(x.a, putter(x)); });
    setV(guide().a);
  }, [save]);
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
    const x0 = guide(), f = factsFor(x0.a), cur = current(x0, f);
    if (what === "next") {
      if (cur.needs?.(x0.a)) return;
      setGuide((x) => {
        cur.commit?.(x.a, putter(x));
        if (cur.type !== "welcome") x.done[cur.id] = true;
        if (cur.id === "plan") x.finishedAt = stamp();
        x.back = null;
        arrive(x, after(x, factsFor(x.a)).id);
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
      if (!confirm("Start the guide over? Your answers here are cleared. The household bar and the tools keep their numbers.")) return;
      const n = freshGuide();
      n.pace = x0.pace;
      if (profile) {
        seedFromHousehold(n.a, profile);
        for (const k of Object.keys(n.a) as (keyof Answers)[]) mark(n, k, "entered");
      }
      replaceGuide(n);
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
  const R = score(g.a), rt = rating(R.score), View = VIEWS[st.id];
  const left = minutesLeft({ ...g, a: v }, facts), about = "about " + left + (left === 1 ? " minute" : " minutes") + " left";
  const count = st.type === "welcome" ? "" : idx >= 0 ? "Step " + (idx + 1) + " of " + L.length + " · " + about : "A deeper card · " + about;
  return (
    <GuideCtx value={view}>
      <div className="stack solo" role="tabpanel" id="tab-guide">
        <Top g={g} st={st} facts={facts} score={R.score} color={rt.color} count={count} step={idx + 1} steps={L.length} client={client} go={go} act={act} />
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
          <div className="gd-side">
            <Card>
              <CardHeader><CardTitle>{st.id === "plan" ? "What's behind the score" : "Readiness score"}</CardTitle></CardHeader>
              <CardContent id="gdScore">{client ? <ScoreSide a={g.a} go={go} ring={st.id !== "plan"} /> : null}</CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle>Your route</CardTitle></CardHeader>
              <CardContent className="px-2.5 pt-2 pb-3" id="gdMap">{client ? <RouteMap g={g} cur={st} facts={facts} go={go} act={act} /> : null}</CardContent>
            </Card>
          </div>
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

function ScoreSide({ a, go, ring }: { a: Answers; go: (id: string) => void; ring: boolean }) {
  const R = score(a), rt = rating(R.score);
  return (
    <>
      <div className="gd-score-top" hidden={!ring}><Ring score={R.score} /><div className="gd-score-t"><div className="r text-(color:--ink)" style={{ "--ink": rt.color } as React.CSSProperties}>{rt.label}</div>
        <div className="n">{R.score == null ? (R.n ? "Your score appears once two areas are answered." : "Your score appears as you answer.") : R.n < FACTORS.length ? "From " + R.n + " of " + FACTORS.length + " areas so far" : "All five areas answered"}</div></div></div>
      <div className="gd-facs">{FACTORS.map((f) => {
        const p = R.P[f.id];
        return (
          <button key={f.id} type="button" className={"gd-fac" + (p ? "" : " na")} data-go={f.step} onClick={() => go(f.step)}>
            <div className="top"><span>{f.name}</span><em>{p ? Math.round(p.p * f.w) + " / " + f.w : "—"}</em></div>
            <div className="bar"><i className="w-(--w) bg-(--swatch)" style={{ "--w": (p ? p.p * 100 : 0).toFixed(0) + "%", "--swatch": p ? barColor(p.p) : "transparent" } as React.CSSProperties}></i></div>
            <div className="sub">{p ? p.txt : "Not answered yet"}</div></button>
        );
      })}</div>
    </>
  );
}

/* The route: each chapter's cards, the one you're on, those done, and on
   the Quick check the deeper cards it skips, marked and still open to you. */
function RouteMap({ g, cur, facts, go, act }: { g: GuideState; cur: StepDecl; facts: RouteFacts; go: (id: string) => void; act: (w: string) => void }) {
  // The cards that hang on the retirement age stay out until it's known.
  const known = ok(g.a.retire);
  return (
    <>
      {CHAPTERS.map((c, i) => {
        const ch = i + 1, list = STEPS.filter((s) => s.chapter === ch && (known || !s.when));
        const walked = list.filter((s) => applies(s, g.a) && !deeper(s, g.a, g.pace, facts)), d = walked.filter((s) => g.done[s.id]).length;
        const here = cur.chapter === ch || (cur.chapter === 0 && ch === 1);
        return (
          <div key={c + (here ? ":here" : "")} className="gd-map-chw"><Collapsible defaultOpen={here}>
            <div className="gd-map-ch"><CollapsibleTrigger>{c}<span className="gd-map-n">{walked.length ? d + " of " + walked.length : "deeper"}</span><ChevronDownIcon aria-hidden="true" /></CollapsibleTrigger></div>
            <CollapsibleContent>
              {list.map((s) => {
                const na = !applies(s, g.a), deep = !na && deeper(s, g.a, g.pace, facts);
                const cls = na ? "na" : s.id === cur.id ? "cur" : g.done[s.id] ? "done" : deep ? "deep" : "";
                return (
                  <button key={s.id} type="button" className={"gd-map-st " + cls} disabled={na} data-go={na ? undefined : s.id} onClick={() => go(s.id)}
                    aria-current={s.id === cur.id ? "step" : undefined}>
                    <i aria-hidden="true"></i>{s.title}{na ? <span className="tag">not needed</span> : deep && s.id !== cur.id ? <span className="tag">deeper · open</span> : null}</button>
                );
              })}
            </CollapsibleContent>
          </Collapsible></div>
        );
      })}
      <div className="gd-map-foot text-note"><Button variant="quiet" size="inline" data-gd="restart" onClick={() => act("restart")}>Start over</Button></div>
    </>
  );
}

/* The top bar: the pace switch, the score in brief, the step count and the
   time left, a bar for each chapter, and the arrow whose tip rides the end
   of the fill. Bars grow in step with the arrow; motion only for moves
   forward made on this page, not for the state it loads in. */
function Top({ g, st, facts, score: s, color, count, step, steps, client, go, act }: {
  g: GuideState; st: StepDecl; facts: RouteFacts; score: number | null; color: string; count: string; step: number; steps: number;
  client: boolean; go: (id: string) => void; act: (w: string) => void;
}) {
  const L = route(g.a, g.pace, facts), n = CHAPTERS.length;
  const hit = st.id === "plan" || L.every((x) => x.id === "plan" || x.type === "welcome" || g.done[x.id]);
  const segs = CHAPTERS.map((c, ci) => {
    const list = L.filter((x) => x.chapter === ci + 1), d = list.filter((x) => g.done[x.id]).length;
    return { c, ci, list, d, fill: hit ? 1 : list.length ? d / list.length : 0 };
  });
  let far: { ci: number; f: number } | null = null;
  segs.forEach((x) => { if (x.d) far = { ci: x.ci, f: x.d / x.list.length }; });
  const F = far as { ci: number; f: number } | null;
  const pos = hit ? n : F ? F.ci + F.f : 0;
  /* A move forward flies: the arrow travels (a transform transition), the
     string twangs on the first release, and a fresh finish holds the
     bullseye until the arrow lands, then plays the impact. Under reduced
     motion nothing is scripted: the arrow jumps and the bullseye changes
     colour in the same frame. */
  const wrap = useRef<HTMLDivElement>(null), track = useRef<HTMLDivElement>(null), arrow = useRef<HTMLSpanElement>(null), prev = useRef<number | null>(null);
  // Transitions switch on only after the saved progress has been drawn.
  useLayoutEffect(() => {
    if (!client) return;
    const wr = wrap.current!;
    void wr.offsetWidth;
    wr.classList.add("ready");
  }, [client]);
  useLayoutEffect(() => {
    if (!client) return;
    const was = prev.current;
    prev.current = pos;
    if (was == null || !(pos > was) || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const wr = wrap.current!, tr = track.current!, ar = arrow.current!;
    const again = (el: Element, c: string) => { el.classList.remove(c); void (el as HTMLElement).offsetWidth; el.classList.add(c); };
    let after = 0;
    const land = () => {
      ar.removeEventListener("transitionend", onEnd);
      clearTimeout(backstop);
      wr.classList.remove("fly");
      tr.classList.remove("loose", "inflight");
      if (!hit) return;
      again(tr, "impact");
      after = window.setTimeout(() => tr.classList.remove("impact"), 320);
    };
    const onEnd = (e: TransitionEvent) => { if (e.target === ar && e.propertyName === "transform") land(); };
    tr.classList.remove("impact");
    again(wr, "fly");
    if (was === 0) again(tr, "loose");
    if (hit) tr.classList.add("inflight");
    ar.addEventListener("transitionend", onEnd);
    const backstop = window.setTimeout(land, 800);
    return () => {
      ar.removeEventListener("transitionend", onEnd);
      clearTimeout(backstop);
      clearTimeout(after);
      wr.classList.remove("fly");
      tr.classList.remove("loose", "inflight", "impact");
    };
  }, [pos, hit, client]);
  const first = (x: (typeof segs)[number]) => (x.list[0] ? x.list[0].id : "welcome");
  return (
    <div className="panel gd-top">
      <div className="gd-top-row">
        <div className="gd-title">Retirement Readiness Guide</div>
        {client ? <Segmented attr="data-pace" options={[["quick", "Quick check"], ["full", "Full walkthrough"]] as const} value={g.pace} onChange={(p) => act("pace:" + p)} /> : null}
        <div className="gd-mini" id="gdMini">{client && s != null ? <>Score <b className="text-(color:--ink)" style={{ "--ink": color } as React.CSSProperties}>{s}</b></> : null}</div>
        <div className="gd-count" id="gdCount">{client ? count : ""}</div>
      </div>
      <div className="gd-prog-wrap" ref={wrap}>
        <div className="gd-prog" id="gdProg">{client ? segs.map((x) => (
          <button key={x.c} type="button" className={"gd-seg" + (st.chapter === x.ci + 1 ? " on" : "")} data-go={first(x)}
            aria-label={x.c + ": " + x.d + " of " + x.list.length + " done"} onClick={() => go(first(x))}>
            <i><b style={{ "--f": x.fill.toFixed(4) } as React.CSSProperties}></b></i><span>{x.c}</span></button>
        )) : null}</div>
        <div className={"gd-track" + (client && !F && !hit ? " nocked" : "") + (client && hit ? " hit" : "")} id="gdTrack" ref={track}
          role="progressbar" aria-label="Guide progress" aria-valuemin={0} aria-valuemax={client ? steps : undefined}
          aria-valuenow={client ? Math.max(0, step) : undefined} aria-valuetext={client ? count || "Not started" : undefined}
          style={client && F && !hit ? { "--pos": pos.toFixed(4), "--ci": F.ci } as React.CSSProperties : undefined}>
          <span className="gd-bow" aria-hidden="true"><svg viewBox="18 5 32 54"><path className="str rest" d="M33 7 L33 57" /><path className="str drawn" d="M33 7 L21 32 L33 57" />
            <path className="limb" d="M33 7 C31 10 34 13 39 17 Q53 32 39 47 C34 51 31 54 33 57" /></svg></span>
          <span className="gd-arrow" id="gdArrow" ref={arrow} aria-hidden="true"><svg viewBox="5 25.5 56 13"><path className="sh" d="M7 32 H51" />
            <path className="hd" d="M60 32 L48 25.5 L50.5 32 L48 38.5 Z M11 32 L6 25.5 H11 L18 32 Z M11 32 L6 38.5 H11 L18 32 Z" /></svg></span>
          <span className="gd-goal" aria-hidden="true"><svg viewBox="0 0 18 18"><circle className="rg" cx="9" cy="9" r="7.5" /><circle className="rg" cx="9" cy="9" r="4" /><circle className="eye" cx="9" cy="9" r="2.4" /></svg></span>
        </div>
      </div>
    </div>
  );
}
