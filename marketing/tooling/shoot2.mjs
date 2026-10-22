import {open,go,click,card,view,sleep,allCards,closeIntro} from './lib.mjs';
const only=process.argv[2];
const {browser,page}=await open();
const st=(o)=>({years:'10',contrib:'500',period:'Monthly',growth:'3',nominal:'7.5',vol:'15',adj:false,glideOn:false,glideEnd:'',glideYears:'',...o});
const stages={initial:'60,000',inflation:'2.5',withdrawal:'4',taxRate:'12',fees:'0.1',saOn:false,saTradBal:'',saRothBal:'',saBrokBal:'',saBrokBasis:'',saHsaBal:'',saSalary:'',saMatchPct:'',saMatchCap:'',saStatus:'m',saState:'IL',
 stages:[st({name:'Early career',years:'8',contrib:'1,000',growth:'4',nominal:'8',vol:'16'}),st({name:'Kids at home',years:'12',contrib:'900',growth:'2',nominal:'8',vol:'16'}),st({name:'Peak earning',years:'10',contrib:'3,500',growth:'3',nominal:'7',vol:'13'}),st({name:'Coast',years:'5',contrib:'0',growth:'0',nominal:'6',vol:'10'})],
 solveFor:'After-Tax Withdrawal',target:'45,000',histMix:'80',histMixEnd:'50',kids:null,kidCover:{}};
const amt={'Rent / Mortgage':'1,850','Utilities':'180','Internet & phone':'95','Home / Renters insurance':'25','Car payment':'385','Car insurance':'140','Gas':'160','Maintenance & repairs':'900','Out-of-pocket medical':'1,200','Groceries':'650','Eating out':'260','Activities & hobbies':'120','Subscriptions':'45','Travel':'3,000','Gifts':'800'};
const groups={'Rent / Mortgage':'Housing','Property tax':'Housing','Utilities':'Housing','Internet & phone':'Housing','Home / Renters insurance':'Housing','Car payment':'Transportation','Car insurance':'Transportation','Gas':'Transportation','Maintenance & repairs':'Transportation','Health insurance':'Health','Out-of-pocket medical':'Health','Groceries':'Food','Eating out':'Food','Activities & hobbies':'Lifestyle','Subscriptions':'Lifestyle','Travel':'Lifestyle','Gifts':'Lifestyle','Other debt payments':'Debt'};
const yearly=new Set(['Maintenance & repairs','Out-of-pocket medical','Travel','Gifts']);
const rows=Object.entries(groups).map(([d,g])=>({group:g,desc:d,amount:amt[d]||'0',freq:yearly.has(d)?1:12,custom:false,slot:d}));
const budget={view:'budget',rows,efMonths:'6',pcGross:'95,000',pcFreq:'26',pcFreq2:'26',pcStatus:'s',pcGross2:'',pcState:'IL',pcHealth:'',pcHealth2:'0',pcMatchRate:'50',pcMatchUpTo:'6',pcMatchRate2:'50',pcMatchUpTo2:'6',pcHsaFamily:false,pcHsaBoth:false,pcOrder:'match,ef,hsa,rothIra,k401max,brok',pcPlan:'',pcEfOn:false,pcMatch:'0',pcHsa:'0',pcEf:'0',pcRothIra:'0',pcK401max:'0',pcBrok:'0',pcMatchRoth:false,pcK401maxRoth:false,pcIraRoth:true,pcEfCap:'200'};
const jobs={
 stages: async()=>{await go(page,'/stages','stages',stages); await view(page,'stages_view'); await allCards(page,'stages');
   await click(page,'Historical','Balance over time'); await card(page,'Balance over time','stages_chart_hist');
   await click(page,'Monte Carlo','Balance over time'); await card(page,'Balance over time','stages_chart_mc');},
 calculator: async()=>{await go(page,'/calculator'); await view(page,'calculator_view'); await allCards(page,'calculator');},
 advanced: async()=>{await go(page,'/advanced'); await view(page,'advanced_view'); await allCards(page,'advanced');
   await click(page,'Historical','Balance over time'); await card(page,'Balance over time','advanced_chart_hist');
   await click(page,'Monte Carlo','Balance over time'); await card(page,'Balance over time','advanced_chart_mc');},
 drawdown: async()=>{await go(page,'/drawdown'); await closeIntro(page); await view(page,'drawdown_view'); await allCards(page,'drawdown');
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
 home: async()=>{await go(page,'/'); await view(page,'home_view'); await go(page,'/tools'); await view(page,'tools_view');},
};
for (const [k,f] of Object.entries(jobs)){ if(only && !only.split(',').includes(k)) continue; console.log(k); try{await f()}catch(e){console.log('  ERR',e.message)} }
await browser.close();
