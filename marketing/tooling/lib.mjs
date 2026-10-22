import puppeteer from 'puppeteer-core';
export const sleep = ms => new Promise(s=>setTimeout(s,ms));
export async function open(theme='light'){
  const browser = await puppeteer.launch({executablePath:(process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'), headless:true});
  const page = await browser.newPage();
  await page.setViewport({width:1440,height:900,deviceScaleFactor:2});
  await page.evaluateOnNewDocument(t=>{try{localStorage.setItem('retcalc.theme.v1',JSON.stringify(t))}catch(e){}}, theme);
  return {browser,page};
}
export const share=(id,d)=>'#s='+Buffer.from(JSON.stringify({t:id,d})).toString('base64').replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
export async function go(page, route, id, data){
  await page.goto('about:blank');
  await page.goto('https://retcalc.app'+route+(id?share(id,data):''),{waitUntil:'networkidle0',timeout:60000});
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
    const c=cs[idx]; if(!c) return null; const b=c.getBoundingClientRect(); return {x:b.x+scrollX,y:b.y+scrollY,width:b.width,height:b.height};
  },heading,idx);
  if(!box){console.log('  ! no card', heading); return}
  await page.screenshot({path:`../shots/crops/${file}.png`, clip:{x:box.x-pad,y:box.y-pad,width:box.width+2*pad,height:box.height+2*pad}, captureBeyondViewport:true});
  console.log('  card', file, Math.round(box.width)+'x'+Math.round(box.height));
}
export async function view(page, file, y=0, h=900){
  await page.screenshot({path:`../shots/crops/${file}.png`, clip:{x:0,y,width:1440,height:h}, captureBeyondViewport:true});
  console.log('  view', file);
}
export async function unstick(page){await page.evaluate(()=>{for(const e of document.querySelectorAll('body *')){const p=getComputedStyle(e).position;if(p==='sticky'||p==='fixed'){e.style.setProperty('position','static','important')}}; for(const e of document.querySelectorAll('body *')){const o=getComputedStyle(e);if((o.overflowY==='auto'||o.overflowY==='scroll')&&e.scrollHeight>e.clientHeight+4){e.style.setProperty('max-height','none','important');e.style.setProperty('overflow','visible','important')}}}); await sleep(500);}
export async function allCards(page, prefix, pad=16){
  await unstick(page);
  const boxes = await page.evaluate(()=>[...document.querySelectorAll('[data-slot="card"], .panel.gd-card')].map(c=>{const b=c.getBoundingClientRect();const h=(c.querySelector('h1,h2,h3,h4,[data-slot="card-title"]')?.textContent||c.textContent).trim().slice(0,24);return {x:b.x+scrollX,y:b.y+scrollY,w:b.width,h:b.height,t:h}}).filter(b=>b.w>50&&b.h>40));
  let i=0;
  for(const b of boxes){
    const slug=b.t.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,20);
    await page.screenshot({path:`../shots/crops/${prefix}_${i}_${slug}.png`, clip:{x:b.x-pad,y:b.y-pad,width:b.w+2*pad,height:b.h+2*pad}, captureBeyondViewport:true});
    i++;
  }
  console.log('  ',prefix, boxes.length,'cards');
}
export async function closeIntro(page){
  await page.evaluate(()=>{const c=[...document.querySelectorAll('[data-slot="card"]')].find(c=>c.textContent.startsWith('New here'));c?.querySelector('button')?.click()});
  await sleep(800);
}
