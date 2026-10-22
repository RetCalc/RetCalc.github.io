// List the cards on each page: index, heading text, size. Usage: node cards.mjs /route ...
import puppeteer from 'puppeteer-core';
const browser = await puppeteer.launch({executablePath:(process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'), headless:true});
const page = await browser.newPage();
await page.setViewport({width:1440,height:900,deviceScaleFactor:1});
await page.evaluateOnNewDocument(()=>{try{localStorage.setItem('retcalc.theme.v1','"light"')}catch(e){}});
for (const r of process.argv.slice(2)){
  await page.goto('https://retcalc.app'+r,{waitUntil:'networkidle0',timeout:60000});
  await new Promise(s=>setTimeout(s,2000));
  const list = await page.evaluate(()=>[...document.querySelectorAll('[data-slot="card"], section, .card, .panel')].map((e,i)=>{const b=e.getBoundingClientRect();const h=e.querySelector('h1,h2,h3,h4,[data-slot="card-title"]');return `${i} ${e.tagName}.${(e.className+'').slice(0,40)} ${Math.round(b.width)}x${Math.round(b.height)} @${Math.round(b.y+scrollY)} :: ${(h?.textContent||e.textContent).trim().slice(0,50)}`}));
  console.log('== '+r+'\n'+list.join('\n'));
}
await browser.close();
