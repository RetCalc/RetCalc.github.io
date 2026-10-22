import puppeteer from 'puppeteer-core'; import fs from 'fs';
const dir=new URL('../shots/crops/', import.meta.url).pathname;
const out=new URL('../.preview/', import.meta.url).pathname; fs.mkdirSync(out,{recursive:true});
const pats=process.argv.slice(2);
const browser=await puppeteer.launch({executablePath:(process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'),headless:true,args:['--allow-file-access-from-files']});
const page=await browser.newPage(); await page.setViewport({width:1800,height:1000});
for(const p of pats){
 const files=fs.readdirSync(dir).filter(f=>f.startsWith(p)&&!f.includes('_view')).sort();
 const html=`<body style="margin:0;font:14px sans-serif;display:flex;flex-wrap:wrap;gap:10px;padding:10px;background:#ddd">${files.map(f=>`<div style="width:430px"><div>${f}</div><img src="file://${dir}${f}" style="width:430px;border:1px solid #999"></div>`).join('')}</body>`;
 fs.writeFileSync(out+'cs.html',html);
 await page.goto('file://'+out+'cs.html'); await new Promise(s=>setTimeout(s,800));
 await page.screenshot({path:out+'cs_'+p+'.png',fullPage:true});
}
await browser.close();
