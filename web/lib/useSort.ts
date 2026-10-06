"use client";

/* A table sorted by a clicked column heading. Clicking the sorted column
   again flips it; a new column starts in the direction `firstDir` gives
   (high to low unless told otherwise). */

import { useState } from "react";

type Dir = 1 | -1;

export function useSort<C extends string>(col: C, dir: Dir, firstDir: (c: C) => Dir = () => -1) {
  const [sort, setSort] = useState<{ col: C; dir: Dir }>({ col, dir });
  const by = (c: C) => setSort((s) => (s.col === c ? { col: c, dir: -s.dir as Dir } : { col: c, dir: firstDir(c) }));
  return {
    sort,
    /** What a sortable heading needs: its class, the click, the keyboard
        (Enter or Space), and the order announced to a screen reader. */
    th: (c: C, marked = true) => ({
      className: "sortcol" + (marked && sort.col === c ? (sort.dir > 0 ? " sort-asc" : " sort-desc") : ""),
      tabIndex: 0,
      "aria-sort": (marked && sort.col === c ? (sort.dir > 0 ? "ascending" : "descending") : "none") as "ascending" | "descending" | "none",
      onClick: () => by(c),
      onKeyDown: (e: React.KeyboardEvent) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); by(c); } },
    }),
    order: <T,>(list: readonly T[], val: (x: T, c: C) => number | string) =>
      list.slice().sort((a, b) => {
        const av = val(a, sort.col), bv = val(b, sort.col);
        return (typeof av === "string" ? av.localeCompare(bv as string) : av - (bv as number)) * sort.dir;
      }),
  };
}
