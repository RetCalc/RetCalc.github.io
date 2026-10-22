import {open,sleep,view,allCards,unstick,click} from './lib.mjs';
import fs from 'fs';
const {browser,page}=await open();
const src=fs.readFileSync('shoot2.mjs','utf8');
// reuse budget object
const budget=eval(src.match(/const amt=[\s\S]*?const budget=\{[^\n]*\};/)[0]+';budget');
budget.view='paycheck';
const mk=(step)=>({step,reached:'summary',age:'34',retire:'62',freq:'26',tools:{budget},from:{},stagesOn:false,kids:null,cover:{}});
await page.goto('https://retcalc.app/about',{waitUntil:'networkidle0'});
for (const step of ['budget','paycheck','plan','summary']){
  await page.evaluate(s=>localStorage.setItem('retcalc.paycheck-plan.v1',JSON.stringify(s)), mk(step));
  await page.goto('https://retcalc.app/guide/paycheck',{waitUntil:'networkidle0'}); await sleep(4000);
  if(step==='paycheck'){await click(page,'The usual order'); await sleep(1500);}
  await view(page,'plan_'+step+'_view'); await allCards(page,'plan_'+step);
}
await browser.close();
