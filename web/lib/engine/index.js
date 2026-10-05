/* The calculation engine, one import for the whole site:

     import { project, monteCarlo, runDrawdown } from "@/lib/engine";

   drawdown.js comes first on purpose. math.js reads two of drawdown.js's
   tables inside a function, while drawdown.js reads math.js's historical
   data as it loads, so drawdown.js must ask for math.js (and have it finish
   loading) before its own top-level code runs. */
export * from "./drawdown.js";
export * from "./math.js";
export * from "./plan.js";
export * from "./calculators.js";
