/* The Milestones panel of the retirement calculators: the year growth first
   outpaces contributions, the year each round balance is reached, and what
   fees cost. From renderMilestones() in src/js/app/03-projection.js. */
import { DASH, fmtNum, money } from "@/lib/format";
import { KV } from "./Readout";

const LADDER = [50e3, 100e3, 250e3, 500e3, 1e6, 2e6, 3e6, 5e6, 10e6, 25e6, 50e6, 100e6];

export interface MilestoneRow { year: number; end: number; growth: number; contrib: number }

const Label = ({ main, sub, flag }: { main: React.ReactNode; sub?: string; flag?: boolean }) => (
  <>{flag ? <b className="msflag">{main}</b> : main}{sub ? <span className="mssub">{sub}</span> : null}</>
);

/** `alreadyReal`: the rows are in today's dollars, so no conversion is shown.
    `wholeYears`: label a mid-year milestone by the year it's reached by. */
export function Milestones({ rows, infl = 0, feeCost = 0, horizon = 0, alreadyReal, wholeYears }: {
  rows: MilestoneRow[]; infl?: number; feeCost?: number; horizon?: number; alreadyReal?: boolean; wholeYears?: boolean;
}) {
  if (!rows.length) return <div className="hint">Add some years to see milestones.</div>;
  const yr = (y: number) => (wholeYears ? fmtNum(Math.ceil(y)) : fmtNum(y));
  const final = rows[rows.length - 1].end;
  const cross = rows.find((r) => r.growth > r.contrib && r.contrib > 0);
  return (
    <>
      <KV k={<Label flag main="Crossover" sub={cross ? "Growth first outpaces what you put in" : "Growth never overtakes contributions in this run"} />}
        v={cross ? "Year " + yr(cross.year) : DASH} />
      {LADDER.filter((v) => v <= final).slice(-6).map((v) => {
        const hit = rows.find((r) => r.end >= v);
        return (
          <KV key={v} k={<Label main={money(v)} sub={alreadyReal ? undefined : money(v / Math.pow(1 + infl, hit ? hit.year : 0)) + " in today's dollars"} />}
            v={"Year " + (hit ? yr(hit.year) : DASH)} />
        );
      })}
      {feeCost > 0 ? (
        <div className="kv total"><span className="k">Cost of fees<span className="mssub">What fees take out over {fmtNum(horizon)} years</span></span>
          <span className="v neg">{"−" + money(feeCost)}</span></div>
      ) : null}
    </>
  );
}
