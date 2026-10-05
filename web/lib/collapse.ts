/* Collapsible panels (each page's article, and About's sections): the
   heading carries a chevron and opens or shuts the body below it with a
   height sweep. From initAboutCollapse() and toggleAbout() in
   src/js/app/19-widgets-theme.js. */

export const CHEVRON =
  '<span class="about-chevron"><svg width="14" height="14" viewBox="0 0 16 16" fill="none">' +
  '<path d="M5 6l3 3 3-3" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg></span>';

const SWEEP = 300;
type Wrap = HTMLElement & { _done?: (() => void) | null; _timer?: ReturnType<typeof setTimeout> };

/* The .collapsed class flips at once so the chevron turns with the click; an
   inline display keeps the body on screen while it closes, and the inline
   styles are cleared at the end so the resting state is plain CSS again. */
export function toggleCollapse(p: HTMLElement): void {
  const wrap = p.querySelector<Wrap>(":scope > .about-collapse");
  if (!wrap || window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
    p.classList.toggle("collapsed");
    return;
  }
  // A click mid-sweep reverses from wherever the height is now.
  const from = wrap.getBoundingClientRect().height;
  wrap._done?.();
  const opening = p.classList.contains("collapsed");
  p.classList.toggle("collapsed", !opening);
  wrap.style.display = "block";
  wrap.style.transition = "none";
  wrap.style.height = "auto";
  const full = wrap.scrollHeight;
  wrap.style.height = from + "px";
  void wrap.offsetHeight;
  wrap.style.transition = `height ${SWEEP / 1000}s cubic-bezier(.25,.8,.3,1)`;
  wrap.style.height = (opening ? full : 0) + "px";
  const done = () => {
    clearTimeout(wrap._timer);
    wrap.removeEventListener("transitionend", done);
    wrap._done = null;
    wrap.style.transition = "";
    wrap.style.height = "";
    wrap.style.display = "";
  };
  wrap._done = done;
  // transitionend is skipped if the panel is hidden mid-sweep, so a timer too.
  wrap._timer = setTimeout(done, SWEEP + 60);
  wrap.addEventListener("transitionend", done);
}
