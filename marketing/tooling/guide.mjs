import {open,go,click,sleep,view,unstick,allCards} from './lib.mjs';
const {browser,page}=await open();
const a={ status: "m", age: 38, spouseAge: 36, retire: 62, state: "IL", income: 95000, income2: 60000,
      thKnow: "yes", takehome: 9200, bgKnow: "yes", spend: 7000, cash: 30000,
      debtHas: "no", home: "mortgage", mortPaid: "no", housePay: 2100, college: "yes", kidAge: 6, collegeMo: 300,
      saved: 210000, rothNow: 40000, contrib: 1400, employer: 400, match: "full", risk: 0.0575, splitTrad: 70, splitRoth: 30, splitBrok: 0,
      retSpend: 72000, hcIncl: "no", strategy: undefined };
const ids=["welcome","about","income","spending","cash","debt","goals","savings","invested","accounts","changes","retspend","social","number","lasting","adjust","strategy","health","optimize","plan"];
const done=Object.fromEntries(ids.map(i=>[i,true]));
const at='2026-10-20T12:00:00Z';
const src=Object.fromEntries(Object.keys(a).map(k=>[k,{kind:'entered',at}]));
const mk=(cur)=>({v:2,pace:'full',cur,a,src,done,trip:null,back:null,coachMin:true,snapshots:[],moves:{},lessons:{},startedAt:at});
await page.goto('https://retcalc.app/about',{waitUntil:'networkidle0'});
for (const cur of ['number','lasting','adjust','strategy','plan']){
  await page.evaluate(s=>localStorage.setItem('retcalc.guide.v2',JSON.stringify(s)), mk(cur));
  await page.goto('https://retcalc.app/guide',{waitUntil:'networkidle0'}); await sleep(5000);
  await view(page,'guide_'+cur+'_view'); await allCards(page,'guide_'+cur);
}
await page.goto('https://retcalc.app/guide/report',{waitUntil:'networkidle0'}); await sleep(8000);
await view(page,'guide_report_view');
await page.screenshot({path:'../shots/crops/guide_report_full.png',fullPage:true});
await browser.close();
