const $ = id => document.getElementById(id);
/* toLocaleString builds a fresh Intl.NumberFormat on every call, and that
   construction -- not the formatting -- is essentially the whole cost. Tables
   here run to thousands of calls per render, so the formatters are built once
   per decimal count and reused. Same output, roughly 45x less work. */
const MONEY_FMT = {};
const money = function(v, d){
  const dp = (d === undefined || d === null) ? 0 : d;
  let f = MONEY_FMT[dp];
  if (!f) f = MONEY_FMT[dp] = new Intl.NumberFormat("en-US",
    {minimumFractionDigits: dp, maximumFractionDigits: dp});
  return (v < 0 ? "-" : "") + "$" + f.format(Math.abs(v));
};
const pctStr = function(v, d){
  return (v * 100).toFixed((d === undefined || d === null) ? 2 : d) + "%";
};

/* Headline figures share a fixed-width column, so a long result overruns it at
   the base size. Step the type down as the string gets longer. */
function setBig(id, text){
  const el = $(id);
  el.textContent = text;
  const n = text.length;
  const size = n <= 11 ? 29
             : n <= 13 ? 26
             : n <= 15 ? 23
             : n <= 17 ? 20
             : n <= 20 ? 17 : 15;
  el.style.fontSize = size + "px";
}

// Starting point when nothing is saved.
const DEFAULTS = {initial:10000, contrib:500, period:"Bi-Weekly", growth:.04, nominal:.085,
  inflation:.03, years:30, withdrawal:.04, taxRate:.10, vol:.15, fees:0};
const BASIC_DEFAULTS = {age:30, retire:65, saved:10000, contrib:500, period:"Monthly", risk:.045};

// v2: a fresh key, so an earlier version's saved scenarios don't reappear here.
// v3 split: Basic/Advanced/Stages moved off the shared "retire" bundle onto
// their own keys (retireBundleMigration() below moves old data across once).
const KEYS = {basic:"investment-calculator.basic.v3",
              advanced:"investment-calculator.advanced.v3",
              stages:"investment-calculator.stages.v3",
              tax:"finance-tools.tax.v1",
              mortgage:"finance-tools.mortgage.v1", budget:"finance-tools.budget.v1",
              college:"finance-tools.college.v1", rentbuy:"finance-tools.rentbuy.v1",
              drawdown:"finance-tools.drawdown.v1",
              roth:"finance-tools.roth.v1",
              debt:"finance-tools.debt.v1",
              backtest:"finance-tools.backtest.v1",
              healthcare:"finance-tools.healthcare.v1",
              bridge:"finance-tools.bridge.v1",
              fire:"finance-tools.fire.v1",
              // saved guide plans; the guide's own progress is guide.v1
              guide:"finance-tools.guideplans.v1",
              household:"finance-tools.household.v1"};
const memory = {};
/* Healthcare and FIRE once had no key here, so both lists were written to
   one slot named "undefined" and each overwrote the other. Sort whatever is
   there into its own list by which tool's fields it holds, once. */
try {
  const raw = localStorage.getItem("undefined");
  if (raw && !localStorage.getItem(KEYS.healthcare) && !localStorage.getItem(KEYS.fire)){
    const list = JSON.parse(raw);
    if (Array.isArray(list)){
      const isHC = x => x && x.data && Object.keys(x.data).some(k => /^hc/.test(k));
      const hc = list.filter(isHC), fi = list.filter(x => !isHC(x));
      if (hc.length) localStorage.setItem(KEYS.healthcare, JSON.stringify(hc));
      if (fi.length) localStorage.setItem(KEYS.fire, JSON.stringify(fi));
      localStorage.removeItem("undefined");
    }
  }
} catch(e){}
function storeRead(which){
  try { const raw = localStorage.getItem(KEYS[which]); if (raw) return JSON.parse(raw); }
  catch(e){}
  return memory[which] || null;
}
function storeWrite(which, v){
  memory[which] = v;
  try { localStorage.setItem(KEYS[which], JSON.stringify(v)); } catch(e){}
}
/* one saved-scenario list per tool */
const SC = {basic: storeRead("basic") || [], advanced: storeRead("advanced") || [],
            stages: storeRead("stages") || [], tax: storeRead("tax") || [],
            mortgage: storeRead("mortgage") || [], budget: storeRead("budget") || [],
            college: storeRead("college") || [], rentbuy: storeRead("rentbuy") || [],
            drawdown: storeRead("drawdown") || [],
            roth: storeRead("roth") || [],
            debt: storeRead("debt") || [],
            backtest: storeRead("backtest") || [],
            healthcare: storeRead("healthcare") || [],
            bridge: storeRead("bridge") || [],
            fire: storeRead("fire") || [],
            guide: storeRead("guide") || []};
/* One-time move: scenarios saved before the v3 split lived under a single
   "retire" bundle key holding Basic + Advanced + Stages together. Split each
   into its own list under the same name so nothing saved before this update
   disappears. Guarded by a flag (not by list emptiness) so deleting every
   split scenario later doesn't resurrect the old bundle. */
function migrateBundledRetireScenarios(){
  const FLAG = "investment-calculator.splitmigration.v1";
  try { if (localStorage.getItem(FLAG) === "1") return; } catch(e){ return; }
  let old = null;
  try {
    const raw = localStorage.getItem("investment-calculator.v2");
    if (raw) old = JSON.parse(raw);
  } catch(e){}
  if (Array.isArray(old) && old.length){
    old.forEach(s => {
      if (!s || !s.name) return;
      if (s.basic && !SC.basic.find(x => x.name === s.name)){
        SC.basic.push({name:s.name, data:{age:s.basic.age, retire:s.basic.retire,
          saved:s.basic.saved, contrib:s.basic.contrib, period:s.basic.period,
          risk:s.basic.risk}});
      }
      if ((s.initial != null || s.years != null) &&
          !SC.advanced.find(x => x.name === s.name)){
        const adv = {initial:s.initial, contrib:s.contrib, period:s.period,
          growth:s.growth, nominal:s.nominal, inflation:s.inflation, years:s.years,
          withdrawal:s.withdrawal, taxRate:s.taxRate, vol:s.vol, fees:s.fees,
          gross:s.gross, glide:s.glide};
        if (s.targets){ adv.solveFor = s.targets.solveFor; adv.target = s.targets.target; }
        SC.advanced.push({name:s.name, data:adv});
      }
      if (s.series && !SC.stages.find(x => x.name === s.name)){
        const stg = {globals: s.series.globals, stages: s.series.stages};
        if (s.targets){ stg.solveForS = s.targets.solveForS; stg.targetS = s.targets.targetS; }
        SC.stages.push({name:s.name, data:stg});
      }
    });
    storeWrite("basic", SC.basic);
    storeWrite("advanced", SC.advanced);
    storeWrite("stages", SC.stages);
  }
  try { localStorage.setItem(FLAG, "1"); } catch(e){}
}
migrateBundledRetireScenarios();
/* Which named scenario the current inputs came from, per tool/mode \u2014 kept
   so switching tabs and coming back still shows the name instead of
   "Unsaved". Cleared on Reset or when the loaded scenario is deleted. */
let currentScenario = {basic:"", advanced:"", stages:"", tax:"", mortgage:"",
  budget:"", college:"", rentbuy:"", drawdown:"", roth:"", debt:"", backtest:"",
  healthcare:"", fire:"", guide:"", bridge:""};
/* JSON snapshot of the data as it was last saved/loaded for each tool, so the
   dropdown can flag "(edited)" once the on-screen inputs drift from it. */
let loadedSnapshot = {};
/* which tool the top-bar buttons act on, driven by the visible tab */
function activeTool(){
  const t = chartMode.tab;
  if (t === "tools" && toolSub !== "picker") return toolSub;
  if (t === "simple") return "basic";
  if (t === "series") return "stages";
  if (t === "single") return "advanced";
  if (t === "guide") return "guide";
  return "advanced";
}

let toastTimer;
/* A confirmation gets a jade check; a "set something up first" nudge gets a
   gold info glyph. Callers can force it with the second argument; otherwise
   the wording is classed automatically, so existing one-arg calls just work. */
function toast(msg, type){
  const t = $("toast");
  const kind = type ||
    (/\bfirst\b|isn't reachable|nothing to export|couldn't|no money left|no monthly amount/i
      .test(msg) ? "warn" : "ok");
  const icon = kind === "warn"
    ? '<svg class="toast-ic" viewBox="0 0 20 20" aria-hidden="true">'
      + '<circle cx="10" cy="10" r="8.2" fill="none" stroke="currentColor" stroke-width="1.6"/>'
      + '<path d="M10 5.8v5" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/>'
      + '<circle cx="10" cy="14.1" r="1" fill="currentColor"/></svg>'
    : '<svg class="toast-ic" viewBox="0 0 20 20" aria-hidden="true">'
      + '<circle cx="10" cy="10" r="8.2" fill="none" stroke="currentColor" stroke-width="1.6"/>'
      + '<path d="M6.3 10.4l2.5 2.5 4.9-5.3" fill="none" stroke="currentColor" '
      + 'stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  t.className = "toast " + kind;
  t.innerHTML = icon + '<span class="toast-msg"></span>';
  t.querySelector(".toast-msg").textContent = msg;
  t.classList.add("show");
  // 3.5s for a short note, plus reading time for longer ones (about 20
  // characters a second past the first 60), never more than 7s.
  const ms = Math.min(7000, 3500 + Math.max(0, msg.length - 60) * 50);
  clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove("show"), ms);
}

