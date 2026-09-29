/* ---------- CSV export ---------- */
/* Every on-screen table gets a download button in its panel heading. The tables
   are already the full dataset -- only the print sheet samples rows -- so what
   downloads is exactly what is on screen. */
function cellText(el){
  const c = el.cloneNode(true);
  // Tooltip dots are interface, not data.
  c.querySelectorAll(".tipdot").forEach(x => x.remove());
  return (c.textContent || "").replace(/\s+/g, " ").trim();
}
/* A heading can carry a subtitle and a whole segmented control; neither
   belongs in a filename. */
/* Several headings have their text rewritten as results come in. Assigning
   textContent would take the CSV button (and any segmented control) with it,
   so only the heading's own text node gets replaced. */
function setH2Text(el, text){
  let n = el.firstChild;
  while (n && n.nodeType !== 3) n = n.nextSibling;
  if (n) n.nodeValue = text;
  else el.insertBefore(document.createTextNode(text), el.firstChild);
}
function headingText(h2){
  const c = h2.cloneNode(true);
  c.querySelectorAll(".tipdot,.h2note,.h2ctrl").forEach(x => x.remove());
  return (c.textContent || "").replace(/\s+/g, " ").trim();
}
/* Half the tools have a panel called "Year by year", so the tool name has to
   be part of the filename or every download collides in the same folder. */
function csvScope(){
  return activeTool();
}
function csvEscape(v){
  return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v;
}
function tableToCSV(tbl){
  const lines = [];
  tbl.querySelectorAll("tr").forEach(tr => {
    const cells = tr.querySelectorAll("th,td");
    if (!cells.length) return;
    const out = [];
    cells.forEach(c => out.push(csvEscape(cellText(c))));
    lines.push(out.join(","));
  });
  return lines.join("\r\n");
}
function slugify(t){
  return (t || "table").toLowerCase().replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "").slice(0, 48) || "table";
}
function downloadCSV(tbl, name){
  const body = tbl.querySelector("tbody");
  if (body && !body.querySelector("tr")){ toast("Nothing to export yet"); return; }
  // The BOM is what makes Excel open UTF-8 correctly on Windows.
  const blob = new Blob(["\ufeff" + tableToCSV(tbl)], {type:"text/csv;charset=utf-8"});
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "retcalc-" + slugify(csvScope()) + "-" + slugify(name) + ".csv";
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  toast("Saved " + a.download);
}
function initCSVButtons(){
  document.querySelectorAll(".panel table").forEach(tbl => {
    if (!tbl.querySelector("tbody")) return;
    const panel = tbl.closest(".panel");
    if (!panel) return;
    const h2 = panel.querySelector(":scope > h2");
    let host;
    if (h2){
      host = h2.querySelector(".h2ctrl");
      if (!host){ host = document.createElement("span"); host.className = "h2ctrl"; h2.appendChild(host); }
    } else {
      host = document.createElement("div");
      host.className = "csvbar";
      panel.insertBefore(host, tbl.closest(".scroll") || tbl);
    }
    if (host.querySelector(".csvbtn")) return;   // one button per panel
    const label = h2 ? headingText(h2) : "table";
    const b = document.createElement("button");
    b.type = "button"; b.className = "btn mini csvbtn";
    b.textContent = "CSV";
    b.title = "Download this table as a CSV";
    b.setAttribute("aria-label", "Download " + label + " as CSV");
    b.addEventListener("click", () => downloadCSV(tbl, label));
    host.appendChild(b);
  });
}
initCSVButtons();

function tipFor(key){ return GLOSS[key] || ""; }
(function(){
  let openDot = null, sheet = null;
  const box = () => $("tipbox");
  /* On a phone the explanation opens as a sheet from the bottom, like the
     dropdowns: the field's name on top, the whole text at a readable size,
     scrollable if it's long, and closed with the button, the dimmed page or
     Escape. The hover box stays for a mouse. */
  const phone = () => { try { return window.matchMedia("(max-width:640px)").matches; } catch(e){ return false; } };
  /* The sheet's title is the label the "?" belongs to: only the text that
     comes before the dot in its label, heading or row name, so a note or
     figure printed after it (Coast FIRE's status line, say) stays out, and
     the "optional" pill is dropped. */
  function titleOf(dot){
    // A "?" with no label of its own (after a row of buttons) names itself.
    if (dot.getAttribute("data-tip-title")) return dot.getAttribute("data-tip-title");
    let box = dot.closest("label, h2, h3, h4, th, dt, .k, .optlabel, .gd-h3, .acgroup") || dot.parentElement;
    if (box && box.classList.contains("tipglue")) box = box.parentElement;
    if (!box) return "";
    let t = "";
    try {
      const r = document.createRange();
      r.setStart(box, 0); r.setEndBefore(dot);
      const f = r.cloneContents();
      f.querySelectorAll(".tipdot,.opt,.beta,.about-chevron,.mssub,.h2note").forEach(x => x.remove());
      t = f.textContent;
    } catch(e){ t = ""; }
    return t.replace(/\s+/g, " ").replace(/[\s:]+$/, "").trim().slice(0, 80);
  }
  function closeSheet(){
    if (!sheet) return;
    sheet.m.remove(); sheet.scrim.remove(); sheet.dot.classList.remove("on");
    sheet = null;
  }
  function openSheet(dot, txt){
    closeSheet();
    const scrim = document.createElement("div"); scrim.className = "selscrim";
    const m = document.createElement("div");
    m.className = "selmenu sheet tipsheet";
    m.setAttribute("role", "dialog"); m.setAttribute("aria-modal", "true");
    const h = document.createElement("div"); h.className = "selmenu-h";
    const t = document.createElement("span"); t.textContent = titleOf(dot) || "What this means";
    const x = document.createElement("button");
    x.type = "button"; x.className = "tipsheet-x"; x.setAttribute("aria-label", "Close");
    x.innerHTML = '<svg viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>';
    h.appendChild(t); h.appendChild(x);
    const b = document.createElement("p"); b.className = "tipsheet-b"; b.textContent = txt;
    m.setAttribute("aria-label", t.textContent);
    m.appendChild(h); m.appendChild(b);
    document.body.appendChild(scrim); document.body.appendChild(m);
    scrim.addEventListener("click", closeSheet);
    x.addEventListener("click", closeSheet);
    dot.classList.add("on");
    sheet = {m, scrim, dot};
    try { x.focus({preventScroll:true}); } catch(e){}
  }
  document.addEventListener("keydown", e => { if (e.key === "Escape" && sheet) closeSheet(); });
  function place(dot){
    const b = box(), r = dot.getBoundingClientRect();
    b.classList.add("on");
    const bw = b.offsetWidth, bh = b.offsetHeight;
    let left = r.left + r.width / 2 - bw / 2;
    left = Math.max(8, Math.min(left, window.innerWidth - bw - 8));
    let top = r.top - bh - 10;
    if (top < 8) top = r.bottom + 10;
    b.style.left = left + "px";
    b.style.top = top + "px";
  }
  function show(dot){
    const key = dot.getAttribute("data-tip");
    const txt = tipFor(key);
    if (!txt) return;
    box().textContent = txt;
    dot.classList.add("on");
    place(dot);
    openDot = dot;
  }
  function hide(){
    box().classList.remove("on");
    if (openDot) openDot.classList.remove("on");
    openDot = null;
  }
  document.addEventListener("mouseover", e => {
    const d = e.target.closest ? e.target.closest(".tipdot") : null;
    if (d && !phone()) show(d);
  });
  document.addEventListener("mouseout", e => {
    const d = e.target.closest ? e.target.closest(".tipdot") : null;
    if (d && d === openDot) hide();
  });
  // touch: tap to open, tap anywhere to close
  document.addEventListener("click", e => {
    const d = e.target.closest ? e.target.closest(".tipdot") : null;
    if (d && phone()){
      e.preventDefault(); hide();
      const txt = tipFor(d.getAttribute("data-tip"));
      if (txt) openSheet(d, txt);
      return;
    }
    if (d){ if (d === openDot) hide(); else show(d); e.preventDefault(); }
    else if (openDot) hide();
  });
  window.addEventListener("scroll", () => { if (openDot) hide(); }, true);
})();


/* ---------- readout tween ----------
   The headline figures were the only thing in the app that changed with no
   motion at all, which made the one element everything else is arranged
   around the least alive. Rather than thread a setter through every render
   path, this watches the readout nodes and animates whatever lands in them.
   A change arrives as a finished string; it's parsed back into prefix,
   number and suffix, counted from the value on screen, then committed
   verbatim so the displayed text is always exactly what the renderer wrote. */
const TWEEN_SEL = ".headline .v, .solveopt > .v";
const TWEEN_RE = /^([^\d]*)(\d[\d,]*(?:\.\d+)?)([\s\S]*)$/;
const TWEEN_MS = 240;
function tweenFormat(v, sample){
  const dot = sample.indexOf(".");
  const dec = dot < 0 ? 0 : sample.length - dot - 1;
  let out = v.toFixed(dec);
  if (sample.indexOf(",") >= 0){
    const parts = out.split(".");
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    out = parts.join(".");
  }
  return out;
}
function tweenTo(el){
  const cur = el.textContent;
  if (cur === el._twLast) return;            // our own frame, not a new value
  const m = TWEEN_RE.exec(cur);
  const from = el._twShown;
  const commit = () => {
    el._twLast = null;
    el._twShown = m ? parseFloat(m[2].replace(/,/g, "")) : null;
    el._twPre = m ? m[1] : null;
  };
  if (el._twRaf){ cancelAnimationFrame(el._twRaf); el._twRaf = 0; }
  // No previous number, a changed prefix (a sign flip, a different unit), or
  // an offscreen pane: nothing worth animating between.
  if (!m || from == null || el._twPre !== m[1] || el.offsetParent === null){
    commit(); return;
  }
  const to = parseFloat(m[2].replace(/,/g, ""));
  if (!isFinite(to) || to === from){ commit(); return; }
  const t0 = performance.now();
  const step = now => {
    const k = Math.min(1, (now - t0) / TWEEN_MS);
    const e = 1 - Math.pow(1 - k, 3);
    if (k < 1){
      const txt = m[1] + tweenFormat(from + (to - from) * e, m[2]) + m[3];
      el._twLast = txt;
      el.textContent = txt;
      el._twRaf = requestAnimationFrame(step);
    } else {
      el._twRaf = 0;
      el._twLast = cur;
      el.textContent = cur;                  // land on the renderer's own string
      el._twShown = to;
      el._twPre = m[1];
      el._twLast = null;
    }
  };
  el._twRaf = requestAnimationFrame(step);
}
/* Every figure recomputes as you type, and none of it was announced. The
   region is debounced well past a keystroke so it reports where the numbers
   settled rather than narrating each one on the way there. */
let liveTimer = 0;
function announceReadout(){
  const head = Array.prototype.filter.call(
    document.querySelectorAll("#main .headline"), el => el.offsetParent !== null)[0];
  if (!head) return;
  const parts = [];
  head.querySelectorAll(":scope > div").forEach(d => {
    const k = d.querySelector(".k"), v = d.querySelector(".v");
    const t = v ? v.textContent.trim() : "";
    if (k && t && t !== "\u2014" && t !== "--")
      parts.push(k.textContent.trim() + ": " + t);
  });
  if (parts.length) $("srLive").textContent = parts.join(". ");
}
function scheduleAnnounce(){
  clearTimeout(liveTimer);
  liveTimer = setTimeout(announceReadout, 700);
}

function initValueTween(){
  let reduce = false;
  try { reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches; } catch(e){}
  if (reduce || typeof MutationObserver === "undefined") return;
  document.querySelectorAll(TWEEN_SEL).forEach(el => {
    const m = TWEEN_RE.exec(el.textContent);
    el._twShown = m ? parseFloat(m[2].replace(/,/g, "")) : null;
    el._twPre = m ? m[1] : null;
  });
  const obs = new MutationObserver(muts => {
    const hit = [];
    muts.forEach(mu => {
      let n = mu.target;
      if (n.nodeType !== 1) n = n.parentNode;
      if (!n || !n.closest) return;
      const el = n.closest(TWEEN_SEL);
      if (el && hit.indexOf(el) < 0) hit.push(el);
    });
    hit.forEach(tweenTo);
    if (hit.length) scheduleAnnounce();
  });
  obs.observe(document.getElementById("main"),
    {subtree:true, childList:true, characterData:true});
}
/* Under reduced motion initValueTween returns before installing anything, so
   the live region gets its own observer rather than riding along with it. */
/* The rail's parked state drives both the notch strip and a slightly deeper
   shadow, so it reads as lifted off the page only once it's actually over it. */
function initStickyRail(){
  const nb = document.querySelector(".navbar");
  const cover = document.getElementById("sbCover");
  if (!nb) return;
  let queued = false;
  const check = () => {
    queued = false;
    // The sticky offset is var(--sb-clear), not always 0 (see the .navbar
    // rule), so "pinned" has to be checked against that same offset rather
    // than a hardcoded 0.
    const off = parseFloat(getComputedStyle(nb).top) || 0;
    const stuck = nb.getBoundingClientRect().top <= off + 0.5;
    nb.classList.toggle("stuck", stuck);
    if (cover) cover.classList.toggle("stuck", stuck);
  };
  window.addEventListener("scroll", () => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(check);
  }, {passive:true});
  check();
}

/* The Guide's pinned progress card: the same parked check as the rail, and
   its height published as --gd-stick for whatever has to clear it. */
function initGuideStick(){
  const el = document.querySelector(".gd-top");
  if (!el) return;
  const root = document.documentElement, nb = document.querySelector(".navbar");
  const size = () => {
    root.style.setProperty("--gd-stick", el.offsetHeight ? el.offsetHeight + 10 + "px" : "0px");
    if (nb && nb.offsetHeight) root.style.setProperty("--rail-h", nb.offsetHeight + "px");
  };
  if (typeof ResizeObserver !== "undefined"){
    const ro = new ResizeObserver(size);
    ro.observe(el);
    if (nb) ro.observe(nb);
  }
  size();
  let queued = false;
  const check = () => {
    queued = false;
    const off = parseFloat(getComputedStyle(el).top) || 0;
    el.classList.toggle("stuck", !!el.offsetHeight && el.getBoundingClientRect().top <= off + 1);
  };
  window.addEventListener("scroll", () => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(check);
  }, {passive:true});
  check();
}

/* ---------- dropdown menus ----------
   A native <select> stays the source of truth: its value, its options, its
   change events and every line that reads or writes it are untouched. Only
   the list it opens is ours, drawn like the Calculator menu: a card under
   the field on a wide screen, a sheet from the bottom on a phone. Opening is
   caught where a picker starts (a mouse press, a tap, the keys that open
   one); if anything here fails, the browser's own picker still opens. */
function initSelectMenus(){
  let cur = null, typed = "", typedAt = 0, touch = null;
  const narrow = () => { try { return window.matchMedia("(max-width:640px)").matches; } catch(e){ return false; } };
  const usable = el => !!el && el.tagName === "SELECT" && !el.multiple && !(el.size > 1) &&
    !el.disabled && !el.closest("#sheet");
  const hold = el => { try { el.focus({preventScroll:true}); } catch(e){ el.focus(); } };
  function titleFor(sel){
    let l = sel.id ? document.querySelector('label[for="' + sel.id + '"]') : null;
    if (!l){ const f = sel.closest(".field,.formfield"); l = f ? f.querySelector("label") : null; }
    const t = (l ? l.textContent : "") || sel.getAttribute("aria-label") || "";
    return t.replace(/\?/g, "").replace(/\s+/g, " ").trim();
  }
  function item(o){
    const b = document.createElement("button");
    b.type = "button"; b.className = "selmenu-i"; b.setAttribute("role", "option");
    b.dataset.i = o.index;
    b.setAttribute("aria-selected", o.selected ? "true" : "false");
    if (o.disabled) b.disabled = true;
    // "Balanced · a mix of stocks and bonds" reads as a name and a line under it
    const parts = o.text.split(" · ");
    const n = document.createElement("span"); n.className = "n"; n.textContent = parts[0];
    b.appendChild(n);
    if (parts.length > 1){
      const d = document.createElement("span"); d.className = "d";
      d.textContent = parts.slice(1).join(" · "); b.appendChild(d);
    }
    return b;
  }
  function build(sel){
    const m = document.createElement("div");
    m.className = "selmenu"; m.setAttribute("role", "listbox"); m.tabIndex = -1;
    const t = titleFor(sel);
    if (t) m.setAttribute("aria-label", t);
    if (narrow()){
      m.classList.add("sheet");
      const h = document.createElement("div"); h.className = "selmenu-h"; h.textContent = t || "Choose one";
      m.appendChild(h);
    }
    Array.prototype.forEach.call(sel.children, c => {
      if (c.tagName === "OPTGROUP"){
        const g = document.createElement("div"); g.className = "selmenu-g"; g.textContent = c.label;
        m.appendChild(g);
        Array.prototype.forEach.call(c.children, o => { if (!o.hidden) m.appendChild(item(o)); });
      } else if (c.tagName === "OPTION" && !c.hidden) m.appendChild(item(c));
    });
    return m;
  }
  // Under the field, or over it when there's more room above; never off screen.
  function place(){
    if (!cur || cur.sheet) return;
    const r = cur.sel.getBoundingClientRect(), m = cur.menu;
    if (r.bottom < 0 || r.top > window.innerHeight){ close(false); return; }
    m.style.minWidth = Math.max(180, r.width) + "px";
    const below = window.innerHeight - r.bottom - 12, above = r.top - 12;
    const up = below < 220 && above > below;
    m.style.maxHeight = Math.max(120, Math.min(380, up ? above : below)) + "px";
    m.classList.toggle("up", up);
    m.style.top = up ? "auto" : (r.bottom + 6) + "px";
    m.style.bottom = up ? (window.innerHeight - r.top + 6) + "px" : "auto";
    m.style.left = Math.max(8, Math.min(r.left, window.innerWidth - m.offsetWidth - 8)) + "px";
  }
  function focusItem(b){
    if (!b || !cur) return;
    cur.menu.querySelectorAll(".selmenu-i.act").forEach(x => x.classList.remove("act"));
    b.classList.add("act"); hold(b);
    const m = cur.menu, top = b.offsetTop, bot = top + b.offsetHeight;
    if (top < m.scrollTop + 40) m.scrollTop = Math.max(0, top - 40);
    else if (bot > m.scrollTop + m.clientHeight - 6) m.scrollTop = bot - m.clientHeight + 6;
  }
  function open(sel, touched){
    if (cur){ const same = cur.sel === sel; close(false); if (same) return; }
    const m = build(sel), sheet = m.classList.contains("sheet");
    let scrim = null;
    if (sheet){
      scrim = document.createElement("div"); scrim.className = "selscrim";
      scrim.addEventListener("click", () => close(true));
      document.body.appendChild(scrim);
    }
    document.body.appendChild(m);
    cur = {sel, menu:m, scrim, sheet, touched:!!touched};
    sel.setAttribute("aria-expanded", "true");
    place();
    const on = m.querySelector('.selmenu-i[aria-selected="true"]') || m.querySelector(".selmenu-i:not(:disabled)");
    if (on){ m.scrollTop = Math.max(0, on.offsetTop - m.clientHeight / 2 + on.offsetHeight / 2); focusItem(on); }
    m.addEventListener("click", e => {
      const b = e.target.closest(".selmenu-i");
      if (b && !b.disabled) choose(+b.dataset.i);
    });
    m.addEventListener("keydown", onKey);
  }
  function close(refocus){
    if (!cur) return;
    const c = cur; cur = null;
    c.sel.removeAttribute("aria-expanded");
    c.menu.remove();
    if (c.scrim) c.scrim.remove();
    // Focus goes back to the field for keyboard users. Not after a tap: on
    // iOS, focusing a <select> opens the system picker right after ours.
    if (refocus && !c.touched) hold(c.sel);
  }
  function choose(i){
    const sel = cur.sel;
    close(true);
    if (sel.selectedIndex === i) return;
    sel.selectedIndex = i;
    sel.dispatchEvent(new Event("input", {bubbles:true}));
    sel.dispatchEvent(new Event("change", {bubbles:true}));
  }
  function onKey(e){
    const items = Array.prototype.filter.call(cur.menu.querySelectorAll(".selmenu-i"), b => !b.disabled);
    const at = items.indexOf(document.activeElement);
    const go = k => { e.preventDefault(); focusItem(items[Math.max(0, Math.min(items.length - 1, k))]); };
    if (e.key === "ArrowDown") go(at + 1);
    else if (e.key === "ArrowUp") go(at - 1);
    else if (e.key === "Home") go(0);
    else if (e.key === "End") go(items.length - 1);
    else if (e.key === "PageDown") go(at + 8);
    else if (e.key === "PageUp") go(at - 8);
    else if (e.key === "Escape" || e.key === "Tab"){ e.preventDefault(); close(true); }
    else if (e.key === "Enter" || e.key === " "){ e.preventDefault(); if (at >= 0) choose(+items[at].dataset.i); }
    else if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey){
      // type to jump, as a native list does
      const now = Date.now();
      typed = (now - typedAt > 700 ? "" : typed) + e.key.toLowerCase(); typedAt = now;
      const starts = b => b.textContent.trim().toLowerCase().indexOf(typed) === 0;
      const hit = items.find((b, k) => k > at && starts(b)) || items.find(starts);
      if (hit){ e.preventDefault(); focusItem(hit); }
    }
  }
  document.addEventListener("mousedown", e => {
    if (cur && !cur.menu.contains(e.target) && e.target !== cur.sel) close(false);
    const sel = e.target.closest ? e.target.closest("select") : null;
    if (e.button !== 0 || !usable(sel)) return;
    e.preventDefault();
    hold(sel);
    open(sel);
  });
  // A tap (not a drag that starts on the field) opens ours instead of the
  // system picker; cancelling the touch's end stops the picker from opening.
  document.addEventListener("touchstart", e => {
    const t = e.touches[0];
    touch = t ? {x:t.clientX, y:t.clientY, at:Date.now(), el:e.target} : null;
  }, {passive:true});
  document.addEventListener("touchend", e => {
    const t0 = touch; touch = null;
    const sel = e.target.closest ? e.target.closest("select") : null;
    if (!t0 || t0.el !== e.target || !usable(sel)) return;
    const t = e.changedTouches[0];
    if (!t || Math.abs(t.clientX - t0.x) > 10 || Math.abs(t.clientY - t0.y) > 10 || Date.now() - t0.at > 800) return;
    e.preventDefault();
    open(sel, true);
  }, {passive:false});
  document.addEventListener("keydown", e => {
    if (cur || !usable(e.target) || e.ctrlKey || e.metaKey) return;
    const k = e.key;
    if (k === "Enter" || k === " " || k === "F4" || k === "ArrowDown" || k === "ArrowUp"){
      e.preventDefault(); open(e.target);
    }
  });
  window.addEventListener("resize", () => { if (cur && !cur.sheet) close(false); });
  document.addEventListener("scroll", e => {
    if (cur && !cur.sheet && !cur.menu.contains(e.target)) requestAnimationFrame(place);
  }, {capture:true, passive:true});
}

/* ---------- footer ----------
   Its links are the tabs themselves, pressed for you, then back to the top.
   The disclaimer link opens About at its last section. */
function initFooter(){
  const top = () => { try { window.scrollTo({top:0, behavior:"smooth"}); } catch(e){ window.scrollTo(0, 0); } };
  document.querySelectorAll(".sitefoot-nav [data-foot]").forEach(b => b.addEventListener("click", () => {
    const k = b.getAttribute("data-foot");
    // Calculator's own tab opens its mode menu on a touch screen; the footer
    // goes straight to the mode you were last on instead.
    if (k === "calc"){
      const t = calcLastMode();
      if (t !== chartMode.tab){ paneDir = "tab"; showTab(t); pushNav(); }
    } else {
      const tab = $("tabbtn-" + k);
      if (tab && tab.getAttribute("aria-selected") !== "true") tab.click();
    }
    top();
  }));
  $("footDisclaimer").addEventListener("click", () => {
    $("tabbtn-about").click();
    setTimeout(() => {
      const d = document.querySelector(".panel.about.disclaimer");
      if (d) try { d.scrollIntoView({behavior:"smooth", block:"start"}); } catch(e){ d.scrollIntoView(); }
    }, 60);
  });
}

function initLiveRegion(){
  if (typeof MutationObserver === "undefined") return;
  const obs = new MutationObserver(scheduleAnnounce);
  obs.observe(document.getElementById("main"),
    {subtree:true, childList:true, characterData:true});
}

/* ---------- theme ---------- */
const THEME_KEY = "retcalc-theme";
let themeStored = "system";
const THEME_ICON = {
  sun:'<svg viewBox="0 0 20 20" fill="none" aria-hidden="true"><circle cx="10" cy="10" r="3.6" stroke="currentColor" stroke-width="1.7"/><g stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><path d="M10 1.6v2.2M10 16.2v2.2M18.4 10h-2.2M3.8 10H1.6M15.94 4.06l-1.56 1.56M5.62 14.38l-1.56 1.56M15.94 15.94l-1.56-1.56M5.62 5.62L4.06 4.06"/></g></svg>',
  moon:'<svg viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="M16.5 12.4A7 7 0 017.6 3.5a7 7 0 108.9 8.9z" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/></svg>'
};
const THEME_META = {dark:"#080b16", light:"#eceef4"};
function resolvedTheme(stored){
  if (stored !== "system") return stored;
  return (window.matchMedia && window.matchMedia("(prefers-color-scheme: light)").matches)
    ? "light" : "dark";
}
function applyTheme(stored){
  const eff = resolvedTheme(stored);
  document.documentElement.setAttribute("data-theme", eff);
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", THEME_META[eff] || THEME_META.dark);
  // Native form controls (checkboxes, scrollbars) render using this rather
  // than the page's own CSS, so it has to track the theme too -- otherwise
  // an unchecked checkbox keeps its dark-mode appearance in light mode.
  const scheme = document.querySelector('meta[name="color-scheme"]');
  if (scheme) scheme.setAttribute("content", eff);
  themeStored = stored;
  document.querySelectorAll("#segTheme button").forEach(b =>
    b.classList.toggle("on", b.getAttribute("data-theme") === stored));
  /* The masthead button flips to whichever theme isn't showing; the three-way
     switch in About still owns the System option, and both read the same
     stored value so they can't disagree. */
  const tb = $("btnTheme");
  if (tb){
    const goingLight = (eff === "dark");
    tb.innerHTML = goingLight ? THEME_ICON.sun : THEME_ICON.moon;
    const lbl = goingLight ? "Switch to light theme" : "Switch to dark theme";
    tb.setAttribute("aria-label", lbl);
    tb.setAttribute("title", lbl);
  }
  if (!$("tab-simple").hidden) renderBasic();
  else if (!$("tab-single").hidden){ if (lastRun) drawChart(lastRun, readInputs()); }
  else if (!$("tab-series").hidden) renderSeries();
}
function initTheme(){
  let stored = "system";
  try { const v = localStorage.getItem(THEME_KEY);
    if (v === "light" || v === "dark" || v === "system") stored = v; }
  catch(e){}
  applyTheme(stored);
}
$("btnTheme").addEventListener("click", () => {
  const next = resolvedTheme(themeStored) === "dark" ? "light" : "dark";
  applyTheme(next);
  try { localStorage.setItem(THEME_KEY, next); } catch(e){}
});
$("segTheme").addEventListener("click", e => {
  const b = e.target.closest ? e.target.closest("button[data-theme]") : null;
  if (!b) return;
  const stored = b.getAttribute("data-theme");
  applyTheme(stored);
  try { localStorage.setItem(THEME_KEY, stored); } catch(e){}
});

/* Collapses every About section except Appearance, What this is, and
   Disclaimer, so the tab reads as a list of topics instead of a long page
   to scroll through. Adds a chevron to each collapsible heading and toggles
   on click; built generically off the existing panel/h2/body structure
   rather than touching each section's markup individually. */
/* Sweeps a section open or shut by animating the wrapper's height between 0
   and its measured content height. The .collapsed class flips immediately so
   the chevron turns with the click; an inline display:block keeps the section
   on screen while it closes, and both inline styles are cleared at the end so
   the resting collapsed state is plain display:none again. */
const ABOUT_SWEEP = 300;
function toggleAbout(p){
  const wrap = p.querySelector(":scope > .about-collapse");
  if (!wrap){ p.classList.toggle("collapsed"); return; }
  let reduce = false;
  try { reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches; } catch(e){}
  if (reduce){ p.classList.toggle("collapsed"); return; }
  // Mid-sweep clicks reverse from wherever the height currently sits rather
  // than from the full-open or fully-shut value, so a fast double-click
  // doesn't jump.
  const from = wrap.getBoundingClientRect().height;
  if (wrap._aboutDone) wrap._aboutDone();
  const opening = p.classList.contains("collapsed");
  p.classList.toggle("collapsed", !opening);
  wrap.style.display = "block";
  wrap.style.transition = "none";
  wrap.style.height = "auto";
  const full = wrap.scrollHeight;
  wrap.style.height = from + "px";
  void wrap.offsetHeight;
  wrap.style.transition = "height " + (ABOUT_SWEEP/1000) + "s cubic-bezier(.25,.8,.3,1)";
  wrap.style.height = (opening ? full : 0) + "px";
  const done = () => {
    clearTimeout(wrap._aboutTimer);
    wrap.removeEventListener("transitionend", done);
    wrap._aboutDone = null;
    wrap.style.transition = "";
    wrap.style.height = "";
    wrap.style.display = "";
  };
  wrap._aboutDone = done;
  // transitionend can be skipped if the element is hidden mid-sweep (tab
  // change), so the cleanup is also on a timer.
  wrap._aboutTimer = setTimeout(done, ABOUT_SWEEP + 60);
  wrap.addEventListener("transitionend", done);
}

function initAboutCollapse(){
  const panels = document.querySelectorAll(".panel.about:not(.no-collapse):not(.disclaimer)");
  panels.forEach(p => {
    const h2 = p.querySelector("h2");
    if (!h2 || h2.querySelector(".about-chevron")) return;
    const chev = document.createElement("span");
    chev.className = "about-chevron";
    chev.innerHTML = '<svg width="14" height="14" viewBox="0 0 16 16" fill="none">' +
      '<path d="M5 6l3 3 3-3" stroke="currentColor" stroke-width="1.6" ' +
      'stroke-linecap="round" stroke-linejoin="round"/></svg>';
    h2.appendChild(chev);
    const body = p.querySelector(":scope > .body");
    if (body){
      const wrap = document.createElement("div");
      wrap.className = "about-collapse";
      p.insertBefore(wrap, body);
      wrap.appendChild(body);
    }
    p.classList.add("collapsed");
    h2.addEventListener("click", () => toggleAbout(p));
  });
}
if (window.matchMedia){
  window.matchMedia("(prefers-color-scheme: light)").addEventListener("change", function(){
    let stored = "system";
    try { const v = localStorage.getItem(THEME_KEY); if (v) stored = v; } catch(e){}
    if (stored === "system") applyTheme("system");
  });
}

