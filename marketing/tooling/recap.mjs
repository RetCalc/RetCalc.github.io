// Second-pass captures: Healthcare and Mortgage with sample inputs, and the tool list.
// (The Stages loop is gone: Advanced with Changes ahead is the `advanced` job in shoot2.mjs.)
import {open,go,click,sleep,allCards,reveal,CROPS} from './lib.mjs';
const {browser,page}=await open();
// healthcare: a couple retiring at 60 on $95,000, just over the ACA subsidy cliff
await go(page,'/healthcare','healthcare',{retireAge:'60',status:'m',household:'2',spouseAge:'59',state:'IL',income:'95,000',ss:'',premium:''});
await allCards(page,'hc95');
// mortgage: $300 extra per month, $10,000 in month 24, a refinance to 6.25%
await go(page,'/mortgage','mortgage',{price:'450,000',downPct:'20',downAmt:'90,000',rate:'7.25',term:'30',tax:'1.1',ins:'1,800',pmi:'0',hoa:'0',maint:'1',util:'300',extrasOn:'1',extraMo:'300',extraOnce:'10,000',extraWhen:'24',recast:'0',refiRate:'6.25',refiTerm:'30',refiCost:'4,500'});
await allCards(page,'mx');
// tools: compact list (all 14 visible) and the chart tiles
await go(page,'/tools'); await click(page,'Compact'); await sleep(3000);
await page.screenshot({path:CROPS+'tools_compact_full.png',fullPage:true}); console.log('  tools_compact_full');
await go(page,'/tools'); await click(page,'Charts'); await reveal(page); await sleep(3000);
await page.screenshot({path:CROPS+'tools_charts_full.png',fullPage:true}); console.log('  tools_charts_full');
await browser.close();
