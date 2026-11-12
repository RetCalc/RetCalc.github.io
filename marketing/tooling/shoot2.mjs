import {open,go,click,card,view,sleep,allCards,closeIntro,calm,reveal,el,dialog,fullScreen,cardText,unstick,rec,CROPS} from './lib.mjs';
const only=process.argv[2];
const {browser,page}=await open();
// Advanced with "Changes ahead": 30 now, retiring at 65, three changes (kids at
// home save less, peak earning saves more, an inheritance). Reaches its $45,000 target.
// from/until are years from now; until 0 means retirement.
const ch=(id,kind,name,from,until,mode,amount,x={})=>({id,kind,name,on:true,from,until,mode,amount,ramp:0,acct:'auto',nominal:0,...x});
const advanced={initial:'60,000',contrib:'1,000',period:'Monthly',growth:'3',nominal:'7.5',inflation:'2.5',years:'35',withdrawal:'4',taxRate:'12',vol:'15',fees:'0.1',age:'30',solveFor:'After-Tax Withdrawal',target:'45,000',
  changes:[ch('k','saving','Kids at home',8,20,'amount',-400),ch('p','saving','Peak earning',20,28,'amount',1500),ch('i','lump','An inheritance',25,0,'amount',50000)]};
const amt={'Rent / Mortgage':'1,850','Utilities':'180','Internet & phone':'95','Home / Renters insurance':'25','Car payment':'385','Car insurance':'140','Gas':'160','Maintenance & repairs':'900','Out-of-pocket medical':'1,200','Groceries':'650','Eating out':'260','Activities & hobbies':'120','Subscriptions':'45','Travel':'3,000','Gifts':'800'};
const groups={'Rent / Mortgage':'Housing','Property tax':'Housing','Utilities':'Housing','Internet & phone':'Housing','Home / Renters insurance':'Housing','Car payment':'Transportation','Car insurance':'Transportation','Gas':'Transportation','Maintenance & repairs':'Transportation','Health insurance':'Health','Out-of-pocket medical':'Health','Groceries':'Food','Eating out':'Food','Activities & hobbies':'Lifestyle','Subscriptions':'Lifestyle','Travel':'Lifestyle','Gifts':'Lifestyle','Other debt payments':'Debt'};
const yearly=new Set(['Maintenance & repairs','Out-of-pocket medical','Travel','Gifts']);
const rows=Object.entries(groups).map(([d,g])=>({group:g,desc:d,amount:amt[d]||'0',freq:yearly.has(d)?1:12,custom:false,slot:d}));
const budget={view:'budget',rows,efMonths:'6',pcGross:'95,000',pcFreq:'26',pcFreq2:'26',pcStatus:'s',pcGross2:'',pcState:'IL',pcHealth:'',pcHealth2:'0',pcMatchRate:'50',pcMatchUpTo:'6',pcMatchRate2:'50',pcMatchUpTo2:'6',pcHsaFamily:false,pcHsaBoth:false,pcOrder:'match,ef,hsa,rothIra,k401max,brok',pcPlan:'',pcEfOn:false,pcMatch:'0',pcHsa:'0',pcEf:'0',pcRothIra:'0',pcK401max:'0',pcBrok:'0',pcMatchRoth:false,pcK401maxRoth:false,pcIraRoth:true,pcEfCap:'200'};
const jobs={
 calculator: async()=>{await go(page,'/calculator'); await view(page,'calculator_view'); await view(page,'calculator_switch',0,170); await allCards(page,'calculator');
   await page.evaluate(()=>window.scrollTo(0,0)); await fullScreen(page,'Balance over time','calculator_fullscreen_view');},
 advanced: async()=>{await go(page,'/advanced','advanced',advanced); await view(page,'advanced_view');
   console.log('  reading:',await cardText(page,'After-tax income')); console.log('  reach:',await cardText(page,'Reach your target'));
   console.log('  changes:',await page.evaluate(()=>[...document.querySelectorAll('.dsh-sc-rows li')].map(l=>l.innerText.replace(/\s+/g,' ')).join(' / ')+' | '+document.querySelector('#btnStagesBehind')?.textContent));
   await allCards(page,'advanced');
   // the Changes ahead part of the inputs card: its heading down to the "See the N stages" button
   const box=await page.evaluate(()=>{const h=[...document.querySelectorAll('h3')].find(h=>h.textContent.trim().startsWith('Changes ahead'));const c=h.closest('[data-slot="card"]').getBoundingClientRect();const a=h.getBoundingClientRect(),b=document.querySelector('#btnStagesBehind').getBoundingClientRect();return {x:c.x,y:a.y+scrollY-16,width:c.width,height:b.bottom-a.top+40}});
   await page.screenshot({path:CROPS+'advanced_changes_ahead.png',clip:{...box,x:box.x-16,width:box.width+32},captureBeyondViewport:true}); rec('advanced_changes_ahead', await page.evaluate(()=>{const h=[...document.querySelectorAll('h3')].find(h=>h.textContent.trim().startsWith('Changes ahead'));let t='',e=h;while(e&&!(e.tagName==='H3'&&e!==h&&e.textContent.includes('Your goal'))){t+=e.innerText+'\n';e=e.nextElementSibling}return t})); console.log('  advanced_changes_ahead');
   await click(page,'Historical','Balance over time'); await sleep(1500); console.log('  hist:',await cardText(page,'Balance over time')); await card(page,'Balance over time','advanced_chart_hist');
   await page.evaluate(()=>window.scrollTo(0,0)); await fullScreen(page,'Balance over time','advanced_fullscreen_view');
   await click(page,'Monte Carlo','Balance over time'); await sleep(2500); console.log('  mc:',await cardText(page,'Balance over time')); await card(page,'Balance over time','advanced_chart_mc');
   await page.evaluate(()=>window.scrollTo(0,0)); await page.click('#btnViewChanges'); await dialog(page,'advanced_changes_dialog'); await page.keyboard.press('Escape'); await sleep(800);
   await page.click('#btnStagesBehind'); await dialog(page,'advanced_stages_dialog'); await page.keyboard.press('Escape'); await sleep(800);
   await page.click('#btnAddChange'); await dialog(page,'advanced_addchange_dialog'); await page.keyboard.press('Escape'); await sleep(800);},
 drawdown: async()=>{await go(page,'/drawdown'); await closeIntro(page); await view(page,'drawdown_view'); await allCards(page,'drawdown');
   await page.evaluate(()=>window.scrollTo(0,0)); await fullScreen(page,'Every historical','drawdown_fullscreen_view');
   await click(page,'Compare strategies'); await sleep(6000); await allCards(page,'drawdown_cmp');
   await click(page,'Safe spending'); await sleep(6000); await allCards(page,'drawdown_safe');},
 optimizer: async()=>{await go(page,'/optimizer'); await view(page,'optimizer_view'); await click(page,'Find my best plan'); await sleep(45000); await view(page,'optimizer_view_done'); await allCards(page,'optimizer');},
 ss: async()=>{await go(page,'/social-security'); await view(page,'ss_view'); await allCards(page,'ss');},
 bridge: async()=>{await go(page,'/bridge'); await sleep(4000); await view(page,'bridge_view'); await allCards(page,'bridge');},
 roth: async()=>{await go(page,'/roth'); await view(page,'roth_view'); await allCards(page,'roth');},
 healthcare: async()=>{await go(page,'/healthcare','healthcare',{retireAge:'60',status:'m',household:'2',spouseAge:'59',state:'IL',income:'62,000',ss:'',premium:''}); await view(page,'healthcare_view'); await allCards(page,'healthcare');},
 fire: async()=>{await go(page,'/fire'); await view(page,'fire_view'); await allCards(page,'fire'); await click(page,'Historical'); await allCards(page,'fire_hist');},
 backtest: async()=>{await go(page,'/backtest'); await view(page,'backtest_view'); await allCards(page,'backtest');},
 college: async()=>{await go(page,'/college'); await view(page,'college_view'); await allCards(page,'college');},
 rentbuy: async()=>{await go(page,'/rentbuy'); await view(page,'rentbuy_view'); await allCards(page,'rentbuy');},
 incometax: async()=>{await go(page,'/incometax'); await view(page,'incometax_view'); await allCards(page,'incometax'); await click(page,'Retirement income'); await sleep(1500); await view(page,'incometax_ret_view'); await allCards(page,'incometax_ret');},
 budget: async()=>{await go(page,'/budget','budget',budget); await view(page,'budget_view'); await allCards(page,'budget');
   await go(page,'/budget','budget',{...budget,view:'paycheck'}); await click(page,'The usual order'); await sleep(1500); await view(page,'budget_pc_view'); await allCards(page,'budget_pc');},
 debt: async()=>{await go(page,'/debt'); await view(page,'debt_view'); await allCards(page,'debt');},
 mortgage: async()=>{await go(page,'/mortgage'); await view(page,'mortgage_view'); await allCards(page,'mortgage');},
 home: async()=>{await calm(page); await go(page,'/'); await reveal(page); await view(page,'home_view'); await view(page,'header_nav',0,72);
   await page.screenshot({path:CROPS+'home_full.png',fullPage:true}); console.log('  home_full');
   const n=await page.evaluate(()=>document.querySelectorAll('.hm > section').length);
   for(let i=0;i<n;i++){const t=await page.evaluate(i=>document.querySelectorAll('.hm > section')[i].querySelector('h1,h2')?.textContent.trim()||'',i); await el(page,'.hm > section','home_'+i+'_'+t.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,20),16,i);}
   await go(page,'/tools'); await reveal(page); await view(page,'tools_view');
   await page.emulateMediaFeatures([]);},
 learn: async()=>{await calm(page); await go(page,'/learn'); await reveal(page); await view(page,'learn_view');
   await page.screenshot({path:CROPS+'learn_full.png',fullPage:true}); console.log('  learn_full');
   await el(page,'header.lrn-shelf','learn_header',16);
   await allCards(page,'learn');
   for (const slug of ['when-to-claim','sequence-risk','four-percent-rule','compound-growth']){
     await go(page,'/learn/'+slug); await reveal(page); await view(page,'learn_'+slug+'_view');
     await page.evaluate(()=>[...document.querySelectorAll('figure')].find(f=>f.querySelector('input,[role="slider"],select,button'))?.setAttribute('data-cap-widget',''));
     await el(page,'[data-cap-widget]','learn_'+slug+'_widget',16);
     // the lesson section around the widget: from the heading above it to the widget's foot
     const lb=await page.evaluate(()=>{const f=document.querySelector('[data-cap-widget]');const top=f.getBoundingClientRect().top;let e=f;while(e.previousElementSibling){const p=e.previousElementSibling;if(top-p.getBoundingClientRect().top>420&&!/^H[234]$/.test(p.tagName))break;e=p;if(/^H[234]$/.test(p.tagName))break}const a=e.getBoundingClientRect(),b=f.getBoundingClientRect();return {x:b.x-32,y:a.y+scrollY-28,width:b.width+64,height:b.bottom-a.top+46}});
     await page.screenshot({path:CROPS+'learn_'+slug+'_lesson.png',clip:lb,captureBeyondViewport:true}); rec('learn_'+slug+'_lesson', await page.evaluate(()=>document.querySelector('[data-cap-widget]').innerText)); console.log('  lesson section',Math.round(lb.width)+'x'+Math.round(lb.height));
     console.log('  widget:',await page.evaluate(()=>document.querySelector('[data-cap-widget]')?.innerText.replace(/\s*\n\s*/g,' | ').slice(0,300)));
   }
   await page.emulateMediaFeatures([]);},
};
for (const [k,f] of Object.entries(jobs)){ if(only && !only.split(',').includes(k)) continue; console.log(k); try{await f()}catch(e){console.log('  ERR',e.message)} }
await browser.close();
