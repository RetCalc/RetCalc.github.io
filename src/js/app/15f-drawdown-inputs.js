/* ---------- the Drawdown Simulator: Simple and Advanced inputs ----------
   Simple shows the five fields a first run needs: the portfolio, its mix,
   how long, the strategy and its rate (or whatever its one setting is).
   Advanced adds everything else. Hidden fields still count, so Simple says
   which of them are set away from their defaults. A first visit starts in
   Simple; the choice is remembered on this device. */
var DD_INPUTS_KEY = "retcalc-dd-inputs";
var ddInputs = "simple";
try { if (localStorage.getItem(DD_INPUTS_KEY) === "adv") ddInputs = "adv"; } catch (e) {}

/* The advanced settings, as their saved fields and a name for each; the
   strategy ones count only under their strategy. */
var DD_ADV = [
  ["rebal", "rebalancing"], ["fee", "fees"], ["retireAge", "your age"],
  ["spendFloor", "minimum spending"], ["spendCeil", "maximum spending"], ["path", "a spending path"],
  ["ssMode", "Social Security"], ["legacyGoal", "a legacy goal"], ["comfort", "a comfort line"],
  ["starts", "a start each January only"], ["fromYear", "a later start year"],
  ["mcBlock", "Monte Carlo blocks"], ["mcRet", "your own returns"]
];
var DD_ADV_STRAT = {
  fixed: [["skipRaise", "skipping raises"]],
  kitces: [["skipRaise", "skipping raises"], ["kitThresh", "ratchet settings"], ["kitRaise", "ratchet settings"], ["kitGap", "ratchet settings"]],
  guardrails: [["guardBand", "guardrail settings"], ["adjust", "guardrail settings"], ["guardBandLo", "guardrail settings"],
    ["adjustLo", "guardrail settings"], ["gkFinal", "guardrail settings"], ["skipRaise", "skipping raises"]],
  floorceil: [["floor", "floor and ceiling"], ["ceil", "floor and ceiling"]],
  vanguard: [["vgCeil", "Vanguard's limits"], ["vgFloor", "Vanguard's limits"]],
  clyatt: [["clyFloor", "the 95% floor"]],
  sensible: [["sensExtra", "the share of gains"]]
};
/* Which advanced settings are in use, by name, once each. */
function ddAdvInUse(d){
  var out = [];
  var add = function (n) { if (out.indexOf(n) < 0) out.push(n); };
  var off = function (k) {
    var a = d[k], b = DD_DEFAULTS[k];
    if (typeof b === "number") return Math.abs((+a || 0) - b) > 1e-9;
    return String(a == null ? "" : a) !== String(b);
  };
  DD_ADV.forEach(function (p) { if (off(p[0])) add(p[1]); });
  (DD_ADV_STRAT[d.strategy] || []).forEach(function (p) { if (off(p[0])) add(p[1]); });
  if ((d.incomeItems || []).some(function (x) { return x.on !== false; })) add("other income");
  if ((d.expenseItems || []).some(function (x) { return x.on !== false; })) add("future expenses");
  if ((d.floorSteps || []).length) add("a minimum that changes");
  return out;
}
function ddInputsSync(){
  $("asideDD").setAttribute("data-inputs", ddInputs);
  $("segDDIn").querySelectorAll("button").forEach(function (b) { b.classList.toggle("on", b.getAttribute("data-ddin") === ddInputs); });
  if (ddInputs !== "simple") return;
  var used = ddAdvInUse(readDDState());
  $("ddSimpleNote").innerHTML = used.length
    ? "<b>Also in use:</b> " + used.join(", ") + ". <button type='button' class='linkbtn' data-ddadv>Show them</button>"
    : "Simple shows the essentials. <button type='button' class='linkbtn' data-ddadv>Advanced</button> adds rebalancing, fees, Social Security, other income, spending limits, goals and how history is tested.";
}
function ddSetInputs(m){
  ddInputs = m === "adv" ? "adv" : "simple";
  try { localStorage.setItem(DD_INPUTS_KEY, ddInputs); } catch (e) {}
  ddInputsSync();
}
/* A tour or the guide pointing at an advanced field shows Advanced first. */
function ddReveal(el){
  if (el && ddInputs === "simple" && el.closest && el.closest("#asideDD .ddadv")) ddSetInputs("adv");
}
$("segDDIn").addEventListener("click", function (e) {
  var b = e.target.closest ? e.target.closest("button[data-ddin]") : null;
  if (b) ddSetInputs(b.getAttribute("data-ddin"));
});
$("ddSimpleNote").addEventListener("click", function (e) {
  if (e.target.closest && e.target.closest("[data-ddadv]")) ddSetInputs("adv");
});
ddInputsSync();
