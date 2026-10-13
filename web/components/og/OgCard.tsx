/* A link-preview card, 1200 by 630: the page's name and question on the
   left, the homepage's chart of the tool on the right, in the site's dark
   theme. Drawn by app/og-card (development only) and saved as an image by
   scripts/og/render.mjs; the words are in lib/cards.ts. */

import { Brandmark } from "@/components/shell/Brandmark";
import {
  BridgeChart, BudgetChart, CloudChart, FanChart, FireChart, GrowthChart, HealthChart, MortgageChart, RentBuyChart, RothChart, ScoreRing, TaxChart,
} from "@/components/home/charts";
import type { HomeData } from "@/components/home/data";
import type { Card } from "@/lib/cards";
import { money } from "@/lib/format";
import { STATE_OPTIONS } from "@/lib/states";
import s from "./og.module.css";

type Pt = [number, number];
const d = (pts: Pt[]) => pts.map((p, i) => (i ? "L" : "M") + p[0].toFixed(1) + " " + p[1].toFixed(1)).join("");

export function OgCard({ card, data }: { card: Card; data: HomeData }) {
  const home = !card.kick;
  return (
    <div className={"hm " + s.card} data-og-card="">
      <div className={s.copy}>
        <div className={s.brand}><Brandmark /><span>RetCalc</span></div>
        <div className={s.mid}>
          {card.kick && card.kick !== "RetCalc" ? <div className={s.kick}>{card.kick}</div> : null}
          {home
            ? <h1 className={s.display}>Know your <em>number.</em></h1>
            : <h1 className={s.title}>{card.title}</h1>}
          <p className={s.text}>{card.text}</p>
        </div>
        <div className={s.foot}><b>retcalc.app</b><span>Free, no account needed</span></div>
      </div>
      <div className={s.panel}>
        {card.lasted ? (
          <div className={s.reading}>
            <div className={s.v}>{Math.round(data.lasted * 100)}%</div>
            <div className={s.k}>of retirements since 1926 lasted 30 years at 4% a year</div>
          </div>
        ) : card.chart === "tax" ? (
          <div className={s.reading}>
            <div className={s.v}>{money(data.tax.takeHome)}</div>
            <div className={s.k}>take-home from a {money(data.tax.gross)} salary in {STATE_OPTIONS.find((o) => o.code === data.tax.stateName)?.name ?? data.tax.stateName}</div>
          </div>
        ) : card.chart === "growth" ? (
          <div className={s.reading}>
            <div className={s.v}>{money(data.growth[data.growth.length - 1])}</div>
            <div className={s.k}>at 65, from $60,000 at 32 and $1,500 a month</div>
          </div>
        ) : null}
        <div className={s.chart + " " + (s[card.chart] ?? "")}><Chart card={card} data={data} /></div>
        {card.chart === "cloud" ? <div className={s.k}>Each dot is a plan. The ring marks the one that leaves you the most.</div> : null}
      </div>
    </div>
  );
}

function Chart({ card, data }: { card: Card; data: HomeData }) {
  switch (card.chart) {
    // Only the 4% pages show which retirements ran out: the paths are the
    // 4% plan's, and other strategies run out at different times or never.
    case "fan": return card.lasted
      ? <FanChart fan={data.fan} w={340} h={170} />
      : <FanChart fan={{ lines: data.fan.lines, failed: data.fan.failed.map(() => false) }} w={340} h={290} />;
    case "growth": return <GrowthChart values={data.growth} w={340} h={180} />;
    case "score": return <ScoreRing />;
    case "fire": return <FireChart w={340} h={260} />;
    case "bridge": return <BridgeChart w={250} h={110} />;
    case "health": return <HealthChart w={340} h={260} />;
    case "cloud": return <CloudChart />;
    case "roth": return <RothChart w={340} h={260} />;
    case "tax": return <TaxChart tax={data.tax} w={340} h={130} />;
    case "rentbuy": return <RentBuyChart rb={data.rentbuy} w={340} h={250} />;
    case "mortgage": return <MortgageChart years={data.mortgage} w={340} h={260} />;
    case "budget": return <BudgetChart w={280} h={130} />;
    case "college": return <CollegeChart />;
    case "debt": return <DebtChart />;
    case "tools": return <ToolsGrid />;
  }
}

/** College: monthly saving rising to the cost of four years (illustration). */
function CollegeChart({ w = 340, h = 250 }) {
  const goal = 150, pts: Pt[] = [];
  let v = 4;
  for (let a = 0; a <= 18; a++) { pts.push([10 + a * (w - 20) / 18, h - 10 - (v / goal) * (h - 50)]); v = v * 1.055 + 4.4; }
  const gy = h - 10 - (h - 50);
  return (
    <svg className="hm-chart" viewBox={`0 0 ${w} ${h}`} aria-hidden="true">
      <line className="hm-dash" x1={10} x2={w - 10} y1={gy} y2={gy} />
      <text x={10} y={gy - 10}>Four years of tuition</text>
      <path className="hm-ln" d={d(pts)} />
      <circle className="hm-dot" cx={w - 10} cy={pts[18][1]} r={5} />
      <text x={10} y={h + 14}>Birth</text>
      <text x={w - 10} y={h + 14} textAnchor="end">18</text>
    </svg>
  );
}

/** Debt payoff: the avalanche and snowball balances racing to zero (illustration). */
function DebtChart({ w = 340, h = 250 }) {
  const line = (rate: number, end: number) => {
    const pts: Pt[] = [];
    for (let m = 0; m <= end; m++) { const f = 1 - Math.pow(m / end, rate); pts.push([10 + m * (w - 20) / 60, 30 + (1 - f) * (h - 70)]); }
    return pts;
  };
  const av = line(1.5, 42), sn = line(1.2, 58);
  return (
    <svg className="hm-chart" viewBox={`0 0 ${w} ${h}`} aria-hidden="true">
      <g>
        <rect className="f-teal" x={10} y={2} width={9} height={9} rx={2} /><text x={24} y={10.5}>Avalanche</text>
        <rect className="f-sky" x={110} y={2} width={9} height={9} rx={2} /><text x={124} y={10.5}>Snowball</text>
      </g>
      <path className="hm-ln hm-thin s-sky" d={d(sn)} />
      <path className="hm-ln hm-thin s-teal" d={d(av)} />
      <circle className="hm-dot" cx={av[av.length - 1][0]} cy={av[av.length - 1][1]} r={5} />
      <text className="hm-t-ink" x={av[av.length - 1][0]} y={av[av.length - 1][1] + 26} textAnchor="middle">Debt-free</text>
    </svg>
  );
}

/** The tools page: four of the homepage's tool views, each with its name. */
function ToolsGrid() {
  const tiles: [string, React.ReactNode][] = [
    ["FIRE", <FireChart key="f" w={200} h={120} />], ["Early retirement", <BridgeChart key="b" w={200} h={110} />],
    ["Healthcare", <HealthChart key="h" w={200} h={120} />], ["Roth & RMDs", <RothChart key="r" w={200} h={120} />],
  ];
  return (
    <div className={s.grid}>
      {tiles.map(([n, c]) => <div key={n} className={s.mini}><span>{n}</span>{c}</div>)}
    </div>
  );
}
