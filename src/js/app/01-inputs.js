/* ---------- input plumbing ---------- */
const parseNum = s => { const v = parseFloat(String(s).replace(/,/g, "")); return isNaN(v) ? 0 : v; };
const num2 = parseNum;
const num = id => parseNum($(id).value);
const rate = id => num(id) / 100;
const blankOrNum = id => $(id).value.trim() === "" ? "" : parseNum($(id).value);

/* Group the integer part with commas, leave a trailing "." or decimals alone
   so typing "1250.5" isn't fought mid-keystroke. */
function groupDigits(raw, noNeg){
  let s = String(raw).replace(/[^0-9.\-]/g, "");
  const neg = !noNeg && s.startsWith("-");
  s = s.replace(/-/g, "");
  const dot = s.indexOf(".");
  let int = dot === -1 ? s : s.slice(0, dot);
  let dec = dot === -1 ? "" : "." + s.slice(dot + 1).replace(/\./g, "");
  int = int.replace(/^0+(?=\d)/, "");
  if (int) int = int.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return (neg ? "-" : "") + int + dec;
}
/* Keeps a partial entry usable while typing: a lone "-", a trailing ".", or an
   empty field all pass through untouched. */
function sanitizeNumeric(v, noNeg){
  let s = String(v).replace(/[^0-9.\-]/g, "");
  const neg = !noNeg && s.indexOf("-") === 0;
  s = s.replace(/-/g, "");
  const i = s.indexOf(".");
  if (i !== -1) s = s.slice(0, i + 1) + s.slice(i + 1).replace(/\./g, "");
  return (neg ? "-" : "") + s;
}
function formatMoneyField(el){
  const before = el.value;
  const caret = el.selectionStart;
  const digitsBefore = before.slice(0, caret).replace(/[^0-9.\-]/g, "").length;
  const after = groupDigits(before, el.hasAttribute("data-nonneg"));
  if (after === before) return;
  el.value = after;
  let seen = 0, pos = after.length;
  for (let i = 0; i < after.length; i++){
    if (/[0-9.\-]/.test(after[i])) seen++;
    if (seen === digitsBefore){ pos = i + 1; break; }
  }
  if (digitsBefore === 0) pos = 0;
  el.setSelectionRange(pos, pos);
}
/* Runs over a subtree so stage cards added later get the same behavior. The
   flags stop a second pass from double-binding fields that already have it. */
/* A "?" should never sit alone on a line. Each one is wrapped together with
   the word in front of it (or the "optional" tag) so a narrow column wraps
   the pair, not just the dot. Runs over a subtree, like initFields, so stage
   cards built later get it too; tooltip clicks are delegated, so moving the
   dot into the wrapper changes nothing else. */
function glueTipdots(root){
  root.querySelectorAll(".tipdot").forEach(t => {
    if (t.parentElement && t.parentElement.classList.contains("tipglue")) return;
    // Only ordinary text flow can strand the dot on a line of its own. In a
    // flex or grid container (the toggle buttons, panel headings) the text and
    // the dot are already separate items side by side, and splitting the last
    // word off would turn it into a third item: the space before it vanishes
    // and it no longer sits on the text's baseline.
    if (t.parentElement && /flex|grid/.test(getComputedStyle(t.parentElement).display)) return;
    const prev = t.previousSibling;
    const wrap = document.createElement("span");
    wrap.className = "tipglue";
    if (prev && prev.nodeType === 3){
      const m = prev.textContent.match(/^([\s\S]*?)(\S+\s*)$/);
      if (!m) return;
      prev.textContent = m[1];
      t.parentNode.insertBefore(wrap, t);
      wrap.appendChild(document.createTextNode(m[2]));
    } else if (prev && prev.nodeType === 1 && prev.tagName === "SPAN"){
      // the "optional" tag, or a label span whose text is set by code --
      // moving the span keeps its id, so those updates still land
      t.parentNode.insertBefore(wrap, t);
      wrap.appendChild(prev);
    } else return;
    wrap.appendChild(t);
  });
}
function initFields(root){
  glueTipdots(root);
  root.querySelectorAll("[data-money]").forEach(el => {
    if (!el._moneyBound){
      el._moneyBound = true;
      el.addEventListener("input", () => formatMoneyField(el));
      el.addEventListener("blur", () => {
        el.value = groupDigits(el.value, el.hasAttribute("data-nonneg"));
      });
    }
    el.value = groupDigits(el.value, el.hasAttribute("data-nonneg"));
  });

  /* Fields where a negative is meaningless. Block the key, and strip it on
     paste or drop. Bound before the render handlers so the value is already
     clean by the time anything reads it. */
  root.querySelectorAll("[data-nonneg]").forEach(el => {
    if (el._negBound) return;
    el._negBound = true;
    el.addEventListener("keydown", e => {
      if (e.key === "-" || e.key === "Subtract") e.preventDefault();
    });
    el.addEventListener("input", () => {
      if (el.value.indexOf("-") !== -1){
        let caret = null;
        try { caret = el.selectionStart; } catch(err){}
        el.value = el.value.replace(/-/g, "");
        if (caret !== null){
          try { el.setSelectionRange(Math.max(0, caret - 1), Math.max(0, caret - 1)); } catch(err){}
        }
      }
    });
  });
  /* Plain numeric fields. They're text inputs with inputmode="decimal" so phones
     raise the full keypad instead of the punctuation keyboard, which means the
     filtering and arrow-key stepping that type=number gave us are done here. */
  root.querySelectorAll("[data-num]").forEach(el => {
    if (el._numBound) return;
    el._numBound = true;
    const noNeg = el.hasAttribute("data-nonneg");
    el.addEventListener("input", () => {
      const clean = sanitizeNumeric(el.value, noNeg);
      if (clean !== el.value){
        let caret = null;
        try { caret = el.selectionStart; } catch(err){}
        el.value = clean;
        if (caret !== null){
          const p = Math.max(0, caret - 1);
          try { el.setSelectionRange(p, p); } catch(err){}
        }
      }
      /* If a max attribute is set and the entered value exceeds it,
         replace the field value with the max so the user sees the cap. */
      const maxAttr = el.getAttribute("max");
      if (maxAttr !== null){
        const maxV = parseFloat(maxAttr), cur = parseNum(el.value);
        if (!isNaN(maxV) && cur > maxV) el.value = String(maxV);
      }
    });
    el.addEventListener("keydown", e => {
      if (e.key !== "ArrowUp" && e.key !== "ArrowDown") return;
      if (el.readOnly) return;
      e.preventDefault();
      const step = parseFloat(el.getAttribute("data-step")) || 1;
      let v = parseNum(el.value) + (e.key === "ArrowUp" ? step : -step);
      if (noNeg) v = Math.max(0, v);
      const maxAttr2 = el.getAttribute("max");
      if (maxAttr2 !== null){ const maxV2 = parseFloat(maxAttr2); if (!isNaN(maxV2)) v = Math.min(maxV2, v); }
      el.value = String(Math.round(v * 1e6) / 1e6);
      el.dispatchEvent(new Event("input", {bubbles:true}));
    });
  });

  /* Focusing a field selects what's there, so typing replaces it. Saves a lot of
     fumbling on a phone. The mouseup guard stops the click that gave focus from
     immediately collapsing that selection back to a caret. */
  root.querySelectorAll("[data-money],[data-num]").forEach(el => {
    if (el._selBound) return;
    el._selBound = true;
    let armed = false;
    el.addEventListener("focus", () => {
      armed = true;
      setTimeout(() => {
        if (document.activeElement === el){ try { el.select(); } catch(err){} }
      }, 0);
    });
    el.addEventListener("mouseup", e => { if (armed){ e.preventDefault(); armed = false; } });
    el.addEventListener("blur", () => { armed = false; });
  });
}
initFields(document);

function readInputs(){
  const years = Math.min(100, num("years"));
  const glideOn = $("glideToggle").classList.contains("on");
  const p = {
    initial: num("initial"), contrib: num("contrib"), period: $("period").value,
    growth: rate("growth"), nominal: rate("nominal") - rate("fees"),
    inflation: rate("inflation"),
    years,
    withdrawal: rate("withdrawal"), taxRate: rate("taxrate"), vol: rate("volatility"),
    fees: rate("fees"), gross: rate("nominal"),
    glide: glideOn ? {
      on: true,
      endRate: rate("glideEnd") - rate("fees"),
      endRateGross: rate("glideEnd"),
      years: Math.min(years, Math.max(1, Math.round(num("glideYears"))))
    } : {on: false}
  };
  if (acOn()) applyAcct(p);
  return p;
}
function writeInputs(s){
  $("initial").value = groupDigits(s.initial, true); $("contrib").value = groupDigits(s.contrib);
  $("period").value = s.period; $("growth").value = +(s.growth * 100).toFixed(6);
  $("nominal").value = +(s.nominal * 100).toFixed(6);
  $("inflation").value = +(s.inflation * 100).toFixed(6);
  $("years").value = s.years;
  $("withdrawal").value = +(s.withdrawal * 100).toFixed(6);
  $("taxrate").value = +(s.taxRate * 100).toFixed(6);
  $("volatility").value = +((s.vol == null ? .15 : s.vol) * 100).toFixed(6);
  $("fees").value = +((s.fees == null ? 0 : s.fees) * 100).toFixed(6);
  if (s.gross != null) $("nominal").value = +(s.gross * 100).toFixed(6);
  const glideOn = !!(s.glide && s.glide.on);
  $("glideToggle").classList.toggle("on", glideOn);
  $("glideToggle").setAttribute("aria-expanded", String(glideOn));
  $("glideFields").hidden = !glideOn;
  $("glideEnd").value = glideOn ? +((s.glide.endRateGross != null ? s.glide.endRateGross : s.glide.endRate) * 100).toFixed(6) : "";
  $("glideYears").value = glideOn ? s.glide.years : "";
  updateGlideNote();
  // a hand-edited or imported file could carry a negative into one of these
  document.querySelectorAll("[data-nonneg]").forEach(el => {
    if (String(el.value).indexOf("-") !== -1) el.value = el.value.replace(/-/g, "");
  });
  // Anything saved before account types existed carries no acct, and loads
  // in the single-total mode it was saved in.
  writeAcct(s.acct);
}

