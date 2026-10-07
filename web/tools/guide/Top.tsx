"use client";

/* The guide's top bar (doc 2, parts 1 to 3): the title, the pace switch,
   the step count with the time left, and the bow-and-arrow progress bar,
   one segment per chapter. On a phone, the rail's strip sits under it:
   your number, the score, and a Route button that opens the score and the
   route as a sheet. */

import { useLayoutEffect, useRef, useState } from "react";
import { Segmented } from "@/components/common/Readout";
import { Modal, ModalTop } from "@/components/shell/Modal";
import { CHAPTERS, route, type RouteFacts, type StepDecl } from "./route";
import { RouteMap, ScoreCard, type RailPlan } from "./Rail";
import type { GuideState } from "./store";
import { rounded } from "./words";
import { Button } from "@/components/ui/button";

/* The top bar: the pace switch, the score in brief, the step count and the
   time left, a bar for each chapter, and the arrow whose tip rides the end
   of the fill. Bars grow in step with the arrow; motion only for moves
   forward made on this page, not for the state it loads in. */
export function Top({ g, st, facts, score: s, color, count, step, steps, client, go, act, children }: {
  g: GuideState; st: StepDecl; facts: RouteFacts; score: number | null; color: string; count: string; step: number; steps: number;
  client: boolean; go: (id: string) => void; act: (w: string) => void;
  /** The phone's strip, under the bar. */
  children?: React.ReactNode;
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
      {children}
    </div>
  );
}


/** The rail, folded for a phone: your number, the score, and the route as
    a sheet. */
export function Strip({ g, cur, facts, plan, go, act }: { g: GuideState; cur: StepDecl; facts: RouteFacts; plan: RailPlan; go: (id: string) => void; act: (w: string) => void }) {
  const [open, setOpen] = useState(false);
  const S = plan.S, sc = plan.score?.score;
  const goShut = (id: string) => { setOpen(false); go(id); };
  return (
    <div className="gd-strip" id="gdStrip">
      <span className={"gd-strip-n" + (plan.stale ? " stale" : "")}>{S ? <>On course <b className="key">{rounded(S.fv)}</b>{plan.need != null ? <> · needs <b>{rounded(plan.need)}</b></> : null}</>
        : "Your number appears as you answer"}</span>
      {sc != null ? <span className="gd-strip-s">Score <b>{sc}</b></span> : null}
      <span className="gd-strip-r"><Button variant="outline" size="sm" data-gd="route" aria-haspopup="dialog" onClick={() => setOpen(true)}>Route</Button></span>
      {open ? (
        <Modal onClose={() => setOpen(false)} size="guide">
          <ModalTop title="Your score and route" onClose={() => setOpen(false)} />
          <div className="gd-sheet-score"><ScoreCard g={g} plan={plan} go={goShut} ring /></div>
          <RouteMap g={g} cur={cur} facts={facts} go={goShut} act={(w) => { setOpen(false); act(w); }} />
        </Modal>
      ) : null}
    </div>
  );
}
