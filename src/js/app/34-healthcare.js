// ===== HEALTHCARE COST PLANNER =====

/* This section's data tables are assigned below the page's startup code, so a
   direct visit to /healthcare opens the tool before they exist. showTool waits
   for this flag, and the end of the section draws the tool if it's on screen. */
var hcReady = false;

// Federal poverty level for 2026 coverage. Premium tax credits run a year
// behind, so 2026 plans are priced against the 2025 HHS poverty guidelines:
// $15,650 for one person plus $5,500 for each additional person, contiguous
// 48 states and DC. Alaska and Hawaii are higher; this uses the 48-state line.
var HC_FPL_BASE = [0,15650,21150,26650,32150,37650,43150,48650,54150];
var HC_FPL_PER_ADDL = 5500;

// Federal default standard age curve, ages 21-64 (21 = 1.000, 64+ = 3.000).
// CMS, "Final Guidance Regarding Age Curves and State Reporting", 16 Dec 2016,
// Appendix I; in force for plan years 2018 on. A handful of states (and DC)
// set their own curve, which runs somewhat flatter.
var HC_AGE_MULT = [
  1.000,1.000,1.000,1.000, // 21-24
  1.004,1.024,1.048,1.087, // 25-28
  1.119,1.135,1.159,1.183, // 29-32
  1.198,1.214,1.222,1.230, // 33-36
  1.238,1.246,1.262,1.278, // 37-40
  1.302,1.325,1.357,1.397, // 41-44
  1.444,1.500,1.563,1.635, // 45-48
  1.706,1.786,1.865,1.952, // 49-52
  2.040,2.135,2.230,2.333, // 53-56
  2.437,2.548,2.603,2.714, // 57-60
  2.810,2.873,2.952,3.000  // 61-64
];
var HC_AGE40_MULT = 1.278; // index 19 = age 40 - 21

// 2026 average benchmark premium (second-lowest-cost Silver) for a 40-year-old,
// monthly, by state. Source: KFF, Marketplace Average Benchmark Premiums, 2026
// (US average $625, up from $497 in 2025). Averages across each state's rating
// areas; a county quote can differ a lot. Scaled by the HHS age multiplier.
var HC_STATE_PREMIUM_40 = {
  AL:645,AK:1032,AZ:532,AR:774,CA:570,CO:557,CT:870,DC:610,
  DE:691,FL:683,GA:615,HI:541,ID:490,IL:646,IN:474,IA:501,
  KS:670,KY:590,LA:646,ME:709,MD:414,MA:494,MI:523,MN:448,
  MS:662,MO:605,MT:692,NE:710,NV:497,NH:401,NJ:545,NM:623,
  NY:817,NC:638,ND:570,OH:513,OK:604,OR:543,PA:572,RI:506,
  SC:564,SD:655,TN:711,TX:661,UT:640,VT:1299,VA:455,WA:612,
  WV:1073,WI:611,WY:1090
};

// Medicare IRMAA, 2026: the same CMS table the Roth tool uses.
// [individual_magi_max, joint_magi_max, partB_monthly, partD_irmaa_monthly]
var HC_IRMAA = IRMAA.tiers.map(function(t){ return [t.s, t.m, t.b, t.partD]; });
// Average standalone Part D plan premium, 2026 (CMS estimate, before IRMAA)
var HC_PARTD_BASE = 35;
// Medigap Plan G rough range at 65 (low/high, national)
var HC_MEDIGAP_LOW = 120, HC_MEDIGAP_HIGH = 200;

function hcFPL(size){
  size = Math.max(1, Math.round(size));
  if (size <= 8) return HC_FPL_BASE[size];
  return HC_FPL_BASE[8] + (size - 8) * HC_FPL_PER_ADDL;
}

function hcAgeMultiplier(age){
  age = Math.max(21, Math.min(64, Math.round(age)));
  return HC_AGE_MULT[age - 21];
}

// Gross monthly benchmark Silver premium for given state & age
function hcGrossPremium(state, age, manualOverride){
  if (manualOverride > 0) return manualOverride;
  var base = HC_STATE_PREMIUM_40[state] || 500;
  return base / HC_AGE40_MULT * hcAgeMultiplier(age);
}

// Standard ACA contribution % of income for 2026: the applicable percentage
// table in Rev. Proc. 2025-25, with the 400% FPL cliff. These are the rules in
// force for 2026, since the enhanced credits expired at the end of 2025.
// Returns null when income is too high for subsidy.
function hcContribPctStd(pctFPL){
  if (pctFPL < 1.0) return 0;
  if (pctFPL > 4.0) return null;
  if (pctFPL < 1.33) return 0.0210;
  if (pctFPL < 1.50) return 0.0314 + (pctFPL - 1.33) / 0.17 * (0.0419 - 0.0314);
  if (pctFPL < 2.00) return 0.0419 + (pctFPL - 1.50) / 0.50 * (0.0660 - 0.0419);
  if (pctFPL < 2.50) return 0.0660 + (pctFPL - 2.00) / 0.50 * (0.0844 - 0.0660);
  if (pctFPL < 3.00) return 0.0844 + (pctFPL - 2.50) / 0.50 * (0.0996 - 0.0844);
  return 0.0996;
}

// Enhanced contribution % (ARP/IRA rules, 2021-2025: 8.5% cap, no cliff above
// 400% FPL). Expired after 2025; kept to show what a restoration would mean.
function hcContribPctEnhanced(pctFPL){
  if (pctFPL < 1.0) return 0;
  if (pctFPL < 1.50) return 0;
  if (pctFPL < 2.00) return (pctFPL - 1.50) / 0.50 * 0.020;
  if (pctFPL < 2.50) return 0.020 + (pctFPL - 2.00) / 0.50 * 0.020;
  if (pctFPL < 3.00) return 0.040 + (pctFPL - 2.50) / 0.50 * 0.020;
  if (pctFPL < 4.00) return 0.060 + (pctFPL - 3.00) / 1.00 * 0.025;
  return 0.085;
}

// Returns {credit, net, eligible, pct} — monthly figures
function hcCalcACA(income, grossPremium, pctFPL, enhanced){
  var pct = enhanced ? hcContribPctEnhanced(pctFPL) : hcContribPctStd(pctFPL);
  if (pct === null) return {credit:0, net:grossPremium, eligible:false, pct:0};
  var maxContrib = income * pct / 12;
  var credit = Math.max(0, grossPremium - maxContrib);
  var net = Math.max(0, grossPremium - credit);
  return {credit:credit, net:net, eligible:true, pct:pct};
}

function hcIRMAATier(magi, joint){
  var col = joint ? 1 : 0;
  for (var i = 0; i < HC_IRMAA.length; i++){
    if (magi <= HC_IRMAA[i][col]) return i;
  }
  return HC_IRMAA.length - 1;
}

function renderHealthcare(){
  var retireAge = Math.round(num("hcRetireAge")) || 62;
  var status = $("hcStatus").value;
  var joint = (status === "m");
  var household = parseInt($("hcHousehold").value) || (joint ? 2 : 1);
  var state = $("hcState").value || "IL";
  var manualPremium = num("hcManualPremium") || 0;

  $("hcSpouseAgeWrap").hidden = !joint;

  // ── income ───────────────────────────────────────────────────────────────
  // The field is AGI, which is also the MAGI Medicare's IRMAA uses. The ACA
  // adds back the untaxed part of Social Security, so that figure is found
  // from the benefit entered: the taxable part depends on the other income,
  // which is AGI less the taxable part, so repeated passes settle it.
  var magi = num("hcIncome") || 0;
  var ssGross = num("hcSS") || 0, ssTaxed = 0;
  // The step shrinks by at most 0.85 each pass, so 150 passes is exact to
  // well under a cent.
  for (var it = 0; it < 150 && ssGross > 0; it++)
    ssTaxed = ssTaxable(ssGross, Math.max(0, magi - ssTaxed), joint ? "m" : "s").taxable;
  var acaMagi = magi + Math.max(0, ssGross - ssTaxed);

  // ── ACA Bridge ───────────────────────────────────────────────────────────
  var acaBridgeYears = Math.max(0, 65 - retireAge);
  var fpl = hcFPL(household);
  var pctFPL = acaMagi > 0 ? acaMagi / fpl : 0;
  var acaAge = Math.min(64, Math.max(21, retireAge));
  /* The credit is figured for the household, not per person: the benchmark
     for everyone enrolling, less ONE contribution based on the household's
     income. So the benchmark is each adult at their own age (a spouse
     already 65 is on Medicare instead), plus any children in the household,
     priced at the under-15 rate with at most three counted, as the ACA
     does. A premium typed in is the household's own figure from
     healthcare.gov, as on the Bridge tool. */
  var spouseAge = Math.round(num("hcSpouseAge")) || retireAge;
  var spouseOn = joint && spouseAge < 65;
  var acaAge2 = Math.min(64, Math.max(21, spouseAge));
  var adults = joint ? 2 : 1;
  var kids = Math.min(3, Math.max(0, household - adults));
  var childPrem = (HC_STATE_PREMIUM_40[state] || 500) / HC_AGE40_MULT * 0.765;
  var grossMonthly = manualPremium > 0 ? manualPremium
    : hcGrossPremium(state, acaAge, 0) + (spouseOn ? hcGrossPremium(state, acaAge2, 0) : 0) + kids * childPrem;
  var coveredDesc = (spouseOn ? (acaAge2 === acaAge ? "two adults age " + acaAge : "ages " + acaAge + " and " + acaAge2)
      : "age " + acaAge) + (kids ? " + " + kids + (kids === 1 ? " child" : " children") : "");
  var stdResult = hcCalcACA(acaMagi, grossMonthly, pctFPL, false);
  var enhResult = hcCalcACA(acaMagi, grossMonthly, pctFPL, true);
  var bronzeGross = grossMonthly * 0.75;
  var goldGross = grossMonthly * 1.25;
  var usingStateEst = manualPremium <= 0;

  var acaHTML = "";
  if (acaBridgeYears <= 0){
    acaHTML = "<p style='color:var(--dim);font-size:14px'>Retiring at 65 or later: no ACA bridge needed. Medicare coverage begins at 65.</p>";
  } else if (acaMagi <= 0){
    acaHTML = "<p style='color:var(--dim);font-size:14px'>Enter your expected retirement MAGI to see your ACA premium estimate.</p>";
  } else {
    var pctFPLStr = (pctFPL * 100).toFixed(0) + "%";
    var incNote = acaMagi > magi + 0.5 ? " (your MAGI plus " + money(acaMagi - magi) + " of untaxed Social Security, which the ACA counts)" : "";
    var medicaid = pctFPL < 1.0;

    // The headline is what 2026 actually costs; the enhanced figure is only a what-if.
    var netForStat = stdResult.eligible ? stdResult.net : grossMonthly;
    acaHTML += "<div class='hc-stats'>";
    acaHTML += "<div class='hc-stat'><div class='v'>" + acaBridgeYears + " yr" + (acaBridgeYears !== 1 ? "s" : "") + "</div><div class='optlabel'>years on ACA bridge</div></div>";
    acaHTML += "<div class='hc-stat'><div class='v'>$" + Math.round(netForStat) + "/mo</div><div class='optlabel'>est. net Silver premium" + (spouseOn || kids ? ", whole household" : "") + "</div></div>";
    acaHTML += "</div>";

    if (medicaid){
      acaHTML += "<p style='font-size:13px;color:var(--dim);margin:0 0 12px'>Your income of " + money(acaMagi) + incNote + " is <b>" + pctFPLStr + " of the federal poverty level</b> for a " + household + "-person household. Premium tax credits only begin at 100% FPL, so ACA subsidies do not apply here.</p>";
      acaHTML += "<div class='hc-insight'>In the 40 states (plus DC) that expanded Medicaid under the ACA, an income this low typically qualifies you for Medicaid at little or no monthly premium. In the remaining non-expansion states there is a coverage gap: income is too high for Medicaid but too low for ACA subsidies, leaving limited options for subsidized coverage. Check your state's Medicaid eligibility rules.</div>";
    } else {
      // Context paragraph explaining what they're looking at
      acaHTML += "<p style='font-size:13px;color:var(--dim);margin:0 0 12px'>Your income of " + money(acaMagi) + incNote + " is <b>" + pctFPLStr + " of the federal poverty level</b> for a " + household + "-person household — this ratio drives your subsidy. " +
        (stdResult.eligible
          ? "The ACA sets what you're expected to contribute toward health coverage at " + (stdResult.pct * 100).toFixed(2) + "% of your income. The government covers whatever the Silver plan costs above that amount, in the form of a monthly premium tax credit applied at enrollment."
          : "That income is above the 400% FPL cutoff, so there is no credit and you would pay the Silver plan's full list price. The enhanced credits that removed this cutoff (capping your share at 8.5% of income) expired after 2025.") +
        "</p>";
      // Standard rules
      acaHTML += "<div class='hc-section-label'>2026 ACA rules</div>";
      acaHTML += "<div class='kv'><span class='k'>Benchmark Silver plan" + (usingStateEst ? " <span style='color:var(--dimmer);font-size:11px'>(" + state + " est., " + coveredDesc + ") — the reference used to price your credit</span>" : " <span style='color:var(--dimmer);font-size:11px'>your entered premium</span>") + "</span><span class='v'>$" + Math.round(grossMonthly) + "/mo</span></div>";
      if (!stdResult.eligible){
        acaHTML += "<div class='kv'><span class='k'>Premium tax credit</span><span class='v' style='color:var(--dimmer)'>none (income above 400% FPL)</span></div>";
        acaHTML += "<div class='kv total'><span class='k'>Your net premium</span><span class='v'>$" + Math.round(grossMonthly) + "/mo</span></div>";
      } else {
        acaHTML += "<div class='kv'><span class='k'>Premium tax credit <span style='color:var(--dimmer);font-size:11px'>(" + (stdResult.pct * 100).toFixed(2) + "% income cap)</span></span><span class='v pos'>−$" + Math.round(stdResult.credit) + "/mo</span></div>";
        acaHTML += "<div class='kv total'><span class='k'>Your net premium (Silver)</span><span class='v'>$" + Math.round(stdResult.net) + "/mo</span></div>";
      }

      // Enhanced rules — only show if materially different (cliff or lower cost)
      var showEnhanced = (!stdResult.eligible && enhResult.eligible) ||
        (stdResult.eligible && Math.abs(enhResult.net - stdResult.net) > 5);
      if (showEnhanced){
        acaHTML += "<div class='hc-section'>";
        acaHTML += "<div class='hc-section-label'>If Congress restores the enhanced credits <span style='font-weight:400;color:var(--dimmer)'>(in place 2021–2025)</span></div>";
        acaHTML += "<div class='kv'><span class='k'>Premium tax credit <span style='color:var(--dimmer);font-size:11px'>(" + (enhResult.pct * 100).toFixed(2) + "% income cap, no 400% cliff)</span></span><span class='v pos'>−$" + Math.round(enhResult.credit) + "/mo</span></div>";
        acaHTML += "<div class='kv total'><span class='k'>Your net premium (Silver)</span><span class='v'>$" + Math.round(enhResult.net) + "/mo</span></div>";
        acaHTML += "</div>";
      }

      // Plan tier comparison (using standard rules)
      var refCredit = stdResult.credit;
      acaHTML += "<div class='hc-section'>";
      acaHTML += "<div class='hc-section-label'>Plan tier comparison <span style='font-weight:400;color:var(--dimmer)'>(same credit applies to any tier)</span></div>";
      acaHTML += "<div class='hc-tier-row'><span>🥉 Bronze: lowest monthly cost; high deductible — you pay most costs out-of-pocket until you hit it</span><span>~$" + Math.round(Math.max(0, bronzeGross - refCredit)) + "/mo</span></div>";
      acaHTML += "<div class='hc-tier-row hc-tier-sel'><span>🥈 Silver: the credit is built around this tier; also unlocks cost-sharing reductions at lower incomes</span><span>$" + Math.round(stdResult.net) + "/mo</span></div>";
      acaHTML += "<div class='hc-tier-row'><span>🥇 Gold: higher monthly cost; lower deductible and copays — better if you expect to use a lot of care</span><span>~$" + Math.round(Math.max(0, goldGross - refCredit)) + "/mo</span></div>";
      acaHTML += "</div>";

      // Income insights
      if (spouseOn){
        acaHTML += "<div class='hc-insight'>For a couple, <b>both spouses need their own plan</b>, and the figures above cover both of you. The credit is worked out for the household as a whole: the benchmark for both plans, less one contribution based on your combined income. " +
          (stdResult.eligible ? "That's why a subsidized couple pays about what one person at the same income would, not double." : "Above the 400% cliff there is no credit, so you pay both full premiums.") + "</div>";
      }

      // 400% cliff warning if near it (standard rules)
      if (stdResult.eligible && pctFPL > 3.5){
        var cliff400 = fpl * 4.0;
        var overCliff = acaMagi - cliff400;
        if (overCliff < 0){
          var toCliff = -overCliff;
          acaHTML += "<div class='hc-insight'>⚠️ Your income is <b>" + money(toCliff) + " below</b> the 400% FPL cliff. Every dollar above $" + Math.round(cliff400).toLocaleString() + " eliminates the entire subsidy, adding $" + Math.round(stdResult.credit) + "/mo instantly. Roth conversions or portfolio decisions that push income over this line have an outsized cost.</div>";
        }
      }
    }

    // Premium estimate note
    acaHTML += "<div class='hc-note'>" +
      (usingStateEst ? "Benchmark Silver premium is a state-level estimate for " + state + " scaled by age, for " + coveredDesc + ". " + (kids ? "Children are priced as under-15 enrollees; at lower incomes many qualify for CHIP or Medicaid instead. " : "") : "Using your entered benchmark premium. ") +
      "Enter your actual quote from <a href='https://healthcare.gov' target='_blank'>healthcare.gov</a> in the sidebar for precision. " +
      "Credits for 2026 use the IRS's 2026 contribution percentages and the 2025 poverty guidelines. The enhanced credits of 2021–2025, which removed the 400% FPL cliff and capped contributions at 8.5% of income, expired at the end of 2025; the House passed an extension in January 2026, but it has not become law." +
      "</div>";
  }
  $("hcACABody").innerHTML = acaHTML;

  // ── Medicare ─────────────────────────────────────────────────────────────
  var irmaaTier = hcIRMAATier(magi, joint);
  var irmaaTierData = HC_IRMAA[irmaaTier];
  var partBMonthly = irmaaTierData[2];
  var partDIRMAA = irmaaTierData[3];
  var partDTotal = HC_PARTD_BASE + partDIRMAA;
  var totalLow = partBMonthly + partDTotal + HC_MEDIGAP_LOW;
  var totalHigh = partBMonthly + partDTotal + HC_MEDIGAP_HIGH;
  var tierNames = ["Standard","Tier 1","Tier 2","Tier 3","Tier 4","Tier 5"];

  var medHTML = "";
  if (magi <= 0){
    medHTML = "<p style='color:var(--dim);font-size:14px'>Enter your expected retirement MAGI to see Medicare cost estimates. Medicare uses your income from <b>two years prior</b> to determine surcharges.</p>";
  } else {
    var hasIRMAA = irmaaTier > 0;
    medHTML += "<p style='font-size:13px;color:var(--dim);margin:0 0 12px'>" +
      "<b>Part B</b> covers doctor visits, outpatient care, and preventive services. " +
      "<b>Part D</b> covers prescription drugs. " +
      "Most enrollees add a <b>Medigap supplement</b> (like Plan G) which covers deductibles and copays that Parts A and B leave unpaid, capping your out-of-pocket exposure. " +
      "Higher incomes trigger IRMAA surcharges that raise the Part B and Part D premiums." +
      "</p>";
    medHTML += "<div class='hc-irmaa-badge" + (hasIRMAA ? " hc-irmaa-hit" : "") + "'>" +
      "IRMAA " + tierNames[irmaaTier] + (hasIRMAA ? ": income surcharge applies" : ": standard premium") + "</div>";

    medHTML += "<div class='kv'><span class='k'>Part B premium" +
      (hasIRMAA ? " <span style='color:var(--dimmer);font-size:11px'>includes IRMAA surcharge</span>" : "") +
      "</span><span class='v'>$" + partBMonthly.toFixed(0) + "/mo per person</span></div>";
    medHTML += "<div class='kv'><span class='k'>Part D estimate <span style='color:var(--dimmer);font-size:11px'>" +
      (partDIRMAA > 0 ? "~$" + HC_PARTD_BASE + " avg plan + $" + partDIRMAA.toFixed(0) + " IRMAA" : "avg plan, no IRMAA") +
      "</span></span><span class='v'>~$" + Math.round(partDTotal) + "/mo per person</span></div>";
    medHTML += "<div class='kv'><span class='k'>Medigap Plan G <span style='color:var(--dimmer);font-size:11px'>varies by state, insurer &amp; age</span></span><span class='v'>~$" + HC_MEDIGAP_LOW + "–$" + HC_MEDIGAP_HIGH + "/mo per person</span></div>";
    medHTML += "<div class='kv total'><span class='k'>Estimated total per person</span><span class='v'>~$" + Math.round(totalLow) + "–$" + Math.round(totalHigh) + "/mo</span></div>";

    if (joint){
      medHTML += "<div class='kv'><span class='k'>For the couple <span style='color:var(--dimmer);font-size:11px'>both at same IRMAA tier</span></span><span class='v'>~$" + Math.round(totalLow * 2) + "–$" + Math.round(totalHigh * 2) + "/mo</span></div>";
    }

    // IRMAA threshold insights
    if (hasIRMAA){
      var prevTier = HC_IRMAA[irmaaTier - 1];
      var monthSavings = (partBMonthly - prevTier[2]) + (partDIRMAA - prevTier[3]);
      var annualSavings = monthSavings * (joint ? 2 : 1) * 12;
      var threshold = prevTier[joint ? 1 : 0];
      var overBy = magi - threshold;
      medHTML += "<div class='hc-insight'>Your income is <b>" + money(overBy, 0) + " above</b> the " +
        tierNames[irmaaTier] + " threshold ($" + threshold.toLocaleString() + "). " +
        "Reducing MAGI below that threshold saves <b>$" + Math.round(monthSavings) + "/mo per person</b> ($" + Math.round(annualSavings).toLocaleString() + "/yr" + (joint ? " for the couple" : "") + ") in Medicare premiums. " +
        "Roth conversions and capital gains realizations both count toward IRMAA.</div>";
    }

    // Next tier warning (if not at top)
    if (irmaaTier < HC_IRMAA.length - 1){
      var nextTierData = HC_IRMAA[irmaaTier + 1];
      var nextThreshold = nextTierData[joint ? 1 : 0];
      var distToNext = nextThreshold - magi;
      var nextExtraCost = (nextTierData[2] - partBMonthly) + (nextTierData[3] - partDIRMAA);
      if (distToNext < 25000){
        medHTML += "<div class='hc-insight'>Your income is <b>" + money(distToNext, 0) + " below</b> the next IRMAA threshold ($" + nextThreshold.toLocaleString() + "). " +
          "Crossing it adds <b>$" + Math.round(nextExtraCost) + "/mo per person</b> ($" + Math.round(nextExtraCost * (joint ? 2 : 1) * 12).toLocaleString() + "/yr" + (joint ? " for the couple" : "") + "). " +
          "Consider this before large Roth conversions or realizing capital gains.</div>";
      }
    }

    medHTML += "<div class='hc-note'>Medicare costs use CMS's 2026 figures: a $202.90 standard Part B premium and 2026 IRMAA tiers. Medicare applies the surcharge based on your income from <b>two years prior</b>, so income in retirement year 1 may not affect Part B until year 3. Part D estimate is a national average plus IRMAA; your actual plan premium varies. Medigap Plan G estimates are rough national ranges at age 65, and state, insurer, and enrollment age make a significant difference. Medicare Advantage (Part C) plans often have lower monthly premiums but different cost-sharing and network rules.</div>";
  }
  $("hcMedicareBody").innerHTML = medHTML;
}

// ── HC sidebar event wiring ──────────────────────────────────────────────────
(function(){
  function hcListen(id){ var el = $(id); if (el) el.addEventListener("input", renderHealthcare); }
  ["hcRetireAge","hcIncome","hcManualPremium","hcSpouseAge","hcSS"].forEach(hcListen);
  ["hcStatus","hcHousehold","hcState"].forEach(function(id){
    var el = $(id); if (el) el.addEventListener("change", renderHealthcare);
  });

  $("hcCopyTax").addEventListener("click", function(){
    try {
      var txInp = readTax();
      if (txInp.mode !== "retire"){
        toast("Switch the Income Tax tool to Retirement income mode first");
        return;
      }
      var agi = runTax(txInp).agi || 0;
      if (!agi){ toast("Enter income in the Income Tax tool first"); return; }
      $("hcIncome").value = groupDigits(Math.round(agi), true);
      var ssR = runTax(txInp).ssGross || 0;
      $("hcSS").value = ssR > 0 ? groupDigits(Math.round(ssR), true) : "";
      renderHealthcare();
      toast("Copied " + money(agi) + " MAGI from Income Tax");
    } catch(e){ toast("Couldn't read from the Income Tax tool"); }
  });

  $("hcGoTax").addEventListener("click", function(){
    txMode = "retire";
    applyTaxMode();
    showTab("tools");
    showTool("tax");
  });
})();
hcReady = true;
if (chartMode.tab === "tools" && toolSub === "healthcare") renderHealthcare();

