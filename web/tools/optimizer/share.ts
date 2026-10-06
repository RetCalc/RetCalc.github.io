/* The Plan Optimizer's image card: the roadmap it found. From the
   optimizer card in src/js/app/25-share-card.js. */
import type { CardData } from "@/components/shell/share";
import { groupDigits, money, pctStr } from "@/lib/format";
import type { Result } from "./run";
import { opClaims, opCompact, opTacticsLine } from "./words";

export function optimizerCard(res: Result | null): CardData {
  if (!res) return { title: "My retirement roadmap", bigLabel: "Run the optimizer first", big: "—", sub: "", rows: [] };
  const b = res.best.stats, a = res.base.stats, C = { married: res.married, gap: res.age2 == null ? 0 : res.age2 - res.age1, rmdAge: res.rmdAge };
  return { title: "My retirement roadmap", bigLabel: "Left after tax, typical market", big: opCompact(b.medLegacy),
    sub: "Best of " + groupDigits(res.of, true) + " plans, tested in every market since " + res.first,
    rows: [["Social Security at", opClaims(res.best.T, C, true)], ["Lifetime tax", money(a.medTax) + " → " + money(b.medTax)],
      ["Lasted in", pctStr(b.successRate, 0) + " of markets"], ["Left after tax", opCompact(a.medLegacy) + " → " + opCompact(b.medLegacy)]],
    verdict: opTacticsLine(res.best.T, C) };
}
