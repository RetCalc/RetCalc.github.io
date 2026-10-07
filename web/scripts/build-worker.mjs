#!/usr/bin/env node
/* Builds public/engine-worker.js: the engine (math.js, drawdown.js and
   plan.js, between their START and END markers, `export` dropped) and
   lib/engine/worker-glue.js, as one plain script a Web Worker can load. The
   same assembly tests/run.py makes, and build.py made for the old site.
   Runs before `next build` and `next dev` (package.json).

   After them come the readiness guide's plan jobs (decision D7: new job
   types on this worker, not a second one): tools/guide/plan.worker.ts and
   everything it imports, each module turned into CommonJS by TypeScript and
   kept in a small module table. The three engine files already above aren't
   copied again: importing one gives the worker's own globals, so the
   guide's sums run on the same engine as the optimizer's. */
import { readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const WEB = join(dirname(fileURLToPath(import.meta.url)), "..");
const block = (name, tag) => {
  const text = readFileSync(join(WEB, "lib", "engine", name + ".js"), "utf8");
  const a = text.indexOf("// ===" + tag + " START==="), b = text.indexOf("// ===" + tag + " END===");
  if (a < 0 || b < 0) throw new Error(name + ".js has lost its " + tag + " markers");
  return text.slice(a, b);
};
const ENGINE = { math: block("math", "MATH"), drawdown: block("drawdown", "DRAWDOWN"), plan: block("plan", "PLAN") };

/* ---------- the guide's modules ---------- */
const isFile = (p) => { try { return statSync(p).isFile(); } catch { return false; } };
/** Where an import leads, as the app resolves it ("@/" is web/, ".ts" may be left off). */
function resolve(spec, from) {
  const base = spec.startsWith("@/") ? join(WEB, spec.slice(2)) : /^\.\.?\//.test(spec) ? join(dirname(from), spec) : null;
  if (!base) throw new Error(`${relative(WEB, from)} imports "${spec}": only the app's own modules can go in the worker`);
  const hit = [base, base + ".ts", base + ".js", join(base, "index.ts")].find(isFile);
  if (!hit) throw new Error(`${relative(WEB, from)} imports "${spec}", which isn't there`);
  return hit;
}
/** An engine file whose code is already in the worker: its exports, read
    through to the globals of the same names. */
function globalsModule(code) {
  const names = [...code.matchAll(/^export (?:async )?(?:function\*?|const|let|var|class)\s+([A-Za-z_$][\w$]*)/gm)].map((m) => m[1]);
  return 'Object.defineProperty(exports, "__esModule", { value: true });\nObject.defineProperties(exports, {\n' +
    names.map((n) => `  ${n}: { enumerable: true, get: function () { return ${n}; } }`).join(",\n") + "\n});";
}
function bundle(entry) {
  const mods = new Map();
  const add = (abs) => {
    const id = relative(WEB, abs).split("\\").join("/");
    if (mods.has(id)) return id;
    const eng = /^lib\/engine\/(math|drawdown|plan)\.js$/.exec(id);
    if (eng) { mods.set(id, globalsModule(ENGINE[eng[1]])); return id; }
    mods.set(id, "");
    const out = ts.transpileModule(readFileSync(abs, "utf8"), {
      fileName: abs, reportDiagnostics: false,
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: false, isolatedModules: true },
    }).outputText;
    mods.set(id, out.replace(/require\("([^"]+)"\)/g, (_, spec) => "require(" + JSON.stringify(add(resolve(spec, abs))) + ")"));
    return id;
  };
  const main = add(join(WEB, entry));
  return [
    "/* The readiness guide's plan jobs (scripts/build-worker.mjs, from " + entry + "). */",
    "(function () {",
    "  var defs = {", [...mods].map(([id, code]) => JSON.stringify(id) + ": function (module, exports, require) {\n" + code + "\n}").join(",\n"), "  };",
    "  var cache = {};",
    "  function require(id) { var m = cache[id]; if (m) return m.exports; m = cache[id] = { exports: {} }; defs[id](m, m.exports, require); return m.exports; }",
    "  require(" + JSON.stringify(main) + ");",
    "})();",
  ].join("\n");
}

const out = [
  "/* Built by scripts/build-worker.mjs from web/lib/engine and web/tools/guide; don't edit. */",
  ...Object.values(ENGINE).map((code) => code.replace(/^export /gm, "")),
  readFileSync(join(WEB, "lib", "engine", "worker-glue.js"), "utf8"),
  bundle("tools/guide/plan.worker.ts"),
].join("\n;\n");
writeFileSync(join(WEB, "public", "engine-worker.js"), out);
console.log("public/engine-worker.js: " + Math.round(out.length / 1024) + " KB");
