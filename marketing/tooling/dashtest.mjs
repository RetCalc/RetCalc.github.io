import {open,sleep} from './lib.mjs'; import fs from 'fs';
const seed=JSON.parse(fs.readFileSync('../../web/public/dev-seed.json','utf8'));
const {browser,page}=await open(process.argv[2]||'light');
await page.evaluateOnNewDocument(s=>{try{localStorage.setItem('rc-dev-account','1');for(const[k,v] of Object.entries(s)) if(!localStorage.getItem(k)) localStorage.setItem(k,typeof v==='string'?v:JSON.stringify(v))}catch(e){}},seed);
await page.goto('http://localhost:3190/dashboard',{waitUntil:'networkidle0'}); await sleep(3000);
await page.screenshot({path:'/private/tmp/claude-501/-Users-erikalfriend--claude-spares-spare-Z6Akha/bd6b054f-c8d0-465e-989c-b08c1fd78f92/scratchpad/d1.png'});
await browser.close();
