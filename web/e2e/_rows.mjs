import { readFileSync } from "node:fs";
import { PNG } from "pngjs";
const p = PNG.sync.read(readFileSync(process.argv[2]));
const rows = [];
for (let y = 0; y < p.height; y++) {
  let n = 0;
  for (let x = 0; x < p.width; x++) { const i = (y * p.width + x) * 4; if (p.data[i] > 200 && p.data[i + 1] < 90 && p.data[i + 2] < 90) n++; }
  if (n) rows.push([y, n]);
}
// group into bands
const bands = []; for (const [y, n] of rows) { const b = bands[bands.length - 1]; if (b && y - b.to <= 3) { b.to = y; b.n += n; } else bands.push({ from: y, to: y, n }); }
console.log(p.width, p.height, JSON.stringify(bands.filter((b) => b.n > 20)));
