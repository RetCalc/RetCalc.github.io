/* ---------- moving between the guide and the tools ---------- */
function gdLoc(){
  const t = chartMode.tab;
  if (t === "tools") return toolSub;
  if (t === "simple") return "basic";
  return t;
}
function gdNavTool(tool, dir){
  paneDir = dir || "fwd";
  if (tool === "basic") showTab("simple");
  else if (tool === "single" || tool === "series" || tool === "guide") showTab(tool);
  else { toolSub = tool; showTab("tools"); }
  pushNav();
}
function gdTrip(id, from){
  const T = GD_TRIPS[id];
  if (!T) return;
  const st = gdCur();
  if (st.commit && (!st.ok || st.ok(gd.a))) st.commit();
  gd.trip = {id, from: from || gd.cur};
  gd.coachMin = false;
  try { T.prefill(); } catch(e){}
  gdSave();
  gdNavTool(T.tool);
}
/* However you get back to the guide (its button, the phone's back gesture,
   or the Tools card) the tool's result comes with you. */
function gdCapture(){
  const t = gd.trip;
  if (!t) return;
  const T = GD_TRIPS[t.id];
  let got = null;
  try { got = T.capture ? T.capture() : null; } catch(e){}
  const back = typeof got === "string" ? {msg:got} : got;
  gd.back = back && back.msg ? {step:t.from, msg:back.msg, undo:back.undo || null} : null;
  if (gdStep(t.from)) gd.cur = t.from;
  gd.trip = null;
  gdSave();
}
function gdShow(){
  gdCapture();
  gdRender(true);
}
function gdReturn(){ gdNavTool("guide", "back"); }
function gdEndTrip(){
  gd.trip = null;
  gdSave();
  gdCoachSync();
  toast("Guide closed. It's saved under the Guide tab whenever you want to pick it back up.");
}

/* ---------- the coach ---------- */
let gdCoachTimer = null, gdBooted = false;
function gdRerenderTool(tool){
  if (tool === "tax") renderTax();
  else if (tool === "budget"){ buildBudget(); renderBudget(); }
  else if (tool === "debt") renderDebt();
  else if (tool === "mortgage") renderMort();
  else if (tool === "college") renderCollege();
  else if (tool === "basic") renderBasic();
  else if (tool === "drawdown") renderDrawdown();
  else if (tool === "healthcare"){ if (hcReady) renderHealthcare(); }
  else if (tool === "bridge"){ if (brReady) renderBridge(); }
  else if (tool === "fire") $("fiTarget").dispatchEvent(new Event("input", {bubbles:true}));
  else if (tool === "single") renderAll();
  else if (tool === "series") renderSeries();
  else if (tool === "backtest") renderBacktest();
}
function gdCoachSync(){
  const el = $("gdCoach");
  const t = gd.trip, T = t && GD_TRIPS[t.id];
  const onGuide = chartMode.tab === "guide";
  seoSync();
  // Tool help belongs to the tool it was opened on: leaving closes it.
  if (th && (chartMode.tab !== "tools" || toolSub !== th.tool)){
    th = null;
    $("thCoach").hidden = true;
    document.body.classList.remove("gd-on");
  }
  thSyncBtn();
  // A reload mid-trip clears what the tool held, so the page opening on
  // that tool gets the guide's numbers put back in.
  if (!gdBooted){
    gdBooted = true;
    if (T && gdLoc() === T.tool){
      try { T.prefill(); gdRerenderTool(T.tool); } catch(e){}
      setTimeout(gdCoachFill, 400);
    }
  }
  if (th){ el.hidden = true; return; }   // help is open; the guide waits
  if (!T || onGuide){
    el.hidden = true;
    document.body.classList.remove("gd-on");
    return;
  }
  el.hidden = false;
  document.body.classList.add("gd-on");
  gdCoachFill();
}
function gdCoachFill(){
  const el = $("gdCoach"), t = gd.trip, T = t && GD_TRIPS[t.id];
  if (!T || el.hidden) return;
  const here = gdLoc() === T.tool;
  const from = gdStep(t.from), L = gdNumbered(), i = from ? L.indexOf(from) : -1;
  $("gdCoachSub").textContent = "Guide" + (i >= 0 ? " · step " + (i + 1) + " of " + L.length : "");
  $("gdCoachTitle").textContent = T.title;
  let body, chip = "", next = "";
  if (here){
    let tasks = [];
    const pages = T.pages, pi = pages ? Math.max(0, Math.min(pages.length - 1, t.page || 0)) : 0;
    try { tasks = pages ? pages[pi].tasks() : T.tasks(); } catch(e){}
    body = (pages ? "<div class='gd-cpage'><span>Part " + (pi + 1) + " of " + pages.length + "</span><b>" + pages[pi].title + "</b></div>" : "") +
      "<ol class='gd-steps'>" + tasks.map(k => "<li" + (k.ok === true ? " class='ok'" : k.ok === false ? " class='todo'" : "") + ">" + k.h + "</li>").join("") + "</ol>" +
      (pages ? "<div class='gd-cnav'><button type='button' class='btn mini' data-cp='-1'" + (pi ? "" : " disabled") + "><i class='arw back' aria-hidden='true'></i>Back</button>" +
        "<span class='gd-cdots' aria-hidden='true'>" + pages.map((x, i) => "<i" + (i === pi ? " class='on'" : "") + "></i>").join("") + "</span>" +
        (pi < pages.length - 1 ? "<button type='button' class='btn mini primary' data-cp='1'>Next: " + pages[pi + 1].title + "<i class='arw' aria-hidden='true'></i></button>" : "") + "</div>" : "");
    try { chip = T.chip() || ""; } catch(e){}
    // Collapsed, the panel still names the next thing left to do.
    const n = tasks.findIndex(k => k.ok === false);
    if (n >= 0) next = "<span>Next</span>" + tasks[n].h.replace(/<em>.*?<\/em>/g, "");
  } else {
    body = "<p>You've stepped away from the " + T.name + ". Head back to finish this step, or return to the guide.</p>" +
      "<p><button type='button' class='btn mini' id='gdCoachGo'>Open " + T.name + "</button></p>";
    chip = "";
  }
  $("gdCoachBody").innerHTML = body;
  $("gdCoachNext").innerHTML = next;
  $("gdCoachNext").hidden = !next;
  $("gdCoachChip").innerHTML = chip || (here ? "When you're done here:" : "");
  el.classList.toggle("min", !!gd.coachMin);
  const tog = $("gdCoachTog");
  tog.setAttribute("aria-expanded", String(!gd.coachMin));
  const lbl = gd.coachMin ? "Show the steps" : "Hide the steps";
  tog.setAttribute("aria-label", lbl); tog.setAttribute("title", lbl);
  document.body.style.setProperty("--gdh", el.offsetHeight + "px");
}
/* Tools redraw on their own input handlers, and their headline figures
   count up over TWEEN_MS, so fill once they've drawn and again once any
   count-up has landed. */
let gdCoachTimer2 = null;
function gdCoachLater(){
  if ($("gdCoach").hidden) return;
  clearTimeout(gdCoachTimer); clearTimeout(gdCoachTimer2);
  gdCoachTimer = setTimeout(gdCoachFill, 120);
  gdCoachTimer2 = setTimeout(gdCoachFill, TWEEN_MS + 160);
}
document.addEventListener("input", gdCoachLater, true);
document.addEventListener("change", gdCoachLater, true);
document.addEventListener("click", e => {
  if (e.target.closest && e.target.closest("#gdCoach")) return;
  gdCoachLater();
}, true);
window.addEventListener("resize", () => {
  if (!$("gdCoach").hidden) document.body.style.setProperty("--gdh", $("gdCoach").offsetHeight + "px");
});
$("gdCoachBack").addEventListener("click", gdReturn);
/* On a phone the open panel and the keyboard together would bury the field
   being typed in, so starting to type in the tool folds the panel down. */
document.addEventListener("focusin", e => {
  const el = e.target;
  if ($("gdCoach").hidden || gd.coachMin || !el.matches || !el.matches("input,select,textarea")) return;
  if (el.closest("#gdCoach") || !window.matchMedia("(max-width:640px)").matches) return;
  gd.coachMin = true;
  gdSave();
  gdCoachFill();
});
$("gdCoachX").addEventListener("click", gdEndTrip);
$("gdCoachTog").addEventListener("click", () => {
  gd.coachMin = !gd.coachMin;
  gdSave();
  gdCoachFill();
});
$("gdCoachBody").addEventListener("click", e => {
  if (e.target.closest && e.target.closest("#gdCoachGo") && gd.trip) gdNavTool(GD_TRIPS[gd.trip.id].tool);
  const cp = e.target.closest ? e.target.closest("[data-cp]") : null;
  if (cp && gd.trip && GD_TRIPS[gd.trip.id].pages){
    const P = GD_TRIPS[gd.trip.id].pages;
    gd.trip.page = Math.max(0, Math.min(P.length - 1, (gd.trip.page || 0) + parseInt(cp.getAttribute("data-cp"), 10)));
    gdSave();
    gdCoachFill();
    $("gdCoachBody").scrollTop = 0;
    // Bring the part of the tool this part is about into view, clear of the
    // tab rail at the top and the panel itself at the bottom.
    const f = document.querySelector(P[gd.trip.page].focus);
    ddReveal(f);
    if (f){
      const r = f.getBoundingClientRect(), rail = (parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--navh")) || 44) + 16;
      if (r.top < rail || r.bottom > window.innerHeight - $("gdCoach").offsetHeight - 16){
        let smooth = true;
        try { smooth = !window.matchMedia("(prefers-reduced-motion: reduce)").matches; } catch(e2){}
        try { window.scrollBy({top:r.top - rail, behavior:smooth ? "smooth" : "auto"}); } catch(e2){ window.scrollBy(0, r.top - rail); }
      }
    }
    const nb = $("gdCoachBody").querySelector("[data-cp='1']") || $("gdCoachBody").querySelector("[data-cp='-1']");
    if (nb) try { nb.focus({preventScroll:true}); } catch(e2){}
  }
});

/* The contact address is put together here rather than written into the
   page, so it isn't sitting in the HTML for address-harvesting bots. */
document.querySelectorAll("a.mailme").forEach(a => {
  const addr = a.getAttribute("data-u") + "@" + a.getAttribute("data-d");
  a.href = "mailto:" + addr;
  a.textContent = addr;
});

