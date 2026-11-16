"use client";

/* How you compare to the usual rules, on Spending: a card per rule (your
   share large, the guideline under it, a short bar with a tick where the
   guideline sits), then needs, wants and saving against 50/30/20. The
   figures are budget-rules.ts's; this only draws them. */

import { GaugeIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { TipDot } from "@/components/shell/Tooltips";
import { budgetRules, type RuleCard, type Split } from "./budget-rules";
import type { Flow } from "./flows";
import { money } from "./format";
import { otherMonth } from "./model";
import type { Profile } from "./store";
import { Tile } from "./ui";

const pts = (n: number) => { const v = Math.round(n * 10) / 10; return v + (v === 1 ? " pt" : " pts"); };
const ofWords = (c: RuleCard) => (c.of === "gross" ? "pay before taxes" : "income after taxes");
const guide = (c: RuleCard) => (c.atLeast ? `at least ${c.min}%` : c.min != null ? `${c.min}–${c.max}%` : `under ${c.max}%`);
function status(c: RuleCard) {
  if (!c.ok) return c.atLeast ? pts(c.gap) + " short" : pts(c.gap) + " over";
  if (c.atLeast) return "On track";
  return c.min != null && c.pct >= c.min ? "In range" : "Under";
}

/** The bar: your share filled, the guideline as a tick (a range as an
    outlined band), on a scale a little past whichever is larger. */
function Bar({ c }: { c: RuleCard }) {
  const mark = c.max ?? c.min ?? 0, top = Math.max(mark * 1.6, c.pct * 1.1, 1);
  const at = (x: number) => (Math.min(100, (x / top) * 100)).toFixed(2) + "%";
  return (
    <div className="dsh-br-bar" aria-hidden="true">
      <i className="dsh-br-fill" data-ok={c.ok ? "" : undefined} style={{ "--w": at(c.pct) } as React.CSSProperties} />
      {c.min != null && c.max != null ? <i className="dsh-br-band" style={{ "--a": at(c.min), "--b": at(c.max) } as React.CSSProperties} /> : <i className="dsh-br-tick" style={{ "--a": at(mark) } as React.CSSProperties} />}
    </div>
  );
}

function Card({ c }: { c: RuleCard }) {
  const tip = `Yours: ${money(c.dollars)} per month of ${money(c.base)} ${ofWords(c)}.` + (c.ok ? "" : c.atLeast ? ` ${money(c.gapDollars)} more per month reaches ${c.min}%.` : ` ${money(c.gapDollars)} per month over the guideline.`);
  return (
    <div className="dsh-br-card">
      <Badge variant={c.ok ? "positive" : "caution"}>{status(c)}</Badge>
      <div className="dsh-br-name"><span className="tipglue">{c.name} <TipDot k="" title={c.name} text={tip + " " + c.why} /></span></div>
      <div className="dsh-fig">{Math.round(c.pct)}%</div>
      <div className="dsh-cap">Guideline {guide(c)}</div>
      <Bar c={c} />
      <div className="dsh-cap">Of {ofWords(c)}</div>
    </div>
  );
}

const PARTS = [
  { k: "need", name: "Needs", rule: 50, cap: true, what: "housing, utilities, getting around, health, groceries and debt payments" },
  { k: "want", name: "Wants", rule: 30, cap: true, what: "eating out, hobbies, subscriptions, travel, gifts and the like" },
  { k: "save", name: "Saving", rule: 20, cap: false, what: "what's left after spending: saved through work, invested, or not yet given a job" },
] as const;

function SplitCard({ s }: { s: Split }) {
  const amt = { need: s.need, want: s.want, save: s.save }, pct = { need: s.needPct, want: s.wantPct, save: s.savePct };
  // The bar shows what's spent and saved; overspending leaves no saving to draw.
  const width = (k: keyof typeof amt) => Math.max(0, amt[k]);
  return (
    <div className="dsh-br-card dsh-br-split">
      <div className="dsh-br-three">
        {PARTS.map((p) => {
          const d = pct[p.k] - p.rule, bad = p.cap ? d > 0.5 : d < -0.5;
          return (
            <div key={p.k}>
              <div className="dsh-label"><i className="dsh-br-sw" data-k={p.k} />{p.name}</div>
              <div className="dsh-fig dsh-md">{Math.round(pct[p.k])}%</div>
              <div className="dsh-br-d" data-bad={bad ? "" : undefined}>{d >= 0 ? "+" : "−"}{pts(Math.abs(d))}</div>
              <div className="dsh-cap">Rule {p.rule}%</div>
            </div>
          );
        })}
      </div>
      <div className="dsh-br-one">
        <div className="dsh-br-name"><span className="tipglue">Needs, wants and saving <TipDot k="" title="50/30/20" text={PARTS.map((p) => `${p.name}: ${money(amt[p.k])} per month, ${p.what}.`).join(" ") + ` The 50/30/20 rule, from Elizabeth Warren's All Your Worth: half of income after taxes to needs, 30% to wants, 20% to saving. Income here is ${money(s.base)} per month after taxes, with premiums taken out of pay added back. A line you add to the budget above can be set to Need or Want.`} /></span> <span className="dsh-br-sub">· 50/30/20 of income after taxes</span></div>
        <div className="dsh-br-stack">
          <div className="dsh-br-segs">
            {PARTS.map((p) => <i key={p.k} data-k={p.k} style={{ "--g": width(p.k) } as React.CSSProperties} />)}
          </div>
          <i className="dsh-br-rtick" data-at="50" /><i className="dsh-br-rtick" data-at="80" />
        </div>
        <div className="dsh-br-marks" aria-hidden="true"><span data-at="25">Needs under 50%</span><span data-at="65">Wants 30%</span><span data-at="90">Saving 20%</span></div>
      </div>
    </div>
  );
}

export function BudgetRules({ pr, F }: { pr: Profile; F: Flow }) {
  if (!F.hasPay) return null;
  const R = budgetRules({
    rows: F.b.rows, rent: pr.home !== "own", gross: F.gross, after: F.afterTax + otherMonth(pr),
    premiums: F.spend - F.spendPaid, save: F.invested + F.match,
  });
  if (!R.cards.length) return null;
  return (
    <Tile id="rules" className="dsh-r4" icon={GaugeIcon} title="How you compare to the usual rules" right={<span className="dsh-cap">Rules of thumb, not grades</span>}>
      <div className="dsh-br" data-n={R.cards.length}>
        {R.cards.map((c) => <Card key={c.id} c={c} />)}
        {R.split ? <SplitCard s={R.split} /> : (
          <div className="dsh-br-card dsh-br-split dsh-br-wait">
            <div className="dsh-cap">Needs, wants and saving shows once &ldquo;Everything else&rdquo; in your budget above is split into lines. <a href="#budget">Go to your budget</a></div>
          </div>
        )}
      </div>
    </Tile>
  );
}
