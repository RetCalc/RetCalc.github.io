/* ---------- share links ---------- */
/* Everything needed to rebuild both tabs, packed into the URL hash. Short keys
   keep the link manageable; base64 keeps it from looking alarming. */
let linkTab = "simple";
function currentState(){
  const p = readInputs(), g = readGlobals();
  return {v:1, t:chartMode.tab || "simple",
    q:[num("qAge"), num("qRetire"), num("qSaved"), num("qContrib"),
       $("qPeriod").value, $("qRisk").value],
    a:[p.initial, p.contrib, p.period, p.growth, p.gross, p.inflation, p.years,
       p.withdrawal, p.taxRate, p.vol, p.fees, num("target")],
    b:[g.initial, g.inflation, g.withdrawal, g.taxRate, num("targetS"), g.fees],
    c:stages.map(st => [st.years, st.contrib, st.period, st.growth, st.nominal,
                        st.vol || 0, st.adj ? 1 : 0]),
    ab:p.acct, sb:g.acct,
    // what the arrays above can't carry: Advanced's glide, and each stage's
    // glide, stock mix and name
    ag: p.glide && p.glide.on ? p.glide : undefined,
    cx: stages.map(st => ({g:st.glide, m:st.mix, n:st.name})),
    // the historical charts' stock mix and glide-to mix, Advanced then Stages
    hm: [num("histMix"), num("histMixEnd"), num("histMixS"), num("histMixEndS")],
    // the open tool's own inputs, whichever tool that is
    ts: chartMode.tab === "tools" && TOOL_PATHS[toolSub]
      ? {k:toolSub, d:buildToolData(toolSub)} : undefined,
    cs: g.acct ? stages.map(st => [st.sTrad, st.sRoth, st.gRates]) : undefined,
    sub:toolSub, tx:readTaxState(), mo:readMortState(), bg:readBudgetState(),
    rc:readRCState()};
}
function applyState(o){
  if (!o || o.v !== 1) return false;
  if (Array.isArray(o.hm))
    ["histMix", "histMixEnd", "histMixS", "histMixEndS"].forEach((id, i) => {
      if (o.hm[i] != null && isFinite(o.hm[i])) $(id).value = o.hm[i];
    });
  if (o.a){
    const a = o.a;
    writeInputs({initial:a[0], contrib:a[1], period:a[2], growth:a[3], gross:a[4],
      nominal:a[4], inflation:a[5], years:a[6], withdrawal:a[7], taxRate:a[8],
      vol:a[9], fees:a[10], glide:o.ag});
    if (a[11] != null) $("target").value = groupDigits(a[11], true);
    if (o.ab) writeAcct(o.ab);
  }
  if (o.b){
    const b = o.b;
    writeGlobals({initial:b[0], inflation:b[1], withdrawal:b[2], taxRate:b[3],
                  fees:b[5], acct:o.sb});
    if (b[4] != null) $("targetS").value = groupDigits(b[4], true);
  }
  if (Array.isArray(o.c) && o.c.length){
    stages = o.c.map((c, i) => {
      const st = {years:c[0], contrib:c[1], period:c[2], growth:c[3],
        nominal:c[4], vol:c[5], adj:!!c[6]};
      const sp = Array.isArray(o.cs) && o.cs[i];
      if (sp){ st.sTrad = sp[0]; st.sRoth = sp[1]; if (sp[2]) st.gRates = sp[2]; }
      const x = Array.isArray(o.cx) && o.cx[i];
      if (x){
        if (x.g) st.glide = x.g;
        if (x.m != null) st.mix = x.m;
        if (x.n) st.name = x.n;
      }
      return st;
    });
    buildStages();
  }
  if (o.q){
    const q = o.q;
    $("qAge").value = q[0]; $("qRetire").value = q[1];
    $("qSaved").value = groupDigits(q[2], true);
    $("qContrib").value = groupDigits(q[3], true);
    $("qPeriod").value = q[4];
    if (q[5]) $("qRisk").value = q[5];
  }
  if (o.tx) writeTaxState(o.tx);
  if (o.mo) writeMortState(o.mo);
  if (o.bg) writeBudgetState(o.bg);
  if (o.rc) writeRCState(o.rc);
  if (o.ts && o.ts.d && TOOL_PATHS[o.ts.k]) linkToolData(o.ts.k, o.ts.d);
  toolSub = TOOL_PATHS[o.sub] ? o.sub : "picker";
  linkTab = (o.t === "single" || o.t === "series" || o.t === "about" ||
             o.t === "tools" || o.t === "simple" || o.t === "guide") ? o.t : "simple";
  // Links made while the guide was still a tool open it as its own tab.
  if (o.t === "tools" && o.sub === "guide") linkTab = "guide";
  return true;
}
/* A shared link's copy of one tool's inputs, written into its fields. Only the
   fields: the page's startup draws whichever tool opens, and Healthcare and
   FIRE draw themselves once their own code has loaded (FIRE's mode switch
   waits until then too, since its button has no listener yet). */
var linkFireMode = null;
function linkToolData(tool, d){
  if (tool === "tax") writeTaxState(d);
  else if (tool === "mortgage") writeMortState(d);
  else if (tool === "budget") writeBudgetState(d);
  else if (tool === "college") writeCollegeState(d);
  else if (tool === "rentbuy") writeRBState(d);
  else if (tool === "drawdown"){ writeDDState(d); renderItemLists(); }
  else if (tool === "roth") writeRCState(d);
  else if (tool === "debt") writeDebtState(d);
  else if (tool === "backtest") writeBTState(d);
  else if (tool === "healthcare") writeAsideState("asideHC", d);
  else if (tool === "bridge") writeAsideState("asideBR", d);
  else if (tool === "optimizer") writeAsideState("asideOP", d);
  else if (tool === "fire"){ writeAsideState("asideFire", d); linkFireMode = d.mode || null; }
}
/* UTF-8 first, so a stage or debt named with an accent or an emoji still
   makes a link; older links were plain Latin-1 base64, which the fallback
   still reads. */
function encodeState(o){
  try { return btoa(unescape(encodeURIComponent(JSON.stringify(o)))).replace(/=+$/, ""); }
  catch(e){ return ""; }
}
function decodeState(str){
  const raw = str.replace(/-/g, "+").replace(/_/g, "/");
  try { return JSON.parse(decodeURIComponent(escape(atob(raw)))); } catch(e){}
  try { return JSON.parse(atob(raw)); } catch(e){ return null; }
}
function copyText(txt){
  if (navigator.clipboard && navigator.clipboard.writeText)
    return navigator.clipboard.writeText(txt);
  const ta = document.createElement("textarea");
  ta.value = txt; ta.style.position = "fixed"; ta.style.opacity = "0";
  document.body.appendChild(ta); ta.select();
  try { document.execCommand("copy"); } catch(e){}
  document.body.removeChild(ta);
  return Promise.resolve();
}
/* Short links. A full state runs to several thousand characters, nearly all
   of it defaults (the whole starter budget, every tool's untouched fields).
   So a #s= link carries only what differs from the page as it first loads,
   captured before any link or household profile is applied, and the page
   that opens it rebuilds the rest from its own identical copy. Objects are
   diffed key by key, same-length arrays index by index ({"~":length, i:...});
   "~x" marks a key that's gone. The open tool's data is diffed against that
   tool's own defaults, or sent as "=" when it's just a copy of one of the
   four tool states every link carries anyway. Old #p= links still open as
   before. */
let SHARE_BASE = null, SHARE_TOOLS = {};
const SHARE_DUP = {tax:"tx", mortgage:"mo", budget:"bg", roth:"rc"};
function shareBase(){
  try { SHARE_BASE = JSON.parse(JSON.stringify(currentState())); } catch(e){ SHARE_BASE = null; }
  Object.keys(TOOL_PATHS).forEach(k => {
    // The guide's data is the visitor's own answers, not a default.
    if (k === "guide") return;
    try { SHARE_TOOLS[k] = JSON.parse(JSON.stringify(buildToolData(k))); } catch(e){}
  });
}
const isObj = x => x !== null && typeof x === "object" && !Array.isArray(x);
function shareDiff(b, c){
  if (JSON.stringify(b) === JSON.stringify(c)) return undefined;
  if (isObj(b) && isObj(c)){
    const o = {};
    Object.keys(c).forEach(k => { const d = shareDiff(b[k], c[k]); if (d !== undefined) o[k] = d; });
    Object.keys(b).forEach(k => { if (!(k in c) && b[k] !== undefined) o[k] = "~x"; });
    return o;
  }
  if (Array.isArray(b) && Array.isArray(c) && b.length === c.length){
    const o = {"~": c.length};
    c.forEach((v, i) => { const d = shareDiff(b[i], v); if (d !== undefined) o[i] = d; });
    return o;
  }
  return c === undefined ? "~x" : c;
}
function sharePatch(b, d){
  if (d === undefined) return b;
  if (Array.isArray(b) && isObj(d) && "~" in d){
    const o = b.slice(0, d["~"]);
    Object.keys(d).forEach(k => { if (k !== "~") o[+k] = sharePatch(b[+k], d[k]); });
    return o;
  }
  if (isObj(b) && isObj(d)){
    const o = Object.assign({}, b);
    Object.keys(d).forEach(k => { if (d[k] === "~x") delete o[k]; else o[k] = sharePatch(b[k], d[k]); });
    return o;
  }
  return d;
}
function shareLink(){
  const cur = JSON.parse(JSON.stringify(currentState()));
  if (!SHARE_BASE) return "#p=" + encodeState(cur);
  const ts = cur.ts;
  delete cur.ts;
  const d = shareDiff(Object.assign({}, SHARE_BASE, {ts: undefined}), cur) || {};
  delete d.ts;
  if (ts) d.ts = {k: ts.k, d: SHARE_DUP[ts.k] && JSON.stringify(ts.d) === JSON.stringify(cur[SHARE_DUP[ts.k]]) ? "="
    : SHARE_TOOLS[ts.k] ? shareDiff(SHARE_TOOLS[ts.k], ts.d) || {} : ts.d};
  return "#s=" + encodeState(d).replace(/\+/g, "-").replace(/\//g, "_");
}
function shareOpen(str){
  const d = decodeState(str);
  if (!d || !SHARE_BASE) return null;
  const o = sharePatch(Object.assign({}, SHARE_BASE, {ts: undefined}), Object.assign({}, d, {ts: undefined}));
  delete o.ts;
  if (d.ts && d.ts.k) o.ts = {k: d.ts.k, d: d.ts.d === "=" ? o[SHARE_DUP[d.ts.k]]
    : SHARE_TOOLS[d.ts.k] ? sharePatch(SHARE_TOOLS[d.ts.k], d.ts.d) : d.ts.d};
  return o;
}
/* On a phone, a link goes out through the system share sheet rather than the
   clipboard. Sent that way, on its own, Messages and most chat apps show it
   as the site's preview card instead of a bare URL. The hash that carries
   the numbers never reaches the server, so the preview is always the same
   card. Cancelling the sheet does nothing; any other failure falls back to
   copying. */
function shareSheet(){
  try { return !!navigator.share && window.matchMedia("(pointer: coarse)").matches; } catch(e){ return false; }
}
function sendLink(url, copied){
  const copy = () => copyText(url).then(() => toast(copied))
    .catch(() => { prompt("Copy this link:", url); });
  if (!shareSheet()) return copy();
  navigator.share({url}).catch(err => { if (!err || err.name !== "AbortError") copy(); });
}
function doShare(){
  const link = shareLink(), url = location.origin + location.pathname + link;
  history.replaceState({t:chartMode.tab, s:toolSub}, "", link);
  sendLink(url, "Link copied; it opens with these exact numbers");
}

