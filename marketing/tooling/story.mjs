// One household through the real hand-offs: Budget/Paycheck -> Stages -> Social Security -> Drawdown.
import {open,go,click,card,view,sleep,allCards,unstick,share} from './lib.mjs';
import fs from 'fs';
const {browser,page}=await open();
page.on('dialog', d=>{console.log('  dialog:',d.message().slice(0,80)); d.accept();});
const ss=async(k)=>page.evaluate(k=>sessionStorage.getItem(k),k);
const toast=async()=>page.evaluate(()=>[...document.querySelectorAll('[data-sonner-toast],[role="status"],.toast')].map(e=>e.textContent.trim()).filter(Boolean).join(' | '));
const P='st_';
// 0. Stages first, so the copy seeds the starting balance: $60,000 saved, one 31-year stage (34 to 65).
const st0={initial:'60,000',inflation:'2.5',withdrawal:'4',taxRate:'12',fees:'0.1',saOn:false,saTradBal:'',saRothBal:'',saBrokBal:'',saBrokBasis:'',saHsaBal:'',saSalary:'',saMatchPct:'',saMatchCap:'',saStatus:'m',saState:'IL',
 stages:[{years:'31',contrib:'500',period:'Monthly',growth:'3',nominal:'7.5',vol:'15',adj:false,glideOn:false,glideEnd:'',glideYears:''}],
 solveFor:'After-Tax Withdrawal',target:'22,000',histMix:'80',histMixEnd:'50',kids:null,kidCover:{}};
await go(page,'/stages','stages',st0);
// 1. Budget + Paycheck, married with two incomes
const src=fs.readFileSync('shoot2.mjs','utf8');
const budget=eval(src.match(/const amt=[\s\S]*?const budget=\{[^\n]*\};/)[0]+';budget');
const amt={'Rent / Mortgage':'2,900','Property tax':'450','Utilities':'280','Internet & phone':'160','Home / Renters insurance':'120','Car payment':'650','Car insurance':'220','Gas':'320','Maintenance & repairs':'1,500','Health insurance':'450','Out-of-pocket medical':'2,400','Groceries':'1,200','Eating out':'450','Activities & hobbies':'300','Subscriptions':'80','Travel':'6,000','Gifts':'1,500','Other debt payments':'350'};
for (const r of budget.rows) r.amount = amt[r.desc] ?? '0';
Object.assign(budget,{view:'paycheck',pcStatus:'m2',pcGross:'92,000',pcGross2:'68,000',pcFreq:'26',pcFreq2:'26',pcState:'IL',pcMatchRate:'50',pcMatchUpTo:'6',pcMatchRate2:'100',pcMatchUpTo2:'4'});
await go(page,'/budget','budget',budget);
await click(page,'The usual order'); await sleep(1500);
await view(page,P+'pc_view'); await allCards(page,P+'pc');
const btn=async(txt,exact=true)=>{const ok=await page.evaluate((t,e)=>{const b=[...document.querySelectorAll('button')].filter(b=>b.getClientRects().length).find(b=>e?b.textContent.trim()===t:b.textContent.trim().startsWith(t));if(b){b.scrollIntoView({block:'center'});b.click();return true}return false},txt,exact);if(!ok)console.log('  ! no button',txt);await sleep(1300);return ok;};
const typeIn=async(sel,v)=>{await page.evaluate(s=>document.querySelector(s)?.scrollIntoView({block:'center'}),sel);await page.click(sel,{clickCount:3});await page.keyboard.press('Backspace');await page.type(sel,v);await page.keyboard.press('Tab');await sleep(500);};
// 2. Copy to Stages
await page.evaluate(()=>{const b=document.querySelector('#pcCopyOut');b.scrollIntoView({block:'center'});b.click()}); await sleep(1200);
await btn('Stages',false); await btn('Replace it',false); await sleep(3000);
console.log('2 url',page.url().slice(0,40),'| toast',await toast());
await click(page,'Historical','Balance over time');
await view(page,P+'stages_copied');
// 3. Children: two planned, the first in 2 years, then 3 years apart
await page.evaluate(()=>document.querySelector('#btnKidsS')?.click()); await sleep(1200);
console.log('3 kids dialog', await page.evaluate(()=>!!document.querySelector('#kdPlanned')));
await typeIn('#kdPlanned','2'); await typeIn('#kdFirst','2'); await typeIn('#kdSpacing','3');
await page.screenshot({path:'../shots/crops/'+P+'kids_dialog_view.png'});
for (const t of ['Next: how you\'ll cover it','Build the stages','Use these','Build the stages']) { if (await page.evaluate(t=>[...document.querySelectorAll('button')].some(b=>b.getClientRects().length&&b.textContent.trim()===t),t)) { if(t==='Build the stages') await page.screenshot({path:'../shots/crops/'+P+'cover_dialog_view.png'}); await btn(t); } }
await sleep(2500);
console.log('3 stages', (await ss('retcalc.tool-stages.v1'))?.match(/"stages":\[.*?\]\]?/)?.[0]?.slice(0,900));
await click(page,'Historical','Balance over time'); await sleep(1500);
await view(page,P+'stages_kids'); await allCards(page,P+'stg');
await page.evaluate(()=>window.scrollTo(0,0));
// 4. Social Security, the same couple
const person=(birth,pay,start)=>({birth,src:'pay',pay,pia:'',start,stop:'65',claim:'67',through:'90',earn:'0',gPast:'2',gAhead:'1',edits:{}});
await go(page,'/social-security','social',{status:'m',you:person('1992','92,000','22'),spouse:{...person('1994','68,000','23'),through:'92'},other:'40,000'});
await view(page,P+'ss_view'); await allCards(page,P+'ss');
// 5. Back to Stages, then Test withdrawals
await page.goto('https://retcalc.app/stages',{waitUntil:'networkidle0'}); await sleep(3000);
await page.evaluate(()=>{const b=document.querySelector('#toDrawdownS');b.scrollIntoView({block:'center'});b.click()}); await sleep(4000);
console.log('5 url',page.url().slice(0,40),'| toast',await toast());
// Drawdown: 30 years from 65, with Social Security copied in
await page.evaluate(()=>{const c=[...document.querySelectorAll('[data-slot="card"]')].find(c=>c.textContent.startsWith('New here'));c?.querySelector('button')?.click()});
await page.evaluate(()=>document.querySelector('#segDDIn [data-ddin="adv"]')?.click()); await sleep(800);
await typeIn('#ddRetireAge','65');
await page.select('#ddSSMode','social'); await sleep(2500);
console.log('5 drawdown', (await ss('retcalc.tool-drawdown.v1'))?.slice(0,500));
await view(page,P+'dd_view'); await allCards(page,P+'dd');
await browser.close();
