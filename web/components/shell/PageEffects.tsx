"use client";

/* Small page-wide behaviors, from src/page.html and 19-widgets-theme.js:

   - Each segmented switch (.seg) gets one raised highlight that slides to
     the chosen option, instead of the highlight blinking from one to the
     next. Measured off the active button, so unequal widths line up.
   - A page's own views (Drawdown's three, a stack carrying data-tab whose
     panels say which views they belong to with data-ddtabs): on a switch,
     the panels that come in rise a few pixels as they fade in (.pane-in,
     styles/03-navigation.css). Only on a switch, never on an update.
   - Every figure recomputes as you type; the screen-reader live region
     reports the headline figures once they settle, not each keystroke. */

import { useEffect } from "react";

function initSeg(seg: HTMLElement & { __thumb?: boolean }) {
  if (seg.__thumb) return;
  seg.__thumb = true;
  const thumb = document.createElement("span");
  thumb.className = "seg-thumb";
  seg.insertBefore(thumb, seg.firstChild);
  const place = () => {
    const on = seg.querySelector<HTMLElement>("button.on");
    // Every write here is guarded: even a no-op classList change counts as a
    // mutation, and would wake this observer again, forever.
    if (!on || !on.offsetWidth) {
      if (thumb.classList.contains("ready")) thumb.classList.remove("ready");
      return;
    }
    const w = on.offsetWidth + "px", x = `translateX(${on.offsetLeft}px)`;
    // Only write on a real change, so this can't re-trigger its own observer.
    if (thumb.style.width !== w) thumb.style.width = w;
    if (thumb.style.transform !== x) thumb.style.transform = x;
    if (!thumb.classList.contains("ready")) thumb.classList.add("ready");
  };
  new MutationObserver(place).observe(seg, { subtree: true, attributes: true, attributeFilter: ["class"] });
  new ResizeObserver(place).observe(seg);
  place();
}

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

export function PageEffects() {
  useEffect(() => {
    const main = document.getElementById("main");
    if (!main) return;
    main.querySelectorAll<HTMLElement>(".seg").forEach(initSeg);
    let timer: ReturnType<typeof setTimeout>;
    const obs = new MutationObserver((muts) => {
      for (const m of muts) m.addedNodes.forEach((n) => {
        if (n instanceof HTMLElement) {
          if (n.matches(".seg")) initSeg(n);
          n.querySelectorAll<HTMLElement>(".seg").forEach(initSeg);
        }
      });
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
