// Paycheck to Retirement (/guide/paycheck), walked through in one session by its own buttons:
// Budget -> Paycheck ("The usual order") -> Your plan -> Changes ahead (optional).
// The household is shoot2.mjs's Budget household, 34, retiring at 62.
import {open,sleep,view,allCards,click,BASE} from './lib.mjs';
import fs from 'fs';
const {browser,page}=await open();
const src=fs.readFileSync(new URL('shoot2.mjs', import.meta.url),'utf8');
const budget=eval(src.match(/const amt=[\s\S]*?const budget=\{[^\n]*\};/)[0]+';budget');
budget.view='paycheck';
const state={step:'budget',reached:'budget',age:'34',retire:'62',freq:'26',tools:{budget},from:{},stagesOn:false,kids:null,cover:{}};
await page.goto(BASE+'/about',{waitUntil:'networkidle0'});
await page.evaluate(s=>localStorage.setItem('retcalc.paycheck-plan.v1',JSON.stringify(s)), state);
await page.goto(BASE+'/guide/paycheck',{waitUntil:'networkidle0'}); await sleep(4000);
const press=async(t)=>{const ok=await page.evaluate(t=>{const b=[...document.querySelectorAll('button')].filter(b=>b.getClientRects().length).find(b=>b.textContent.trim().startsWith(t));if(b){b.click();return true}return false},t); if(!ok) console.log('  ! no button',t); await sleep(3500); return ok;};
const shoot=async(step)=>{await page.evaluate(()=>{document.activeElement?.blur(); for(const a of document.querySelectorAll('a')) if(a.textContent.trim()==='Skip to content') a.style.display='none'; window.scrollTo(0,0)}); await sleep(800); await view(page,'plan_'+step+'_view'); await allCards(page,'plan_'+step); await page.evaluate(()=>window.scrollTo(0,0)); await sleep(500);};
const reading=async()=>page.evaluate(()=>[...document.querySelectorAll('[data-slot="card"]')].find(c=>c.textContent.includes('After-tax income'))?.innerText.replace(/\s*\n\s*/g,' | ').slice(0,400));
await shoot('budget');
await press('Next'); await click(page,'The usual order'); await sleep(1500); await shoot('paycheck');
await press('Next'); await sleep(1500);
// Advanced's default $100,000 target is out of reach for this household ("Not on track");
// a $35,000 after-tax target is one the plan reaches.
const setTarget=async()=>{const id=await page.evaluate(()=>[...document.querySelectorAll('label')].find(l=>l.textContent.trim().startsWith('Target, inflation adjusted'))?.htmlFor);
  if(!id){console.log('  ! no target field');return}
  await page.evaluate(i=>document.getElementById(i).scrollIntoView({block:'center'}),id); await page.click('#'+id,{clickCount:3}); await sleep(300); await page.keyboard.press('Backspace'); await sleep(400); await page.type('#'+id,'35000',{delay:60}); await page.keyboard.press('Tab'); await sleep(1500);};
await setTarget(); console.log('  plan:',await reading()); await shoot('plan');
await press('Plan for kids'); await sleep(1500); console.log('  changes ahead:',await reading()); await shoot('stages');
await browser.close();
