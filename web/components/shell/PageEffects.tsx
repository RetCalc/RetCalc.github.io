"use client";

/* Small page-wide behaviors, from src/page.html and 19-widgets-theme.js:

   - A page's own views (Drawdown's three, a stack carrying data-tab whose
     panels say which views they belong to with data-ddtabs): on a switch,
     the panels that come in rise a few pixels as they fade in (.pane-in,
     styles/03-navigation.css). Only on a switch, never on an update.
   - Every figure recomputes as you type; the screen-reader live region
     reports the headline figures once they settle, not each keystroke.
   - A tool's inputs column (<aside>, sticky beside the results) ends 16px
     above the bottom of the screen wherever it starts, so its last field is
     always reachable by scrolling the column itself. The stylesheet sizes it
     for when it's pinned under the header; above that, at the top of the
     page under the tool's own header, it would run off the bottom of the
     screen. Kept up to date as the page scrolls or resizes.
   - iOS zooms toward a focused field even when its font is 16px. Pinning
     maximum-scale while a field has focus stops that; the viewport goes back
     on blur so pinch-zoom still works everywhere else (the old site's
     02-accounts-advanced.js did the same). */

import { useEffect } from "react";

function announce() {
  const head = [...document.querySelectorAll<HTMLElement>("#main .headline, #main [data-readout]")].find((el) => el.offsetParent !== null);
  const live = document.getElementById("srLive");
  if (!head || !live) return;
  const parts: string[] = [];
  // A readout's figures: the columns of a .headline, or the homepage's
  // [data-pair]s, each a label ([data-k]) and the figure after it.
  const pairs = head.matches(".headline") ? head.querySelectorAll(":scope > div") : head.querySelectorAll("[data-pair]");
  pairs.forEach((d) => {
    const k = d.querySelector(".k, [data-k]"), v = d.querySelector(".v, [data-k] + *");
    const t = v?.textContent?.trim() ?? "";
    if (k && t && t !== "—" && t !== "--") parts.push(k.textContent!.trim() + ": " + t);
  });
  if (parts.length) live.textContent = parts.join(". ");
}

const typed = (t: EventTarget | null) =>
  t instanceof HTMLElement && (t.matches("input, select, textarea") || t.isContentEditable);

// Next puts a new viewport tag in on every page change, so the live one is
// looked up each time rather than kept.
const LOCK = ", maximum-scale=1";
const viewport = () => document.querySelector<HTMLMetaElement>('meta[name="viewport"]');

function noFocusZoom() {
  let restore: ReturnType<typeof setTimeout>;
  const unpin = () => {
    const vp = viewport();
    if (vp?.content.endsWith(LOCK)) vp.content = vp.content.slice(0, -LOCK.length);
  };
  const lock = (e: FocusEvent) => {
    if (!typed(e.target)) return;
    clearTimeout(restore);
    const vp = viewport();
    if (vp && !vp.content.includes("maximum-scale")) vp.content += LOCK;
  };
  const unlock = (e: FocusEvent) => {
    if (!typed(e.target)) return;
    clearTimeout(restore);
    // a short wait, so tabbing from field to field doesn't flicker the viewport
    restore = setTimeout(unpin, 250);
  };
  document.addEventListener("focusin", lock);
  document.addEventListener("focusout", unlock);
  return () => {
    document.removeEventListener("focusin", lock);
    document.removeEventListener("focusout", unlock);
    clearTimeout(restore);
    unpin();
  };
}

/* The inputs columns' height: from where each starts on screen to 16px above
   the screen's bottom, never more than the stylesheet's pinned height (when
   the page has scrolled past the column's end, its top rises above the pin)
   and never under 240px. Only sticky columns: on a phone they run with the
   page and keep the stylesheet's own height. */
function fitAsides() {
  let queued = false;
  const fit = () => {
    queued = false;
    for (const a of document.querySelectorAll<HTMLElement>("main aside")) {
      const cs = getComputedStyle(a);
      let h = "";
      if (cs.position === "sticky") {
        const pin = parseFloat(cs.top) || 0, top = a.getBoundingClientRect().top;
        h = Math.round(Math.max(240, innerHeight - Math.max(top, pin) - 16)) + "px";
      }
      if (a.style.maxHeight !== h) a.style.maxHeight = h;
    }
  };
  const queue = () => {
    if (!queued) { queued = true; requestAnimationFrame(fit); }
  };
  addEventListener("scroll", queue, { passive: true });
  addEventListener("resize", queue);
  // A page change, or anything above the column changing height (a header
  // that wraps, a notice that opens), moves where the column starts.
  const ro = new ResizeObserver(queue);
  ro.observe(document.body);
  queue();
  return () => {
    removeEventListener("scroll", queue);
    removeEventListener("resize", queue);
    ro.disconnect();
  };
}

export function PageEffects() {
  useEffect(noFocusZoom, []);
  useEffect(fitAsides, []);
  useEffect(() => {
    const main = document.getElementById("main");
    if (!main) return;
    let timer: ReturnType<typeof setTimeout>;
    const obs = new MutationObserver(() => {
      clearTimeout(timer);
      timer = setTimeout(announce, 700);
    });
    obs.observe(main, { subtree: true, childList: true, characterData: true });
    const views = new MutationObserver((muts) => {
      for (const m of muts) {
        const el = m.target as HTMLElement, now = el.dataset.tab, was = m.oldValue;
        if (!now || now === was) continue;
        el.querySelectorAll<HTMLElement>("[data-ddtabs]").forEach((p) => {
          const of = p.dataset.ddtabs!.split(" ");
          if (!of.includes(now) || (was && of.includes(was))) return;
          p.classList.remove("pane-in");
          void p.offsetWidth; // replays on a quick switch back
          p.classList.add("pane-in");
        });
      }
    });
    views.observe(main, { subtree: true, attributes: true, attributeFilter: ["data-tab"], attributeOldValue: true });
    return () => {
      obs.disconnect();
      views.disconnect();
      clearTimeout(timer);
    };
  }, []);
  return null;
}
