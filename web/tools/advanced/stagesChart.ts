/* What the chart draws for a run of stages, in each mode: the Dashboard's
   plan (PlanScreen.tsx) and the site's Advanced with changes ahead on
   (Advanced.tsx). Each point carries its stage, for the Dashboard's
   tooltip; the marks are the stage boundaries, which each screen replaces
   with where its changes start. */

import { emptyChart, fanPoints, histChart, type ChartData, type ChartMode } from "@/components/tools/Projection";
import { historicalRuns, monteCarlo, projectSeries } from "@/lib/engine/typed";
import { fraction } from "@/lib/format";
import { MC_RUNS } from "@/lib/mc-seed";
import type { stagesCompute } from "@/tools/stages/model";
import { histMixOf, type HistMixFields } from "./HistMix";

/** `glideAt`: where a glide split year by year has got to in each stage
    (0 to 1), so historical mode's mix moves along with it; none, the mix
    holds until a stage's own glide. */
export function stagesChart(s: HistMixFields & { histMixEnd: string }, V: ReturnType<typeof stagesCompute>, mode: ChartMode, band: number, seed: number, glideAt?: (number | null)[]): ChartData {
  const { P, R } = V, g = P.g;
  if (!R.rows.length) return emptyChart();
  const defl = (yr: number) => Math.pow(1 + g.inflation, yr);
  const marks = R.summary.slice(0, -1).map((x) => ({ year: x.endYear, label: String(x.stage + 1) }));
  const start = { year: 0, stage: 1, base: g.initial, hi: g.initial, lo: g.initial, p25: g.initial, p75: g.initial };
  if (mode === "hist") {
    // US stocks and small-cap value together are the stocks; small value's
    // share of them and cash's share of the rest (bonds are what's left).
    const { mix, full } = histMixOf(s), endMix = fraction(s.histMixEnd);
    const H = historicalRuns({ initial: g.initial, fees: g.fees }, P.eff.map((st, i) => {
      const at = glideAt?.[i];
      return { ...st, mix: at == null ? mix : mix + (endMix - mix) * at, ...full, ...(st.glide?.on ? { glide: { ...st.glide, endMix } } : {}) };
    }));
    return histChart(start, H, marks, (b) => ({ stage: (b as { stage?: number }).stage }));
  }
  if (mode === "mc") {
    const mc = monteCarlo(g, P.eff, MC_RUNS, seed);
    const pts = fanPoints({ ...start, det: g.initial }, mc.bands, (b, i) => ({
      stage: R.chartRows[i] ? R.chartRows[i].stage : 1,
      det: R.chartRows[i] ? R.chartRows[i].end / defl(R.chartRows[i].year) : b.p50,
    }));
    return { ...emptyChart(true), pts, marks, legend: "mc", mc };
  }
  const shift = (d: number) => P.eff.map((st) => ({ ...st, nominal: Math.max(-0.99, st.nominal + d) }));
  const hiR = projectSeries(g, shift(band)), loR = projectSeries(g, shift(-band));
  const pts = [{ year: 0, stage: 1, base: g.initial, hi: g.initial, lo: g.initial }, ...R.chartRows.map((r, i) => ({
    year: r.year, stage: r.stage, base: r.end / defl(r.year),
    hi: (hiR.chartRows[i] ? hiR.chartRows[i].end : r.end) / defl(r.year),
    lo: (loR.chartRows[i] ? loR.chartRows[i].end : r.end) / defl(r.year),
  }))];
  return { ...emptyChart(), pts, marks, legend: "band" };
}
