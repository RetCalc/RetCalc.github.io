/* The notes that go with a market-history run, from histBarNote() and
   histWhen() in src/js/app/04-charts.js. */
import type { HistRuns, HistWindow } from "@/lib/engine/types";
import { fmtNum, fmtYears } from "@/lib/format";

const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "Sep 1929", or the year alone for a window that starts in January. */
export function histWhen(w: HistWindow | undefined): string {
  return w?.startMonth ? MON[w.startMonth - 1] + " " + w.start : w ? String(w.start) : "";
}

/** What the run covers: how many windows, over which years. */
export function HistBarNote({ H, perStage }: { H: HistRuns | null; perStage?: boolean }) {
  if (!H || !H.count) {
    return <>{H?.tooLong ? "No window fits: history runs " + H.first + "–" + H.last + "." : "Add some years to run this."}</>;
  }
  return (
    <>
      <b>{fmtNum(H.count)}</b> rolling windows of {fmtYears(H.totalYears)}, compounded month by month, {H.first}{"–"}{H.last}.{" "}
      {perStage ? "Each stage uses its own stock mix, set on the cards above. " : ""}Your rate of return and inflation inputs are ignored in this mode.
    </>
  );
}
