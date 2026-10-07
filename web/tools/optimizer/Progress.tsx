"use client";

/* While the search runs, the guide's bow and arrow, bigger: the string
   draws back with the arrow on it, holds, and lets go; the arrow rides the
   search's real progress with the fill behind it, and lands in the target
   when the answer is in. The first shot in a session takes at least five
   seconds and later ones about two (display pacing only: the search and
   its answer are untouched); a click, a tap, Enter or Escape skips it.
   Under reduced motion there's no flight and the answer shows when it's in.
   The counters follow the arrow, not the search, so they never run ahead
   of what's on screen. Everything moves by transform (styles in
   15-optimizer.css). From opProgHTML() and opLoop() in
   src/js/app/31b-plan-optimizer.js. */

import { useEffect, useId, useRef } from "react";
import { groupDigits, pctStr } from "@/lib/format";
import { OP_IMPACT_MS, OP_STRIKE_MS, finish, skipFlight, stopOptimizer, useOptimizer, watch, type Host, type Run } from "./run";
import { opCompact, opTacticsShort } from "./words";
import { Button } from "@/components/ui/button";

export function Progress({ host, R }: { host: Host; R: Run }) {
  const root = useRef<HTMLDivElement>(null);
  const hintId = useId();

  useEffect(() => {
    const stopWatching = watch(host);
    const node0 = root.current;
    // Started from the run button, which is now disabled: focus moves here,
    // so Enter or Escape can skip without hunting for the loader.
    const a = document.activeElement as HTMLElement | null;
    if (node0 && R.min > 0 && (!a || a === document.body || (a.matches("[data-op='run']") && (a as HTMLButtonElement).disabled))) {
      try { node0.focus({ preventScroll: true }); } catch { /* old browsers */ }
    }
    // With focus lost to the page (a click elsewhere on nothing), the keys still skip.
    const onKey = (e: KeyboardEvent) => {
      if ((e.key === "Escape" || e.key === "Enter") && !e.defaultPrevented && (document.activeElement === document.body || document.activeElement == null)) skipFlight(host);
    };
    document.addEventListener("keydown", onKey);
    const last: Record<string, string> = {};
    const q = (k: string) => root.current?.querySelector<HTMLElement>("[data-opn='" + k + "']");
    const set = (k: string, v: string) => {
      const el = q(k);
      if (el && last[k] !== v) { last[k] = v; el.textContent = v; }
    };
    let frame = 0, prev = performance.now(), pct = -1;
    const tick = () => {
      const node = root.current;
      if (!node) return;
      const now = performance.now(), el = now - R.t0, dt = Math.min(100, now - prev);
      prev = now;
      const actual = R.done ? 1 : R.prog ? R.prog.frac : 0;
      const still = R.min === 0;
      // Skipped, or no flight to show: the answer as soon as it's in.
      if (R.done && (R.skip || still) && !R.hitAt) { finish(host); return; }
      const loosed = still || R.skip || el >= R.loose;
      // The flight can't outrun its clock, which starts at the release and
      // runs fast off the bow, easing in toward the target. Skipped, the
      // clock is gone and the arrow keeps up with the search.
      const t = R.skip ? 1 : Math.max(0, Math.min(1, (el - R.loose) / Math.max(1, R.min - R.loose)));
      const want = loosed ? Math.min(actual, 1 - Math.pow(1 - t, 1.6)) : 0;
      if (still) R.shown = Math.floor(want * 10) / 10;
      else {
        // Eased toward where it should be, quicker once the answer is in.
        R.shown += (want - R.shown) * (1 - Math.exp(-dt / (R.done ? 45 : 90)));
        if (Math.abs(want - R.shown) < 0.003) R.shown = want;
      }
      const p = Math.max(0, Math.min(1, R.shown));
      node.style.setProperty("--p", p.toFixed(4));
      // Drawing back: the string's middle comes back with the arrow on it,
      // eased, then held under tension until the release.
      const d = R.draw > 0 && el < R.draw ? el / R.draw : 1, pull = loosed ? 0 : d * d * (3 - 2 * d);
      node.style.setProperty("--pull", pull.toFixed(3));
      node.classList.toggle("op-loosed", loosed);
      const bar = node.querySelector<HTMLElement>("[role='progressbar']");
      if (bar && Math.round(p * 100) !== pct) {
        pct = Math.round(p * 100);
        bar.setAttribute("aria-valuenow", String(pct));
        bar.setAttribute("aria-valuetext", pct + "% searched");
      }
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
        if (!R.hitAt && loosed && now - R.nowAt > 420) {
          R.nowAt = now;
          const L = R.combos, T = L && L.length ? L[Math.min(L.length - 1, Math.floor(f * L.length))] : R.prog?.T;
          if (T) set("now", "Trying: " + opTacticsShort(T, R.P));
        }
        if (R.hitAt && R.done) set("now", "Found it. Tested " + groupDigits(R.done.runs, true) + " retirements.");
      }
      // Landed at the end of the lane: into the bullseye, the target's
      // reaction, and the answer. No hold after that.
      if (R.done && R.shown >= 1 && !R.hitAt) R.hitAt = now;
      // every frame, as a redraw of the page resets the classes
      node.classList.toggle("op-hit", !!R.hitAt);
      node.classList.toggle("op-impact", !!R.hitAt && now - R.hitAt >= OP_STRIKE_MS);
      if (R.hitAt && now - R.hitAt >= OP_STRIKE_MS + OP_IMPACT_MS) {
        finish(host);
        return;
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener("keydown", onKey);
      stopWatching();
    };
  }, [host, R]);

  // eslint-disable-next-line react-hooks/purity -- where the flight is when this draws: a remount mid-flight starts from there
  const loosed = R.min === 0 || R.skip || performance.now() - R.t0 >= R.loose;
  const flight = R.min > 0;
  const skipHere = (e: React.SyntheticEvent) => {
    if ((e.target as HTMLElement).closest("button")) return;
    skipFlight(host);
  };
  return (
    <div className={"op-run group/run" + (loosed ? " op-loosed" : "")} data-op-host={host} ref={root}
      style={{ "--p": R.shown.toFixed(4) } as React.CSSProperties}
      tabIndex={flight ? 0 : undefined} role={flight ? "group" : undefined} aria-label={flight ? "Plan Optimizer search" : undefined}
      aria-describedby={flight ? hintId : undefined} onClick={flight ? skipHere : undefined}
      onKeyDown={flight ? (e) => {
        // Escape from anywhere in it (Stop included); Enter only on the loader itself, so Stop keeps its Enter.
        if (e.key === "Escape" || (e.key === "Enter" && e.target === e.currentTarget)) { e.preventDefault(); skipFlight(host); }
      } : undefined}>
      <div className="op-shot" role="progressbar" aria-label="Search progress" aria-valuemin={0} aria-valuemax={100}
        aria-valuenow={Math.round(R.shown * 100)} aria-valuetext={Math.round(R.shown * 100) + "% searched"}>
        <span className="op-bow" aria-hidden="true"><svg viewBox="18 5 32 54"><path className="str rest" d="M33 7 L33 57" /><path className="str drawn" d="M33 7 L21 32 L33 57" />
          <path className="limb" d="M33 7 C31 10 34 13 39 17 Q53 32 39 47 C34 51 31 54 33 57" /></svg></span>
        <div className="op-lane" aria-hidden="true"><i className="op-fill"><b></b></i>
          <span className="op-arrow"><svg viewBox="5 25.5 56 13"><path className="sh" d="M7 32 H51" />
            <path className="hd" d="M60 32 L48 25.5 L50.5 32 L48 38.5 Z M11 32 L6 25.5 H11 L18 32 Z M11 32 L6 38.5 H11 L18 32 Z" /></svg></span>
          <span className="op-target"><svg viewBox="0 0 44 44"><circle className="rg" cx="22" cy="22" r="20" /><circle className="rg" cx="22" cy="22" r="13.5" />
            <circle className="rg" cx="22" cy="22" r="7" /><circle className="eye" cx="22" cy="22" r="2.6" /></svg></span></div>
      </div>
      <div className="op-stats">
        <div><b data-opn="tried">0</b><span data-opn="of">plans tried</span></div>
        <div><b data-opn="runs">0</b><span>retirements simulated</span></div>
        <div><b data-opn="best">—</b><span>{R.goal === "legacy" ? "best so far, left after tax" : "best so far"}</span></div>
      </div>
      {/* Stop sits with the running commentary, a full-size button (44px
          under a finger), not a link in the corner. */}
      <div className="flex items-start gap-4">
        <div className="min-w-0 flex-1">
          <div className="op-now" data-opn="now">Setting up every combination…</div>
          {flight ? (
            <p className="op-skip m-0 text-label text-muted-foreground">
              <span aria-hidden="true" className="pointer-coarse:hidden">Click or press Enter to skip ahead</span>
              <span aria-hidden="true" className="hidden pointer-coarse:inline">Tap to skip ahead</span>
              <span className="sr-only" id={hintId}>Press Enter or Escape to skip.</span>
            </p>
          ) : null}
        </div>
        <Button variant="outline" size="sm" className="shrink-0 group-[.op-hit]/run:invisible" data-op="stop" data-host={host} onClick={() => stopOptimizer(host)}>Stop</Button>
      </div>
    </div>
  );
}

/** A quiet announcement when a search starts and when its answer is in,
    beside the loader rather than on it, so the counters aren't read out. */
export function OptimizerStatus({ host }: { host: Host }) {
  const H = useOptimizer(host);
  const msg = H.run ? "Searching every plan." : H.res ? "Found the best plan. The answer is below." : "";
  return <p className="sr-only" role="status">{msg}</p>;
}
