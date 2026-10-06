/* Lets plain Node load the app's TypeScript logic files (model.ts and lib/)
   the way Next does: "@/..." means web/, and an import may leave off ".ts".
   Node 22 strips the types itself; .tsx files (screens) are never loaded. */
import { statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const WEB = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const isFile = (p) => { try { return statSync(p).isFile(); } catch { return false; } };

export async function resolve(spec, ctx, next) {
  let path = null;
  if (spec.startsWith("@/")) path = join(WEB, spec.slice(2));
  else if (/^\.\.?\//.test(spec) && ctx.parentURL?.startsWith("file:")) path = join(dirname(fileURLToPath(ctx.parentURL)), spec);
  if (path) {
    const hit = [path, path + ".ts", path + ".js", join(path, "index.ts")].find(isFile);
    if (hit) return next(pathToFileURL(hit).href, ctx);
  }
  return next(spec, ctx);
}
