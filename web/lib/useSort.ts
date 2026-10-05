"use client";

/* A table sorted by a clicked column heading. Clicking the sorted column
   again flips it; a new column starts in the direction `firstDir` gives
   (high to low unless told otherwise). */

import { useState } from "react";

type Dir = 1 | -1;

export function useSort<C extends string>(col: C, dir: Dir, firstDir: (c: C) => Dir = () => -1) {
  const [sort, setSort] = useState<{ col: C; dir: Dir }>({ col, dir });
  return {
    sort,
    by: (c: C) => setSort((s) => (s.col === c ? { col: c, dir: -s.dir as Dir } : { col: c, dir: firstDir(c) })),
    /** The heading's class: marked when it is the sorted column. */
    cls: (c: C, marked = true) => "sortcol" + (marked && sort.col === c ? (sort.dir > 0 ? " sort-asc" : " sort-desc") : ""),
    order: <T,>(list: readonly T[], val: (x: T, c: C) => number | string) =>
      list.slice().sort((a, b) => {
        const av = val(a, sort.col), bv = val(b, sort.col);
        return (typeof av === "string" ? av.localeCompare(bv as string) : av - (bv as number)) * sort.dir;
      }),
  };
}
