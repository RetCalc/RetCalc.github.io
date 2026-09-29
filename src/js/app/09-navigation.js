/* ---------- tabs ---------- */
/* ---------- chart mode switches ---------- */
function wireMode(segId, which, opts, redraw){
  $(segId).addEventListener("click", e => {
    const b = e.target.closest ? e.target.closest("button[data-mode]") : null;
    if (!b) return;
    const m = b.getAttribute("data-mode");
    if (chartMode[which] === m) return;
    chartMode[which] = m;
    $(segId).querySelectorAll("button").forEach(x =>
      x.classList.toggle("on", x.getAttribute("data-mode") === m));
    for (const k in opts){ const el = $(opts[k]); if (el) el.hidden = (k !== m); }
    redraw();
    if (which === "series") renderSeries();
  });
}
const redrawSingle = () => { if (lastRun) drawChart(lastRun, readInputs()); };
wireMode("segSingle", "single", {band:"optBand", hist:"histBar", mc:"mcBar"}, redrawSingle);
wireMode("segSeries", "series", {band:"optBandS", hist:"histBarS", mc:"mcBarS"},
         () => renderSeries());
["histMix","histMixEnd"].forEach(id => $(id).addEventListener("input", () => {
  if (chartMode.single === "hist") redrawSingle();
}));
["histMixS","histMixEndS"].forEach(id => $(id).addEventListener("input", () => {
  if (chartMode.series === "hist") renderSeries();
}));

function reroll(){ mcSeed = (mcSeed * 1664525 + 1013904223) >>> 0; }
$("btnReroll").addEventListener("click", () => {
  reroll(); redrawSingle(); toast("New set of runs");
});
$("btnRerollS").addEventListener("click", () => {
  reroll(); renderSeries(); toast("New set of runs");
});
$("volatility").addEventListener("input", () => {
  if (chartMode.single === "mc") scheduleMC(redrawSingle);
});

/* iOS decimal keypad has no minus key, so rates get an explicit sign flip. */
document.addEventListener("click", e => {
  const b = e.target.closest ? e.target.closest(".signflip") : null;
  if (!b) return;
  const el = b.parentNode.querySelector("input");
  if (!el) return;
  const v = parseNum(el.value);
  el.value = String(-v);
  b.classList.toggle("on", -v < 0);
  el.dispatchEvent(new Event("input", {bubbles:true}));
  el.dispatchEvent(new Event("change", {bubbles:true}));
});

/* ---------- the Calculator tab's mode menu ----------
   Basic, Advanced and Stages live behind one tab. The tab shows the open
   mode, and remembers it: the menu is how you switch. With a mouse it opens
   on hover, and clicking the tab returns to the remembered mode. Its layout (dropdown,
   full-width phone sheet, or a sheet rising from the web app's bottom bar)
   is all CSS; the script only places it under the tab on a wide screen. */
const CALC_MODES = {simple:"Basic", single:"Advanced", series:"Stages"};
const CALCBTN = $("tabbtn-calc");
const CALCITEMS = Array.prototype.slice.call(
  document.querySelectorAll("#calcMenu [role=menuitemradio]"));
function calcModeSync(t){
  if (CALC_MODES[t] == null) return;
  $("calcMode").textContent = CALC_MODES[t];
  CALCBTN.setAttribute("aria-controls", "tab-" + t);
  CALCITEMS.forEach(x => x.setAttribute("aria-checked", String(x.getAttribute("data-mode") === t)));
}
function calcMenuPlace(){
  const m = $("calcMenu"), nb = CALCBTN.closest(".navbar");
  const bl = CALCBTN.getBoundingClientRect().left - nb.getBoundingClientRect().left;
  // Line the menu's text up with the tab's, but never past the right edge.
  const max = nb.clientWidth - m.offsetWidth - 10;
  m.style.left = Math.max(10, Math.min(bl - 12, max)) + "px";
}
function calcMenuOpen(focusItem, hover){
  const m = $("calcMenu");
  m.hidden = false;
  $("calcScrim").hidden = !!hover;
  CALCBTN.closest(".navbar").classList.add("menu-open");
  CALCBTN.setAttribute("aria-expanded", "true");
  calcMenuPlace();
  if (focusItem){
    const cur = CALCITEMS.find(x => x.getAttribute("aria-checked") === "true") || CALCITEMS[0];
    cur.focus();
  }
}
function calcMenuClose(refocus){
  const m = $("calcMenu");
  if (m.hidden) return;
  m.hidden = true;
  $("calcScrim").hidden = true;
  CALCBTN.closest(".navbar").classList.remove("menu-open");
  CALCBTN.setAttribute("aria-expanded", "false");
  if (refocus) CALCBTN.focus();
}
CALCITEMS.forEach((it, i) => {
  it.addEventListener("click", e => {
    const t = it.getAttribute("data-mode");
    calcMenuClose(e.detail === 0);
    if (t !== chartMode.tab){
      paneDir = "tab";
      showTab(t);
      pushNav();
    }
  });
  it.addEventListener("keydown", e => {
    let j = -1;
    if (e.key === "ArrowDown") j = (i + 1) % CALCITEMS.length;
    else if (e.key === "ArrowUp") j = (i - 1 + CALCITEMS.length) % CALCITEMS.length;
    else if (e.key === "Home") j = 0;
    else if (e.key === "End") j = CALCITEMS.length - 1;
    else if (e.key === "Escape"){ e.preventDefault(); calcMenuClose(true); return; }
    else if (e.key === "Tab"){ calcMenuClose(false); return; }
    if (j < 0) return;
    e.preventDefault();
    CALCITEMS[j].focus();
  });
});
$("calcScrim").addEventListener("click", () => calcMenuClose(false));
/* With a mouse, the menu opens on hover and the tab itself goes straight to
   the mode you were last on. Touch screens have no hover, so there a tap on
   the tab still opens the menu. A short delay on leaving lets the pointer
   cross from the tab to the menu, and the menu's ::before covers the gap. */
const CALC_HOVER = window.matchMedia ? window.matchMedia("(hover:hover) and (pointer:fine)") : null;
function calcHover(){ return !!(CALC_HOVER && CALC_HOVER.matches); }
let calcHoverTimer = null;
[CALCBTN, $("calcMenu")].forEach(el => {
  el.addEventListener("mouseenter", () => {
    if (!calcHover()) return;
    clearTimeout(calcHoverTimer);
    if ($("calcMenu").hidden) calcMenuOpen(false, true);
  });
  el.addEventListener("mouseleave", () => {
    if (!calcHover()) return;
    clearTimeout(calcHoverTimer);
    calcHoverTimer = setTimeout(() => {
      // keep it open while a keyboard user is inside it
      if (!$("calcMenu").contains(document.activeElement)) calcMenuClose(false);
    }, 220);
  });
});
function calcLastMode(){
  const cur = CALCITEMS.find(x => x.getAttribute("aria-checked") === "true");
  return cur ? cur.getAttribute("data-mode") : "simple";
}
// A press anywhere outside the menu and its tab closes it. pointerdown rather
// than click, so the press that starts a scroll on a phone counts too.
document.addEventListener("pointerdown", e => {
  if ($("calcMenu").hidden || !e.target.closest) return;
  if (e.target.closest("#calcMenu") || e.target.closest("#tabbtn-calc")) return;
  calcMenuClose(false);
}, true);
document.addEventListener("keydown", e => {
  if (e.key === "Escape" && !$("calcMenu").hidden) calcMenuClose(true);
});
window.addEventListener("resize", () => { if (!$("calcMenu").hidden) calcMenuPlace(); });

/* Direction of the next pane swap, consumed by playPaneEnter. Set by whichever
   control initiated the move; defaults back to a plain tab change so a stray
   programmatic showTab can't inherit a stale direction. */
let paneDir = "tab";
const PANE_CLASSES = ["pane-in","pane-in-fwd","pane-in-back","pane-in-cards"];
/* Runs after the [hidden] flags are set, so it animates whatever actually
   ended up visible rather than trying to predict it. Removing the class and
   reading offsetWidth forces a reflow, which is what lets the same animation
   replay on a repeat visit to the same pane. */
function playPaneEnter(){
  const dir = paneDir;
  paneDir = "tab";
  const panes = Array.prototype.filter.call(
    document.querySelectorAll("#main > .stack, #main > aside"), el => !el.hidden);
  panes.forEach(el => {
    const cls = (el.id === "tab-toolpicker") ? "pane-in-cards"
      : (dir === "fwd") ? "pane-in-fwd"
      : (dir === "back") ? "pane-in-back" : "pane-in";
    PANE_CLASSES.forEach(c => el.classList.remove(c));
    void el.offsetWidth;
    el.classList.add(cls);
  });
}

/* The back row is the first grid item in main and spans every column, so it
   sits above the input pane in both layouts. Its label is read off the picker
   card rather than duplicated here, so the two can't drift apart. */
function setToolBack(sub){
  const row = $("toolBack"), onPicker = (sub === "picker");
  row.hidden = onPicker;
  if (onPicker) return;
  const card = document.querySelector('.toolcard[data-pick="' + sub + '"]');
  if (!card) return;
  // The header repeats the card you picked: its icon tile, name (and badge)
  // and one-line description.
  const name = card.querySelector(".toolcard-name"), badge = name && name.querySelector(".beta");
  $("toolCrumb").textContent = toolName(name);
  if (badge) $("toolCrumb").appendChild(badge.cloneNode(true));
  const ic = card.querySelector(".toolcard-icon");
  $("toolHeadIcon").innerHTML = ic ? ic.innerHTML : "";
  const d = card.querySelector(".toolcard-desc");
  $("toolHeadDesc").textContent = d ? d.textContent.trim() : "";
}
$("btnToolBack").addEventListener("click", () => {
  paneDir = "back";
  showTool("picker");
  pushNav();
});

/* Tab and tool moves are pushed as history entries so the phone's back
   gesture steps back through the app instead of leaving it. The state lives
   in the entry object, not the URL, so a share link's hash is untouched. */
let navSuspended = false;
/* Clean paths for the tools that have one (e.g. /incometax), built from a
   single table so the two directions can't drift apart. Tabs/states with no
   entry here (compare views, the picker's own url) just don't rewrite the
   address bar. A share link's hash (#s= or #p=) still wins on load when present,
   since it carries full input state, not just which tab is open. */
const TOOL_PATHS = {
  tax:"incometax", mortgage:"mortgage", budget:"budget", college:"college",
  rentbuy:"rentbuy", drawdown:"drawdown", roth:"roth", debt:"debt",
  backtest:"backtest", healthcare:"healthcare", fire:"fire", bridge:"bridge"
};
const SUB_BY_PATH = {};
Object.keys(TOOL_PATHS).forEach(sub => { SUB_BY_PATH[TOOL_PATHS[sub]] = sub; });
/* Tab ids are "single" and "series" inside the code, but the address shows
   the names on the tabs. The old /single and /series addresses still open
   the right tab, so bookmarks and links shared before the rename keep working. */
const TAB_PATHS = {single:"advanced", series:"stages", about:"about", guide:"guide"};
const TAB_BY_PATH = {advanced:"single", stages:"series", about:"about",
                     single:"single", series:"series", guide:"guide"};
function pathForRoute(t, s){
  if (t === "simple") return "/";
  if (TAB_PATHS[t]) return "/" + TAB_PATHS[t];
  if (t === "tools") return "/" + (TOOL_PATHS[s] || "tools");
  return null;
}
/* Search landing pages that open an existing tool under their own address:
   /rmd is the Roth tool, /72t the Bridge. The address stays as it came in
   (see the boot's canonical swap) and the page shows its own article. */
const PATH_ALIAS = {rmd:"roth", "72t":"bridge"};
function pathSeg(path){ return path.replace(/^\/+|\/+$/g, "").replace(/\.html$/, ""); }
function routeFromPath(path){
  const seg = pathSeg(path);
  if (!seg) return null;
  if (PATH_ALIAS[seg]) return {t:"tools", s:PATH_ALIAS[seg]};
  if (TAB_BY_PATH[seg]) return {t:TAB_BY_PATH[seg]};
  if (seg === "tools") return {t:"tools", s:"picker"};
  if (SUB_BY_PATH[seg]) return {t:"tools", s:SUB_BY_PATH[seg]};
  return null;
}
function pushNav(){
  if (navSuspended) return;
  try {
    const path = pathForRoute(chartMode.tab, toolSub);
    if (path) history.pushState({t:chartMode.tab, s:toolSub}, "", path);
    else history.pushState({t:chartMode.tab, s:toolSub}, "");
  } catch(e){}
}
window.addEventListener("popstate", e => {
  const st = e.state;
  if (!st || !st.t) return;
  navSuspended = true;
  if (st.t === "compare"){
    if (chartMode.tab === "compare"){ navSuspended = false; return; }
    paneDir = "tab";
    showCompare();
    navSuspended = false;
    return;
  }
  if (st.t === "dd-compare"){
    if (chartMode.tab === "dd-compare"){ navSuspended = false; return; }
    paneDir = "tab";
    showDDCompare();
    navSuspended = false;
    return;
  }
  if (chartMode.tab === "compare") chartMode.tab = cmpPrevTab;
  if (chartMode.tab === "dd-compare") chartMode.tab = ddCmpPrevTab;
  paneDir = (st.t === "tools" && st.s === "picker") ? "back" : "tab";
  // The guide used to be a tool, so an older entry can still say so.
  if (st.t === "tools" && st.s === "guide") showTab("guide");
  else if (st.t === "tools"){ toolSub = st.s || "picker"; showTab("tools"); }
  else showTab(st.t);
  navSuspended = false;
});

/* Tools is a container tab: picking it reveals a second row for choosing which
   tool, so more can be added later without crowding the main nav. */
let toolSub = "picker";
/* A tool card's name without its badge (the Roth card carries "Beta"). */
function toolName(card){
  if (!card) return "";
  return Array.prototype.filter.call(card.childNodes, n => n.nodeType === 3)
    .map(n => n.textContent).join("").trim();
}
/* The tab title follows the view, so a row of open tabs or the history list
   says which tool each one is. */
/* Titles and descriptions for every page, in the JSON block in <head>
   (src/page-meta.json). The same table writes each address's static <head>
   (build.py), so the
   title a search engine reads and the one the app sets can't drift apart. */
let PAGE_META = null;
try { PAGE_META = JSON.parse($("pageMeta").textContent); } catch(e){}
/* Which page's article and title go with where the app is now: the tab or
   tool, or a landing alias like /rmd while you're still on its tool. */
function pageSlug(){
  const t = chartMode.tab;
  let slug = t === "simple" ? "home" : t === "single" ? "advanced" : t === "series" ? "stages"
    : t === "guide" ? "guide" : t === "about" ? "about"
    : t === "tools" ? (toolSub === "picker" ? "tools" : TOOL_PATHS[toolSub] || null) : null;
  const here = pathSeg(location.pathname);
  if (PATH_ALIAS[here] && slug && SUB_BY_PATH[slug] === PATH_ALIAS[here]) slug = here;
  return slug;
}
/* Each page ships with only its own article (build.py), so moving to another
   tool inside the app shows none rather than the wrong one. The page's one
   h1 is the tool's title in its header; elsewhere it's #pageH1, read by
   screen readers and search engines. A landing alias names the tool its
   own way (/72t is "72(t) Calculator"). Runs after setToolBack(). */
function seoSync(){
  const slug = pageSlug();
  document.querySelectorAll(".seo-a").forEach(a => { a.hidden = a.getAttribute("data-page") !== slug; });
  const P = PAGE_META && PAGE_META.pages[slug];
  const onTool = chartMode.tab === "tools" && toolSub !== "picker";
  $("pageH1").hidden = onTool;
  if (!onTool) $("pageH1").textContent = P && P.h1 ? P.h1 : "RetCalc";
  else if (P && P.h1) $("toolCrumb").textContent = P.h1;
}
function setDocTitle(){
  const P = PAGE_META && PAGE_META.pages[pageSlug()];
  if (P){ document.title = P.title; return; }
  const base = "RetCalc";
  const t = chartMode.tab;
  let name = "";
  if (t === "single") name = "Advanced";
  else if (t === "series") name = "Stages";
  else if (t === "about") name = "About";
  else if (t === "guide") name = "Retirement Readiness Guide";
  else if (t === "tools"){
    const card = document.querySelector('.toolcard[data-pick="' + toolSub + '"] .toolcard-name');
    name = toolSub === "picker" ? "Tools" : (toolName(card) || "Tools");
  }
  document.title = name ? name + " \u00b7 " + base : base;
}
function showTool(sub){
  toolSub = sub;
  const onPicker = (sub === "picker");
  setToolBack(sub);
  $("tab-toolpicker").hidden = !onPicker;
  $("tab-tax").hidden = (sub !== "tax");
  $("tab-mortgage").hidden = (sub !== "mortgage");
  $("tab-budget").hidden = (sub !== "budget");
  $("tab-college").hidden = (sub !== "college");
  $("tab-rentbuy").hidden = (sub !== "rentbuy");
  $("tab-drawdown").hidden = (sub !== "drawdown");
  $("tab-roth").hidden = (sub !== "roth");
  $("tab-debt").hidden = (sub !== "debt");
  $("tab-backtest").hidden = (sub !== "backtest");
  $("tab-healthcare").hidden = (sub !== "healthcare");
  $("tab-fire").hidden = (sub !== "fire");
  $("asideBT").hidden = (sub !== "backtest");
  $("tab-bridge").hidden = (sub !== "bridge");
  $("asideBR").hidden = (sub !== "bridge");
  $("asideHC").hidden = (sub !== "healthcare");
  $("asideFire").hidden = (sub !== "fire");
  $("asideTax").hidden = (sub !== "tax");
  $("asideMort").hidden = (sub !== "mortgage");
  $("asideCollege").hidden = (sub !== "college");
  $("asideRB").hidden = (sub !== "rentbuy");
  $("asideDD").hidden = (sub !== "drawdown");
  $("asideRC").hidden = (sub !== "roth");
  // Budget has no sidebar inputs, so it earns the same full-width layout
  // as the tool picker rather than sitting narrow with empty space beside it.
  $("main").classList.toggle("solo", onPicker || sub === "budget" || sub === "debt");
  refreshScenarioList(currentScenario[activeTool()] || "");
  initCSVButtons();
  if (sub === "tax") renderTax();
  else if (sub === "mortgage") renderMort();
  else if (sub === "budget") renderBudget();
  else if (sub === "college") renderCollege();
  else if (sub === "rentbuy") renderRentBuy();
  else if (sub === "drawdown"){ renderDrawdown(); showDDIntro(); }
  else if (sub === "roth") renderRoth();
  else if (sub === "debt") renderDebt();
  else if (sub === "backtest") renderBacktest();
  else if (sub === "healthcare"){ if (hcReady) renderHealthcare(); }
  else if (sub === "bridge"){ if (brReady) renderBridge(); }
  else if (sub === "fire") {
    var fiEl = $("fiTarget");
    if (fiEl) fiEl.dispatchEvent(new Event("input", {bubbles:true}));
  }
  gdCoachSync();
  setDocTitle();
  try { window.scrollTo({top:0, behavior:"auto"}); } catch(e){ window.scrollTo(0, 0); }
  playPaneEnter();
}
/* Drawdown packs in more than any other tool, so first-time visitors get a
   one-line orientation. Dismissing it is remembered, same pattern as the
   theme preference. */
const DD_INTRO_KEY = "retcalc-dd-intro-seen";
function showDDIntro(){
  let seen = false;
  try { seen = localStorage.getItem(DD_INTRO_KEY) === "1"; } catch(e){}
  $("ddIntro").hidden = seen;
}
function dismissDDIntro(){
  $("ddIntro").hidden = true;
  try { localStorage.setItem(DD_INTRO_KEY, "1"); } catch(e){}
}
$("ddIntroClose").addEventListener("click", dismissDDIntro);
function showTab(t){
  chartMode.tab = t;
  $("tab-compare").hidden = true;
  $("tab-dd-compare").hidden = true;
  calcMenuClose(false);
  document.querySelectorAll("nav[role=tablist] button").forEach(x => {
    const k = x.getAttribute("data-tab");
    const on = k === t || (k === "calc" && CALC_MODES[t] != null);
    x.setAttribute("aria-selected", String(on));
    if (on) x.removeAttribute("tabindex"); else x.setAttribute("tabindex", "-1");
  });
  calcModeSync(t);
  $("tab-guide").hidden = (t !== "guide");
  $("tab-simple").hidden = (t !== "simple");
  $("tab-single").hidden = (t !== "single");
  $("tab-series").hidden = (t !== "series");
  $("tab-about").hidden = (t !== "about");
  hhPlace(t);
  // tools tab always delegates to showTool for pane visibility
  if (t !== "tools"){
    $("tab-toolpicker").hidden = true;
    $("tab-tax").hidden = true;
    $("tab-mortgage").hidden = true;
    $("tab-budget").hidden = true;
    $("asideTax").hidden = true;
    $("asideMort").hidden = true;
    $("asideCollege").hidden = true;
    $("asideRB").hidden = true;
    $("tab-college").hidden = true;
    $("tab-rentbuy").hidden = true;
    $("tab-drawdown").hidden = true;
    $("asideDD").hidden = true;
    $("tab-roth").hidden = true;
    $("asideRC").hidden = true;
    $("tab-debt").hidden = true;
    $("tab-backtest").hidden = true;
    $("tab-healthcare").hidden = true;
    $("tab-fire").hidden = true;
    $("asideBT").hidden = true;
    $("tab-bridge").hidden = true;
    $("asideBR").hidden = true;
    $("asideHC").hidden = true;
    $("asideFire").hidden = true;
    $("main").classList.remove("solo");
  }
  if (t !== "tools") setToolBack("picker");
  $("asideSimple").hidden = (t !== "simple");
  $("asideSingle").hidden = (t !== "single");
  $("asideSeries").hidden = (t !== "series");
  $("main").classList.toggle("solo", t === "about" || t === "guide");
  refreshScenarioList(currentScenario[activeTool()] || "");
  if (t === "simple") renderBasic();
  else if (t === "single"){ if (lastRun) drawChart(lastRun, readInputs()); renderTools(); }
  else if (t === "series") renderSeries();
  else if (t === "guide") gdShow();
  else if (t === "tools") showTool(toolSub);
  if (t !== "tools"){ setDocTitle(); gdCoachSync(); }
  try { window.scrollTo({top:0, behavior:"auto"}); } catch(e){ window.scrollTo(0, 0); }
  if (t !== "tools") playPaneEnter();
}
const TABBTNS = Array.prototype.slice.call(
  document.querySelectorAll("nav[role=tablist] button"));
TABBTNS.forEach((b, i) => {
  b.addEventListener("click", e => {
    const t = b.getAttribute("data-tab");
    // With a mouse, Calculator goes to the mode last used (the menu opens
    // on hover); on a touch screen, a tap opens the mode menu.
    if (t === "calc"){
      if (calcHover() && e.detail !== 0){
        clearTimeout(calcHoverTimer);
        calcMenuClose(false);
        const m = calcLastMode();
        if (chartMode.tab !== m){ paneDir = "tab"; showTab(m); pushNav(); }
        return;
      }
      if ($("calcMenu").hidden) calcMenuOpen(e.detail === 0);
      else calcMenuClose(false);
      return;
    }
    // Clicking Tools while a tool is open → return to picker
    if (t === "tools" && chartMode.tab === "tools" && toolSub !== "picker"){
      paneDir = "back";
      showTool("picker");
    } else {
      showTab(t);
    }
    pushNav();
  });
  /* A tablist is expected to move on the arrow keys, with one stop in the tab
     order for the whole rail rather than one per tab. showTab keeps the
     tabindex roving as the selection changes. */
  b.addEventListener("keydown", e => {
    if (b === CALCBTN && (e.key === "ArrowDown" || e.key === "ArrowUp")){
      e.preventDefault();
      calcMenuOpen(true);
      return;
    }
    let j = -1;
    if (e.key === "ArrowRight") j = (i + 1) % TABBTNS.length;
    else if (e.key === "ArrowLeft") j = (i - 1 + TABBTNS.length) % TABBTNS.length;
    else if (e.key === "Home") j = 0;
    else if (e.key === "End") j = TABBTNS.length - 1;
    if (j < 0) return;
    e.preventDefault();
    calcMenuClose(false);
    TABBTNS[j].focus();
    // Arrowing onto Calculator only lands there; opening its menu on the way
    // past would get in the way of reaching Tools.
    if (TABBTNS[j] !== CALCBTN) TABBTNS[j].click();
  });
});
document.querySelectorAll(".toolcard[data-pick]").forEach(card => {
  const go = () => {
    if (chartMode.tab !== "tools") showTab("tools");
    paneDir = "fwd";
    showTool(card.getAttribute("data-pick"));
    pushNav();
  };
  /* Where the browser can, the card's icon tile glides up into the tool's
     header as the page changes (a view transition naming the one tile on
     each side); elsewhere, or with reduced motion, the page just changes. */
  const activate = () => {
    const ic = card.querySelector(".toolcard-icon");
    let motion = true;
    try { motion = !window.matchMedia("(prefers-reduced-motion: reduce)").matches; } catch(e){}
    if (!document.startViewTransition || !motion || !ic){ go(); return; }
    ic.style.viewTransitionName = "toolicon";
    let vt;
    try {
      vt = document.startViewTransition(() => {
        ic.style.viewTransitionName = "";
        go();
        $("toolHeadIcon").style.viewTransitionName = "toolicon";
      });
    } catch(e){ ic.style.viewTransitionName = ""; go(); return; }
    const done = () => { $("toolHeadIcon").style.viewTransitionName = ""; ic.style.viewTransitionName = ""; };
    // A transition the browser skips (a hidden tab, say) still runs the
    // update; its promises just reject, which is expected, not an error.
    vt.ready.catch(() => {});
    vt.updateCallbackDone.catch(() => {});
    vt.finished.then(done, done);
  };
  card.addEventListener("click", activate);
  card.addEventListener("keydown", e => {
    if (e.key === "Enter" || e.key === " "){ e.preventDefault(); activate(); }
  });
});



