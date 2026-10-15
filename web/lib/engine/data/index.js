/* The engine's figures, kept apart from its calculations: each tax year's
   (years.js and a file per year), and those that don't change with the
   year: the market's history (history.js) and the IRS life tables and
   starting mortgage rate (tables.js). tests/run.py and
   scripts/build-worker.mjs follow these imports to put them in front of the
   engine. */
export * from "./years.js";
export * from "./history.js";
export * from "./tables.js";
