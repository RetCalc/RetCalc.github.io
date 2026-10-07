/* Collapsible panels (each page's article): the heading carries a chevron
   and opens or shuts the body below it. From initAboutCollapse() and
   toggleAbout() in src/js/app/19-widgets-theme.js.

   The height changes in one step (DESIGN.md, Motion: transform and opacity
   only). On opening, the body settles in through .reveal (a 200ms fade and
   4px drop, styles/08-about-budget.css); closing is instant, and reduced
   motion turns the reveal off in CSS. */

export const CHEVRON =
  '<span class="about-chevron"><svg width="14" height="14" viewBox="0 0 16 16" fill="none">' +
  '<path d="M5 6l3 3 3-3" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg></span>';

export function toggleCollapse(p: HTMLElement): void {
  const opening = !p.classList.toggle("collapsed");
  p.querySelector(":scope > h2 > button[aria-expanded]")?.setAttribute("aria-expanded", String(opening));
  const wrap = p.querySelector<HTMLElement>(":scope > .about-collapse");
  if (!wrap) return;
  wrap.classList.remove("reveal");
  if (opening) {
    void wrap.offsetWidth; // replays on a quick reopen
    wrap.classList.add("reveal");
  }
}
