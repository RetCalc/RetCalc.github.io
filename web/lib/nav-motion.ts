"use client";

/* Which way a page change goes, for the new page's entrance: into a tool
   ("fwd": it rises and settles), back out ("back": it drops in from above),
   or across ("tab"). Whoever navigates says which; anything else is across.
   From paneDir in src/js/app/09-navigation.js. */

export type NavDir = "tab" | "fwd" | "back";
let dir: NavDir = "tab";

export function setNavDir(d: NavDir) {
  dir = d;
}
/** The direction asked for, once: the next change is across again. */
export function takeNavDir(): NavDir {
  const d = dir;
  dir = "tab";
  return d;
}
