/* ---------- converter and inflation helper ---------- */
const CONV_ICON = '<svg viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M3 5.5h9.5M10 3l2.5 2.5L10 8M13 10.5H3.5M6 8l-2.5 2.5L6 13" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg>';
/* A pop-up that restates one contribution at every frequency. Apply on a row
   hands that amount and frequency to `apply` and closes; it starts from
   whatever the opener's fields already say. */
function openConverter(title, amt, period, apply){
  const ov = document.createElement("div");
  ov.className = "popup-overlay";
  ov.innerHTML = "<div class='popup wide'>" +
    "<div class='sg-top'><h3>" + title + "</h3>" +
    "<button type='button' class='sg-close' aria-label='Close'>&times;</button></div>" +
    "<div class='formhint'>See what a contribution comes to at each frequency, then " +
      "apply the one that matches how you save.</div>" +
    "<div class='two'>" +
      "<div class='field'><label for='convAmt'>Amount</label>" +
        "<div class='inputwrap'><span class='affix'>$</span><input id='convAmt' type='text' " +
        "inputmode='decimal' data-money data-nonneg></div></div>" +
      "<div class='field'><label for='convPeriod'>Paid</label><select id='convPeriod'>" +
        PERIOD_NAMES.map(n => "<option>" + n + "</option>").join("") + "</select></div>" +
    "</div><div id='convOut'></div></div>";
  const amtEl = ov.querySelector("#convAmt"), perEl = ov.querySelector("#convPeriod");
  amtEl.value = groupDigits(Math.round(amt * 100) / 100, true);
  perEl.value = PPY[period] ? period : "Monthly";
  const render = () => {
    const annual = parseNum(amtEl.value) * PPY[perEl.value];
    ov.querySelector("#convOut").innerHTML = PERIOD_NAMES.map(to => {
      const v = annual / PPY[to];
      return "<div class='convrow'><span class='k'>" + to + "</span>" +
        "<span class='v'>" + money(v, 2) + "</span>" +
        "<button class='btn mini' type='button' data-period='" + to +
        "' data-amt='" + Math.round(v) + "'>Apply</button></div>";
    }).join("");
  };
  const shut = () => { if (ov._modalDone) ov._modalDone(); ov.remove(); };
  ov.addEventListener("click", e => {
    const b = e.target.closest ? e.target.closest("button[data-period]") : null;
    if (b){
      const per = b.getAttribute("data-period"), v = parseFloat(b.getAttribute("data-amt"));
      shut();
      apply(v, per);
      toast("Contribution set to " + money(v, 2) + " " + per.toLowerCase());
      return;
    }
    if (e.target === ov || (e.target.closest && e.target.closest(".sg-close"))) shut();
  });
  amtEl.addEventListener("input", render);
  perEl.addEventListener("change", render);
  document.body.appendChild(ov);
  initFields(ov);
  render();
  wireModal(ov, shut);
  amtEl.focus();
  amtEl.select();
}

/* Contribution growth by account: three rates in, the blend shown live.
   `blend(rates)` gives the blended rate for the preview; `apply` gets the
   rates, or null for "Use one rate" (the blend then stays in the field). */
function openGrowthRates(title, init, blend, apply, note){
  const pct = v => +(v * 100).toFixed(4);
  const ov = document.createElement("div");
  ov.className = "popup-overlay";
  const row = (k, lbl) => "<div class='formfield'><label for='gr_" + k + "'>" + lbl + "</label>" +
    "<div class='formwrap'><input id='gr_" + k + "' type='text' inputmode='decimal' data-num data-step='0.5' value='" +
    pct(init[k]) + "'><span class='affix'>%/yr</span></div></div>";
  ov.innerHTML = "<div class='popup wide'>" +
    "<div class='sg-top'><h3>" + title + "</h3>" +
    "<button type='button' class='sg-close' aria-label='Close'>&times;</button></div>" +
    "<div class='formhint'>How much each account's contribution rises each year. The contribution " +
      "growth field shows the blend: the single rate that ends at the same total." +
      (note ? " " + note : "") + "</div>" +
    row("t", "Traditional") + row("r", "Roth") + row("b", "Taxable brokerage") +
    "<div class='kv total' style='margin:4px 0 14px'><span class='k'>Blended</span><span class='v' id='gr_blend'></span></div>" +
    "<div class='formactions'><button type='button' class='btn' data-gr='one'>Use one rate</button>" +
    "<button type='button' class='btn primary' data-gr='apply'>Apply</button></div></div>";
  const read = () => ({t: parseNum(ov.querySelector("#gr_t").value) / 100,
                       r: parseNum(ov.querySelector("#gr_r").value) / 100,
                       b: parseNum(ov.querySelector("#gr_b").value) / 100});
  const show = () => { ov.querySelector("#gr_blend").textContent = pctStr(blend(read()), 2); };
  const shut = () => { if (ov._modalDone) ov._modalDone(); ov.remove(); };
  ov.addEventListener("input", show);
  ov.addEventListener("click", e => {
    const b = e.target.closest ? e.target.closest("[data-gr]") : null;
    if (b){
      const rates = b.getAttribute("data-gr") === "apply" ? read() : null;
      shut(); apply(rates); return;
    }
    if (e.target === ov || (e.target.closest && e.target.closest(".sg-close"))) shut();
  });
  document.body.appendChild(ov);
  initFields(ov);
  show();
  wireModal(ov, shut);
  ov.querySelector("#gr_t").focus();
}
function openAcGrowth(){
  if (!acOn()) return;
  const g0 = rate("growth");
  const init = acGrowth || {t:g0, r:g0, b:g0};
  openGrowthRates("Contribution growth by account", init, rates => {
    const p = readInputs(), a = readAcctState();
    return growthBlend(p, p.years, {t:a.tradC, r:a.rothC, b:a.brokC}, rates);
  }, rates => {
    acGrowth = rates;
    acGrowthSync();
    renderAll();
    toast(rates ? "Contribution growth set by account" : "One contribution growth rate for every account");
  }, readAcctState().matchPct > 0 ? "Your employer match rises at the blended rate." : "");
}
$("acGrowthBtn").addEventListener("click", openAcGrowth);
$("growth").addEventListener("click", () => { if ($("growth").readOnly) openAcGrowth(); });

/* Split by account, the total is what acSetTotal() aims at: your three
   contributions plus the match they earn. */
$("convOpen").addEventListener("click", () => {
  const per = $("period").value;
  let cur = num("contrib");
  if (acOn()){
    const a = readAcctState();
    cur = a.tradC + a.rothC + a.brokC + acMatchPer(a, PPY[per]);
  }
  openConverter("Contribution converter", cur, per, (v, p) => {
    $("period").value = p;
    if (acOn()) acSetTotal(v);
    else $("contrib").value = groupDigits(v);
    renderAll();
  });
});

function renderTools(){
  const infl = chartMode.tab === "series" ? rate("gInflation") : rate("inflation");
  const yrs = num("inflYrs"), amt = num("inflAmt");
  const fwd = inflDir === "fwd";
  $("inflNote").textContent = "at " + pctStr(infl, 2) + " inflation";
  $("inflAmtLabel").textContent = fwd ? "Amount today"
    : "Amount " + fmtNum(yrs) + (yrs === 1 ? " year from now" : " years from now");
  $("inflOutLabel").textContent = fwd
    ? "In " + fmtNum(yrs) + (yrs === 1 ? " year that costs" : " years that costs")
    : "That is worth today";
  const out = fwd ? amt * Math.pow(1 + infl, yrs) : amt / Math.pow(1 + infl, yrs);
  $("inflOut").textContent = money(out, 2);
}
let inflDir = "fwd";
$("segInfl").addEventListener("click", e => {
  const b = e.target.closest ? e.target.closest("button[data-dir]") : null;
  if (!b) return;
  inflDir = b.getAttribute("data-dir");
  $("segInfl").querySelectorAll("button").forEach(x =>
    x.classList.toggle("on", x.getAttribute("data-dir") === inflDir));
  renderTools();
});

function renderAll(){ renderProjection(); renderTools(); }

