/* ---------- the Drawdown Simulator: classic studies, reproduced ----------
   Each card says what the paper found, in its own terms, and what the
   simulator finds set up the same way (DD_RESEARCH, in the engine, does the
   finding; the tests pin its numbers). Load this setup puts the paper's plan
   on the simulator, keeping the portfolio value. */
var DD_STUDY_UI = {
  bengen: {title: "Bengen (1994): the 4% rule",
    cite: "William Bengen, “Determining Withdrawal Rates Using Historical Data,” <i>Journal of Financial Planning</i>, October 1994.",
    setup: "A fixed amount, raised with inflation each year; half stocks, half bonds, rebalanced yearly; a retirement starting each January from 1927, the record's first full year, to 1976.",
    paper: "A 4% first-year withdrawal lasted at least 33 years from every start, with 50% to 75% in stocks. 1966 was the hardest start.",
    sim: function (f) {
      return "4% lasted at least <b>" + f.short50.years + " years</b> from every start at 50/50, and " + f.short75.years +
        " at 75/25, " + f.short50.year + " the hardest. Lasting 30 years from every start allowed <b>" + pctStr(f.safemax, 2) +
        "</b>, set by " + f.safeAt + ".";
    },
    why: "Bengen's bonds were intermediate-term Treasuries; the record here has 10-year Treasuries, hit harder by the 1970s' rising rates. The same lesson, with a little less room."},
  trinity: {title: "The Trinity study (1998)",
    cite: "Philip Cooley, Carl Hubbard and Daniel Walz, “Retirement Savings: Choosing a Withdrawal Rate That Is Sustainable,” <i>AAII Journal</i>, February 1998.",
    setup: "4% of the starting portfolio, raised with inflation, for 30 years; each January to 1965 (their data ended in 1995); five mixes. The record here starts its retirements in 1927, theirs in 1926.",
    paper: "It lasted in 95% of starts with all stocks, 98% at 75/25, 95% at 50/50, 71% at 25/75 and 20% with all bonds.",
    paperRates: {100: .95, 75: .98, 50: .95, 25: .71, 0: .20},
    sim: function (f) {
      var P = DD_STUDY_UI.trinity.paperRates;
      return "<table class='ddstudy-t'><thead><tr><th>Stocks</th><th>Paper</th><th>Here, " + f.nSame + " starts to 1965</th><th>Here, all " + f.nAll + " to 1996</th></tr></thead><tbody>" +
        f.mixes.map(function (m) {
          return "<tr><td>" + m + "%</td><td>" + pctStr(P[m], 0) + "</td><td>" + pctStr(f.same[m], 0) + "</td><td>" + pctStr(f.all[m], 0) + "</td></tr>";
        }).join("") + "</tbody></table>";
    },
    why: "Close where it matters. Trinity's bonds were long-term high-grade corporates; these are 10-year Treasuries, which is most of the gap in the bond-heavy mixes. Adding the starts since 1965 lowers the stock-heavy results a little."},
  guyton: {title: "Guyton-Klinger guardrails (2006)",
    cite: "Jonathan Guyton and William Klinger, “Decision Rules and Maximum Initial Withdrawal Rates,” <i>Journal of Financial Planning</i>, March 2006.",
    setup: "Start at 5.4% with 65% stocks, for 40 years. Cut spending 10% when the withdrawal rate climbs 20% above where it started, raise it 10% when it falls 20% below, no cuts in the final 15 years, and no inflation raise after a losing year.",
    paper: "With its decision rules, starting rates of 5.2% to 5.6% held for 40 years at 99% confidence with 65% in stocks, in Monte Carlo runs.",
    sim: function (f) {
      return "5.2%, 5.4% and 5.6% all lasted in <b>" + (f.lo === 1 && f.success === 1 && f.hi === 1 ? "every one" : pctStr(Math.min(f.lo, f.success, f.hi), 0)) +
        "</b> of the " + f.starts + " 40-year starts since 1927" + (f.max ? ", as would any start up to " + pctStr(f.max / 100, 2) : "") +
        ". The cuts are the price: retiring in " + f.lowest.year + ", spending fell to <b>" + pctStr(f.lowest.share, 0) + "</b> of year one's, after inflation.";
    },
    why: "The paper's 99% means the money lasts, not that spending holds: guardrails get there by cutting. Its rule for which holding to sell from isn't modeled here."},
  vanguard: {title: "Vanguard dynamic spending",
    cite: "Vanguard Research's dynamic spending rule.",
    setup: "Aim at 5% of the portfolio each year, but let spending move at most 5% up or 2.5% down from last year's, after inflation; 50/50, 35 years.",
    paper: "Proposed as a middle road: income far steadier than taking a straight percentage of the portfolio, with more room to adjust to markets than a fixed amount.",
    sim: function (f) {
      var fails = Math.round((1 - f.success) * f.starts);
      return "Spending's biggest one-year moves were <b>+" + pctStr(f.swing.up, 1) + " and −" + pctStr(-f.swing.down, 1) +
        "</b>, against +" + pctStr(f.pctSwing.up, 0) + " and −" + pctStr(-f.pctSwing.down, 0) + " for a straight 5% of the portfolio. " +
        (fails ? "The steadiness has a price: it ran out in <b>" + fails + " of " + f.starts + "</b> starts, where a straight percentage never can."
          : "It lasted in every start.");
    },
    why: "A cut of no more than 2.5% a year can lag a falling market, which is how it can run out; Vanguard's research pairs the rule with a sensible starting rate."},
  vpw: {title: "Variable percentage withdrawal (Bogleheads)",
    cite: "The Bogleheads' VPW method, from the Bogleheads forum and wiki, 2015 onward.",
    setup: "Retire at 65 with 60% stocks and spend to 100: each year an annuity-style payment on what's left, at the mix's expected real return (3.8%).",
    paper: "It can't run out before its last year and spends the portfolio down by then, with payments that rise and fall with markets.",
    sim: function (f) {
      return "It lasted in <b>every one</b> of " + f.starts + " starts and left nothing at the end, as designed. Year one took " + pctStr(f.first, 2) +
        ". Retiring in " + f.lowest.year + ", spending fell to <b>" + pctStr(f.lowest.share, 0) + "</b> of year one's, after inflation.";
    },
    why: "It can't fail on its own terms, so the question it leaves is the one the scorecard asks: how low could spending go?"},
  kitces: {title: "Kitces ratchet (2015)",
    cite: "Michael Kitces, “The Ratcheting Safe Withdrawal Rate: A More Dominant Version of the 4% Rule?”, <i>Nerd's Eye View</i>, 2015.",
    setup: "Start at 4%, raised with inflation, 60% stocks, 30 years; raise spending 10% whenever the portfolio is 50% above where it began, at most once every three years.",
    paper: "The raises come only once the portfolio has grown enough to afford them, so ratcheting keeps the 4% rule's historical record while many retirees get raises.",
    sim: function (f) {
      return "It lasted in <b>" + pctStr(f.success, 1) + "</b> of starts, the same as a plain 4%: " +
        (f.newFails ? f.newFails + " start" + (f.newFails === 1 ? "" : "s") + " failed that 4% survived. " : "no start failed that 4% survived. ") +
        "<b>" + f.raised + " of " + f.starts + "</b> got at least one raise, and the typical last year's spending was " + ddN(f.medGain) + " times year one's.";
    },
    why: "The ratchet waits for the gains, so the starts that test the 4% rule never ratchet early."}
};

function ddStudyLoad(id){
  var S = ddStudy(id);
  if (!S) return;
  var st = Object.assign({}, DD_DEFAULTS, {initial: num("ddInitial") > 0 ? num("ddInitial") : 1000000},
    S.setup, {incomeItems: [], expenseItems: [], floorSteps: [], pathStages: []});
  if (st.retireAge == null) st.retireAge = "";
  writeDDState(st);
  ddFromClamp();
  renderDrawdown();
  toast("Loaded " + DD_STUDY_UI[id].title.replace(/ \(.*\)$/, "") + "'s setup");
}
function ddStudyForm(){
  var ov = document.createElement("div");
  ov.className = "popup-overlay";
  ov.innerHTML = "<div class='popup wide ddstudypop'><h3>Classic studies, reproduced</h3>" +
    "<div class='formhint'>Each study set up as the paper did, run on this record: stocks, bonds and inflation since 1926. What the paper found, and what the simulator finds.</div>" +
    DD_RESEARCH.map(function (S) {
      var U = DD_STUDY_UI[S.id], f = S.find();
      return "<div class='ddstudy'><h4>" + U.title + "</h4><div class='ddstudy-cite'>" + U.cite + "</div>" +
        "<div class='ddstudy-k'>Setup</div><p>" + U.setup + "</p>" +
        "<div class='ddstudy-k'>The paper found</div><p>" + U.paper + "</p>" +
        "<div class='ddstudy-k'>The simulator finds</div><div class='ddstudy-sim'>" + U.sim(f) + "</div>" +
        "<p class='ddstudy-why'>" + U.why + "</p>" +
        "<button type='button' class='btn mini' data-study='" + S.id + "'>Load this setup</button></div>";
    }).join("") +
    "<div class='formactions'><button type='button' class='btn' data-studyclose>Close</button></div></div>";
  document.body.appendChild(ov);
  var shut = function () { if (ov._modalDone) ov._modalDone(); ov.remove(); };
  ov.addEventListener("click", function (e) {
    if (e.target === ov || (e.target.closest && e.target.closest("[data-studyclose]"))) { shut(); return; }
    var b = e.target.closest ? e.target.closest("[data-study]") : null;
    if (b) { shut(); ddStudyLoad(b.getAttribute("data-study")); }
  });
  wireModal(ov, shut);
  ov.querySelector("[data-studyclose]").focus();
}
$("ddStudyBtn").addEventListener("click", ddStudyForm);

/* The strategy landing pages (/4-percent-rule, /guardrails, /vpw) open the
   simulator on their strategy, with the article's worked example: a
   retirement starting each January, as the research tested, and the
   portfolio whatever it already is. */
var DD_LANDING = {
  "4-percent-rule": {starts: "year", strategy: "fixed", rate: 4, stock: 60, sv: 0, cash: 0, stockEnd: "", years: 30},
  guardrails: {starts: "year", strategy: "guardrails", rate: 5, stock: 60, sv: 0, cash: 0, stockEnd: "", years: 30,
    guardBand: 20, adjust: 10, guardBandLo: 20, adjustLo: 10, gkFinal: false, skipRaise: false},
  vpw: {starts: "year", strategy: "vpw", stock: 60, sv: 0, cash: 0, stockEnd: "", years: 35, retireAge: "65", vpwRate: 3.8, vpwFV: 0}
};
function ddLanding(seg){
  if (!DD_LANDING[seg]) return;
  writeDDState(Object.assign({}, DD_LANDING[seg], {floorSteps: [], pathStages: []}));
}
