/* The notes that go with a market-history or Monte Carlo run, from
   histBarNote(), histWhen(), histSummary() and mcSummary() in
   src/js/app/04-charts.js. */
import type { HistRuns, HistWindow, MCResult } from "@/lib/engine/types";
import { fmtNum, fmtYears, money } from "@/lib/format";

export const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

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

/** Under a market-history chart: how many windows reach the target, the
    median, and the worst and best starts. From histSummary(). */
export function HistSummary({ id, H, target, label }: { id: string; H: HistRuns | null; target: number; label: string }) {
  if (!H || !H.count) {
    return (
      <div className="mcnote" id={id} hidden={!H?.tooLong}>
        {H?.tooLong ? <><b className="warn">{fmtYears(H.totalYears)}</b> is longer than the {H.span} years of history available ({H.first}{"–"}{H.last}). Shorten the plan to use this mode.</> : null}
      </div>
    );
  }
  const pct = target > 0 ? (H.finals.filter((f) => f >= target).length / H.count) * 100 : 0;
  return (
    <div className="mcnote" id={id}>
      {target > 0 ? <><b className={pct >= 75 ? undefined : "warn"}>{pct.toFixed(1) + "%"}</b> of windows reach {money(target)} {label}.{" "}</> : null}
      Median outcome <b>{money(H.median)}</b>. Worst window started {histWhen(H.worst)} ({money(H.worst.final)}), best started {histWhen(H.best)} ({money(H.best.final)}).
    </div>
  );
}

/** Under a Monte Carlo chart: how many runs reach the target. From mcSummary(). */
export function McSummary({ id, mc, target, label }: { id: string; mc: MCResult | null; target: number; label: string }) {
  if (!mc || !mc.finals.length || !(target > 0)) return <div className="mcnote" id={id} hidden></div>;
  const pct = (mc.finals.filter((f) => f >= target).length / mc.finals.length) * 100;
  return (
    <div className="mcnote" id={id}>
      <b className={pct >= 75 ? undefined : "warn"}>{pct.toFixed(0) + "%"}</b> of {mc.trials.toLocaleString("en-US")} runs reach {money(target)} {label}. Median outcome <b>{money(mc.median)}</b>.
    </div>
  );
}
