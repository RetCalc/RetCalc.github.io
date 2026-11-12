// One household through the site's real hand-offs:
// Budget (Paycheck tab) -> Copy to Advanced -> Advanced (Changes ahead: Children)
// -> Social Security -> Advanced's Test withdrawals -> Drawdown (Social Security copied in).
// Every figure each step shows is logged (and written to ../.preview/capture/story-<theme>.log)
// so the copy can quote them.
import {open,go,click,card,view,sleep,allCards,dialog,cardText,THEME,BASE} from './lib.mjs';
import fs from 'fs';
const {browser,page}=await open();
const logFile=new URL(`../.preview/capture/story-${THEME}.log`, import.meta.url).pathname;
fs.mkdirSync(new URL('../.preview/capture/', import.meta.url).pathname,{recursive:true}); fs.writeFileSync(logFile,'');
const log=(...a)=>{const t=a.join(' '); console.log(t); fs.appendFileSync(logFile,t+'\n');};
page.on('dialog', d=>{log('  dialog:',d.message().slice(0,80)); d.accept();});
const toast=async()=>page.evaluate(()=>[...document.querySelectorAll('[data-sonner-toast],[role="status"],.toast')].map(e=>e.textContent.trim()).filter(Boolean).join(' | '));
const btn=async(txt,exact=true)=>{const ok=await page.evaluate((t,e)=>{const b=[...document.querySelectorAll('button')].filter(b=>b.getClientRects().length).find(b=>e?b.textContent.trim()===t:b.textContent.trim().startsWith(t));if(b){b.scrollIntoView({block:'center'});b.click();return true}return false},txt,exact);if(!ok)log('  ! no button',txt);await sleep(1300);return ok;};
const typeIn=async(sel,v)=>{await page.evaluate(s=>document.querySelector(s)?.scrollIntoView({block:'center'}),sel);await page.click(sel,{clickCount:3});await page.keyboard.press('Backspace');await page.type(sel,v);await page.keyboard.press('Tab');await sleep(500);};
// every visible card's text, one line each, for the log
const dump=async(label)=>{const t=await page.evaluate(()=>[...document.querySelectorAll('[data-slot="card"]')].filter(c=>c.getClientRects().length&&c.getBoundingClientRect().width>50).map(c=>c.innerText.replace(/\s*\n\s*/g,' | ').slice(0,900)));log('--',label);t.forEach((x,i)=>log('  ['+i+'] '+x));};
const P='st_';

// 0. Advanced first, so the copy lands on a plan: $60,000 saved, 34 now, retiring at 65 (31 years),
//    a $40,000 after-tax income target (from savings; Social Security comes on top).
await go(page,'/advanced','advanced',{initial:'60,000',contrib:'500',period:'Monthly',growth:'3',years:'31',age:'34',target:'40,000',solveFor:'After-Tax Withdrawal',inflation:'2.5',withdrawal:'4',taxRate:'12',fees:'0.1',nominal:'7.5',vol:'15'});

// 1. Budget + Paycheck: married, $92,000 and $68,000, Illinois, "The usual order"
const src=fs.readFileSync(new URL('shoot2.mjs', import.meta.url),'utf8');
const budget=eval(src.match(/const amt=[\s\S]*?const budget=\{[^\n]*\};/)[0]+';budget');
const amt={'Rent / Mortgage':'2,900','Property tax':'450','Utilities':'280','Internet & phone':'160','Home / Renters insurance':'120','Car payment':'650','Car insurance':'220','Gas':'320','Maintenance & repairs':'1,500','Health insurance':'450','Out-of-pocket medical':'2,400','Groceries':'1,200','Eating out':'450','Activities & hobbies':'300','Subscriptions':'80','Travel':'6,000','Gifts':'1,500','Other debt payments':'350'};
for (const r of budget.rows) r.amount = amt[r.desc] ?? '0';
Object.assign(budget,{view:'paycheck',pcStatus:'m2',pcGross:'92,000',pcGross2:'68,000',pcFreq:'26',pcFreq2:'26',pcState:'IL',pcMatchRate:'50',pcMatchUpTo:'6',pcMatchRate2:'100',pcMatchUpTo2:'4'});
await go(page,'/budget','budget',budget);
await click(page,'The usual order'); await sleep(1500);
await view(page,P+'pc_view'); await dump('1 Paycheck'); await allCards(page,P+'pc');

// 2. Copy to Advanced (goes straight to /advanced; "Replace it" only if Advanced already has saving)
await page.evaluate(()=>{window.scrollTo(0,0);const b=document.querySelector('#pcCopyOut');b.scrollIntoView({block:'center'});b.click()}); await sleep(1500);
await btn('Replace it',false); await sleep(1500);
log('2 button',await page.evaluate(()=>document.querySelector('#pcCopyOut')?.textContent.trim()||'(left the page)'));
await sleep(2500);
log('2 url',page.url().replace(BASE,'').slice(0,40),'| toast',await toast());
await view(page,P+'adv_copied'); await dump('2 Advanced after the copy');

// 3. Changes ahead: Children, one planned, in 2 years, no paid childcare (family helps).
//    With paid childcare, or two children, the costs outrun this couple's saving for years
//    and the cover step shows a red warning, so the sample keeps to one.
await page.evaluate(()=>{const b=document.querySelector('#btnAddChange');b.scrollIntoView({block:'center'});b.click()}); await sleep(1200);
await page.evaluate(()=>[...document.querySelectorAll('.dsh-sc-kind')].find(b=>b.textContent.trim().startsWith('Children'))?.click()); await sleep(1500);
log('3 kids dialog', await page.evaluate(()=>!!document.querySelector('#kdPlanned')));
await typeIn('#kdPlanned','1'); await sleep(800); await typeIn('#kdFirst','2');
await page.evaluate(()=>{const l=[...document.querySelectorAll('[role=dialog] *')].find(e=>e.textContent.trim()==='Paid childcare before school?');const g=l.closest('.field,div').parentElement;[...g.querySelectorAll('button,[role=radio]')].find(b=>b.textContent.trim()==='No')?.click()}); await sleep(800);
log('3 kids', await page.evaluate(()=>document.querySelector('[role="dialog"]')?.innerText.replace(/\s*\n\s*/g,' | ').slice(0,1200)));
await dialog(page,P+'kids_dialog');
if (await btn("Next: how you'll cover it")) {
  await sleep(1200);
  await btn('Brokerage first',false);
  log('3 cover', await page.evaluate(()=>document.querySelector('[role="dialog"]')?.innerText.replace(/\s*\n\s*/g,' | ').slice(0,900)));
  await dialog(page,P+'cover_dialog');
}
await btn('Add them'); await sleep(2500);
log('3 changes', await page.evaluate(()=>[...document.querySelectorAll('.dsh-sc-rows li')].map(l=>l.innerText.replace(/\s+/g,' ')).join(' / ')+' | '+document.querySelector('#btnStagesBehind')?.textContent));
await click(page,'Historical','Balance over time'); await sleep(2000);
await page.evaluate(()=>window.scrollTo(0,0));
await view(page,P+'adv_kids'); await dump('3 Advanced with the children');
await allCards(page,P+'adv');
await page.evaluate(()=>window.scrollTo(0,0));
await page.click('#btnViewChanges'); await dialog(page,P+'adv_changes_dialog'); await page.keyboard.press('Escape'); await sleep(800);
await page.click('#btnStagesBehind'); await sleep(800);
log('3 stages table', await page.evaluate(()=>document.querySelector('[role="dialog"]')?.innerText.replace(/\s*\n\s*/g,' | ').slice(0,1500)));
await dialog(page,P+'adv_stages_dialog'); await page.keyboard.press('Escape'); await sleep(800);

// 4. Social Security, the same couple (born 1992 and 1994)
const person=(birth,pay,start)=>({birth,src:'pay',pay,pia:'',start,stop:'65',claim:'67',through:'90',earn:'0',gPast:'2',gAhead:'1',edits:{}});
await go(page,'/social-security','social',{status:'m',you:person('1992','92,000','22'),spouse:{...person('1994','68,000','23'),through:'92'},other:'40,000'});
await view(page,P+'ss_view'); await dump('4 Social Security'); await allCards(page,P+'ss');

// 5. Back to Advanced, then Test withdrawals
await page.goto(BASE+'/advanced',{waitUntil:'networkidle0'}); await sleep(3000);
await page.evaluate(()=>{const b=document.querySelector('#toDrawdown');b.scrollIntoView({block:'center'});b.click()}); await sleep(4000);
log('5 url',page.url().replace(BASE,'').slice(0,40),'| toast',await toast());
// Drawdown: 30 years from 65, with Social Security copied in. The Drawdown's spending is the
// household's total (Social Security pays part of it), so the 4% default would leave the
// portfolio untouched once the checks start; an 8% starting rate is their whole spending.
await page.evaluate(()=>document.querySelector('#segDDIn [data-ddin="adv"]')?.click()); await sleep(800);
await typeIn('#ddRetireAge','65');
await page.select('#ddSSMode','social'); await sleep(2000);
await typeIn('#ddRate','8'); await sleep(2500);
log('5 rate', await page.evaluate(()=>document.querySelector('#ddRateNote')?.textContent));
log('5 ss option', await page.evaluate(()=>document.querySelector('#ddSSMode')?.selectedOptions[0]?.textContent));
await page.evaluate(()=>window.scrollTo(0,0));
await view(page,P+'dd_view'); await dump('5 Drawdown'); await allCards(page,P+'dd');
await browser.close();
