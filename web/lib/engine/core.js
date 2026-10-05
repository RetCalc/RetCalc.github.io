/* The part of the engine every calculator needs: projections, taxes,
   healthcare, the market history, and the small calculators beside them.
   Screens import it through typed.ts; the Early Retirement Bridge and the
   retirement plan engine it uses come separately (typed-bridge.ts), so only
   the page that needs them loads them.

   drawdown.js comes first on purpose. math.js reads two of drawdown.js's
   tables inside a function, while drawdown.js reads math.js's historical
   data as it loads, so drawdown.js must ask for math.js (and have it finish
   loading) before its own top-level code runs. Anything that loads the
   engine starts here for that reason. */
export * from "./drawdown.js";
export * from "./math.js";
export * from "./calculators.js";
export * from "./fire.js";
export * from "./landing.js";
