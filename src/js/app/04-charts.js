/* ---------- charts ---------- */
let chartPoints = [];
let mcSeed = 20260902;
const chartMode = {single:"band", series:"band", fire:"band"};

const NS = "http://www.w3.org/2000/svg";
function cssVar(name){
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || "#888";
}
const svgEl = (n, at) => { const e = document.createElementNS(NS, n);
  for (const k in at) e.setAttribute(k, at[k]); return e; };
const swatch = (c, t) => "<span><i style='background:" + c + "'></i>" + t + "</span>";
/* A legend entry that shows or hides its layer of the chart: the faint
   line per starting year ("traces").
   The choice is a class on the chart's panel, so it survives the chart being
   redrawn as inputs change; lgSync() puts each fresh legend in step with it. */
const lgToggle = (c, t, layer) => "<button type='button' class='lgtoggle' data-layer='" + layer +
  "' aria-pressed='true' title='Show or hide on the chart'><i style='background:" + c + "'></i>" + t + "</button>";
function lgSync(elId){
  const el = $(elId), panel = el && el.closest(".panel");
  if (!panel) return;
  el.querySelectorAll(".lgtoggle").forEach(b =>
    b.setAttribute("aria-pressed", String(!panel.classList.contains("hide-" + b.dataset.layer))));
}
document.addEventListener("click", e => {
  const b = e.target.closest && e.target.closest(".lgtoggle"), panel = b && b.closest(".panel");
  if (!panel) return;
  const off = panel.classList.toggle("hide-" + b.dataset.layer);
  b.setAttribute("aria-pressed", String(!off));
});

/* Shared painter. Both tabs hand it the same shape of data, so the rate band
   and the Monte Carlo fan render through one code path. */
/* Gridlines on round numbers: a step of 1, 2, 2.5 or 5 times a power of ten,
   picked so the range takes about four of them, with the top line just
   above the data. $0 / $500k / $1M / $1.5M reads at a glance; quarters of
   whatever the maximum happened to be ($509k, $1.02M) don't. */
function niceAxis(lo, hi){
  if (!(hi > lo)) hi = lo + 1;
  const raw = (hi - lo) / 4;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const f = raw / mag;
  const step = (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * mag;
  const min = Math.floor(lo / step + 1e-9) * step;
  const max = Math.ceil(hi * 1.02 / step - 1e-9) * step;
  const ticks = [];
  for (let v = min; v <= max + step / 2; v += step) ticks.push(Math.abs(v) < step / 1e6 ? 0 : v);
  return {min, max, ticks};
}
/* $1.5M, $2M, $1.25M: only the decimals the number needs. */
function fmtAxisMoney(v){
  const a = Math.abs(v), sign = v < 0 ? "-$" : "$";
  if (a >= 1e6) return sign + +(a / 1e6).toFixed(2) + "M";
  if (a >= 1e3) return sign + +(a / 1e3).toFixed(1) + "k";
  return sign + Math.round(a);
}
function paintChart(svgId, pts, maxX, mode, stageMarks, xOffset, opt){
  const o = opt || {};
  xOffset = xOffset || 0;
  const svg = $(svgId);
  const narrow = window.innerWidth < 640;
  const W = narrow ? 470 : 900, H = narrow ? 400 : 340;
  const L = narrow ? 60 : 78, Rp = narrow ? 12 : 14;
  const T = narrow ? 12 : 14, B = narrow ? 34 : 30;
  const fs = narrow ? 15 : 11, sw = narrow ? 1.7 : 1;
  const pw = W - L - Rp, ph = H - T - B;
  svg.setAttribute("viewBox", "0 0 " + W + " " + H);
  svg.innerHTML = "";
  if (!pts || !pts.length) return null;

  const vals = [];
  pts.forEach(a => {
    vals.push(a.base);
    if (a.hi != null) vals.push(a.hi);
    if (a.lo != null) vals.push(a.lo);
    if (a.det != null) vals.push(a.det);
  });
  // A comparison line (o.overlay: [{pts:[{year, value}], color, dash, width}])
  // counts toward the axis, so it never runs off the top.
  (o.overlay || []).forEach(ov => ov.pts.forEach(p => vals.push(p.value)));
  const AX = niceAxis(Math.min(0, Math.min.apply(null, vals)), Math.max.apply(null, vals));
  const maxY = AX.max, minY = AX.min;
  const span = (maxY - minY) || 1;
  const X = y => L + (y / (maxX || 1)) * pw;
  const Y = v => T + ph - ((v - minY) / span) * ph;

  const defs = svgEl("defs", {});
  [["fanOuter", "#4fbf95", .16, .02], ["fanInner", "#4fbf95", .30, .06],
   ["bandFill", "#4fbf95", .20, .05]].forEach(g => {
    const grad = svgEl("linearGradient", {id:g[0] + svgId, x1:0, y1:0, x2:0, y2:1});
    grad.appendChild(svgEl("stop", {offset:"0%", "stop-color":g[1], "stop-opacity":g[2]}));
    grad.appendChild(svgEl("stop", {offset:"100%", "stop-color":g[1], "stop-opacity":g[3]}));
    defs.appendChild(grad);
  });
  /* The plan's own line ends in the logo's arrowhead: the one line on the
     chart that's yours flies on past its last year. Sized in stroke widths,
     so it scales with the line on a phone. */
  const tip = svgEl("marker", {id:"tip" + svgId, viewBox:"0 0 10 10", refX:6.5, refY:5,
    markerWidth:4.2, markerHeight:4.2, orient:"auto"});
  tip.appendChild(svgEl("path", {d:"M0 .6 L10 5 L0 9.4 L2.6 5 Z", fill:"#e9b872"}));
  defs.appendChild(tip);
  svg.appendChild(defs);

  const fmtAxis = fmtAxisMoney;
  AX.ticks.forEach(v => {
    const y = Y(v);
    svg.appendChild(svgEl("line", {x1:L, x2:W - Rp, y1:y, y2:y, stroke:cssVar("--grid"),
      "stroke-width":1 * sw}));
    const t = svgEl("text", {x:L - 8, y:y + fs/3, "text-anchor":"end", "font-size":fs,
      fill:cssVar("--axis"), "font-family":"ui-monospace,SF Mono,Menlo,monospace"});
    t.textContent = fmtAxis(v); svg.appendChild(t);
  });
  const step = Math.max(1, Math.ceil(maxX / (narrow ? 6 : 12)));
  for (let y = 0; y <= maxX; y += step){
    const t = svgEl("text", {x:X(y), y:H - 10, "text-anchor":"middle", "font-size":fs,
      fill:cssVar("--axis"), "font-family":"ui-monospace,SF Mono,Menlo,monospace"});
    t.textContent = y + xOffset; svg.appendChild(t);
  }

  const line = f => pts.map((a, i) => (i ? "L" : "M") + X(a.year) + " " + Y(f(a))).join(" ");
  const ribbon = (top, bot) =>
    pts.map((a, i) => (i ? "L" : "M") + X(a.year) + " " + Y(top(a))).join(" ") + " " +
    pts.slice().reverse().map(a => "L" + X(a.year) + " " + Y(bot(a))).join(" ") + " Z";

  /* Every starting year as its own faint line, beneath the percentile
     shading: the individual retirements the bands summarize. Drawing only;
     the axis still fits the bands, so a lucky start that runs off the top is
     clipped rather than squashing everything else. o.traces is {xs, lines},
     each line one value per x. */
  if (o.traces && o.traces.lines && o.traces.lines.length){
    const cid = "trc" + svgId;
    const cp = svgEl("clipPath", {id:cid});
    cp.appendChild(svgEl("rect", {x:L, y:T, width:pw, height:ph}));
    defs.appendChild(cp);
    const tg = svgEl("g", {"clip-path":"url(#" + cid + ")", fill:"none", stroke:"#7d9fd6",
      "stroke-opacity":o.traces.lines.length > 400 ? .055 : o.traces.lines.length > 60 ? .13 : .18, "stroke-width":.9 * sw,
      "stroke-linejoin":"round", class:"traces"});
    const xs = o.traces.xs;
    o.traces.lines.forEach(ln => {
      let d = "";
      for (let i = 0; i < xs.length && i < ln.length; i++){
        const v = ln[i];
        if (v == null || !isFinite(v)) continue;
        d += (d ? "L" : "M") + X(xs[i]).toFixed(1) + " " + Y(v).toFixed(1);
      }
      if (d) tg.appendChild(svgEl("path", {d}));
    });
    svg.appendChild(tg);
  }

  if (mode === "mc"){
    svg.appendChild(svgEl("path", {d:ribbon(a => a.hi, a => a.lo), fill:"url(#fanOuter" + svgId + ")"}));
    svg.appendChild(svgEl("path", {d:ribbon(a => a.p75, a => a.p25), fill:"url(#fanInner" + svgId + ")"}));
  } else {
    svg.appendChild(svgEl("path", {d:ribbon(a => a.hi, a => a.lo), fill:"url(#bandFill" + svgId + ")"}));
  }

  (stageMarks || []).forEach(m => {
    const sx = X(m.year);
    svg.appendChild(svgEl("line", {x1:sx, x2:sx, y1:T, y2:T + ph, stroke:cssVar("--stageline"),
      "stroke-width":1 * sw, "stroke-dasharray":"4 4"}));
    const lab = svgEl("text", {x:sx + 4, y:T + fs, "font-size":fs * .92, fill:"#5f7583",
      "font-family":"ui-monospace,SF Mono,Menlo,monospace"});
    lab.textContent = m.label; svg.appendChild(lab);
  });

  if (mode === "mc"){
    if (pts[0].det != null)
      svg.appendChild(svgEl("path", {d:line(a => a.det), fill:"none", stroke:"#7d9fd6",
        "stroke-width":1.6 * sw, "stroke-dasharray":"5 4"}));
    svg.appendChild(svgEl("path", {d:line(a => a.base), fill:"none", stroke:"#e9b872",
      "stroke-width":2.6 * sw, "stroke-linejoin":"round", "marker-end":"url(#tip" + svgId + ")"}));
  } else {
    svg.appendChild(svgEl("path", {d:line(a => a.hi), fill:"none", stroke:"#4fbf95",
      "stroke-width":1.8 * sw, "stroke-linejoin":"round", opacity:.9}));
    if (!o.noLoLine)
      svg.appendChild(svgEl("path", {d:line(a => a.lo), fill:"none", stroke:"#e2795f",
        "stroke-width":1.8 * sw, "stroke-linejoin":"round", opacity:.9}));
    svg.appendChild(svgEl("path", {d:line(a => a.base), fill:"none", stroke:"#e9b872",
      "stroke-width":2.6 * sw, "stroke-linejoin":"round", "marker-end":"url(#tip" + svgId + ")"}));
  }

  (o.overlay || []).forEach(ov => {
    if (!ov.pts.length) return;
    svg.appendChild(svgEl("path", {d:ov.pts.map((p, i) => (i ? "L" : "M") + X(p.year) + " " + Y(p.value)).join(" "),
      fill:"none", stroke:ov.color || cssVar("--dim"), "stroke-width":(ov.width || 1.8) * sw,
      "stroke-dasharray":ov.dash || "6 5", "stroke-linejoin":"round", opacity:.95}));
  });

  const hover = svgEl("line", {x1:0, x2:0, y1:T, y2:T + ph, stroke:"#e9b872",
    "stroke-width":1 * sw, opacity:0}); svg.appendChild(hover);
  const dot = svgEl("circle", {r:4.5 * sw, fill:"#e9b872", stroke:cssVar("--dotstroke"),
    "stroke-width":2.5 * sw, opacity:0}); svg.appendChild(dot);

  let dotHi = null, dotLo = null, xTick = null;
  if (o.enhanced){
    dotHi = svgEl("circle", {r:4 * sw, fill:"#4fbf95", stroke:cssVar("--dotstroke"),
      "stroke-width":2 * sw, opacity:0}); svg.appendChild(dotHi);
    if (!o.noLoLine){
      dotLo = svgEl("circle", {r:4 * sw, fill:"#e2795f", stroke:cssVar("--dotstroke"),
        "stroke-width":2 * sw, opacity:0}); svg.appendChild(dotLo);
    }
    xTick = svgEl("circle", {r:3 * sw, fill:cssVar("--dim"), opacity:0,
      cy: T + ph + (B / 2)}); svg.appendChild(xTick);
    svg.style.animation = "none";
    svg.getBoundingClientRect();
    svg.style.animation = "chartFadeUp .35s ease-out";
  }
  return {pts, X, Y, hover, dot, dotHi, dotLo, xTick, maxX, W};
}

/* A plain multi-line painter. The fan painter above is built around one
   series with a ribbon around it; this one draws n independent lines that may
   not even share a length, which is what comparing scenarios needs. */
const MULTI_COLORS = ["#e9b872", "#4fbf95", "#7d9fd6"];
function paintMulti(svgId, series, maxX, opt){
  const o = opt || {};
  const svg = $(svgId);
  const narrow = window.innerWidth < 640;
  const W = narrow ? 470 : 900, H = narrow ? 400 : 340;
  const L = narrow ? 60 : 78, Rp = narrow ? 12 : 14;
  const T = narrow ? 12 : 14, B = narrow ? 34 : 30;
  const fs = narrow ? 15 : 11, sw = narrow ? 1.7 : 1;
  const pw = W - L - Rp, ph = H - T - B;
  svg.setAttribute("viewBox", "0 0 " + W + " " + H);
  svg.innerHTML = "";
  const live = (series || []).filter(x => x && x.pts && x.pts.length);
  if (!live.length) return null;

  const vals = [];
  live.forEach(x => x.pts.forEach(pt => vals.push(pt.value)));
  const AX = niceAxis(Math.min(0, Math.min.apply(null, vals)), Math.max.apply(null, vals));
  const maxY = AX.max, minY = AX.min;
  const span = (maxY - minY) || 1;
  const X = y => L + (y / (maxX || 1)) * pw;
  const Y = v => T + ph - ((v - minY) / span) * ph;

  const fmtAxis = o.yFmt ? o.yFmt : fmtAxisMoney;
  AX.ticks.forEach(v => {
    const y = Y(v);
    svg.appendChild(svgEl("line", {x1:L, x2:W - Rp, y1:y, y2:y, stroke:cssVar("--grid"),
      "stroke-width":1 * sw}));
    const t = svgEl("text", {x:L - 8, y:y + fs/3, "text-anchor":"end", "font-size":fs,
      fill:cssVar("--axis"), "font-family":"ui-monospace,SF Mono,Menlo,monospace"});
    t.textContent = fmtAxis(v); svg.appendChild(t);
  });
  const step = Math.max(1, Math.ceil(maxX / (narrow ? 6 : 12)));
  for (let y = 0; y <= maxX; y += step){
    const t = svgEl("text", {x:X(y), y:H - 10, "text-anchor":"middle", "font-size":fs,
      fill:cssVar("--axis"), "font-family":"ui-monospace,SF Mono,Menlo,monospace"});
    t.textContent = o.xFmt ? o.xFmt(y) : y; svg.appendChild(t);
  }

  if (minY < 0){
    const zy = Y(0);
    svg.appendChild(svgEl("line", {x1:L, x2:W - Rp, y1:zy, y2:zy,
      stroke:cssVar("--axis"), "stroke-width":1 * sw, opacity:.55}));
  }
  // Marked moments (the Drawdown Simulator's market eras): a faint dashed
  // line with its label at the top.
  (o.marks || []).forEach(m => {
    if (m.x < 0 || m.x > maxX) return;
    svg.appendChild(svgEl("line", {x1:X(m.x), x2:X(m.x), y1:T + fs + 4, y2:T + ph, stroke:cssVar("--axis"),
      "stroke-width":1 * sw, "stroke-dasharray":"3 4", opacity:.55}));
    const t = svgEl("text", {x:X(m.x), y:T + fs, "text-anchor":"middle", "font-size":fs * .9,
      fill:cssVar("--axis"), "font-family":"ui-monospace,SF Mono,Menlo,monospace"});
    t.textContent = m.label; svg.appendChild(t);
  });

  const colors = live.map((x, i) => x.color || MULTI_COLORS[i % MULTI_COLORS.length]);
  live.forEach((x, i) => {
    const d = x.pts.map((pt, k) => (k ? "L" : "M") + X(pt.year) + " " + Y(pt.value)).join(" ");
    const at = {d, fill:"none", stroke:colors[i], "stroke-width":(x.width || 2.4) * sw,
                "stroke-linejoin":"round"};
    if (x.dash) at["stroke-dasharray"] = x.dash;
    svg.appendChild(svgEl("path", at));
  });

  /* One hover grid across every series, so the tooltip can show them together
     even when one plan is shorter than another. */
  const seen = {};
  live.forEach(x => x.pts.forEach(pt => { seen[pt.year] = 1; }));
  const yearList = Object.keys(seen).map(Number).sort((a, b) => a - b);
  const maps = live.map(x => {
    const m = {}; x.pts.forEach(pt => { m[pt.year] = pt.value; }); return m;
  });
  const pts = yearList.map(yr => {
    const vs = maps.map(m => (m[yr] == null ? null : m[yr]));
    let firstv = null;
    for (let i = 0; i < vs.length; i++) if (vs[i] != null){ firstv = vs[i]; break; }
    return {year:yr, base: firstv == null ? 0 : firstv, vals:vs};
  });

  const hover = svgEl("line", {x1:0, x2:0, y1:T, y2:T + ph, stroke:"#e9b872",
    "stroke-width":1 * sw, opacity:0}); svg.appendChild(hover);
  const dot = svgEl("circle", {r:4.5 * sw, fill:"#e9b872", stroke:cssVar("--dotstroke"),
    "stroke-width":2.5 * sw, opacity:0}); svg.appendChild(dot);
  return {pts, X, Y, hover, dot, maxX, W, names: live.map(x => x.name), colors};
}

function mcLegend(elId, extra, noDet){
  const parts = [swatch("#4fbf95", "10th\u201390th percentile"),
                 swatch("#3f9a78", "25th\u201375th"),
                 swatch("#e9b872", "Median")];
  // The dashed no-volatility line only exists where there's a plan to draw it from.
  if (!noDet) parts.push(swatch("#7d9fd6", "Without volatility"));
  if (extra) parts.push(swatch(cssVar("--stageline"), extra));
  $(elId).innerHTML = parts.join("");
}
/* History mode shares the fan painter with Monte Carlo, but not its legend:
   there is no "without volatility" line to show, because no assumed rate is
   used at all. */
function histLegend(elId, extra){
  const parts = [swatch("#4fbf95", "10th\u201390th percentile of windows"),
                 swatch("#3f9a78", "25th\u201375th"),
                 swatch("#e9b872", "Median window"),
                 lgToggle("#7d9fd6", "Each starting year", "traces")];
  if (extra) parts.push(swatch(cssVar("--stageline"), extra));
  $(elId).innerHTML = parts.join("");
  lgSync(elId);
}
function histSummary(noteId, H, target, label){
  const el = $(noteId);
  if (!H || !H.count){
    if (H && H.tooLong){
      el.hidden = false;
      el.innerHTML = "<b class='warn'>" + fmtYears(H.totalYears) + "</b> is longer " +
        "than the " + H.span + " years of history available (" + H.first +
        "\u2013" + H.last + "). Shorten the plan to use this mode.";
    } else el.hidden = true;
    return;
  }
  el.hidden = false;
  let out = "";
  if (target > 0){
    let hit = 0;
    for (let i = 0; i < H.finals.length; i++) if (H.finals[i] >= target) hit++;
    const pct = hit / H.count * 100;
    out += "<b" + (pct >= 75 ? "" : " class='warn'") + ">" + pct.toFixed(1) + "%" +
      "</b> of windows reach " + money(target) + " " + label + ". ";
  }
  out += "Median outcome <b>" + money(H.median) + "</b>. Worst window started " +
    histWhen(H.worst) + " (" + money(H.worst.final) + "), best started " +
    histWhen(H.best) + " (" + money(H.best.final) + ").";
  el.innerHTML = out;
}
const HIST_MON = ["Jan","Feb","Mar","Apr","May","Jun",
                  "Jul","Aug","Sep","Oct","Nov","Dec"];
function histWhen(w){
  return (w && w.startMonth) ? HIST_MON[w.startMonth - 1] + " " + w.start
                             : (w ? String(w.start) : "");
}
function histBarNote(H, perStage){
  if (!H || !H.count){
    if (H && H.tooLong)
      return "No window fits: history runs " + H.first + "\u2013" + H.last + ".";
    return "Add some years to run this.";
  }
  return "<b>" + fmtNum(H.count) + "</b> rolling windows of " +
    fmtYears(H.totalYears) + ", compounded month by month, " + H.first +
    "\u2013" + H.last + ". " + (perStage
      ? "Each stage uses its own stock mix, set on the cards above. "
      : "") +
    "Your rate of return and inflation inputs are ignored in this mode.";
}
/* One stage object for the single-plan tab, carrying the mix instead of a rate. */
function histStagesSingle(p){
  const mix = Math.max(0, Math.min(1, num("histMix") / 100));
  const endMix = Math.max(0, Math.min(1, num("histMixEnd") / 100));
  return [{years:p.years, contrib:p.contrib, period:p.period, growth:p.growth,
           nominal:p.nominal, mix,
           glide: (p.glide && p.glide.on)
             ? {on:true, years:p.glide.years, endMix} : {on:false}}];
}
function histStagesSeries(g){
  const mix = Math.max(0, Math.min(1, num("histMixS") / 100));
  const endMix = Math.max(0, Math.min(1, num("histMixEndS") / 100));
  return effectiveStages(g).map(st => {
    const out = Object.assign({}, st, {mix});
    if (out.glide && out.glide.on)
      out.glide = Object.assign({}, out.glide, {endMix});
    return out;
  });
}
function mcSummary(noteId, mc, target, label){
  if (!mc || !mc.finals.length || !(target > 0)){ $(noteId).hidden = true; return; }
  let hit = 0;
  for (let i = 0; i < mc.finals.length; i++) if (mc.finals[i] >= target) hit++;
  const pct = hit / mc.finals.length * 100;
  $(noteId).hidden = false;
  $(noteId).innerHTML = "<b" + (pct >= 75 ? "" : " class='warn'") + ">" + pct.toFixed(0) +
    "%</b> of " + mc.trials.toLocaleString() + " runs reach " + money(target) + " " + label +
    ". Median outcome <b>" + money(mc.median) + "</b>.";
}
const MC_RUNS = 5000;
function readTrials(){ return MC_RUNS; }
/* Simulation is the one genuinely expensive step, so keep it off the keystroke path. */
let mcTimer = null;
function scheduleMC(fn){ clearTimeout(mcTimer); mcTimer = setTimeout(fn, 160); }

function drawChart(R, p){
  if (!R || !R.years.length){ chartPoints = paintChart("chart", [], 1, "band", [], 0, {enhanced:true}); return; }
  const real = (v, yr) => v / Math.pow(1 + p.inflation, yr);

  $("histGlideWrap").hidden = !(p.glide && p.glide.on);

  if (chartMode.single === "hist"){
    const H = historicalRuns({initial:p.initial, fees:p.fees}, histStagesSingle(p));
    $("histNote").innerHTML = histBarNote(H, false);
    if (!H.count){
      chartPoints = paintChart("chart", [], 1, "mc", [], 0, {enhanced:true});
      $("legend").innerHTML = "";
      histSummary("mcNote", H, 0, "");
      return;
    }
    const pts = [{year:0, base:p.initial, hi:p.initial, lo:p.initial,
                  p25:p.initial, p75:p.initial}];
    H.bands.forEach(b => pts.push({year:b.year, base:b.p50, hi:b.p90, lo:b.p10,
                                   p25:b.p25, p75:b.p75}));
    chartPoints = paintChart("chart", pts, p.years, "mc", [], 0, {enhanced:true,
      traces:{xs:pts.map(a => a.year), lines:H.traces.map(t => [p.initial].concat(t))}});
    histLegend("legend");
    const S = goalSolve(acSolveP(p), $("solveFor").value, num("target"));
    histSummary("mcNote", H, S.portToday, "(the portfolio behind your target above)");
    return;
  }

  if (chartMode.single === "mc"){
    const mc = monteCarlo({initial:p.initial, inflation:p.inflation},
      [{years:p.years, contrib:p.contrib, period:p.period, growth:p.growth,
        nominal:p.nominal, vol:p.vol}], readTrials(), mcSeed);
    const pts = [{year:0, base:p.initial, hi:p.initial, lo:p.initial,
                  p25:p.initial, p75:p.initial, det:p.initial}];
    mc.bands.forEach((b, i) => pts.push({year:b.year, base:b.p50, hi:b.p90, lo:b.p10,
      p25:b.p25, p75:b.p75,
      det: R.years[i] ? real(R.years[i].end, R.years[i].year) : b.p50}));
    chartPoints = paintChart("chart", pts, p.years, "mc", [], 0, {enhanced:true});
    mcLegend("legend");
    const S = goalSolve(acSolveP(p), $("solveFor").value, num("target"));
    mcSummary("mcNote", mc, S.portToday, "(the portfolio behind your target above)");
  } else {
    const band = Math.max(0, num("band")) / 100;
    const hiR = project(Object.assign({}, p, {nominal: p.nominal + band}));
    const loR = project(Object.assign({}, p, {nominal: Math.max(-0.99, p.nominal - band)}));
    const pts = [{year:0, base:p.initial, hi:p.initial, lo:p.initial}];
    R.years.forEach((y, i) => pts.push({year:y.year, base: real(y.end, y.year),
      hi: real(hiR.years[i] ? hiR.years[i].end : y.end, y.year),
      lo: real(loR.years[i] ? loR.years[i].end : y.end, y.year)}));
    chartPoints = paintChart("chart", pts, p.years, "band", [], 0, {enhanced:true});
    const lbl = (band * 100).toFixed(2).replace(/\.?0+$/, "");
    $("legend").innerHTML =
      swatch("#4fbf95", band > 0 ? "At " + pctStr(p.nominal + band, 2) + " (+" + lbl + "%)" : "Higher") +
      swatch("#e9b872", "At " + pctStr(p.nominal, 2) + " (your rate)") +
      swatch("#e2795f", band > 0 ? "At " + pctStr(Math.max(-0.99, p.nominal - band), 2) + " (\u2212" + lbl + "%)" : "Lower");
    $("mcNote").hidden = true;
  }
}

/* One probe routine, reused by both charts. Touch matters here: without it a
   chart is inert on a phone, since there is no hover. */
function attachChart(wrapId, svgId, tipId, getState, tipHtml){
  const wrap = $(wrapId);
  function probe(clientX, clientY){
    const st = getState();
    if (!st || !st.pts) return;
    const box = $(svgId).getBoundingClientRect();
    if (!box.width) return;
    const vx = (clientX - box.left) / box.width * st.W;
    let best = st.pts[0];
    for (const a of st.pts)
      if (Math.abs(st.X(a.year) - vx) < Math.abs(st.X(best.year) - vx)) best = a;
    const bx = st.X(best.year);
    st.hover.setAttribute("x1", bx);
    st.hover.setAttribute("x2", bx);
    st.hover.setAttribute("opacity", .4);
    st.dot.setAttribute("cx", bx);
    st.dot.setAttribute("cy", st.Y(best.base));
    st.dot.setAttribute("opacity", 1);
    if (st.dotHi && best.hi != null){
      st.dotHi.setAttribute("cx", bx);
      st.dotHi.setAttribute("cy", st.Y(best.hi));
      st.dotHi.setAttribute("opacity", 1);
    }
    if (st.dotLo && best.lo != null){
      st.dotLo.setAttribute("cx", bx);
      st.dotLo.setAttribute("cy", st.Y(best.lo));
      st.dotLo.setAttribute("opacity", 1);
    }
    if (st.xTick){
      st.xTick.setAttribute("cx", bx);
      st.xTick.setAttribute("opacity", 1);
    }
    const tip = $(tipId);
    tip.innerHTML = tipHtml(best);
    tip.style.opacity = 1;
    const wb = wrap.getBoundingClientRect();
    const tw = tip.offsetWidth || 190, th = tip.offsetHeight || 84;
    let left = clientX - wb.left + 16;
    if (left + tw > wb.width - 4) left = clientX - wb.left - tw - 16;
    left = Math.max(4, Math.min(left, wb.width - tw - 4));
    let top = clientY - wb.top - th - 14;
    if (top < 4) top = clientY - wb.top + 18;
    top = Math.max(4, Math.min(top, wb.height - th - 4));
    tip.style.left = left + "px";
    tip.style.top = top + "px";
  }
  function clear(){
    $(tipId).style.opacity = 0;
    const st = getState();
    if (st && st.hover){ st.hover.setAttribute("opacity", 0);
      st.dot.setAttribute("opacity", 0);
      if (st.dotHi) st.dotHi.setAttribute("opacity", 0);
      if (st.dotLo) st.dotLo.setAttribute("opacity", 0);
      if (st.xTick) st.xTick.setAttribute("opacity", 0);
    }
  }
  wrap.addEventListener("mousemove", e => probe(e.clientX, e.clientY));
  wrap.addEventListener("mouseleave", clear);
  chartTouch(wrap, probe, clear);
}

/* Touch scrubbing for a chart: a touch shows the point under the finger and
   the tooltip stays up briefly after it lifts. Scrubbing sideways shouldn't
   scroll the page, but the chart is a full-width block on a phone and
   swallowing every gesture that started on it made it a dead zone for
   ordinary scrolling. The first move decides: mostly vertical hands the
   gesture back to the page, mostly horizontal keeps it here for the rest of
   the touch. (Charts also get -webkit-touch-callout/user-select:none on touch
   devices, so a press-and-hold doesn't start a text selection.) */
function chartTouch(el, probe, clear){
  let t0x = 0, t0y = 0, axis = "", timer = null;
  el.addEventListener("touchstart", e => {
    const t = e.touches[0]; if (!t) return;
    clearTimeout(timer);
    t0x = t.clientX; t0y = t.clientY; axis = "";
    probe(t.clientX, t.clientY);
  }, {passive:true});
  el.addEventListener("touchmove", e => {
    const t = e.touches[0]; if (!t) return;
    if (!axis){
      const dx = Math.abs(t.clientX - t0x), dy = Math.abs(t.clientY - t0y);
      if (dx < 6 && dy < 6) return;
      axis = (dy > dx) ? "y" : "x";
      if (axis === "y") clear();
    }
    if (axis === "y") return;
    e.preventDefault();
    probe(t.clientX, t.clientY);
  }, {passive:false});
  el.addEventListener("touchend", () => { clearTimeout(timer); timer = setTimeout(clear, 2500); }, {passive:true});
}

function tipRows(best, mode){
  if (mode === "hist")
    return "<br><span style='color:#4fbf95'>90th</span> <span class='n'>" + money(best.hi) +
      "</span><br><span style='color:#3f9a78'>75th</span> <span class='n'>" + money(best.p75) +
      "</span><br><span style='color:#e9b872'>Median</span> <span class='n'>" + money(best.base) +
      "</span><br><span style='color:#3f9a78'>25th</span> <span class='n'>" + money(best.p25) +
      "</span><br><span style='color:#e2795f'>10th</span> <span class='n'>" + money(best.lo) + "</span>";
  if (mode === "mc")
    return "<br><span style='color:#4fbf95'>90th</span> <span class='n'>" + money(best.hi) +
      "</span><br><span style='color:#3f9a78'>75th</span> <span class='n'>" + money(best.p75) +
      "</span><br><span style='color:#e9b872'>Median</span> <span class='n'>" + money(best.base) +
      "</span><br><span style='color:#3f9a78'>25th</span> <span class='n'>" + money(best.p25) +
      "</span><br><span style='color:#e2795f'>10th</span> <span class='n'>" + money(best.lo) + "</span>";
  const nm = ["Higher","Your rate","Lower"];
  return "<br><span style='color:#4fbf95'>" + nm[0] + "</span> <span class='n'>" + money(best.hi) +
    "</span><br><span style='color:#e9b872'>" + nm[1] + "</span> <span class='n'>" + money(best.base) +
    "</span><br><span style='color:#e2795f'>" + nm[2] + "</span> <span class='n'>" + money(best.lo) + "</span>";
}
attachChart("chartWrap", "chart", "tip", () => chartPoints,
  best => "<b>Year " + fmtNum(best.year) + "</b>" + tipRows(best, chartMode.single));
attachChart("chartWrapS", "chartS", "tipS", () => seriesPoints,
  best => "<b>Year " + fmtNum(best.year) + "</b> <span style='color:#8ba0ac'>&middot; stage " +
          best.stage + "</span>" + tipRows(best, chartMode.series));

