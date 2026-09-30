/* ---------- sharing and printing the plan ----------
   A link carries the answers (not the budget or debt lists, which can be
   long and are the most personal) and opens on the results. Printing uses
   the site's one-page summary sheet. */
function gdSharePlan(){
  const a = {};
  Object.keys(gd.a).forEach(k => {
    if (["bgRows", "debtRows", "moState", "clState", "ddTool"].indexOf(k) < 0) a[k] = gd.a[k];
  });
  const url = location.origin + "/guide#g=" + encodeState({v:1, a});
  sendLink(url, "Link copied. It opens this plan in the guide, with your numbers.");
}
/* Only plain values come in from a link: numbers, true/false, and short
   strings of letters, digits and spaces. Nothing that could be markup. */
function gdCleanShared(o){
  if (!o || o.v !== 1 || !o.a || typeof o.a !== "object") return null;
  const a = {};
  Object.keys(o.a).forEach(k => {
    const v = o.a[k];
    if (!/^[A-Za-z0-9]{1,24}$/.test(k)) return;
    if ((typeof v === "number" && isFinite(v)) || typeof v === "boolean" || v === null) a[k] = v;
    else if (typeof v === "string" && /^[A-Za-z0-9 .,%\-]{0,40}$/.test(v)) a[k] = v;
  });
  return a;
}
function gdPrintPlan(){
  if (gdGuideSheet() === false) return;
  setTimeout(() => window.print(), 60);
}
function gdGuideSheet(){
  const a = gd.a, R = gdScore(), S = gdSim();
  if (R.score == null || !S){ toast("Answer more of the guide to print a plan"); $("sheet").innerHTML = ""; return false; }
  const rt = gdRating(R.score), want = gdNeed(S);
  const tmp = document.createElement("div");
  tmp.className = "gd-chart";
  gdChartDraw(tmp, [gdSeries(S, "Your plan", "p")]);
  const svg = tmp.querySelector("svg");
  const over = tmp.querySelector(".gd-ch-over");
  const chart = svg ? "<div class='sh-chart gd-chart'>" + svg.outerHTML + "</div>" + (over ? "<div class='sh-more' style='margin:-6px 0 10px'>" + over.textContent + "</div>" : "") : "";
  let plan = row("Retire at", fmtNum(S.retire));
  plan += row("Saving", S.stop != null ? (S.stop <= a.age ? "Coasting, nothing new" : money(S.monthly) + "/mo to " + fmtNum(S.stop)) : money(S.monthly) + "/mo to retirement");
  plan += row("Spending in retirement", money(S.spend) + "/yr");
  if (gdMinSpend()) plan += row("Minimum spending", money(gdMinSpend()) + "/yr");
  plan += row("Social Security", money(S.ss.total / 12) + "/mo from " + S.ss.claim);
  if (S.pension) plan += row("Pension", money(S.pension / 12) + "/mo");
  plan += row("Withdrawals", S.tactics ? opTacticsLine(S.T, S.C) : "Brokerage, then traditional, then Roth");
  plan += row("Income tax", "About " + money(S.taxYr) + "/yr");
  plan += row("Withdrawal approach", gdStratName(a.strategy || "fixed"));
  plan += row("Stocks in retirement", S.mix + "%");
  let nums = "";
  if (gdPos(a.takehome)) nums += row("Take-home pay", money(a.takehome) + "/mo");
  if (gdPos(a.spend)) nums += row("Spending today", money(a.spend) + "/mo");
  if (gdOk(a.cash)) nums += row("Emergency fund", money(a.cash));
  if (a.debtHas === "yes" && gdOk(a.debtTotal)) nums += row("Debt, excluding mortgage", money(a.debtTotal));
  if (gdOk(a.saved)) nums += row("Retirement savings", money(a.saved));
  nums += row("Projected at " + fmtNum(S.retire), money(S.fv));
  if (want > 0) nums += row("Needed at " + fmtNum(S.retire), money(want));
  const areas = GD_FACTORS.map(f => R.P[f.id] ? row(f.name, Math.round(R.P[f.id].p * f.w) + " / " + f.w) : "").join("");
  const A = gdActions();
  const moves = A.length ? "<div class='sh-moves'><div class='sh-t'>Your next moves, in order</div><ol>" +
    A.map(x => "<li><b>" + x.t + "</b> " + x.d + "</li>").join("") + "</ol></div>" : "";
  const d = new Date();
  $("sheet").innerHTML =
    "<div class='sh-h'>" + SHEET_MARK + "<h1>Retirement Readiness Plan</h1><span>" + d.toLocaleDateString("en-US", {month:"long", day:"numeric", year:"numeric"}) +
      " &middot; every figure in today's dollars</span></div>" +
    "<div class='sh-big'>" +
      "<div><div class='k'>Readiness score</div><div class='v'>" + R.score + " / 100</div><div class='n'>" + rt.label + "</div></div>" +
      "<div><div class='k'>Savings at " + fmtNum(S.retire) + "</div><div class='v'>" + money(S.fv) + "</div><div class='n'>" + (want > 0 ? "needs about " + money(want) : "projected") + "</div></div>" +
      "<div><div class='k'>Lasted in</div><div class='v'>" + pctStr(S.success, 0) + "</div><div class='n'>of retirements since " + (S.H ? S.H.first : 1926) + "</div></div>" +
    "</div>" + chart +
    "<div class='sh-cols'>" +
      "<section><div class='sh-t'>Your plan</div>" + plan + "</section>" +
      "<section><div class='sh-t'>Your numbers</div>" + nums + "</section>" +
      "<section><div class='sh-t'>Score by area</div>" + areas + "</section>" +
    "</div>" + moves +
    "<div class='sh-foot'>Savings grow at " + pctStr(S.real, 1) + " a year after inflation for a " + gdRiskLabel(S.real) + " mix, with contributions rising with inflation. " +
    "Retirement is tested against every historical retirement since " + (S.H ? S.H.first : 1926) + " with " + S.mix + "% in stocks, spending a fixed amount that rises with inflation. " +
    "Spending is after tax: each year's income tax, Medicare surcharge and health insurance before 65 are worked out from where the money comes from and paid on top" +
    (S.tactics ? ", with the Plan Optimizer's roadmap applied (" + opTacticsLine(S.T, S.C).toLowerCase() + ")" : "") + ". " +
    "Social Security is an estimate. This is a rule-of-thumb plan, not financial advice.</div>";
}

/* ---------- the guide's own controls ---------- */
$("tab-guide").addEventListener("click", e => {
  const el = e.target.closest ? e.target.closest("[data-set],[data-gd],[data-go],[data-trip],[data-fill],[data-nav],[data-opt],[data-target],[data-lever]") : null;
  if (!el || el.disabled) return;
  if (el.hasAttribute("data-opt")){
    gdSel = el.getAttribute("data-opt");
    if (gdSel === "custom" && !gdDraft){
      const a = gd.a;
      gdDraft = {retire:a.retire, contrib:a.contrib, stopAge:gdOk(a.stopAge) ? a.stopAge : null, retSpend:a.retSpend};
    }
    gdRender(false);
    const f = gdSel === "custom" ? $("gdd-retire") : null;
    if (f) try { f.focus({preventScroll:true}); } catch(e2){}
    return;
  }
  if (el.hasAttribute("data-lever")){
    const k = el.getAttribute("data-lever"), on = Object.keys(gdLevers).filter(x => gdLevers[x]);
    if (gdLevers[k] && on.length <= 2){ toast("Balancing needs at least two"); return; }
    gdLevers[k] = !gdLevers[k];
    gdSel = "balance";
    gdRender(false);
    return;
  }
  if (el.hasAttribute("data-target")){
    gd.a.target = parseFloat(el.getAttribute("data-target"));
    gdSave();
    gdRender(false);
    return;
  }
  if (el.hasAttribute("data-set")){
    gd.a[el.getAttribute("data-set")] = el.getAttribute("data-val");
    gdSave();
    gdRender(false);
    return;
  }
  if (el.hasAttribute("data-fill")){
    const k = el.getAttribute("data-fill"), v = parseFloat(el.getAttribute("data-v"));
    gd.a[k] = v;
    gdSave();
    const f = $("gdf-" + k);
    if (f){ f.value = gdM(v); gdRefresh(); }
    else gdRender(false);
    return;
  }
  if (el.hasAttribute("data-trip")){ gdTrip(el.getAttribute("data-trip"), el.getAttribute("data-from")); return; }
  if (el.hasAttribute("data-go")){ gdGoStep(el.getAttribute("data-go")); return; }
  if (el.hasAttribute("data-nav")){
    const n = el.getAttribute("data-nav");
    paneDir = "fwd";
    if (n === "single" || n === "series" || n === "guide") showTab(n); else { toolSub = n; showTab("tools"); }
    pushNav();
    return;
  }
  const g = el.getAttribute("data-gd");
  if (g === "apply"){ gdApplyOpt(); return; }
  if (g === "print"){ gdPrintPlan(); return; }
  if (g === "share"){ gdSharePlan(); return; }
  if (g === "next") gdNext();
  else if (g === "prev") gdPrev();
  else if (g === "resume") gdGoStep(gdFirstOpen());
  else if (g === "optapply") opApplyToGuide();
  else if (g === "optclear") opClearGuide();
  else if (g === "undo" && gd.back && gd.back.undo){
    Object.assign(gd.a, gd.back.undo);
    gd.back = {step:gd.back.step, msg:"Undone. Your answers are back to what they were."};
    gdHouseholdSync();
    gdSave();
    gdRender(false);
  } else if (g === "restart"){
    if (!confirm("Start the guide over? Your answers here are cleared. The household bar and the tools keep their numbers.")) return;
    gd = gdFresh();
    gdSeedFromHousehold();
    gdSave();
    gdRender(true);
  }
});
$("tab-guide").addEventListener("input", e => {
  const d = e.target.getAttribute && e.target.getAttribute("data-d");
  if (d && gdDraft){
    const t = e.target.value.trim();
    gdDraft[d] = t === "" ? null : parseNum(t);
    const o = gdCurOpt(), fig = $("gdCard").querySelector("[data-optfig='custom']");
    if (fig) fig.textContent = o && o.T && Object.keys(o.set).length ? pctStr(o.T.success, 0) + " lasted · " + money(o.T.fv) + " at " + fmtNum(o.T.retire) : "";
    $("gdCmp").innerHTML = gdCmpHTML();
    gdChartsDraw($("gdCmp"));
    return;
  }
  const el = e.target, k = el.getAttribute && el.getAttribute("data-a");
  if (!k || el.tagName === "SELECT") return;
  const t = el.value.trim();
  gd.a[k] = t === "" ? null : parseNum(t);
  gdSave();
  gdRefresh();
});
$("tab-guide").addEventListener("change", e => {
  const el = e.target, k = el.getAttribute && el.getAttribute("data-a");
  if (!k || el.tagName !== "SELECT") return;
  gd.a[k] = el.getAttribute("data-kind") === "num" ? (el.value === "" ? null : parseFloat(el.value)) : (el.value || null);
  gdSave();
  if (el.hasAttribute("data-rerender")) gdRender(false); else gdRefresh();
});
$("tab-guide").addEventListener("keydown", e => {
  if (e.key !== "Enter" || e.target.tagName !== "INPUT" || e.target.hasAttribute("data-d")) return;
  const b = $("gdCard").querySelector("[data-gd='next']");
  if (b && !b.disabled){ e.preventDefault(); b.click(); }
});
/* A shared plan (#g=) opens in the guide on its results. Someone who has
   their own answers is asked first; the household bar and tools are left
   alone either way. */
(function(){
  if (!location.hash || location.hash.indexOf("#g=") !== 0) return;
  const a = gdCleanShared(decodeState(location.hash.slice(3)));
  try { history.replaceState(history.state, "", location.pathname + location.search); } catch(e){}
  if (!a || !Object.keys(a).length) return;
  if (Object.keys(gd.done).length && !confirm("This link opens a shared retirement plan in the guide. Replace your own guide answers with it? Your household bar and tools won't change.")) return;
  gd = gdFresh();
  gd.a = a;
  gdMigrate(gd.a);
  gdNumbered().forEach(st => { if (st.id !== "results") gd.done[st.id] = true; });
  gd.cur = "results";
  gdSave();
})();
if (!Object.keys(gd.a).length) gdSeedFromHousehold();

shareBase();
let fromLink = false;
if (location.hash && (location.hash.indexOf("#p=") === 0 || location.hash.indexOf("#s=") === 0)){
  const st = location.hash[1] === "s" ? shareOpen(location.hash.slice(3)) : decodeState(location.hash.slice(3));
  fromLink = !!(st && applyState(st));
}
// A shared link carries someone's exact numbers; the profile fills in
// everything else on an ordinary visit.
if (!fromLink) hhApply(hhLoad());
const pathRoute = fromLink ? null : routeFromPath(location.pathname);
if (pathRoute) toolSub = pathRoute.s || "picker";
showTab(fromLink ? linkTab : (pathRoute ? pathRoute.t : "simple"));
renderAll();
renderSeries();
renderBasic();
renderTax();
renderMort();
renderCollege();
renderRentBuy();
renderDrawdown();
buildBudget();
renderBudget();
initTheme();
initAboutCollapse();
// Seed an entry so the first back press has somewhere defined to land. An
// old address (/single, /series) is swapped for its current name while at it.
try {
  const canon = pathRoute && !PATH_ALIAS[pathSeg(location.pathname)] ? pathForRoute(chartMode.tab, toolSub) : null;
  if (canon && canon !== location.pathname)
    history.replaceState({t:chartMode.tab, s:toolSub}, "", canon + location.search + location.hash);
  else history.replaceState({t:chartMode.tab, s:toolSub}, "");
} catch(e){}
initStickyRail();
initGuideStick();
initSelectMenus();
initFooter();
let tweening = false;
try { tweening = !window.matchMedia("(prefers-reduced-motion: reduce)").matches; } catch(e){}
if (tweening) initValueTween(); else initLiveRegion();
if (fromLink) toast("Loaded from a shared link");

