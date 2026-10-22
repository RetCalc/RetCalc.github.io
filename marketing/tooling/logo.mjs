import {open} from './lib.mjs'; import fs from 'fs';
const {browser,page}=await open();
await page.goto('https://retcalc.app/',{waitUntil:'networkidle0'});
const svg=await page.evaluate(()=>{const a=document.querySelector('header a[href="/"]')||document.querySelector('a[href="/"]');const s=a.querySelector('svg');const cs=getComputedStyle(document.documentElement);return {svg:s?.outerHTML, vars:['--ds-brand-gold','--ds-brand-jade','--ds-brand-steel'].map(v=>cs.getPropertyValue(v))}});
fs.writeFileSync('../shots/logo_nav.svg',svg.svg||''); console.log(svg.vars, (svg.svg||'').slice(0,400));
await browser.close();
