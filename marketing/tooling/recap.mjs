import {open,go,click,card,view,sleep,allCards,unstick,share} from './lib.mjs';
import fs from 'fs';
const {browser,page}=await open();
const src=fs.readFileSync('shoot2.mjs','utf8');
const stages=eval(src.match(/const st=[\s\S]*?kidCover:\{\}\};/)[0]+';stages');
const note=async()=>page.evaluate(()=>[...document.querySelectorAll('[data-slot="card"]')].map(c=>c.textContent).find(t=>t.startsWith('Balance'))?.match(/Note.*$/)?.[0]);
for (const tgt of ['45,000','40,000']){
  await go(page,'/stages','stages',{...stages,target:tgt}); await click(page,'Historical','Balance over time'); await sleep(1500);
  console.log('stages',tgt,await note());
  await card(page,'Balance over time','stages_hist_'+tgt.replace(',',''));
}
// healthcare
await go(page,'/healthcare','healthcare',{retireAge:'60',status:'m',household:'2',spouseAge:'59',state:'IL',income:'95,000',ss:'',premium:''});
await allCards(page,'hc95');
// mortgage
await go(page,'/mortgage','mortgage',{price:'450,000',downPct:'20',downAmt:'90,000',rate:'7.25',term:'30',tax:'1.1',ins:'1,800',pmi:'0',hoa:'0',maint:'1',util:'300',extrasOn:'1',extraMo:'300',extraOnce:'10,000',extraWhen:'24',recast:'0',refiRate:'6.25',refiTerm:'30',refiCost:'4,500'});
await allCards(page,'mx');
// tools compact
await go(page,'/tools'); await click(page,'Compact'); await sleep(3000);
await page.screenshot({path:'../shots/crops/tools_compact_full.png',fullPage:true});
await go(page,'/tools'); await sleep(6000);
await page.screenshot({path:'../shots/crops/tools_charts_full.png',fullPage:true});
await browser.close();
