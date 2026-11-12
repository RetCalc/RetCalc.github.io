import puppeteer from 'puppeteer-core';
// THEME=dark captures the site in dark mode into shots/crops-dark (same file
// names), for the decks; the default is light into shots/crops, for the PDFs.
// BASE points the captures at another copy of the site (default retcalc.app).
export const THEME = process.env.THEME === 'dark' ? 'dark' : 'light';
export const CROPS = new URL(THEME === 'dark' ? '../shots/crops-dark/' : '../shots/crops/', import.meta.url).pathname;
(await import('fs')).mkdirSync(CROPS, { recursive: true });
export const BASE = process.env.BASE || 'https://retcalc.app';
// Each crop's visible text goes to ../.preview/capture/texts-<theme>.jsonl ({file, text}),
// which captures.py reads to write shots/CAPTURES.md (the figures each crop shows).
const TEXTDIR = new URL('../.preview/capture/', import.meta.url).pathname;
(await import('fs')).mkdirSync(TEXTDIR, { recursive: true });
import fs from 'fs';
export function rec(file, text){ fs.appendFileSync(`${TEXTDIR}texts-${THEME}.jsonl`, JSON.stringify({file, text:(text||'').replace(/[ \t]*\n[ \t\n]*/g,' | ').slice(0,2500)})+'\n'); }
export const sleep = ms => new Promise(s=>setTimeout(s,ms));
export async function open(theme=THEME){
  const browser = await puppeteer.launch({executablePath:(process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'), headless:true});
  const page = await browser.newPage();
  await page.setViewport({width:1440,height:900,deviceScaleFactor:2});
  await page.evaluateOnNewDocument(t=>{try{localStorage.setItem('retcalc.theme.v1',JSON.stringify(t))}catch(e){}}, theme);
  return {browser,page};
}
export const share=(id,d)=>'#s='+Buffer.from(JSON.stringify({t:id,d})).toString('base64').replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
export async function go(page, route, id, data){
  await page.goto('about:blank');
  await page.goto(BASE+route+(id?share(id,data):''),{waitUntil:'networkidle0',timeout:60000});
  await sleep(2500);
}
// click the first visible button/role=tab etc whose trimmed text equals txt (within optional card heading scope)
export async function click(page, txt, scope){
  const ok = await page.evaluate((txt,scope)=>{
    let root=document;
    if(scope){root=[...document.querySelectorAll('[data-slot="card"]')].find(c=>c.textContent.includes(scope))||document}
    const el=[...root.querySelectorAll('button,[role="tab"],[role="radio"],a,label')].find(e=>e.textContent.trim()===txt && e.offsetParent!==null);
    if(el){el.scrollIntoView({block:'center'}); el.click(); return true} return false;
  },txt,scope);
  if(!ok) console.log('  ! no click target', txt);
  await sleep(1500);
}
// screenshot the card whose text starts-with/contains heading, padded
export async function card(page, heading, file, pad=16, idx=0){
  await unstick(page);
  const box = await page.evaluate((h,idx)=>{
    const cs=[...document.querySelectorAll('[data-slot="card"], .panel')].filter(c=>{const t=c.getBoundingClientRect();return t.width>0 && (c.querySelector('h1,h2,h3,h4,[data-slot="card-title"]')?.textContent.trim().startsWith(h) || c.textContent.trim().startsWith(h))});
    const c=cs[idx]; if(!c) return null; const b=c.getBoundingClientRect(); return {x:b.x+scrollX,y:b.y+scrollY,width:b.width,height:b.height,text:c.innerText};
  },heading,idx);
  if(!box){console.log('  ! no card', heading); return}
  await page.screenshot({path:`${CROPS}${file}.png`, clip:{x:box.x-pad,y:box.y-pad,width:box.width+2*pad,height:box.height+2*pad}, captureBeyondViewport:true});
  rec(file, box.text);
  console.log('  card', file, Math.round(box.width)+'x'+Math.round(box.height));
}
export async function view(page, file, y=0, h=900){
  // from the top, with no focus ring or "Skip to content" link showing
  await page.evaluate(()=>{document.activeElement?.blur(); for(const a of document.querySelectorAll('a')) if(a.textContent.trim()==='Skip to content') a.style.display='none'; window.scrollTo(0,0)}); await sleep(400);
  await page.screenshot({path:`${CROPS}${file}.png`, clip:{x:0,y,width:1440,height:h}, captureBeyondViewport:true});
  rec(file, await page.evaluate((y,h)=>{const out=[];const w=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT);let n;while((n=w.nextNode())){const t=n.textContent.trim();if(!t)continue;const p=n.parentElement;if(!p||!p.getClientRects().length)continue;const b=p.getBoundingClientRect();const top=b.top+scrollY;if(top>=y&&top<y+h&&getComputedStyle(p).visibility!=='hidden')out.push(t)}return out.join('\n')},y,h));
  console.log('  view', file);
}
export async function unstick(page){await page.evaluate(()=>{for(const e of document.querySelectorAll('body *')){const p=getComputedStyle(e).position;if(p==='sticky'||p==='fixed'){e.style.setProperty('position','static','important')}}; for(const e of document.querySelectorAll('body *')){const o=getComputedStyle(e);if((o.overflowY==='auto'||o.overflowY==='scroll')&&e.scrollHeight>e.clientHeight+4){e.style.setProperty('max-height','none','important');e.style.setProperty('overflow','visible','important')}}}); await sleep(500);}
export async function allCards(page, prefix, pad=16){
  await unstick(page);
  const boxes = await page.evaluate(()=>[...document.querySelectorAll('[data-slot="card"], .panel.gd-card')].map(c=>{const b=c.getBoundingClientRect();const h=(c.querySelector('h1,h2,h3,h4,[data-slot="card-title"]')?.textContent||c.textContent).trim().slice(0,24);return {x:b.x+scrollX,y:b.y+scrollY,w:b.width,h:b.height,t:h,text:c.innerText}}).filter(b=>b.w>50&&b.h>40));
  let i=0;
  for(const b of boxes){
    const slug=b.t.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,20);
    await page.screenshot({path:`${CROPS}${prefix}_${i}_${slug}.png`, clip:{x:b.x-pad,y:b.y-pad,width:b.w+2*pad,height:b.h+2*pad}, captureBeyondViewport:true});
    rec(`${prefix}_${i}_${slug}`, b.text);
    i++;
  }
  console.log('  ',prefix, boxes.length,'cards');
}
export async function closeIntro(page){
  await page.evaluate(()=>{const c=[...document.querySelectorAll('[data-slot="card"]')].find(c=>c.textContent.startsWith('New here'));c?.querySelector('button')?.click()});
  await sleep(800);
}
// Turn off motion (scroll reveals, chart and stage animations) so a page
// shows its finished state at once. Use before go().
export async function calm(page){ await page.emulateMediaFeatures([{name:'prefers-reduced-motion',value:'reduce'}]); }
// Scroll the whole page in steps so lazy images and on-scroll content load,
// then wait for every image and return to the top.
export async function reveal(page){
  const h = await page.evaluate(()=>document.documentElement.scrollHeight);
  for (let y=0; y<h; y+=600){ await page.evaluate(y=>window.scrollTo(0,y),y); await sleep(250); }
  await page.evaluate(async()=>{ await Promise.all([...document.images].map(i=>i.complete?0:new Promise(r=>{i.onload=i.onerror=r; setTimeout(r,8000)}))); window.scrollTo(0,0); });
  await sleep(800);
}
// Screenshot an element (first visible match of a CSS selector), padded.
export async function el(page, sel, file, pad=16, idx=0){
  const box = await page.evaluate((s,idx)=>{const e=[...document.querySelectorAll(s)].filter(e=>e.getClientRects().length)[idx]; if(!e) return null; const b=e.getBoundingClientRect(); return {x:b.x+scrollX,y:b.y+scrollY,width:b.width,height:b.height,text:e.innerText};},sel,idx);
  if(!box){console.log('  ! no element', sel); return null}
  await page.screenshot({path:`${CROPS}${file}.png`, clip:{x:Math.max(0,box.x-pad),y:Math.max(0,box.y-pad),width:box.width+2*pad,height:box.height+2*pad}, captureBeyondViewport:true});
  rec(file, box.text);
  console.log('  el', file, Math.round(box.width)+'x'+Math.round(box.height));
  return box;
}
// Screenshot the open dialog (role=dialog), padded so its rounded edge and shadow show.
// Everything but the dialog is hidden for the shot, so the padding is plain page ground.
export async function dialog(page, file, pad=24){
  await sleep(600);
  // no focus rings; a dialog taller than the window is shot in a window tall enough to hold it
  await page.evaluate(()=>document.activeElement?.blur());
  const vp=page.viewport();
  const need=await page.evaluate(()=>{const d=document.querySelector('[role="dialog"]');if(!d)return 0;let h=d.scrollHeight;for(const e of d.querySelectorAll('*')){if(e.scrollHeight>e.clientHeight+4&&/(auto|scroll)/.test(getComputedStyle(e).overflowY))h+=e.scrollHeight-e.clientHeight}return h});
  if(need+80>vp.height){await page.setViewport({...vp,height:Math.ceil(need+120)}); await sleep(1000);}
  await page.evaluate(()=>{const s=document.createElement('style');s.id='cap-dlg';s.textContent='body *{visibility:hidden!important} [role="dialog"], [role="dialog"] *{visibility:visible!important} body *:not([role="dialog"]):not([role="dialog"] *):not(:has([role="dialog"])){opacity:0!important} [data-slot="dialog-overlay"],[data-slot="sheet-overlay"],[data-slot="alert-dialog-overlay"]{display:none!important}';document.head.appendChild(s)});
  const b = await el(page, '[role="dialog"]', file, pad);
  await page.evaluate(()=>document.getElementById('cap-dlg')?.remove());
  if(page.viewport().height!==vp.height){await page.setViewport(vp); await sleep(800);}
  return b;
}
// Open a card's chart in full screen and take the 1440x900 viewport.
export async function fullScreen(page, heading, file){
  const ok = await page.evaluate(h=>{const c=[...document.querySelectorAll('[data-slot="card"]')].find(c=>c.getClientRects().length && ((c.querySelector('h1,h2,h3,h4,[data-slot="card-title"]')?.textContent.trim().startsWith(h)) || c.textContent.trim().startsWith(h))); const b=c?.querySelector('[aria-label="Full screen"]'); if(b){b.click(); return true} return false},heading);
  if(!ok){console.log('  ! no full screen button', heading); return}
  await sleep(2500); await page.screenshot({path:`${CROPS}${file}.png`}); rec(file, await page.evaluate(()=>(document.querySelector('[role="dialog"]')||document.fullscreenElement||document.body).innerText)); console.log('  full screen', file);
  await page.keyboard.press('Escape'); await sleep(1000);
}
// The text of the card whose heading starts with h (for logging figures).
export async function cardText(page, h){ return page.evaluate(h=>[...document.querySelectorAll('[data-slot="card"]')].find(c=>c.getClientRects().length && ((c.querySelector('h1,h2,h3,h4,[data-slot="card-title"]')?.textContent.trim().startsWith(h)) || c.textContent.trim().startsWith(h)))?.innerText.replace(/\s*\n\s*/g,' | ').slice(0,700),h); }
