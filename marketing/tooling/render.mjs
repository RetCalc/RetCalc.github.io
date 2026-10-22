import puppeteer from 'puppeteer-core';
import path from 'path';
const [src, out, shots] = process.argv.slice(2).map((p) => p && path.resolve(p));
const browser = await puppeteer.launch({executablePath:(process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'), headless:true, args:['--allow-file-access-from-files']});
const page = await browser.newPage();
await page.setViewport({width:900,height:1100,deviceScaleFactor:1});
await page.goto('file://'+src, {waitUntil:'networkidle0', timeout:120000});
await page.evaluate(()=>document.fonts.ready);
await page.pdf({path: out, width:'8.5in', height:'11in', printBackground:true, preferCSSPageSize:true});
if (shots) { // per-page PNG previews for review
  (await import('fs')).mkdirSync(shots, { recursive: true });
  const els = await page.$$('section.page');
  for (let i=0;i<els.length;i++) await els[i].screenshot({path:`${shots}/p${String(i+1).padStart(2,'0')}.png`});
}
await browser.close();
console.log('wrote', out);
