"use client";

/* The Retirement Readiness Guide's page: the progress bar with its arrow,
   the step card, the score and the route. From src/main/17-guide.html,
   gdRender(), gdRenderSide() and the guide's controls in
   src/js/app/30-guide-steps.js and 33-guide-share-controls.js. */

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
import { FACTORS, barColor, mar, ok, rating, score, sim } from "./calc";
import { Ring } from "./results";
import { GuideSheet } from "./sheet";
import { CHAPTERS, STEPS, applies, current, firstOpen, numbered, route, stepById, type Step } from "./steps";
import { freshGuide, guide, migrate, replaceGuide, setGuide, useGuide, type Answers, type GuideState } from "./store";
import { curOpt, setTune } from "./tune";
import { GuideCtx, type GuideView } from "./ui";
import { setNavDir } from "@/lib/nav-motion";

/** The guide as a tool, for the header's Save: every answer and which
    steps are done. Where you were and any trip into a tool are left out. */
const GUIDE_DEF: ToolDef<ToolInputs> = { id: "guide", label: "Guide", noun: "plan", defaults: {} };

/** Only plain values come in from a link: numbers, true/false, and short
    strings of letters, digits and spaces. Nothing that could be markup. */
function cleanShared(o: unknown): Answers | null {
  const v = o as { v?: number; a?: Record<string, unknown> } | null;
  if (!v || v.v !== 1 || !v.a || typeof v.a !== "object") return null;
  const a: Record<string, unknown> = {};
  Object.keys(v.a).forEach((k) => {
    const x = v.a![k];
    if (!/^[A-Za-z0-9]{1,24}$/.test(k)) return;
    if ((typeof x === "number" && isFinite(x)) || typeof x === "boolean" || x === null) a[k] = x;
    else if (typeof x === "string" && /^[A-Za-z0-9 .,%\-]{0,40}$/.test(x)) a[k] = x;
  });
  return a as Answers;
}

/** The plan on one printed page, or why there isn't one yet. */
function planSheet(): React.ReactNode | string {
  const a = guide().a;
  return score(a).score == null || !sim(a) ? "Answer more of the guide to print a plan" : <GuideSheet a={a} />;
}

/** Draws a step's arrival: the answers it assumes, and the step. */
function arrive(g: GuideState, id: string) {
  g.cur = id;
  stepById(id)?.prep?.(g.a);
}

export function Guide() {
  const client = useClient();
  const g = useGuide(), router = useRouter(), toast = useToast(), { profile, save } = useHousehold();
  const H = useOptimizer("guide");
  const [v, setV] = useState<Answers>(() => guide().a);
  const [focusKey, setFocusKey] = useState(0);
  const card = useRef<HTMLDivElement>(null);
  const sync = () => syncHousehold(guide().a, save);

  /* On arrival: a trip's result comes back with it; a shared plan opens on
     its results; a first visit starts from the household bar. */
  const arrived = useRef(false);
  useEffect(() => {
    if (arrived.current) return;
    arrived.current = true;
    if (finishTrip()) syncHousehold(guide().a, save);
    const hash = window.location.hash;
    if (hash.startsWith("#g=")) {
      const a = cleanShared(decodeHash(hash.slice(3)));
      try { history.replaceState(history.state, "", window.location.pathname + window.location.search); } catch { /* old browsers */ }
      if (a && Object.keys(a).length && (!Object.keys(guide().done).length ||
        confirm("This link opens a shared retirement plan in the guide. Replace your own guide answers with it? Your household bar and tools won't change."))) {
        const n = freshGuide();
        n.a = a;
        migrate(n.a as Answers & Record<string, unknown>);
        numbered(n.a).forEach((st) => { if (st.id !== "results") n.done[st.id] = true; });
        n.cur = "results";
        replaceGuide(n);
      }
    }
    setGuide((x) => { stepById(current(x).id)?.prep?.(x.a); });
    setV(guide().a);
  }, [save]);
  // The household bar loads after the page: a first visit starts from it.
  useEffect(() => {
    if (!profile || Object.keys(guide().a).length) return;
    setGuide((x) => seedFromHousehold(x.a, profile));
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
    const cur = current(guide());
    if (what === "next") {
      if (cur.ok && !cur.ok(guide().a)) return;
      setGuide((x) => {
        cur.commit?.(x.a);
        if (cur.id !== "intro") x.done[cur.id] = true;
        const L = route(x.a), i = L.findIndex((s) => s.id === cur.id);
        x.back = null;
        arrive(x, (L[i + 1] || L[L.length - 1]).id);
      });
      if (cur.sync) sync();
    } else if (what === "prev") {
      setGuide((x) => {
        const L = route(x.a), i = L.findIndex((s) => s.id === cur.id);
        x.back = null;
        arrive(x, L[Math.max(0, i - 1)].id);
      });
    } else if (what === "resume") return go(firstOpen(guide()));
    else if (what === "restart") {
      if (!confirm("Start the guide over? Your answers here are cleared. The household bar and the tools keep their numbers.")) return;
      const n = freshGuide();
      if (profile) seedFromHousehold(n.a, profile);
      replaceGuide(n);
    } else if (what === "undo") {
      const B = guide().back;
      if (!B?.undo) return;
      setGuide((x) => { Object.assign(x.a, B.undo); x.back = { step: B.step, msg: "Undone. Your answers are back to what they were." }; });
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
      const a: Record<string, unknown> = {};
      Object.entries(guide().a).forEach(([k, x]) => { if (!["bgRows", "debtRows", "moState", "clState", "ddTool"].includes(k)) a[k] = x; });
      sendLink(window.location.origin + "/guide#g=" + encodeHash({ v: 1, a }), "Link copied. It opens this plan in the guide, with your numbers.", toast);
      return;
    }
    redraw();
    setFocusKey((k) => k + 1);
  };

  /* Adjusting the plan: the option picked, written into the answers. */
  const applyOpt = () => {
    const a = guide().a, o = curOpt(a);
    if (!o || !o.T || !Object.keys(o.set).length) return;
    const undo: Partial<Answers> = {}, ch: string[] = [], set = o.set;
    (Object.keys(set) as (keyof typeof set)[]).forEach((k) => { (undo as Record<string, unknown>)[k] = a[k] ?? null; });
    const success = o.T.success;
    setGuide((x) => {
      const y = x.a;
      if ("retire" in set) { ch.push("retire at <b>" + fmtNum(set.retire!) + "</b>"); y.retire = set.retire; }
      if ("contrib" in set) { ch.push("save <b>" + money(set.contrib! + (y.employer || 0)) + "/mo</b>"); y.contrib = set.contrib; }
      if ("stopAge" in set) {
        ch.push(set.stopAge == null ? "save until you retire" : set.stopAge <= y.age! ? "<b>stop saving now</b>" : "<b>stop saving at " + fmtNum(set.stopAge) + "</b>");
        y.stopAge = set.stopAge;
      }
      if ("retSpend" in set) { ch.push("spend <b>" + money(set.retSpend!) + " a year</b>"); y.retSpend = set.retSpend; }
      if (ok(y.stopAge) && y.stopAge >= y.retire!) { if (undo.stopAge === undefined) undo.stopAge = y.stopAge; y.stopAge = null; }
      x.back = { step: "tune", undo, msg: "Applied. Your plan now has you " + ch.join(", ").replace(/, ([^,]*)$/, " and $1") +
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
    set: (k, val, again) => {
      setGuide((x) => { (x.a as Record<string, unknown>)[k] = val; });
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

  // The header's Save keeps the plan; loading one starts there.
  const plan = useMemo(() => ({ v: 1, a: g.a, done: g.done }) as ToolInputs, [g.a, g.done]);
  useRegisterTool(GUIDE_DEF, plan, (d) => {
    const data = d as { a?: Answers; done?: Record<string, boolean> };
    if (!data || !data.a || typeof data.a !== "object") return;
    const n = freshGuide();
    n.a = structuredClone(data.a);
    migrate(n.a as Answers & Record<string, unknown>);
    n.done = { ...(data.done || {}) };
    const L = numbered(n.a);
    n.cur = L.every((st) => st.id === "results" || n.done[st.id]) ? "results" : firstOpen(n);
    replaceGuide(n);
    setTune((t) => { t.sel = null; t.draft = null; });
    syncHousehold(n.a, save);
    redraw();
  });

  // The count and the card follow the answers as the card was drawn; the
  // score and the route follow every keystroke.
  // The header's Share: the plan's link, and the plan on one page.
  useShareKit("guide", {
    link: { title: "Share your plan", run: () => act("share"), desc: ["Text or send your answers and plan", "Opens your answers and plan in the guide"] },
    sheetLabel: ["Print or save as PDF", "Your score, plan and next moves on one page"],
    sheet: () => planSheet(),
  });

  const st = current(g), L = numbered(v), idx = L.indexOf(st);
  const ch = st.ch >= 0 ? CHAPTERS[st.ch] : "Start";
  const R = score(g.a), rt = rating(R.score);
  return (
    <GuideCtx value={view}>
      <div className="stack solo" role="tabpanel" id="tab-guide">
        <Top g={g} st={st} score={R.score} color={rt.color} count={idx >= 0 ? "Step " + (idx + 1) + " of " + L.length : ""} client={client} go={go} />
        <div className="gd-grid">
          <div className="panel gd-card" id="gdCard" tabIndex={-1} ref={card}
            onKeyDown={(e) => {
              const t = e.target as HTMLElement;
              if (e.key !== "Enter" || t.tagName !== "INPUT" || t.hasAttribute("data-d")) return;
              if (st.ok && !st.ok(g.a)) return;
              e.preventDefault();
              act("next");
            }}>
            {client ? (
              <>
                <div className="gd-eyebrow"><span>{ch}</span>{idx >= 0 && st.title !== ch ? <span>{st.title}</span> : null}</div>
                <st.Body />
                <div className="gd-foot">{st.Foot ? <st.Foot /> : <Foot st={st} a={g.a} last={idx === L.length - 2} act={act} />}</div>
              </>
            ) : null}
          </div>
          <div className="gd-side">
            <div className="panel gd-score">
              <h2>Readiness score</h2>
              <div className="body" id="gdScore">{client ? <ScoreSide a={g.a} go={go} /> : null}</div>
            </div>
            <div className="panel gd-map">
              <h2>Your route</h2>
              <div className="body" id="gdMap">{client ? <RouteMap g={g} cur={st} go={go} act={act} /> : null}</div>
            </div>
          </div>
        </div>
      </div>
    </GuideCtx>
  );
}

function Foot({ st, a, last, act }: { st: Step; a: Answers; last: boolean; act: (w: string) => void }) {
  const isOk = !st.ok || st.ok(a);
  return (
    <>
      <button type="button" className="btn" data-gd="prev" onClick={() => act("prev")}><i className="arw back" aria-hidden="true"></i>Back</button><span className="sp"></span>
      <span className="gd-why" data-why="" hidden={isOk}>{st.why ? st.why(a) : ""}</span>
      <button type="button" className="btn primary" data-gd="next" disabled={!isOk} onClick={() => act("next")}>{last ? "See my score" : "Continue"}<i className="arw" aria-hidden="true"></i></button>
    </>
  );
}

function ScoreSide({ a, go }: { a: Answers; go: (id: string) => void }) {
  const R = score(a), rt = rating(R.score);
  return (
    <>
      <div className="gd-score-top"><Ring score={R.score} /><div className="gd-score-t"><div className="r" style={{ color: rt.color }}>{rt.label}</div>
        <div className="n">{R.score == null ? (R.n ? "Your score appears once two areas are answered." : "Your score appears as you answer.") : R.n < FACTORS.length ? "From " + R.n + " of " + FACTORS.length + " areas so far" : "All five areas answered"}</div></div></div>
      <div className="gd-facs">{FACTORS.map((f) => {
        const p = R.P[f.id];
        return (
          <button key={f.id} type="button" className={"gd-fac" + (p ? "" : " na")} data-go={f.step} onClick={() => go(f.step)}>
            <div className="top"><span>{f.name}</span><em>{p ? Math.round(p.p * f.w) + " / " + f.w : "—"}</em></div>
            <div className="bar"><i style={{ width: (p ? p.p * 100 : 0).toFixed(0) + "%", background: p ? barColor(p.p) : "transparent" }}></i></div>
            <div className="sub">{p ? p.txt : "Not answered yet"}</div></button>
        );
      })}</div>
    </>
  );
}

function RouteMap({ g, cur, go, act }: { g: GuideState; cur: Step; go: (id: string) => void; act: (w: string) => void }) {
  return (
    <>
      {CHAPTERS.map((c, ci) => (
        <div key={c} style={{ display: "contents" }}>
          <div className="gd-map-ch">{c}</div>
          {STEPS.filter((s) => s.ch === ci).map((s) => {
            const na = !applies(s, g.a), cls = na ? "na" : s.id === cur.id ? "cur" : g.done[s.id] ? "done" : "";
            return (
              <button key={s.id} type="button" className={"gd-map-st " + cls} disabled={na} data-go={na ? undefined : s.id} onClick={() => go(s.id)}>
                <i aria-hidden="true"></i>{s.title}{na ? <span className="tag">not needed</span> : null}</button>
            );
          })}
        </div>
      ))}
      <div className="gd-map-foot"><button type="button" className="gd-link" data-gd="restart" onClick={() => act("restart")}>Start over</button></div>
    </>
  );
}

/* The top bar: the score in brief, the step count, a bar for each chapter,
   and the arrow flying just ahead of the fill. Bars grow to their new
   widths in step with the arrow; motion only for moves made on this page,
   not for the state it loads in. */
function Top({ g, st, score: s, color, count, client, go }: { g: GuideState; st: Step; score: number | null; color: string; count: string; client: boolean; go: (id: string) => void }) {
  const L = route(g.a);
  const hit = st.id === "results" || L.every((x) => x.id === "results" || x.id === "intro" || g.done[x.id]);
  const segs = CHAPTERS.map((c, ci) => {
    const list = L.filter((x) => x.ch === ci), d = list.filter((x) => g.done[x.id]).length;
    return { c, ci, list, d, fill: hit && ci === CHAPTERS.length - 1 ? "calc(100% - 28px)" : (list.length ? (d / list.length) * 100 : 0).toFixed(0) + "%" };
  });
  let far: { ci: number; f: number } | null = null;
  segs.forEach((x) => { if (x.d) far = { ci: x.ci, f: x.d / x.list.length }; });
  const F = far as { ci: number; f: number } | null;
  const pos = hit ? 7 : F ? F.ci + F.f : 0;
  const left = hit ? "calc(100% + 18px)" : F ? "calc((100% - 30px) * " + (pos / 6).toFixed(4) + " + " + (F.ci * 6 + 46) + "px)" : "var(--nock)";
  const track = useRef<HTMLDivElement>(null), arrow = useRef<HTMLSpanElement>(null), prev = useRef<number | null>(null);
  const [shownFill, setShownFill] = useState<string[] | null>(null);
  useLayoutEffect(() => {
    if (!client) return;
    const was = prev.current;
    prev.current = pos;
    if (was == null || !(pos > was)) return;
    const tr = track.current!, ar = arrow.current!;
    const again = (el: Element, c: string) => { el.classList.remove(c); void (el as HTMLElement).offsetWidth; el.classList.add(c); };
    again(ar, "fly");
    if (was === 0) again(tr, "loose");
    if (hit) again(tr, "fresh");
    const t = setTimeout(() => { ar.classList.remove("fly"); tr.classList.remove("loose", "fresh"); }, 1400);
    return () => clearTimeout(t);
  }, [pos, hit, client]);
  // The bars draw at their old widths first, then grow.
  const fills = segs.map((x) => x.fill);
  const key = fills.join("|");
  const [lastKey, setLastKey] = useState<string | null>(null);
  if (client && key !== lastKey) {
    setLastKey(key);
    if (lastKey != null) setShownFill(lastKey.split("|"));
  }
  useEffect(() => {
    if (!shownFill) return;
    const t = requestAnimationFrame(() => setShownFill(null));
    return () => cancelAnimationFrame(t);
  }, [shownFill]);
  const widths = shownFill ?? fills;
  return (
    <div className="panel gd-top">
      <div className="gd-top-row">
        <div className="gd-title">Retirement Readiness Guide</div>
        <div className="gd-mini" id="gdMini">{client && s != null ? <>Score <b style={{ color }}>{s}</b></> : null}</div>
        <div className="gd-count" id="gdCount">{client ? count : ""}</div>
      </div>
      <div className="gd-prog-wrap">
        <div className="gd-prog" id="gdProg">{client ? segs.map((x, i) => (
          <button key={x.c} type="button" className={"gd-seg" + (st.ch === x.ci ? " on" : "")} data-go={x.list[0] ? x.list[0].id : "intro"}
            aria-label={x.c + ": " + x.d + " of " + x.list.length + " done"} onClick={() => go(x.list[0] ? x.list[0].id : "intro")}>
            <i><b style={{ width: widths[i] }}></b></i><span>{x.c}</span></button>
        )) : null}</div>
        <div className={"gd-track" + (client && !F && !hit ? " nocked" : "") + (client && hit ? " hit" : "")} id="gdTrack" aria-hidden="true" ref={track}>
          <span className="gd-bow"><svg viewBox="18 5 32 54"><path className="str rest" d="M33 7 L33 57" /><path className="str drawn" d="M33 7 L21 32 L33 57" />
            <path className="limb" d="M33 7 C31 10 34 13 39 17 Q53 32 39 47 C34 51 31 54 33 57" /></svg></span>
          <span className="gd-arrow" id="gdArrow" ref={arrow} style={client ? { left } : undefined}><svg viewBox="5 25.5 56 13"><path className="sh" d="M7 32 H51" />
            <path className="hd" d="M60 32 L48 25.5 L50.5 32 L48 38.5 Z M11 32 L6 25.5 H11 L18 32 Z M11 32 L6 38.5 H11 L18 32 Z" /></svg></span>
          <span className="gd-goal"><svg viewBox="0 0 18 18"><circle className="rg" cx="9" cy="9" r="7.5" /><circle className="rg" cx="9" cy="9" r="4" /><circle className="eye" cx="9" cy="9" r="1.6" /></svg></span>
        </div>
      </div>
    </div>
  );
}

