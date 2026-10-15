/* Every year's figures, by year. The Income Tax tool lets you pick the year;
   everything else uses the newest. To add a year: its file beside 2026.js,
   then an import and an addYear() line here. Nothing else changes. */
import { YEAR_2026 } from "./2026.js";

export var YEAR_DATA = {};
/** The newest year there are figures for: what every tool uses, and where
    the Income Tax tool starts. */
export var NEWEST_YEAR = 0;
/** Adds a year's figures (each year's file, once, below). */
export function addYear(d){
  YEAR_DATA[d.year] = d;
  if (d.year > NEWEST_YEAR) NEWEST_YEAR = d.year;
}
addYear(YEAR_2026);

/** A year's figures: the newest year's when none is asked for, or when the
    year asked for isn't here (an old share link, say). */
export function yearData(year){
  return YEAR_DATA[year] || YEAR_DATA[NEWEST_YEAR];
}
/** The years there are figures for, newest first. */
export function dataYears(){
  return Object.keys(YEAR_DATA).map(Number).sort(function (a, b){ return b - a; });
}
