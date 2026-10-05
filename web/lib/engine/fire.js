/* The FIRE calculator's market-history search: for each rolling window
   since 1926, when the plan first reaches its target (or, for Coast FIRE,
   when it could stop contributing and still get there). Moved unchanged from
   src/js/app/35-fire.js; only the exports and imports are added. */
import { HIST_M_BOND, HIST_M_INFL, HIST_M_STOCK, PPY } from "./math.js";

export function fiComputeCrossings(p, maxYears){
  var avail = HIST_M_STOCK.length;
  var N = Math.ceil(maxYears * 12 - 1e-9);
  if (N > avail) return null;
  var count = avail - N + 1;
  var ppy = PPY[p.period] || 12;
  var plan = [];
  for (var k = 1; k <= N; k++){
    var yearNo = Math.ceil(k / 12);
    var grown = p.contrib * Math.pow(1 + p.growth, yearNo - 1);
    var amount;
    if (ppy >= 12) amount = grown * (ppy / 12);
    else if (ppy === 4) amount = (k % 3 === 0) ? grown : 0;
    else amount = (k % 12 === 0) ? grown : 0;
    plan.push({amount: amount, w: p.histMix});
  }
  var target = p.target;
  var crossings = [];
  for (var wi = 0; wi < count; wi++){
    var bal = p.initial, cum = 1;
    for (var k = 0; k < N; k++){
      var pl = plan[k], idx = wi + k;
      var r = (pl.w * HIST_M_STOCK[idx] + (1 - pl.w) * HIST_M_BOND[idx]) / 100;
      if (r <= -0.999) r = -0.999;
      bal = bal * (1 + r) + pl.amount;
      cum *= (1 + HIST_M_INFL[idx] / 100);
      if ((bal / cum) >= target){
        crossings.push((k + 1) / 12);
        break;
      }
    }
  }
  crossings.sort(function(a, b){ return a - b; });
  return {crossings: crossings, total: count};
}

export function fiYearsFromCrossings(crossings, total, successPct){
  var needed = Math.max(1, Math.floor(successPct / 100 * total));
  if (needed > crossings.length) return null;
  return crossings[needed - 1];
}

export function fiComputeCoastCrossings(p){
  var avail = HIST_M_STOCK.length;
  var retYrs = Math.max(1, p.retireAge - p.curAge);
  var N = Math.ceil(retYrs * 12 - 1e-9);
  if (N > avail) return null;
  var count = avail - N + 1;
  var ppy = PPY[p.period] || 12;
  var mix = p.histMix;
  var target = p.target;
  var nomBal   = new Float64Array(N + 1);
  var cumInfl  = new Float64Array(N + 1);
  var backNom  = new Float64Array(N + 1);
  var backInfl = new Float64Array(N + 1);
  var crossings = [];
  for (var wi = 0; wi < count; wi++){
    nomBal[0]  = p.initial;
    cumInfl[0] = 1;
    for (var k = 0; k < N; k++){
      var idx = wi + k;
      var r = (mix * HIST_M_STOCK[idx] + (1 - mix) * HIST_M_BOND[idx]) / 100;
      if (r <= -0.999) r = -0.999;
      var yearNo = Math.ceil((k + 1) / 12);
      var grown  = p.contrib * Math.pow(1 + p.growth, yearNo - 1);
      var amt;
      if (ppy >= 12)      amt = grown * (ppy / 12);
      else if (ppy === 4) amt = ((k + 1) % 3 === 0)  ? grown : 0;
      else                amt = ((k + 1) % 12 === 0) ? grown : 0;
      nomBal[k + 1]  = nomBal[k] * (1 + r) + amt;
      cumInfl[k + 1] = cumInfl[k] * (1 + HIST_M_INFL[idx] / 100);
    }
    backNom[N]  = 1;
    backInfl[N] = 1;
    for (var k = N - 1; k >= 0; k--){
      var idx = wi + k;
      var r = (mix * HIST_M_STOCK[idx] + (1 - mix) * HIST_M_BOND[idx]) / 100;
      if (r <= -0.999) r = -0.999;
      backNom[k]  = backNom[k + 1]  * (1 + r);
      backInfl[k] = backInfl[k + 1] * (1 + HIST_M_INFL[idx] / 100);
    }
    for (var k = 0; k <= N; k++){
      var coastReal = nomBal[k] * backNom[k] / (cumInfl[k] * backInfl[k]);
      if (isFinite(coastReal) && coastReal >= target){
        crossings.push(k / 12);
        break;
      }
    }
  }
  crossings.sort(function(a, b){ return a - b; });
  return {crossings: crossings, total: count};
}
