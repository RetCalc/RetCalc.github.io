"use client";

/* While the search runs, the guide's bow and arrow, bigger: the string
   draws back with the arrow on it, holds, and lets go; the arrow leaves fast
   and rides the progress with the fill behind it, and lands in the target
   when the answer is in. The counters follow the arrow, not the search, so
   they never run ahead of what's on screen. From opProgHTML() and opLoop()
   in src/js/app/31b-plan-optimizer.js. */

import { useEffect, useRef } from "react";
import { groupDigits, pctStr } from "@/lib/format";
import { OP_DRAW_MS, OP_LOOSE_MS, OP_MIN_MS, finish, stopOptimizer, watch, type Host, type Run } from "./run";
import { opCompact, opTacticsShort } from "./words";
import { Button } from "@/components/ui/button";

export function Progress({ host, R }: { host: Host; R: Run }) {
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const stopWatching = watch(host);
    const last: Record<string, string> = {};
    const q = (k: string) => root.current?.querySelector<HTMLElement>("[data-opn='" + k + "']");
    const set = (k: string, v: string) => {
      const el = q(k);
      if (el && last[k] !== v) { last[k] = v; el.textContent = v; }
    };
    let frame = 0;
    const tick = () => {
      const node = root.current;
      if (!node) return;
      const now = performance.now(), el = now - R.t0;
      const actual = R.done ? 1 : R.prog ? R.prog.frac : 0;
      // The flight can't outrun its clock, which starts at the release and
      // runs fast off the bow, easing in toward the target.
      const t = Math.max(0, Math.min(1, (el - OP_LOOSE_MS) / (OP_MIN_MS - OP_LOOSE_MS)));
      const want = el < OP_LOOSE_MS ? 0 : Math.min(actual, 1 - Math.pow(1 - t, 1.6));
      R.shown += (want - R.shown) * (R.done ? 0.2 : 0.12);
      if (want - R.shown < 0.002) R.shown = want;
      node.querySelector<HTMLElement>(".op-lane")?.style.setProperty("--p", Math.max(0, Math.min(1, R.shown)).toFixed(4));
      // Drawing back: the string's middle comes back 12 units with the arrow
      // on it, eased, then held under tension until the release.
      const d = el < OP_DRAW_MS ? el / OP_DRAW_MS : 1, pull = el < OP_LOOSE_MS ? d * d * (3 - 2 * d) : 0;
      node.style.setProperty("--pull", pull.toFixed(3));
      // The limbs flex as it comes back (CSS scales them by --pull), so the
      // string's ends follow their tips.
      const tip = 25 * (1 - 0.07 * pull), str = node.querySelector(".op-bow .str.drawn");
      if (str && el < OP_LOOSE_MS) str.setAttribute("d", "M33 " + (32 - tip).toFixed(2) + " L" + (33 - 12 * pull).toFixed(2) + " 32 L33 " + (32 + tip).toFixed(2));
      node.classList.toggle("op-full", el >= OP_DRAW_MS && el < OP_LOOSE_MS);
      node.classList.toggle("op-loosed", el >= OP_LOOSE_MS);
      const P = R.prog || R.done;
      if (P) {
        const f = R.shown, N = P.of, tried = Math.round(N * Math.min(f, actual));
        set("tried", groupDigits(tried, true));
        set("of", "of " + groupDigits(N, true) + " plans tried");
        set("runs", groupDigits(tried * P.windows, true));
        let b: { medLegacy: number; successRate: number } | null = null;
        for (let i = 0; i < R.log.length && R.log[i].frac <= f + 1e-9; i++) b = R.log[i].best;
        if (R.hitAt && R.done) b = R.done.best.stats;
        if (b) set("best", R.goal === "legacy" ? opCompact(b.medLegacy) : pctStr(b.successRate, 0) + " lasted");
        if (!R.hitAt && el >= OP_LOOSE_MS && now - R.nowAt > 420) {
          R.nowAt = now;
          const L = R.combos, T = L && L.length ? L[Math.min(L.length - 1, Math.floor(f * L.length))] : R.prog?.T;
          if (T) set("now", "Trying: " + opTacticsShort(T, R.P));
        }
        if (R.hitAt && R.done) set("now", "Found it. Tested " + groupDigits(R.done.runs, true) + " retirements.");
      }
      if (R.done && R.shown >= 0.999 && !R.hitAt) R.hitAt = now;
      // every frame, as a redraw of the page resets the classes
      node.classList.toggle("op-hit", !!R.hitAt);
      if (R.hitAt && now - R.hitAt > 1150) {
        finish(host);
        return;
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frame);
      stopWatching();
    };
  }, [host, R]);

  // eslint-disable-next-line react-hooks/purity -- where the flight is when this draws: a remount mid-flight starts from there
  const loosed = performance.now() - R.t0 >= OP_LOOSE_MS;
  return (
    <div className={"op-run group/run" + (loosed ? " op-loosed" : "")} data-op-host={host} aria-live="polite" ref={root}>
      <div className="op-shot" aria-hidden="true">
        <span className="op-bow"><svg viewBox="18 5 32 54"><path className="str rest" d="M33 7 L33 57" /><path className="str drawn" d="M33 7 L33 32 L33 57" />
          <path className="limb" d="M33 7 C31 10 34 13 39 17 Q53 32 39 47 C34 51 31 54 33 57" /></svg></span>
        <div className="op-lane" style={{ "--p": R.shown.toFixed(4) } as React.CSSProperties}><i className="op-fill"></i><i className="op-trail"></i>
          <span className="op-arrow"><svg viewBox="5 25.5 56 13"><path className="sh" d="M7 32 H51" />
            <path className="hd" d="M60 32 L48 25.5 L50.5 32 L48 38.5 Z M11 32 L6 25.5 H11 L18 32 Z M11 32 L6 38.5 H11 L18 32 Z" /></svg></span></div>
        <span className="op-target"><svg viewBox="0 0 44 44"><circle className="rg" cx="22" cy="22" r="20" /><circle className="rg" cx="22" cy="22" r="13.5" />
          <circle className="rg" cx="22" cy="22" r="7" /><circle className="eye" cx="22" cy="22" r="2.6" /></svg></span>
      </div>
      <div className="op-stats">
        <div><b data-opn="tried">0</b><span data-opn="of">plans tried</span></div>
        <div><b data-opn="runs">0</b><span>retirements simulated</span></div>
        <div><b data-opn="best">—</b><span>{R.goal === "legacy" ? "best so far, left after tax" : "best so far"}</span></div>
      </div>
      {/* Stop sits with the running commentary, a full-size button (44px
          under a finger), not a link in the corner. */}
      <div className="flex items-start gap-4">
        <div className="op-now min-w-0 flex-1" data-opn="now">Setting up every combination…</div>
        <Button variant="outline" size="sm" className="shrink-0 group-[.op-hit]/run:invisible" data-op="stop" data-host={host} onClick={() => stopOptimizer(host)}>Stop</Button>
      </div>
    </div>
  );
}
