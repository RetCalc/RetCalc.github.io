import {open,sleep} from './lib.mjs';
const {browser,page}=await open();
const at='2026-10-20T12:00:00Z';
const a={ status: "m", age: 38, spouseAge: 36, retire: 62, state: "IL", income: 95000, income2: 60000, thKnow: "yes", takehome: 9200, bgKnow: "yes", spend: 7000, cash: 30000, debtHas: "no", home: "mortgage", mortPaid: "no", housePay: 2100, college: "yes", kidAge: 6, collegeMo: 300, saved: 210000, rothNow: 40000, contrib: 1400, employer: 400, match: "full", risk: 0.0575, splitTrad: 70, splitRoth: 30, splitBrok: 0, retSpend: 72000, hcIncl: "no" };
const ids=["welcome","about","income","spending","cash","debt","goals","savings","invested","accounts","changes","retspend","social","number","lasting","adjust","strategy","health","optimize","plan"];
await page.goto('https://retcalc.app/about',{waitUntil:'networkidle0'});
await page.evaluate(s=>localStorage.setItem('retcalc.guide.v2',JSON.stringify(s)), {v:2,pace:'full',cur:'plan',a,src:Object.fromEntries(Object.keys(a).map(k=>[k,{kind:'entered',at}])),done:Object.fromEntries(ids.map(i=>[i,true])),trip:null,back:null,coachMin:true,snapshots:[],moves:{},lessons:{},startedAt:at});
await page.goto('https://retcalc.app/guide/report',{waitUntil:'networkidle0'}); await sleep(8000);
const boxes=await page.evaluate(()=>{const out=[];for(const e of document.querySelectorAll('main *')){const b=e.getBoundingClientRect();const r=b.height/b.width;if(b.width>700&&r>1.2&&r<1.35){out.push({x:b.x+scrollX,y:b.y+scrollY,w:b.width,h:b.height,c:e.className})}};return out});
console.log(boxes.length, boxes[0]);
let i=0; for(const b of boxes){await page.screenshot({path:`../shots/crops/report_p${String(i++).padStart(2,'0')}.png`,clip:{x:b.x,y:b.y,width:b.w,height:b.h},captureBeyondViewport:true});}
await browser.close();
