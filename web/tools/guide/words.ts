/* How the guide says a figure in a sentence: prose rounds, tables keep the
   exact figure (doc 1, principle 7). */

import { money } from "@/lib/format";

/** $1.52M, $567,000, $940. */
export function rounded(v: number): string {
  const x = Math.abs(v), sign = v < 0 ? "-" : "";
  if (x >= 1e6) return sign + "$" + (x / 1e6).toFixed(2).replace(/\.?0+$/, "") + "M";
  if (x >= 1e4) return money(Math.round(v / 1000) * 1000);
  return money(v);
}

/** "a, b and c". */
export const and = (list: string[]) => list.join(", ").replace(/, ([^,]*)$/, " and $1");
