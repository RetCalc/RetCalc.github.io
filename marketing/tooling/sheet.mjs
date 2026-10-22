import puppeteer from 'puppeteer-core'; import fs from 'fs';
const [dir, out, from, to, cols='4', width='1800'] = process.argv.slice(2);
const files = fs.readdirSync(dir).filter(f=>/^p\d+\.png$/.test(f)).sort().slice(+from-1, +to);
const html = `<body style="margin:0;background:#666;display:grid;grid-template-columns:repeat(${cols},1fr);gap:12px;padding:12px">${files.map(f=>`<div><div style="color:#fff;font:12px sans-serif">${f}</div><img src="file://${dir}/${f}" style="width:100%"></div>`).join('')}</body>`;
fs.writeFileSync(dir+'/sheet.html', html);
const b = await puppeteer.launch({executablePath:(process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'),headless:true,args:['--allow-file-access-from-files']});
const p = await b.newPage(); await p.setViewport({width:+width,height:800});
await p.goto('file://'+dir+'/sheet.html'); await new Promise(r=>setTimeout(r,800));
await p.screenshot({path:out, fullPage:true}); await b.close();
