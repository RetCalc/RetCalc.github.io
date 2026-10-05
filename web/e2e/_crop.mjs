import { readFileSync, writeFileSync } from "node:fs";
import { PNG } from "pngjs";
const [src, out, y0, y1] = process.argv.slice(2);
const p = PNG.sync.read(readFileSync(src)), h = +y1 - +y0;
const o = new PNG({ width: p.width, height: h });
PNG.bitblt(p, o, 0, +y0, p.width, h, 0, 0);
writeFileSync(out, PNG.sync.write(o));
