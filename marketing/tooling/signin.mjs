import {open,go,click,sleep,view} from './lib.mjs';
const {browser,page}=await open();
await go(page,'/calculator'); await click(page,'Sign in'); await sleep(1500);
const box=await page.evaluate(()=>{const d=document.querySelector('[role="dialog"]');if(!d)return null;const b=d.getBoundingClientRect();return {x:b.x,y:b.y,width:b.width,height:b.height}});
console.log(box);
if(box) await page.screenshot({path:'../shots/crops/signin_dialog.png',clip:box});
await view(page,'signin_view');
await browser.close();
