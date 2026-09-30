/* ---------- series of stages ---------- */
let seriesPoints = [], seriesRun = null, seriesTarget = 0;

const SERIES_GLOBALS = {initial:10000, inflation:.03, withdrawal:.04, taxRate:.10,
  target:100000, fees:0};
const SERIES_STAGES = [
  {years:10, contrib:500,  period:"Bi-Weekly", growth:.04, nominal:.085, vol:.17},
  {years:20, contrib:1200, period:"Monthly",   growth:.03, nominal:.085, vol:.09, adj:true}
];
let stages = SERIES_STAGES.map(x => Object.assign({}, x));

/* Used only for the user-typed stage name, since that's the one bit of free
   text that gets written back into innerHTML on rebuild. */
function escapeHtml(s){
  return String(s).replace(/[&<>"']/g, c => ({
    "&":"&amp;", "<":"&lt;", ">":"&gt;", "\"":"&quot;", "'":"&#39;"
  }[c]));
}

function fmtNum(v){
  const r = Math.round(v * 100) / 100;
  return r === Math.floor(r) ? String(r) : r.toFixed(2);
}
/* One expense ratio applies to the whole portfolio, so it comes off each
   stage's return rather than being a per-stage field. */
/* Fees come off every stage's return. Separately, a stage can have its typed
   contribution restated in the dollars of its own start year: $3,000 entered
   for a stage beginning in year 5 is modeled as $3,000 x (1+inflation)^5. The
   stage's own growth rate then compounds from that adjusted base. */
function effectiveStages(g){ return effectiveStagesFrom(g, stages); }
/* Same transformation against any stage list, so a saved scenario can be run
   without loading it into the live Stages tab. */
function effectiveStagesFrom(g, list){
  const fee = g.fees || 0, infl = g.inflation || 0;
  let start = 0, salary = g.acct ? g.acct.salary || 0 : 0;
  return list.map((st, i) => {
    const factor = (st.adj && i > 0) ? Math.pow(1 + infl, start) : 1;
    const mine = st.contrib * factor;
    const mf = stMatchFactor(g, st, mine, salary);
    const out = Object.assign({}, st, {contrib: mine * mf, mf, mine, salary,
                                       nominal: st.nominal - fee});
    // the salary a later stage is matched on has had this stage's raises
    salary *= Math.pow(1 + (st.growth || 0), st.years || 0);
    // The glide end rate is stored as typed (pre-fee), matching how nominal
    // is stored on the stage itself -- fees come off here, at the same point
    // nominal's fee is applied, so both ends of the glide are net of fees.
    if (out.glide && out.glide.on){
      out.glide = Object.assign({}, out.glide, {endRate: out.glide.endRate - fee});
    }
    start += st.years;
    return out;
  });
}
function stageStartYear(i){
  let y = 0;
  for (let k = 0; k < i; k++) y += stages[k].years;
  return y;
}
function readGlobals(){
  const g = {initial: num("gInitial"), inflation: rate("gInflation"),
          withdrawal: rate("gWithdrawal"), taxRate: rate("gTaxrate"),
          target: num("targetS"), fees: rate("gFees"), inflYears: ""};
  if (saOn()) stageGrowthBlends(g.fees);
  if (saOn()) applyStageAcct(g);
  return g;
}
function writeGlobals(o){
  $("gInitial").value = groupDigits(o.initial, true);
  $("gInflation").value = +(o.inflation * 100).toFixed(6);
  $("gWithdrawal").value = +(o.withdrawal * 100).toFixed(6);
  $("gTaxrate").value = +(o.taxRate * 100).toFixed(6);
  $("gFees").value = +((o.fees == null ? 0 : o.fees) * 100).toFixed(6);
  writeStageAcct(o.acct);
}

/* ---------- account types (Stages) ---------- */
/* Same idea as Advanced, stretched across stages. The starting balances,
   match and tax settings are whole-run; each stage says where its own
   contribution goes, so a plan can run Roth early and traditional later.
   Every account still earns the stage's return, so the run's total is
   unchanged apart from the match, and projectSeries is linear in both the
   starting balance and every contribution: running it once per account,
   with that account's slice of each stage, gives each ending balance. */
let lastStageAcct = null;
function saOn(){ return $("saToggle").classList.contains("on"); }
function readStageAcct(){
  const basisRaw = $("saBrokBasis").value.trim();
  return {on:true, tradBal:num("saTradBal"), rothBal:num("saRothBal"),
    brokBal:num("saBrokBal"), brokBasis: basisRaw === "" ? null : num("saBrokBasis"),
    salary:num("saSalary"), matchPct:num("saMatchPct"), matchCap:num("saMatchCap"),
    status:$("saStatus").value, state:$("saState").value};
}
function writeStageAcct(a){
  const on = !!(a && a.on);
  if (on){
    const m = v => groupDigits(v || 0, true);
    $("saTradBal").value = m(a.tradBal); $("saRothBal").value = m(a.rothBal);
    $("saBrokBal").value = m(a.brokBal);
    $("saBrokBasis").value = a.brokBasis == null ? "" : m(a.brokBasis);
    $("saSalary").value = m(a.salary);
    $("saMatchPct").value = String(a.matchPct || 0);
    $("saMatchCap").value = String(a.matchCap == null ? 6 : a.matchCap);
    if (a.status) $("saStatus").value = a.status;
    if (a.state) $("saState").value = a.state;
  }
  const was = saOn();
  $("saToggle").classList.toggle("on", on);
  saSync();
  // the split rows live in the stage cards, so they come and go with a rebuild
  if (was !== on && $("stageList").children.length) buildStages();
}
function saSync(){
  const on = saOn();
  $("saToggle").setAttribute("aria-expanded", String(on));
  $("saFields").hidden = !on;
  $("gInitialField").hidden = on;
  $("gTaxrateField").hidden = on;
  $("saTaxField").hidden = !on;
  $("saPanel").hidden = !on;
}
/* A stage with no split yet puts everything in traditional. Roth is capped
   at what's left after traditional; the brokerage takes the remainder. */
function stSplit(st){
  const t = Math.max(0, Math.min(1, st.sTrad == null ? 1 : st.sTrad));
  const r = Math.max(0, Math.min(1 - t, st.sRoth == null ? 0 : st.sRoth));
  return {t, r, b: Math.max(0, 1 - t - r)};
}
/* The same formula as Advanced: matchPct% of what goes into traditional and
   Roth, on contributions up to matchCap% of salary. Worked out at the start
   of the stage, as a multiple of your own contribution; both then grow at
   the stage's growth rate, so the multiple holds for the whole stage and the
   engine stays linear. `mine` is the stage's first-period contribution, in
   the same dollars as `salary` at that point. */
function stMatchFactor(g, st, mine, salary){
  const a = g.acct;
  if (!a || !(a.matchPct > 0) || !(salary > 0) || !(mine > 0)) return 1;
  const s = stSplit(st), ppy = PPY[st.period];
  const eligible = Math.min(mine * (s.t + s.r), salary * (a.matchCap || 0) / 100 / ppy);
  return 1 + Math.max(0, eligible * a.matchPct / 100) / mine;
}
/* The match stage 1 earns in its first year, restated biweekly, beside the
   most the salary allows, for the note under the match inputs. */
function stMatchNow(a){
  const st = stages[0];
  if (!a || !st || !(a.salary > 0) || !(a.matchPct > 0)) return null;
  const s = stSplit(st), ppy = PPY[st.period];
  const capPer = a.salary * (a.matchCap || 0) / 100 / ppy;
  const per = Math.min(Math.max(0, st.contrib) * (s.t + s.r), capPer) * a.matchPct / 100;
  return {bi: per * ppy / 26, full: capPer * a.matchPct / 100 * ppy / 26};
}
/* A stage with per-account growth (st.gRates) runs on the blend of them,
   weighted by that stage's split, at the stage's own return net of fees. */
function stageGrowthBlend(st, fee){
  const e = Object.assign({}, st, {nominal: st.nominal - fee,
    glide: st.glide && st.glide.on
      ? Object.assign({}, st.glide, {endRate: st.glide.endRate - fee}) : st.glide});
  const s = stSplit(st);
  return growthBlend(e, st.years, {t:s.t, r:s.r, b:s.b}, st.gRates);
}
function stageGrowthBlends(fee){
  stages.forEach((st, i) => {
    if (!st.gRates) return;
    st.growth = stageGrowthBlend(st, fee);
    const el = $("stageList").querySelector("[data-f='growth'][data-i='" + i + "']");
    if (el && (el.readOnly || document.activeElement !== el)) el.value = +(st.growth * 100).toFixed(2);
  });
}
function applyStageAcct(g){
  const a = readStageAcct();
  g.initial = a.tradBal + a.rothBal + a.brokBal;
  g.acct = a;
  const eff = effectiveStagesFrom(g, stages);
  // each effective stage carries its match multiple, mf: of every dollar
  // going in, 1/mf is yours (split three ways) and the rest is match
  const mfOf = i => eff[i].mf || 1;
  // each account's slice grows at its own rate where the stage sets one;
  // the match grows at the stage's (blended) rate
  const gOf = k => i => stages[i].gRates ? stages[i].gRates[k] : eff[i].growth;
  const slice = (bal, share, grow) => projectSeries(Object.assign({}, g, {initial: bal}),
    eff.map((st, i) => Object.assign({}, st, {contrib: st.contrib * share(i),
                                              growth: grow ? grow(i) : st.growth})));
  const T = slice(a.tradBal, i => stSplit(stages[i]).t / mfOf(i), gOf("t"));
  const Ro = slice(a.rothBal, i => stSplit(stages[i]).r / mfOf(i), gOf("r"));
  const Br = slice(a.brokBal, i => stSplit(stages[i]).b / mfOf(i), gOf("b"));
  const Mt = slice(0, i => (mfOf(i) - 1) / mfOf(i));
  const years = T.totalYears;
  const basis0 = a.brokBasis == null ? a.brokBal : a.brokBasis;
  const B = acFinish(a, {trad:T.fv + Mt.fv, roth:Ro.fv, brok:Br.fv}, basis0 + Br.contribTotal,
    Math.pow(1 + g.inflation, years), g.withdrawal, acSeniors(a, years));
  B.matchTotal = Mt.contribTotal;
  B.rothIn = Ro.contribTotal;
  B.years = years;
  g.taxRate = B.effRate;
  lastStageAcct = B;
}
/* After-tax income targets are taxed at the target's own income level. */
function stTargetRate(g){
  if (!g.acct || !lastStageAcct || $("solveForS").value !== "After-Tax Withdrawal") return g.taxRate;
  return acTargetRate(g.acct, lastStageAcct, num("targetS"), g.taxRate);
}
/* The tax readout and results panel. */
function renderStageAcct(g){
  saSync();
  if (!g.acct || !lastStageAcct) return;
  const B = lastStageAcct;
  $("saTaxOut").value = pctStr(B.effRate, 1);
  $("saTotBal").textContent = money(g.initial);
  const M = stMatchNow(g.acct);
  $("saMatchNote").textContent = !M ? ""
    : "Stage 1 match: " + money(M.bi, 2) + " biweekly"
      + (M.bi < M.full - 0.005 ? " (the full match is " + money(M.full, 2) + ")" : "")
      + ".";
  acRenderTable("saResults", "saResultsNote", B, B.matchTotal > 0
    ? "Your employer puts in <b>" + money(B.matchTotal) + "</b> over the " +
      fmtNum(B.years) + " years, before growth." : "");
}

const PERIOD_NAMES = ["Weekly","Bi-Weekly","Monthly","Quarterly","Annually"];
const PERIOD_ADV = {"Weekly":"weekly", "Bi-Weekly":"bi-weekly", "Monthly":"monthly",
                    "Quarterly":"quarterly", "Annually":"annually"};

/* Cards are rebuilt only when a stage is added, removed or loaded. Editing a
   field updates the model in place, so typing never loses focus. */
/* The last stage's glide toggle is drawn twice: in the field grid, where it
   sits beside rate of return on phones, and as its own row everywhere else.
   CSS shows one; a click rebuilds the cards, so they never disagree. */
function stageGlideBtn(st, i){
  const on = !!(st.glide && st.glide.on);
  return "<button type='button' class='glidebtn" + (on ? " on" : "") +
    "' data-glidetoggle='" + i + "' aria-expanded='" + on + "'>" +
    "<span class='glidebtn-check' aria-hidden='true'></span>" +
    "<span class='glidebtn-txt'>Glide path" +
    "<span class='tipdot' data-tip='glide' role='button' tabindex='0' aria-label='What is this?'>?</span></span>" +
    "</button>";
}
function buildStages(){
  const list = $("stageList");
  list.innerHTML = stages.map((st, i) => {
    const opts = PERIOD_NAMES.map(n =>
      "<option" + (n === st.period ? " selected" : "") + ">" + n + "</option>").join("");
    return "<div class='stagecard'>" +
      "<div class='stagehead'><span class='stagenum' contenteditable='true' spellcheck='false'" +
        " data-name='" + i + "' title='Click to rename' aria-label='Stage " + (i+1) + " name'>" +
        escapeHtml(st.name || ("Stage " + (i + 1))) + "</span>" +
      "<span class='stagespan' data-span='" + i + "'></span>" +
      "<button class='btn mini' type='button' data-del='" + i + "'>Remove</button></div>" +
      stageGridHtml(st, i, opts) + "</div>" +
      (i === stages.length - 1 ? (
        "<div class='glidewrap'>" + stageGlideBtn(st, i) +
          "<div class='glidefields'" + ((st.glide && st.glide.on) ? "" : " hidden") + ">" +
            "<div class='two'>" +
              "<div class='field'><label>End at</label><div class='inputwrap'>" +
                "<input type='text' inputmode='decimal' data-num data-step='1' data-f='glideEnd' data-i='" + i +
                "' value='" + ((st.glide && st.glide.endRate != null) ? +(st.glide.endRate * 100).toFixed(6) : "") +
                "' aria-label='Stage " + (i+1) + " glide end rate'><span class='affix'>%</span></div></div>" +
              "<div class='field'><label>Over final</label><div class='inputwrap'>" +
                "<input type='text' inputmode='decimal' data-num data-step='1' min='1' data-nonneg data-f='glideYears' data-i='" + i +
                "' value='" + ((st.glide && st.glide.years) || "") +
                "' aria-label='Stage " + (i+1) + " glide years'><span class='affix'>yrs</span></div></div>" +
            "</div>" +
            "<div class='field stagemix'><label>Glides to<span class='tipdot' data-tip='histglidemix' role='button' tabindex='0' aria-label='What is this?'>?</span></label><div class='inputwrap'>" +
              "<input type='text' inputmode='decimal' data-num data-step='5' min='0' max='100' data-nonneg data-f='glideMix' data-i='" + i +
              "' value='" + (+((((st.glide && st.glide.endMix != null) ? st.glide.endMix : Math.min((st.mix == null ? .8 : st.mix), .4)) * 100).toFixed(6))) +
              "' aria-label='Stage " + (i+1) + " ending stock mix'><span class='affix'>%</span></div></div>" +
            "<div class='hint' style='margin:0' data-glidenote='" + i + "'></div>" +
          "</div>" +
        "</div>"
      ) : "") + "</div>";
  }).join("");
  $("stageEmpty").style.display = stages.length ? "none" : "block";
  initFields(list);
  if (stages.length) updateStageGlideNote(stages.length - 1);
  stages.forEach((st, i) => updateStageRealRate(i));
}
/* One stage card's field grid. Split by account type, the single
   contribution becomes three dollar amounts (the same as Advanced) and a
   read-only total, laid out as a second row of four under years,
   frequency, growth and return. */
function stageGridHtml(st, i, opts){
  const split = saOn();
  const adjRow = i > 0 ?
            "<label class='adjrow' title='Inflation adjusted: grows the amount you type by inflation up to the start of this stage'>" +
              "<span class='adjrow-top'><input type='checkbox' data-f='adj' data-i='" + i + "'" +
              (st.adj ? " checked" : "") + "><span class='adjtxt'>Infl. adj.</span></span>" +
              "<span class='adjnote' data-adj='" + i + "'></span>" +
            "</label>" : "";
  const f = {};
  f.years =
        "<div class='field'><label>Years</label><div class='inputwrap'>" +
          "<input type='text' inputmode='decimal' data-num data-step='1' min='0' data-f='years' data-i='" + i +
          "' value='" + st.years + "' data-nonneg aria-label='Stage " + (i+1) + " years'>" +
          "<span class='affix'>yrs</span></div></div>";
  f.contrib =
        "<div class='field'><label>Contribution</label><div class='inputwrap'>" +
          "<span class='affix'>$</span><input type='text' inputmode='decimal' data-f='contrib' data-i='" + i +
          "' value='" + groupDigits(st.contrib, true) + "' data-money data-nonneg aria-label='Stage " + (i+1) + " contribution'>" +
          "</div>" + adjRow + "</div>";
  if (split){
    const s = stSplit(st), amt = x => groupDigits(Math.round(st.contrib * x * 100) / 100, true);
    const acct = (k, lbl, x) =>
        "<div class='field'><label>" + lbl + "</label><div class='inputwrap'>" +
          "<span class='affix'>$</span><input type='text' inputmode='decimal' data-f='" + k + "' data-i='" + i +
          "' value='" + amt(x) + "' data-money data-nonneg aria-label='Stage " + (i+1) + " " + lbl + " contribution'>" +
          "</div></div>";
    f.trad = acct("cT", "Traditional", s.t);
    f.roth = acct("cR", "Roth", s.r);
    f.brok = acct("cB", "Taxable", s.b);
    f.total =
        "<div class='field'><label>Total</label><div class='inputwrap' style='box-shadow:none;background:transparent'>" +
          "<span class='affix'>$</span><input type='text' readonly tabindex='-1' data-stotal='" + i +
          "' value='" + groupDigits(st.contrib, true) + "' aria-label='Stage " + (i+1) + " total contribution'>" +
          "</div>" + adjRow + "</div>";
  }
  f.freq =
        "<div class='field'><label>Frequency</label>" +
          "<select data-f='period' data-i='" + i + "' aria-label='Stage " + (i+1) + " frequency'>" + opts + "</select>" +
          "<button type='button' class='linkbtn' data-conv='" + i + "'>" + CONV_ICON + "Convert</button></div>";
  f.growth =
        "<div class='field'><label>Contribution growth<span class='tipdot' data-tip='contribgrowth' role='button' tabindex='0' aria-label='What is this?'>?</span></label><div class='inputwrap'>" +
          "<input type='text' inputmode='decimal' data-num data-step='0.5' data-f='growth' data-i='" + i +
          "' value='" + (+(st.growth * 100).toFixed(st.gRates && saOn() ? 2 : 6)) + "' aria-label='Stage " + (i+1) + " contribution growth'" +
          (st.gRates && saOn() ? " readonly class='blended' title='Blended from your per-account rates. Click to edit.'" : "") + ">" +
          "<span class='affix'>%/yr</span></div>" +
          (saOn() ? "<button type='button' class='linkbtn' data-grate='" + i + "'>" +
            (st.gRates ? "Edit by account" : "Set by account") + "</button>" : "") + "</div>";
  f.mix =
        "<div class='field stagemix'><label>Stock mix<span class='tipdot' data-tip='histmix' role='button' tabindex='0' aria-label='What is this?'>?</span></label><div class='inputwrap'>" +
          "<input type='text' inputmode='decimal' data-num data-step='5' min='0' max='100' data-nonneg data-f='mix' data-i='" + i +
          "' value='" + (+(((st.mix == null ? .8 : st.mix)) * 100).toFixed(6)) + "' aria-label='Stage " + (i+1) + " stock mix'>" +
          "<span class='affix'>%</span></div></div>";
  f.vol =
        "<div class='field stagevol'><label>Volatility</label><div class='inputwrap'>" +
          "<input type='text' inputmode='decimal' data-num data-step='1' min='0' data-nonneg data-f='vol' data-i='" + i +
          "' value='" + (+((st.vol || 0) * 100).toFixed(6)) + "' aria-label='Stage " + (i+1) + " volatility'>" +
          "<span class='affix'>%/yr</span></div></div>";
  f.rate =
        "<div class='field'><label>Rate of return<span class='tipdot' data-tip='nominalreturn' role='button' tabindex='0' aria-label='What is this?'>?</span></label><div class='inputwrap'>" +
          "<button type='button' class='signflip' data-signstage='" + i + "' title='Flip sign'>&plusmn;</button>" +
          "<input type='text' inputmode='decimal' data-num data-step='0.5' data-f='nominal' data-i='" + i +
          "' value='" + (+(st.nominal * 100).toFixed(6)) + "' aria-label='Stage " + (i+1) + " rate of return'>" +
          "<span class='affix'>%</span></div>" +
          "<div class='hint stagereal' data-realrate='" + i + "' style='margin:4px 0 0'></div></div>";
  const order = split
    ? ["years", "freq", "growth", "mix", "vol", "rate", "trad", "roth", "brok", "total"]
    : ["years", "contrib", "freq", "growth", "mix", "vol", "rate"];
  return "<div class='stagegrid" + (split ? " split" : "") + "'>" + order.map(k => f[k]).join("") +
    (i === stages.length - 1 ? "<div class='field stageglide'><label aria-hidden='true'>&nbsp;</label>" +
      stageGlideBtn(st, i) + "</div>" : "");
}
/* The advanced tab shows a real (inflation-adjusted) rate right next to the
   nominal one; stages get the same, using the plan's single global inflation
   rate since stages don't each have their own. */
function updateStageRealRate(i){
  const st = stages[i];
  const note = $("stageList").querySelector("[data-realrate='" + i + "']");
  if (!st || !note) return;
  const infl = rate("gInflation");
  const fees = rate("gFees");
  const real = (1 + st.nominal - fees) / (1 + infl) - 1;
  note.textContent = pctStr(real, 2) + " Real";
}

$("stageList").addEventListener("input", e => {
  const el = e.target, f = el.getAttribute && el.getAttribute("data-f");
  if (!f || f === "period") return;
  const i = parseInt(el.getAttribute("data-i"), 10);
  if (!stages[i]) return;
  if (f === "years"){
    stages[i].years = Math.min(100, parseNum(el.value));
    if (stages[i].glide) clampStageGlideYears(i);
  }
  else if (f === "contrib") stages[i].contrib = parseNum(el.value);
  else if (f === "cT" || f === "cR" || f === "cB"){
    // the three amounts are the stage's total and its split
    const card = el.closest(".stagegrid");
    const v = k => parseNum(card.querySelector("[data-f='" + k + "']").value);
    const t = v("cT"), r = v("cR"), b = v("cB"), sum = t + r + b;
    stages[i].contrib = sum;
    if (sum > 0){ stages[i].sTrad = t / sum; stages[i].sRoth = r / sum; }
    const tot = card.querySelector("[data-stotal]");
    if (tot) tot.value = groupDigits(Math.round(sum * 100) / 100, true);
  }
  else if (f === "glideEnd"){
    stages[i].glide = stages[i].glide || {on: true};
    stages[i].glide.endRate = parseNum(el.value) / 100;
  }
  else if (f === "glideYears"){
    stages[i].glide = stages[i].glide || {on: true};
    stages[i].glide.years = Math.max(1, Math.round(parseNum(el.value)));
    clampStageGlideYears(i);
  }
  else if (f === "glideMix"){
    stages[i].glide = stages[i].glide || {on: true};
    stages[i].glide.endMix = Math.max(0, Math.min(1, parseNum(el.value) / 100));
  }
  else stages[i][f] = parseNum(el.value) / 100;
  if (f === "glideEnd" || f === "glideYears") updateStageGlideNote(i);
  if (f === "nominal") updateStageRealRate(i);
  renderSeries();
});
/* Glide years can never exceed the stage's own length \u2014 there's no
   meaningful "final 10 years" of a 6-year stage. Silently caps it and
   reflects the corrected number back into the field. */
function clampStageGlideYears(i){
  const st = stages[i];
  if (!st || !st.glide) return;
  const max = Math.max(1, Math.round(st.years));
  const y = Math.round(st.glide.years || 1);
  const clamped = Math.min(max, Math.max(1, y));
  if (clamped !== st.glide.years){
    st.glide.years = clamped;
    const field = $("stageList").querySelector("[data-f='glideYears'][data-i='" + i + "']");
    if (field) field.value = clamped;
  }
}
function updateStageGlideNote(i){
  const st = stages[i];
  const note = $("stageList").querySelector("[data-glidenote='" + i + "']");
  if (!note) return;
  if (!st || !st.glide || !st.glide.on){ note.textContent = ""; return; }
  const total = Math.max(1, Math.round(st.years));
  const gy = Math.min(total, Math.max(1, Math.round(st.glide.years || 1)));
  const startYear = Math.max(1, total - gy + 1);
  note.textContent = "Holds " + pctStr(st.nominal, 1) + " through year " + (startYear - 1) +
    " of this stage, then eases down to " + pctStr(st.glide.endRate || 0, 1) + " by year " + total + ".";
}
$("stageList").addEventListener("change", e => {
  const el = e.target;
  const f = el.getAttribute && el.getAttribute("data-f");
  if (!f) return;
  const i = parseInt(el.getAttribute("data-i"), 10);
  if (!stages[i]) return;
  if (f === "period"){ stages[i].period = el.value; renderSeries(); }
  else if (f === "adj"){ stages[i].adj = el.checked; renderSeries(); }
});
/* Stage names: the "Stage N" label doubles as a rename field. Selecting all
   text on focus means a click can just be typed over; Enter commits instead
   of inserting a line break; blur is where the value actually saves, so
   nothing renders (or resizes the "Year X-Y" span next to it) until the name
   is final. An empty or default-looking entry just reverts to "Stage N". */
$("stageList").addEventListener("focusin", e => {
  const el = e.target;
  if (!el.getAttribute || el.getAttribute("data-name") === null) return;
  const range = document.createRange();
  range.selectNodeContents(el);
  const sel = window.getSelection();
  sel.removeAllRanges();
  sel.addRange(range);
});
$("stageList").addEventListener("keydown", e => {
  const el = e.target;
  if (el.getAttribute && el.getAttribute("data-name") !== null && e.key === "Enter"){
    e.preventDefault();
    el.blur();
  }
});
$("stageList").addEventListener("focusout", e => {
  const el = e.target;
  const attr = el.getAttribute && el.getAttribute("data-name");
  if (attr === null || attr === undefined) return;
  const i = parseInt(attr, 10);
  if (!stages[i]) return;
  const raw = el.textContent.replace(/\s+/g, " ").trim().slice(0, 40);
  const def = "Stage " + (i + 1);
  if (raw && raw !== def) stages[i].name = raw;
  else delete stages[i].name;
  el.textContent = stages[i].name || def;
});
$("stageList").addEventListener("click", e => {
  const gr = e.target.closest
    ? e.target.closest("button[data-grate], input[data-f='growth'][readonly]") : null;
  if (gr){
    const i = parseInt(gr.getAttribute("data-grate") || gr.getAttribute("data-i"), 10);
    const st = stages[i];
    if (!st) return;
    const fee = rate("gFees");
    openGrowthRates(escapeHtml(st.name || ("Stage " + (i + 1))) + " contribution growth",
      st.gRates || {t:st.growth, r:st.growth, b:st.growth},
      rates => stageGrowthBlend(Object.assign({}, st, {gRates: rates}), fee),
      rates => {
        if (!stages[i]) return;
        if (rates) stages[i].gRates = rates; else delete stages[i].gRates;
        buildStages(); renderSeries();
        toast(rates ? "Contribution growth set by account" : "One contribution growth rate for every account");
      }, readStageAcct().matchPct > 0 ? "Your employer match rises at the blended rate." : "");
    return;
  }
  const cv = e.target.closest ? e.target.closest("button[data-conv]") : null;
  if (cv){
    const i = parseInt(cv.getAttribute("data-conv"), 10);
    if (!stages[i]) return;
    openConverter(escapeHtml(stages[i].name || ("Stage " + (i + 1))) + " contribution",
      stages[i].contrib, stages[i].period, (v, p) => {
        if (!stages[i]) return;
        stages[i].contrib = v;
        if (saOn()){
          // split by account: scale each account, in whole dollars
          const sp = stSplit(stages[i]);
          const t = Math.round(v * sp.t), r = Math.round(v * sp.r), b = Math.round(v * sp.b);
          stages[i].contrib = t + r + b;
          if (t + r + b > 0){ stages[i].sTrad = t / (t + r + b); stages[i].sRoth = r / (t + r + b); }
        }
        stages[i].period = p;
        buildStages(); renderSeries();
      });
    return;
  }
  const del = e.target.closest ? e.target.closest("button[data-del]") : null;
  if (del){
    stages.splice(parseInt(del.getAttribute("data-del"), 10), 1);
    buildStages(); renderSeries();
    toast("Stage removed");
    return;
  }
  const gt = e.target.closest ? e.target.closest("button[data-glidetoggle]") : null;
  if (gt){
    const i = parseInt(gt.getAttribute("data-glidetoggle"), 10);
    if (!stages[i]) return;
    const wasOn = !!(stages[i].glide && stages[i].glide.on);
    if (wasOn){
      stages[i].glide.on = false;
    } else {
      // Defaults to 3 points below this stage's own rate, over its final 5
      // years \u2014 re-derived each time it's turned on, in case the stage's
      // rate or length changed since it was last used.
      const cur = stages[i].nominal * 100;
      stages[i].glide = {
        on: true,
        endRate: Math.max(0, cur - 3) / 100,
        years: Math.min(5, Math.max(1, Math.round(stages[i].years)))
      };
    }
    buildStages(); renderSeries();
  }
});
$("btnAddStage").addEventListener("click", () => {
  const last = stages[stages.length - 1];
  // Copies the previous stage's numbers as a starting point, but never its
  // custom name -- a new stage should show the plain "Stage N" label until
  // the user names it themselves.
  stages.push(last ? Object.assign({}, last, {years:10, adj:true, name:undefined})
                   : {years:10, contrib:500, period:"Monthly", growth:.03,
                      nominal:.07, vol:.12, adj:true});
  delete stages[stages.length - 1].name;
  buildStages(); renderSeries();
});

function renderStagedSolve(g, R){
  const last = stages[stages.length - 1];
  if (!last){ $("tPerPeriod").textContent = "\u2014"; return; }
  const solveFor = $("solveForS").value;
  const target = num("targetS");
  const portToday = solveFor === "After-Tax Withdrawal"
    ? target / (g.withdrawal * (1 - stTargetRate(g))) : target;
  const eff = effectiveStages(g);
  const F = finalStageSolve(g, eff, portToday);

  $("targetHintS").textContent = solveFor === "After-Tax Withdrawal"
    ? "The after-tax income you want each year, in today's spending power."
    : "The portfolio balance you want, in today's spending power.";
  $("tPortToday").textContent = money(portToday);
  $("tPays").textContent = money(portToday * g.withdrawal * (1 - stTargetRate(g))) + " per year";
  $("tPortFuture").textContent = money(F.targetFuture);
  $("tStartBal").textContent = money(F.startBal);
  $("tGrown").textContent = money(F.grown);

  // With a match on, the solve's contribution includes the employer's share;
  // show what you'd put in yourself.
  const mf = eff[eff.length - 1].mf || 1;
  setBig("tPerPeriod", money(F.perPeriod / mf, 2));
  $("tPerPeriodNote").textContent = "Stage " + stages.length + ", paid "
    + PERIOD_ADV[last.period] + " for " + fmtYears(last.years)
    + (mf > 1 ? ", plus the match" : "");
  $("tPerYear").textContent = money(F.perYear / mf);
  const ch = $("tChange");
  const delta = (F.perPeriod - eff[eff.length - 1].contrib) / mf;
  ch.textContent = (delta >= 0 ? "+" : "") + money(delta, 2);
  ch.className = "v " + (delta > 0 ? "neg" : "pos");

  if (F.reached){
    setBig("tYears", fmtYears(F.stageYears));
    $("tYearsNote").textContent = "Keeping " + money(eff[eff.length - 1].contrib / mf, 2)
      + " " + PERIOD_ADV[last.period];
    $("tYearsNow").textContent = fmtYears(last.years);
    $("tYearsTotal").textContent = fmtYears(F.totalIfStretched);
    $("btnApplyYearsS").disabled = false;
  } else {
    setBig("tYears", "Out of reach");
    $("tYearsNote").textContent = "Not reached within 100 years at this contribution.";
    $("tYearsNow").textContent = fmtYears(last.years);
    $("tYearsTotal").textContent = "\u2014";
    $("btnApplyYearsS").disabled = true;
  }
  return {portToday};
}

$("btnApplyS").addEventListener("click", () => {
  const i = stages.length - 1;
  // Split by account type, a bigger final stage shifts the account mix and so
  // the tax rate the target needs; a few passes settle it.
  for (let pass = 0; pass < (saOn() ? 5 : 1); pass++){
    const g = readGlobals();
    const solveFor = $("solveForS").value, target = num("targetS");
    const portToday = solveFor === "After-Tax Withdrawal"
      ? target / (g.withdrawal * (1 - stTargetRate(g))) : target;
    const F = finalStageSolve(g, effectiveStages(g), portToday);
    // the solve works on the fee- and inflation-adjusted stage, so undo the
    // contribution adjustment before writing the number back into the card
    const infl = g.inflation || 0;
    const factor = (stages[i].adj && i > 0) ? Math.pow(1 + infl, stageStartYear(i)) : 1;
    stages[i].contrib = Math.round(F.perPeriod / factor / (effectiveStages(g)[i].mf || 1));
  }
  buildStages(); renderSeries();
  toast("Final stage contribution set to " + money(stages[i].contrib));
});
$("btnApplyYearsS").addEventListener("click", () => {
  const g = readGlobals();
  const solveFor = $("solveForS").value, target = num("targetS");
  const portToday = solveFor === "After-Tax Withdrawal"
    ? target / (g.withdrawal * (1 - stTargetRate(g))) : target;
  const F = finalStageSolve(g, effectiveStages(g), portToday);
  if (!F.reached){ toast("That target isn't reachable within 100 years"); return; }
  stages[stages.length - 1].years = F.stageYears;
  buildStages(); renderSeries();
  toast("Final stage set to " + fmtYears(F.stageYears));
});

function renderSeries(){
  const g = readGlobals();
  const R = projectSeries(g, effectiveStages(g));
  seriesRun = R;

  const eff = effectiveStages(g);
  let acc = 0;
  stages.forEach((st, i) => {
    const el = $("stageList").querySelector("[data-span='" + i + "']");
    if (el) el.textContent = "Year " + fmtNum(acc) + " \u2013 " + fmtNum(acc + st.years);
    const note = $("stageList").querySelector("[data-adj='" + i + "']");
    if (note) note.textContent = (st.adj && i > 0)
      ? money(eff[i].contrib / (eff[i].mf || 1)) : "";
    acc += st.years;
  });
  $("stageList").querySelectorAll(".stagevol").forEach(el => {
    el.style.display = chartMode.series === "mc" ? "" : "none";
    el.parentNode.classList.toggle("withvol", chartMode.series === "mc");
  });
  $("stageList").querySelectorAll(".stagemix").forEach(el => {
    el.style.display = "none";
  });
  // Two columns on phones: the glide toggle fills the cell beside rate of
  // return when the fields before it leave one, else takes its own row.
  $("stageList").querySelectorAll(".stageglide").forEach(el => {
    const shown = Array.prototype.filter.call(el.parentNode.children,
      f => f !== el && f.style.display !== "none").length;
    el.classList.toggle("even", shown % 2 === 0);
  });

  $("gStages").textContent = stages.length;
  $("gFeeNote").textContent = (g.fees || 0) > 0
    ? pctStr(g.fees, 2) + " off every stage" : "none";
  $("gTotalYears").textContent = fmtNum(R.totalYears) + (R.totalYears === 1 ? " yr" : " yrs");
  $("gTotalContrib").textContent = money(R.contribTotal);

  setBig("xFV", money(R.fv));
  $("xFVnote").textContent = stages.length
    ? "Across " + stages.length + (stages.length === 1 ? " stage, " : " stages, ")
      + fmtNum(R.totalYears) + " years"
    : "Add a stage to begin";
  setBig("xFVreal", money(R.fvReal));
  $("xFVrealnote").textContent = "Inflation of " + pctStr(g.inflation, 2) + " over "
    + fmtNum(R.inflYears) + " years";
  setBig("xMonthly", money(R.afterTax));
  $("xInvested").textContent = money(R.invested);
  $("xGrowth").textContent = money(R.growth);
  $("xContribs").textContent = money(R.contribTotal);
  $("xLastContrib").textContent = R.lastPeriod
    ? money(R.lastContribReal) + " " + PERIOD_ADV[R.lastPeriod] : money(0);
  $("xWd").textContent = money(R.wd);
  $("xWdReal").textContent = money(R.wdReal);
  $("xAfterTax").textContent = money(R.afterTax);
  $("xAfterTaxMo").textContent = money(R.afterTaxMo);

  $("stageTable").querySelector("tbody").innerHTML = R.summary.map(x =>
    "<tr><td>" + x.stage + "</td><td>" + fmtNum(x.years) + "</td><td>" + pctStr(x.nominal, 2) +
    "</td><td>" + money(x.start) + "</td><td>" + money(x.contrib) +
    "</td><td class='pos'>" + money(x.growth) + "</td><td>" + money(x.end) + "</td></tr>").join("");

  $("xYearTable").querySelector("tbody").innerHTML = R.calRows.map(r =>
    "<tr><td>" + r.year + "</td><td>" +
    (r.stageFrom === r.stage ? r.stage : r.stageFrom + "\u2013" + r.stage) +
    "</td><td>" + money(r.start) +
    "</td><td>" + money(r.contrib) + "</td><td class='pos'>" + money(r.growth) +
    "</td><td>" + money(r.end) + "</td><td>" +
    money(r.end / Math.pow(1 + g.inflation, r.t)) + "</td></tr>").join("");

  const feeCost = (g.fees || 0) > 0
    ? projectSeries(g, effectiveStagesFrom(Object.assign({}, g, {fees: 0}), stages)).fv - R.fv : 0;
  renderMilestones("msBodyS",
    R.rows.map(r => ({year:r.endYear, end:r.end, growth:r.growth, contrib:r.contrib})),
    g.inflation, feeCost, R.totalYears, false, true);

  const solved = renderStagedSolve(g, R);
  seriesTarget = solved ? solved.portToday : 0;

  drawSeriesChart(g, R);
  renderStageAcct(g);
}

function drawSeriesChart(g, R){
  if (!R || !R.rows.length){ seriesPoints = paintChart("chartS", [], 1, "band", [], 0, {enhanced:true}); return; }
  const defl = yr => Math.pow(1 + g.inflation, yr);
  const marks = R.summary.slice(0, -1).map(x => ({year:x.endYear, label:String(x.stage + 1)}));

  if (chartMode.series === "hist"){
    const lastSt = stages.length ? stages[stages.length - 1] : null;
    $("histGlideWrapS").hidden = !(lastSt && lastSt.glide && lastSt.glide.on);
    const H = historicalRuns({initial:g.initial, fees:g.fees}, histStagesSeries(g));
    $("histNoteS").innerHTML = histBarNote(H, false);
    if (!H.count){
      seriesPoints = paintChart("chartS", [], 1, "mc", [], 0, {enhanced:true});
      $("legendS").innerHTML = "";
      histSummary("mcNoteS", H, 0, "");
      return;
    }
    const pts = [{year:0, stage:1, base:g.initial, hi:g.initial, lo:g.initial,
                  p25:g.initial, p75:g.initial}];
    H.bands.forEach(b => pts.push({year:b.year, stage:b.stage, base:b.p50,
                                   hi:b.p90, lo:b.p10, p25:b.p25, p75:b.p75}));
    seriesPoints = paintChart("chartS", pts, R.totalYears, "mc", marks, 0, {enhanced:true,
      traces:{xs:pts.map(a => a.year), lines:H.traces.map(t => [g.initial].concat(t))}});
    histLegend("legendS", "Stage boundary");
    histSummary("mcNoteS", H, seriesTarget || 0, "(your target above)");
    return;
  }

  if (chartMode.series === "mc"){
    const mc = monteCarlo(g, effectiveStages(g), readTrials(), mcSeed);
    const pts = [{year:0, stage:1, base:g.initial, hi:g.initial, lo:g.initial,
                  p25:g.initial, p75:g.initial, det:g.initial}];
    mc.bands.forEach((b, i) => pts.push({year:b.year,
      stage: R.chartRows[i] ? R.chartRows[i].stage : 1,
      base:b.p50, hi:b.p90, lo:b.p10, p25:b.p25, p75:b.p75,
      det: R.chartRows[i] ? R.chartRows[i].end / defl(R.chartRows[i].year) : b.p50}));
    seriesPoints = paintChart("chartS", pts, R.totalYears, "mc", marks, 0, {enhanced:true});
    mcLegend("legendS", "Stage boundary");
    mcSummary("mcNoteS", mc, seriesTarget || 0, "(your target above)");
  } else {
    const band = Math.max(0, num("bandS")) / 100;
    const shift = d => effectiveStages(g).map(st =>
      Object.assign({}, st, {nominal: Math.max(-0.99, st.nominal + d)}));
    const hiR = projectSeries(g, shift(band));
    const loR = projectSeries(g, shift(-band));
    const pts = [{year:0, stage:1, base:g.initial, hi:g.initial, lo:g.initial}];
    R.chartRows.forEach((r, i) => pts.push({year:r.year, stage:r.stage,
      base: r.end / defl(r.year),
      hi: (hiR.chartRows[i] ? hiR.chartRows[i].end : r.end) / defl(r.year),
      lo: (loR.chartRows[i] ? loR.chartRows[i].end : r.end) / defl(r.year)}));
    seriesPoints = paintChart("chartS", pts, R.totalYears, "band", marks, 0, {enhanced:true});
    const lbl = (band * 100).toFixed(2).replace(/\.?0+$/, "");
    $("legendS").innerHTML =
      swatch("#4fbf95", band > 0 ? "Every stage +" + lbl + "%" : "Higher") +
      swatch("#e9b872", "As entered") +
      swatch("#e2795f", band > 0 ? "Every stage \u2212" + lbl + "%" : "Lower") +
      swatch(cssVar("--stageline"), "Stage boundary");
    $("mcNoteS").hidden = true;
  }
}

["gInitial","gInflation","gWithdrawal","gTaxrate","gFees"]
  .forEach(id => $(id).addEventListener("input", renderSeries));
["saTradBal","saRothBal","saBrokBal","saBrokBasis","saSalary","saMatchPct","saMatchCap"]
  .forEach(id => $(id).addEventListener("input", () => renderSeries()));
["saStatus","saState"].forEach(id => $(id).addEventListener("change", () => renderSeries()));
$("saToggle").addEventListener("click", e => {
  if (e.target.closest && e.target.closest(".tipdot")) return;
  if (!saOn()){
    // Start with the whole balance in traditional and every stage's
    // contribution there too, so nothing moves until you split it.
    const blank = ["saTradBal","saRothBal","saBrokBal"].every(id => !(num(id) > 0));
    const H = hhLoad() || {};
    writeStageAcct(blank
      ? {on:true, tradBal:num("gInitial"), rothBal:0, brokBal:0, brokBasis:null,
         salary:H.income || 0, matchPct:0, matchCap:6,
         status:H.status || $("txStatus").value, state:H.state || $("txState").value}
      : Object.assign(readStageAcct(), {on:true}));
    renderSeries();
    toast("Tax is now worked out from each account type");
  } else {
    // Back to one total: carry the balance and calculated rate across, and
    // fold any match into each stage's contribution so the answer holds.
    // The match field is cleared so switching back doesn't count it twice.
    const g = readGlobals();
    const eff = effectiveStages(g);
    const matched = eff.some(st => st.mf > 1);
    stages.forEach((st, i) => { st.contrib = Math.round(st.contrib * (eff[i].mf || 1)); });
    $("gInitial").value = groupDigits(Math.round(g.initial), true);
    $("gTaxrate").value = +(g.taxRate * 100).toFixed(2);
    if (matched) $("saMatchPct").value = "0";
    writeStageAcct(null);
    renderSeries();
    toast("Back to one total, with a " + pctStr(g.taxRate, 1) + " tax rate" +
      (matched ? "; the match is now part of each stage's contribution" : ""));
  }
});
["gInflation","gFees"].forEach(id => $(id).addEventListener("input", () => {
  stages.forEach((st, i) => updateStageRealRate(i));
}));
$("bandS").addEventListener("input", () => {
  if (chartMode.series === "band" && seriesRun) renderSeries();
});

