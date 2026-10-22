// Contact sheet of slide PNGs: node sheet2.mjs <dir> <out.png> <from> <to> [cols]
import puppeteer from 'puppeteer-core'; import fs from 'fs';
const [dir, out, from, to, cols = '3'] = process.argv.slice(2);
const files = fs.readdirSync(dir).filter((f) => /^s\d+\.png$/.test(f)).sort().slice(+from - 1, +to);
fs.writeFileSync(dir + '/sheet.html', `<body style="margin:0;background:#555;display:grid;grid-template-columns:repeat(${cols},1fr);gap:10px;padding:10px">${files.map((f) => `<div><div style="color:#fff;font:13px sans-serif">${f}</div><img src="file://${dir}/${f}" style="width:100%"></div>`).join('')}</body>`);
const b = await puppeteer.launch({ executablePath: (process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'), headless: true, args: ['--allow-file-access-from-files'] });
const p = await b.newPage(); await p.setViewport({ width: 2000, height: 800 });
await p.goto('file://' + dir + '/sheet.html'); await new Promise((r) => setTimeout(r, 800));
await p.screenshot({ path: out, fullPage: true }); await b.close();
