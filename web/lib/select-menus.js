/* eslint-disable @typescript-eslint/no-unused-vars -- moved as-is; its catch blocks name the error they ignore */
/* The site's own dropdown lists, drawn over native <select>s. Moved from
   src/js/app/19-widgets-theme.js with only the export and the run-once guard
   added. The <select> stays the source of truth (React's state reads its
   change events as usual); this only replaces the list it opens. */
let started = false;

/* ---------- dropdown menus ----------
   A native <select> stays the source of truth: its value, its options, its
   change events and every line that reads or writes it are untouched. Only
   the list it opens is ours, drawn like the Calculator menu: a card under
   the field on a wide screen, a sheet from the bottom on a phone. Opening is
   caught where a picker starts (a mouse press, a tap, the keys that open
   one); if anything here fails, the browser's own picker still opens. */
export function initSelectMenus(){
  if (started) return;
  started = true;
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
