import puppeteer from 'puppeteer-core';
import path from 'path';
const src = path.resolve(process.argv[2]);
const b = await puppeteer.launch({executablePath:(process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'),headless:true,args:['--allow-file-access-from-files']});
const p = await b.newPage(); await p.setViewport({width:900,height:1100});
await p.goto('file://'+src,{waitUntil:'networkidle0'}); await p.evaluate(()=>document.fonts.ready);
const r = await p.evaluate(()=>[...document.querySelectorAll('section.page')].map((s,i)=>{
  const top=s.getBoundingClientRect().top; let max=0;
  for(const e of s.querySelectorAll('*')){ if(e.closest('.foot')||e.closest('.runhead')) continue; if(e.parentElement && (e.parentElement.closest('.crop')||e.parentElement.closest('.browser > div:last-child'))) continue; const bb=e.getBoundingClientRect(); if(bb.width&&bb.height) max=Math.max(max,bb.bottom-top); }
  const limit = s.classList.contains('dark')?1056:1016;
  return `${i+1}:${Math.round(limit-12-max)}`;
}).join('  '));
console.log(r); await b.close();
