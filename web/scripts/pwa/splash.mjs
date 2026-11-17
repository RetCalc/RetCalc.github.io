#!/usr/bin/env node
/* Makes the home-screen app's launch pictures (public/splash/): the page's
   ground in each theme with the app icon in the middle, one per iPhone
   screen size, so the app opens on its own color instead of a black, then
   white, flash. iOS shows the one whose size matches the device exactly;
   lib/splash.ts lists them for app/layout.tsx. Run by hand when the icon or
   the ground colors change:

     node scripts/pwa/splash.mjs
*/
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const WEB = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const OUT = join(WEB, "public", "splash");
/* Portrait size in points, and the screen's pixel ratio. */
const SCREENS = [
  [440, 956, 3], // iPhone 16/17 Pro Max
  [402, 874, 3], // iPhone 16/17 Pro, iPhone 17
  [420, 912, 3], // iPhone Air
  [430, 932, 3], // iPhone 14 Pro Max, 15/16 Plus, 15 Pro Max
  [393, 852, 3], // iPhone 14 Pro, 15, 15 Pro, 16, 16e
  [428, 926, 3], // iPhone 12/13 Pro Max, 14 Plus
  [390, 844, 3], // iPhone 12, 13, 14
  [375, 812, 3], // iPhone X, XS, 11 Pro, 12/13 mini
  [414, 896, 3], // iPhone XS Max, 11 Pro Max
  [414, 896, 2], // iPhone XR, 11
  [375, 667, 2], // iPhone SE (2nd and 3rd)
];
const GROUND = { light: "#f5f5f7", dark: "#000000" };
const icon = readFileSync(join(WEB, "public", "favicon.svg"));
mkdirSync(OUT, { recursive: true });
const list = [];
for (const [w, h, r] of SCREENS) {
  const side = Math.round(96 * r);
  const mark = await sharp(icon, { density: 72 * (side / 64) }).resize(side, side).png().toBuffer();
  for (const theme of ["light", "dark"]) {
    const file = `${w}x${h}@${r}-${theme}.png`;
    await sharp({ create: { width: w * r, height: h * r, channels: 3, background: GROUND[theme] } })
      .composite([{ input: mark, gravity: "center" }]).png({ compressionLevel: 9, palette: true }).toFile(join(OUT, file));
    list.push({ url: "/splash/" + file, media: `(device-width: ${w}px) and (device-height: ${h}px) and (-webkit-device-pixel-ratio: ${r}) and (orientation: portrait) and (prefers-color-scheme: ${theme})` });
  }
}
writeFileSync(join(WEB, "lib", "splash.json"), JSON.stringify(list, null, 2) + "\n");
console.log(`${list.length} launch pictures in public/splash, listed in lib/splash.json`);
