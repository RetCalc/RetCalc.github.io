/* For tests/run.py: the few figures the calculation tests check that live in
   the app's TypeScript rather than in web/lib/engine/ (the Roth and Debt
   tools' defaults, the Guide's score weights and ratings), printed as plain
   script in the shape tests/math.test.js reads them. Loads the TypeScript
   the way the baseline scripts do (web/scripts/baseline/loader.mjs). */
import { register } from "node:module";

register(new URL("../web/scripts/baseline/loader.mjs", import.meta.url));

const [{ ROTH_DEFAULTS }, { DEBT_DEFAULTS }, { FACTORS, rating }, { BRIDGE_DEFAULTS }] = await Promise.all([
  import("../web/tools/roth/model.ts"),
  import("../web/tools/debt/model.ts"),
  import("../web/tools/guide/calc.ts"),
  import("../web/tools/bridge/model.ts"),
]);

// The tools keep their inputs as the text in their fields ("1,500,000").
const num = (v) => (/^-?[\d,]+(\.\d+)?$/.test(v) ? Number(v.replace(/,/g, "")) : v);
const rc = Object.fromEntries(Object.entries(ROTH_DEFAULTS).map(([k, v]) => [k, num(v)]));
const debts = DEBT_DEFAULTS.rows.map((r) => ({ desc: r.desc, balance: num(r.balance), apr: num(r.apr), min: num(r.min) }));

console.log([
  "var RC_DEFAULTS = " + JSON.stringify(rc) + ";",
  "var DEBT_DEFAULTS = " + JSON.stringify(debts) + ";",
  "var GD_FACTORS = " + JSON.stringify(FACTORS) + ";",
  "var gdRating = " + rating.toString() + ";",
  "var BR_SEPP_RATE_DEFAULT = " + JSON.stringify(BRIDGE_DEFAULTS.seppRate) + ";",
].join("\n"));
