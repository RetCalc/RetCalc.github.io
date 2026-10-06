"use client";

/* The Early Retirement Bridge's printed summary and image card. From
   buildBridgeSheet() in src/js/app/36-bridge.js and the bridge card in
   25-share-card.js. */

import { SheetPage, SheetSection, SheetTable, type SheetRows } from "@/components/shell/Sheet";
import { copyChart, type ShareKit } from "@/components/shell/share";
import { HIST_START, STATES } from "@/lib/engine/typed";
import { DASH, fmtNum, money, pctStr } from "@/lib/format";
import { holdPct, lowerName, type BridgeRun, type RunPlan } from "./run";

/** `sel`: the plan picked on the page, the one the detail follows. */
export function bridgeShare(R: BridgeRun | null, sel: RunPlan | null): ShareKit {
  return {
    sheet: () => {
      if (!R || !sel) return "Enter your balances first";
      const ctx = R.ctx, b = R.best, st = b.steady, e = sel.steady.end;
      const situation: SheetRows = [["Retire at", fmtNum(ctx.age)], ["Filing status", ctx.status === "m" ? "Married filing jointly" : "Single"],
        ["State", (STATES as Record<string, { n: string }>)[ctx.state]?.n || ctx.state], ["Spending, after tax", money(ctx.spend) + "/yr"],
        ["Traditional", money(ctx.trad) + (ctx.k401 > 0 ? " (" + money(ctx.k401) + " in the 401(k) you're leaving)" : "")],
        ["Roth", money(ctx.roth) + " (" + money(ctx.rothBasis) + " contributions)"], ["Brokerage", money(ctx.brok) + " at " + pctStr(ctx.basisPct, 0) + " basis"]];
      if (ctx.g457 > 0) situation.push(["457(b)", money(ctx.g457)]);
      situation.push(["Stocks", fmtNum(ctx.stock) + "%"]);
      if (ctx.work > 0) situation.push(["Part-time work", money(ctx.work) + "/yr until " + fmtNum(ctx.workUntil)]);
      situation.push(["Health insurance", ctx.aca ? "ACA with subsidy, household of " + Math.max(ctx.household, ctx.adults) : "Not included"]);
      const at: SheetRows = [["Traditional", money(e.ira + e.sepp)], ...(ctx.g457 > 0 ? [["457(b)", money(e.g457)] as [string, string]] : []),
        ["Roth", money(e.roth)], ["Brokerage", money(e.brok)], ["Total", money(e.total)]];
      const m = (v: number) => (v > 0.5 ? money(v) : DASH);
      return (
        <SheetPage title="Early Retirement Bridge" sub={<>Ages {fmtNum(ctx.age)}–59½ &middot; today&apos;s dollars</>}
          big={[["Best way to 59½", b.name, b.desc], ["Holds up in", holdPct(b.test.hold, b.test.of), R.mc ? "random markets" : "retirements since " + HIST_START],
            ["Cost of the bridge", money(st.cost), "tax, penalties" + (ctx.aca ? ", premiums" : "") + " to 59½"]]}
          chart={copyChart("#chartBR")}
          foot="Estimates only, in today's dollars, with 2026 tax rules and ACA tables held fixed in real terms. 72(t) and conversion rules are strict; confirm a plan with a tax professional. Not tax advice.">
          <div className="sh-cols">
            <SheetSection t="Your situation" rows={situation} />
            <SheetSection t="Ways to 59½" rows={R.live.map((p) => [p.name, holdPct(p.test.hold, p.test.of) + " hold · " + money(p.steady.cost) + " cost · " + money(p.steady.end.total) + " at 59½"])} />
            <SheetSection t={"At 59½, " + lowerName(sel.name)} rows={at} />
          </div>
          <SheetTable t={"Year by year, " + lowerName(sel.name) + ", steady returns"} head={["Age", "Tax", "Penalty", "Health", "Brokerage", "Roth", "72(t)", "55 / 457(b)", "Converted", "Balance"]}
            rows={(sel.steady.rows || []).map((r) => [r.age, money(r.tax + r.fica), m(r.pen), m(r.health), m(r.d.brok), m(r.d.rothBasis + r.d.rung), m(r.sp), m(r.d.r55), m(r.C), money(r.end.total)])} />
        </SheetPage>
      );
    },
    card: () => {
      if (!R) return { title: "Can I bridge to 59½?", bigLabel: "Enter your balances", big: "—", sub: "", rows: [] };
      const b = R.best, t = b.test, s = b.steady;
      return { title: "Can I bridge to 59½?", bigLabel: R.mc ? "Reaches 59½ penalty-free, random markets" : "Reaches 59½ penalty-free, tested since " + HIST_START,
        big: t.of ? pctStr(t.hold / t.of, 0) : "—", sub: "Retiring at " + R.ctx.age + " · " + money(R.ctx.spend) + " a year after tax",
        rows: [["Best plan", b.name], ["Tax to 59½", money(s.tax)], ["Penalties", money(s.pen)], ...(R.ctx.aca ? [["Health premiums to 59½", money(s.health)] as [string, string]] : []),
          ["Traditional at 59½", money(s.end.trad)], ["Roth at 59½", money(s.end.roth)], ["Brokerage at 59½", money(s.end.brok)]],
        verdict: b.desc, chart: { sel: "#chartBR", w: 900, h: 300 } };
    },
  };
}
