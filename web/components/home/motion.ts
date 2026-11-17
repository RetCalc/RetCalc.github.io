"use client";

/* Scroll and pointer motion shared by the homepage (Home.tsx) and the
   Dashboard's front page (dashboard/Landing.tsx). Everything is written to
   attributes and custom properties React doesn't render, so a re-render
   never undoes it; reduced motion shows everything as it ends. */

import { useEffect } from "react";

/* The belts (768px and up). Each keeps its own place (x, in pixels) and is
   moved a frame at a time: by hand while it's dragged, then on what's left
   of that push, and otherwise at its
   own slow drift, which waits while the pointer is over the belt. The
   track holds its cards twice, so the place wraps at half its width. On a
   phone the belts are plain rows that scroll and none of this runs. */
export function useBelts(box: React.RefObject<HTMLElement | null>) {
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const still = matchMedia("(prefers-reduced-motion: reduce)").matches, phone = matchMedia("(width < 768px)");
    const DRIFT = 30;
    interface Belt {
      belt: HTMLElement; track: HTMLElement; dir: number; x: number; v: number; target: number | null; over: boolean;
      drag: { x0: number; from: number; last: number; t: number; moved: boolean } | null;
    }
    const belts: Belt[] = [...el.querySelectorAll<HTMLElement>("[data-belt]")].map((belt) => ({
      belt, track: belt.querySelector<HTMLElement>(".hx-track") as HTMLElement, dir: belt.dataset.belt === "left" ? -1 : 1,
      x: 0, v: 0, target: null, over: false, drag: null,
    }));
    let raf = 0, last = 0, seen = false;
    const frame = (t: number) => {
      const dt = Math.min(0.05, last ? (t - last) / 1000 : 0);
      last = t;
      for (const b of belts) {
        if (phone.matches) { if (b.track.style.transform) b.track.style.transform = ""; continue; }
        const half = b.track.scrollWidth / 2;
        if (b.drag) { /* the pointer sets x */ }
        else if (b.target != null) {
          const d = b.target - b.x;
          b.x += d * Math.min(1, dt * 7);
          if (Math.abs(d) < 0.5) { b.x = b.target; b.target = null; }
        } else if (Math.abs(b.v) > 6) { b.x += b.v * dt; b.v *= Math.pow(0.03, dt); }
        else if (!b.over && !still) b.x += b.dir * DRIFT * dt;
        if (half > 0) {
          const wrap = b.x <= -half ? half : b.x > 0 ? -half : 0;
          if (wrap) { b.x += wrap; if (b.target != null) b.target += wrap; if (b.drag) b.drag.x0 += wrap; }
        }
        b.track.style.transform = `translate3d(${b.x.toFixed(2)}px,0,0)`;
      }
      raf = seen ? requestAnimationFrame(frame) : 0;
    };
    const io = new IntersectionObserver(([e]) => {
      seen = e.isIntersecting;
      if (seen && !raf) { last = 0; raf = requestAnimationFrame(frame); }
    }, { rootMargin: "200px" });
    io.observe(el);

    const offs: (() => void)[] = [];
    const on = <K extends keyof HTMLElementEventMap>(n: HTMLElement, k: K, f: (e: HTMLElementEventMap[K]) => void, o?: AddEventListenerOptions) => {
      n.addEventListener(k, f as EventListener, o);
      offs.push(() => n.removeEventListener(k, f as EventListener, o));
    };
    for (const b of belts) {
      on(b.belt, "pointerenter", (e) => { if (e.pointerType === "mouse") b.over = true; });
      on(b.belt, "pointerleave", () => { b.over = false; });
      on(b.belt, "focusin", () => { b.over = true; });
      on(b.belt, "focusout", () => { b.over = false; });
      on(b.belt, "pointerdown", (e) => {
        if (phone.matches || (e.pointerType === "mouse" && e.button !== 0)) return;
        b.drag = { x0: b.x, from: e.clientX, last: e.clientX, t: e.timeStamp, moved: false };
        b.v = 0; b.target = null;
      });
      on(b.belt, "pointermove", (e) => {
        const d = b.drag;
        if (!d) return;
        const dx = e.clientX - d.from;
        if (!d.moved && Math.abs(dx) > 6) { d.moved = true; b.belt.setPointerCapture(e.pointerId); b.belt.setAttribute("data-drag", ""); }
        if (!d.moved) return;
        b.x = d.x0 + dx;
        const dt = (e.timeStamp - d.t) / 1000;
        if (dt > 0) b.v = b.v * 0.6 + ((e.clientX - d.last) / dt) * 0.4;
        d.last = e.clientX; d.t = e.timeStamp;
      });
      const end = (e: PointerEvent) => {
        const d = b.drag;
        if (!d) return;
        b.drag = null;
        b.belt.removeAttribute("data-drag");
        if (!d.moved) { b.v = 0; return; }
        if (e.timeStamp - d.t > 80) b.v = 0;
        // The press that ended a drag isn't a click on the card under it.
        const stop = (c: Event) => { c.preventDefault(); c.stopPropagation(); };
        b.belt.addEventListener("click", stop, { capture: true, once: true });
        setTimeout(() => b.belt.removeEventListener("click", stop, { capture: true }), 0);
      };
      on(b.belt, "pointerup", end);
      on(b.belt, "pointercancel", end);
      // A sideways swipe on a trackpad moves the belt; up and down still scrolls the page.
      on(b.belt, "wheel", (e) => {
        if (phone.matches || Math.abs(e.deltaX) <= Math.abs(e.deltaY)) return;
        e.preventDefault();
        b.x -= e.deltaX; b.v = 0; b.target = null;
      }, { passive: false });
    }
    return () => { io.disconnect(); cancelAnimationFrame(raf); offs.forEach((f) => f()); };
  }, [box]);
}

/* A page's scroll motion: text eases in as it arrives (data-rv), a chart
   draws once most of it is on screen and resets when it drops back below
   the fold (data-draw), a scene follows the scroll (data-scrub: --s runs 0
   to 1 as it comes up the screen), a picture slides as its section crosses
   the screen (data-pan: --q runs 0 to 1 from entering at the bottom to
   leaving at the top), and in a pile of cards that stick and cover one
   another (data-stack) each card knows how much of it the next has covered
   (--k, 0 to 1). */
export function usePageMotion(root: React.RefObject<HTMLDivElement | null>) {
  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const still = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const rvs = [...el.querySelectorAll<HTMLElement>("[data-rv]")];
    const draws = [...el.querySelectorAll<HTMLElement>("[data-draw]:not([data-pane])")];
    const scrubs = [...el.querySelectorAll<HTMLElement>("[data-scrub]")];
    const pans = [...el.querySelectorAll<HTMLElement>("[data-pan]")];
    const stacks = [...el.querySelectorAll<HTMLElement>("[data-stack]")].map((n) => [...n.children] as HTMLElement[]);
    if (!still) {
      rvs.forEach((n) => n.setAttribute("data-rv", "pre"));
      draws.forEach((n) => n.setAttribute("data-draw", "pending"));
    } else scrubs.forEach((n) => n.style.setProperty("--s", "1"));
    /* The part of the screen the header leaves: below it, or above it in
       the home-screen app, where it's a tab bar along the bottom. */
    const view = (): [number, number] => {
      const r = document.querySelector<HTMLElement>(".navbar")?.getBoundingClientRect();
      if (!r) return [0, innerHeight];
      return r.top > innerHeight / 2 ? [0, r.top] : [Math.max(0, r.bottom), innerHeight];
    };
    let queued = false;
    const tick = () => {
      queued = false;
      const [top, vh] = view();
      if (still) return;
      for (const n of rvs) {
        const r = n.getBoundingClientRect();
        if (r.top < vh * 0.9 && r.bottom > top) n.setAttribute("data-rv", "in");
        else if (r.top >= vh) n.setAttribute("data-rv", "pre");
      }
      for (const n of draws) {
        const r = n.getBoundingClientRect(), on = n.getAttribute("data-draw") === "go";
        if (!r.height) continue;
        const need = Math.min(r.height, vh - top) * Number(n.dataset.drawAt ?? 0.9), seen = Math.min(r.bottom, vh) - Math.max(r.top, top);
        if (!on && seen >= need) n.setAttribute("data-draw", "go");
        else if (on && r.top >= vh) n.setAttribute("data-draw", "pending");
      }
      for (const n of scrubs) {
        const r = n.getBoundingClientRect();
        if (!r.height) continue;
        // 0 as its top edge comes on screen, 1 just before that edge reaches the top.
        const s = Math.max(0, Math.min(1, (vh * 0.98 - r.top) / ((vh - top) * 0.9)));
        n.style.setProperty("--s", (s * s * (3 - 2 * s)).toFixed(4));
      }
      for (const n of pans) {
        const r = n.getBoundingClientRect();
        if (r.height) n.style.setProperty("--q", Math.max(0, Math.min(1, (vh - r.top) / (vh - top + r.height))).toFixed(4));
      }
      for (const cards of stacks) cards.forEach((c, i) => {
        const next = cards[i + 1], r = c.getBoundingClientRect();
        const k = next && r.height ? Math.max(0, Math.min(1, (r.bottom - next.getBoundingClientRect().top) / r.height)) : 0;
        c.style.setProperty("--k", k.toFixed(3));
      });
    };
    const onScroll = () => { if (!queued) { queued = true; requestAnimationFrame(tick); } };
    addEventListener("scroll", onScroll, { passive: true });
    addEventListener("resize", onScroll);
    const t = setTimeout(tick, 120);
    return () => { clearTimeout(t); removeEventListener("scroll", onScroll); removeEventListener("resize", onScroll); };
  }, [root]);
}
