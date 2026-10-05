"use client";

/* Rent vs. Buy: buyer and renter net worth over any horizon, each side
   investing what it saves in the months it costs less. Ported from
   src/js/app/14-college-rentbuy.js and src/main/07-rentbuy.html. */

import { useRef } from "react";
import { BandChart } from "@/components/charts/BandChart";
import { Legend } from "@/components/charts/Legend";
import { MoneyInput, NumberInput } from "@/components/fields/NumberInput";
import { useToast } from "@/components/shell/Toast";
import { Tipped } from "@/components/shell/Tooltips";
import { toolInputs, useToolState, type ToolDef } from "@/components/tools/ToolState";
import { BigValue } from "@/components/ui/BigValue";
import { CsvButton } from "@/components/ui/CsvButton";
import { MORT_RATE_30, rentBuyCalc as rentBuyJs } from "@/lib/engine";
import type { RentBuyResult } from "@/lib/engine/types";
import { fmtNum, groupDigits, money, parseNum } from "@/lib/format";
import { MORTGAGE_DEFAULTS } from "@/tools/mortgage/model";

const DEFAULTS = {
  price: groupDigits(450000, true), down: "20", rate: String(MORT_RATE_30), term: "30", propTax: "1.1",
  ins: groupDigits(1800, true), maint: "1", close: "3", sell: "3", rent: groupDigits(1800, true), rentInc: "3.2",
  appr: "4", invest: "7", horizon: "30", gainTax: "15", status: "m",
};
type Inputs = typeof DEFAULTS;
const DEF: ToolDef<Inputs> = { id: "rentbuy", label: "Rent vs. Buy", noun: "rent vs. buy scenario", defaults: DEFAULTS };

const rentBuyCalc = rentBuyJs as unknown as (i: Record<string, number | string>) => RentBuyResult;
const DASH = "—";

export function RentBuy() {
  const { state: s, setState } = useToolState(DEF);
  const toast = useToast();
  const tableRef = useRef<HTMLTableElement>(null);
  const set = (k: keyof Inputs) => (v: string) => setState((c) => ({ ...c, [k]: v }));

  const n = (k: keyof Inputs) => parseNum(s[k]);
  const inp = {
    price: n("price"), downPct: n("down"), rate: n("rate"), term: parseFloat(s.term), propTax: n("propTax"),
    ins: n("ins"), maint: n("maint"), closePct: n("close"), sellPct: n("sell"), rent: n("rent"), rentInc: n("rentInc"),
    appr: n("appr"), invest: n("invest"),
    horizon: Math.min(40, Math.max(1, Math.round(n("horizon")))),
    gainTax: Math.min(50, Math.max(0, n("gainTax") || 0)),
    status: s.status === "s" ? "s" : "m",
  };
  const R = inp.price > 0 ? rentBuyCalc(inp) : null;
  const last = R?.years[R.years.length - 1];
  const buyWins = last ? last.buyerNW >= last.renterNW : false;

  const field = (id: string, label: React.ReactNode, k: keyof Inputs, unit: string, step: number, max?: number) => (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <div className="inputwrap"><NumberInput id={id} nonNeg step={step} max={max} value={s[k]} onValueChange={set(k)} /><span className="affix">{unit}</span></div>
    </div>
  );
  const heading = (text: string, top?: string) => (
    <div className="field" style={top ? { marginTop: top } : undefined}><div className="hint" style={{ margin: "0", fontWeight: 600, color: "var(--text)" }}>{text}</div></div>
  );

  return (
    <>
      <aside id="asideRB">
        <div className="panel inputs">
          <h2>Your situation</h2>
          <div className="body">
            {heading("Buying")}
            <div className="field">
              <label htmlFor="rbPrice">Home price</label>
              <div className="inputwrap"><span className="affix">$</span><MoneyInput id="rbPrice" nonNeg value={s.price} onValueChange={set("price")} /></div>
              <button className="btn mini" type="button" id="rbCopyMort" style={{ marginTop: "6px" }}
                onClick={() => {
                  const mo = toolInputs("mortgage", MORTGAGE_DEFAULTS);
                  const price = parseNum(mo.price);
                  if (!(price > 0)) {
                    toast("Set up the Mortgage tool first");
                    return;
                  }
                  // Only 30, 20 and 15 years here: a 10-year mortgage takes 15,
                  // the closest, rather than leaving the old term.
                  setState((c) => ({
                    ...c, price: groupDigits(price, true), down: mo.downPct, rate: mo.rate,
                    term: ["30", "20", "15"].includes(mo.term) ? mo.term : "15",
                    propTax: mo.tax, ins: mo.ins, maint: mo.maint,
                  }));
                  toast("Copied the home from your mortgage calculation");
                }}>Copy from Mortgage</button>
            </div>
            <div className="two">
              {field("rbDown", "Down payment", "down", "%", 1)}
              {field("rbRate", "Interest rate", "rate", "%", 0.125)}
            </div>
            <div className="two">
              <div className="field">
                <label htmlFor="rbTerm">Length</label>
                <select id="rbTerm" value={s.term} onChange={(e) => set("term")(e.target.value)}><option value="30">30 years</option><option value="20">20 years</option><option value="15">15 years</option></select>
              </div>
              {field("rbPropTax", "Property tax", "propTax", "%/yr", 0.1)}
            </div>
            <div className="two">
              <div className="field">
                <label htmlFor="rbIns">Insurance</label>
                <div className="inputwrap"><span className="affix">$</span><MoneyInput id="rbIns" nonNeg value={s.ins} onValueChange={set("ins")} /><span className="affix">/yr</span></div>
              </div>
              {field("rbMaint", "Maintenance", "maint", "%/yr", 0.1)}
            </div>
            <div className="two">
              {field("rbClose", <Tipped text="Closing costs" k="closingcost" />, "close", "%", 0.1)}
              {field("rbSell", <Tipped text="Selling costs" k="sellingcost" />, "sell", "%", 0.1)}
            </div>
            {heading("Renting", "8px")}
            <div className="two">
              <div className="field">
                <label htmlFor="rbRent">Monthly rent</label>
                <div className="inputwrap"><span className="affix">$</span><MoneyInput id="rbRent" nonNeg value={s.rent} onValueChange={set("rent")} /></div>
              </div>
              {field("rbRentInc", "Annual increase", "rentInc", "%", 0.5)}
            </div>
            {heading("Assumptions", "8px")}
            <div className="two">
              {field("rbAppr", <Tipped text="Home appreciation" k="appreciation" />, "appr", "%/yr", 0.5)}
              {field("rbInvest", "Investment return", "invest", "%/yr", 0.5)}
            </div>
            {field("rbHorizon", "Time horizon", "horizon", "yrs", 1, 40)}
            <div className="two">
              {field("rbGainTax", <Tipped text="Tax on gains" k="rbgaintax" />, "gainTax", "%", 1, 50)}
              <div className="field">
                <label htmlFor="rbStatus"><Tipped text="Filing status" k="rbstatus" /></label>
                <select id="rbStatus" value={s.status} onChange={(e) => set("status")(e.target.value)}><option value="s">Single</option><option value="m">Married, joint</option></select>
              </div>
            </div>
            <div className="derived">
              <div><span>Loan amount</span><span className="num" id="rbLoan">{R ? money(R.loan) : ""}</span></div>
              <div><span>Principal &amp; interest</span><span className="num" id="rbPI">{R ? money(R.pi, 0) + "/mo" : ""}</span></div>
              <div><span>All in</span><span className="num" id="rbMonthly">{R ? money(R.monthlyBuy, 0) + "/mo" : ""}</span></div>
            </div>
          </div>
        </div>
      </aside>
      <div className="stack" id="tab-rentbuy">
        <div className="panel">
          <div className="headline">
            <div><div className="k">Better after <span id="rbHorizonLbl">{R ? fmtNum(inp.horizon) : ""}</span> yrs</div>
              <BigValue className="v gold" id="rbWinner" text={last ? (buyWins ? "Buying" : "Renting") : DASH} />
              <div className="note" id="rbWinNote">{last ? "by " + money(Math.abs(last.buyerNW - last.renterNW)) : ""}</div></div>
            <div><div className="k">Buyer net worth</div><BigValue id="rbBuyerNW" text={last ? money(last.buyerNW) : DASH} />
              <div className="note" id="rbBuyerNote">{last ? "Home equity after selling, plus whatever's invested in months buying costs less than renting, after tax on the gains" : ""}</div></div>
            <div><div className="k">Renter net worth</div><BigValue id="rbRenterNW" text={last ? money(last.renterNW) : DASH} />
              <div className="note" id="rbRenterNote">{last ? "Down payment invested from day one, plus whatever's invested in months renting costs less than buying, after tax on the gains" : ""}</div></div>
          </div>
          <div className="body">
            <div className="hint" style={{ marginBottom: "10px" }}>Every month, whichever side costs less banks the difference and invests it at your chosen return, so a renter paying less than a buyer&apos;s monthly cost keeps growing that gap, and vice versa.</div>
            <div className="kv"><span className="k">Break-even point</span><span className="v" id="rbBreakEven">{R ? (R.breakEven ? "Year " + fmtNum(R.breakEven) + " -- buying pulls ahead" : "Renting stays ahead throughout") : ""}</span></div>
            <div className="kv"><span className="k">Renter invests</span><span className="v" id="rbRenterInvests">{R ? money(R.initialInvest) + " (down payment + closing costs)" : ""}</span></div>
          </div>
        </div>
        <div className="panel">
          <h2>Net worth over time</h2>
          {R ? (
            <BandChart id="RB" enhanced maxX={inp.horizon} ariaLabel="Buyer vs renter net worth"
              pts={[{ year: 0, base: 0, hi: 0, lo: 0 }, ...R.years.map((y) => ({ year: y.year, base: y.buyerNW, hi: y.renterNW, lo: Math.min(y.buyerNW, y.renterNW) }))]}
              tip={(b) => (
                <>
                  <b>Year {fmtNum(b.year)}</b>
                  <br /><span style={{ color: "#e9b872" }}>Buyer</span> <span className="n">{money(b.base)}</span>
                  <br /><span style={{ color: "#4fbf95" }}>Renter</span> <span className="n">{money(b.hi!)}</span>
                </>
              )} />
          ) : (
            <div className="chartwrap" id="chartWrapRB"><svg id="chartRB" viewBox="0 0 900 340" preserveAspectRatio="none" role="img" aria-label="Buyer vs renter net worth" /><div className="tip" /></div>
          )}
          <Legend id="legendRB" items={R ? [["#e9b872", "Buyer net worth"], ["#4fbf95", "Renter net worth"]] : []} />
        </div>
        <div className="panel">
          <h2>Year by year<span className="h2ctrl"><CsvButton table={tableRef} label="Year by year" /></span></h2>
          <div className="swipehint">Swipe the table sideways to see every column.</div>
          <div className="scroll">
            <table id="rbTable" ref={tableRef}>
              <thead><tr><th>Year</th><th>Buyer NW</th><th>Renter NW</th><th>Difference</th><th>Home value</th><th>Balance</th></tr></thead>
              <tbody>
                {R?.years.map((y) => {
                  const diff = y.buyerNW - y.renterNW;
                  return (
                    <tr key={y.year}>
                      <td>{fmtNum(y.year)}</td>
                      <td className={y.buyerNW >= y.renterNW ? "pos" : undefined}>{money(y.buyerNW)}</td>
                      <td className={y.renterNW >= y.buyerNW ? "pos" : undefined}>{money(y.renterNW)}</td>
                      <td className={diff >= 0 ? "pos" : "neg"}>{(diff >= 0 ? "+" : "") + money(diff)}</td>
                      <td>{money(y.homeVal)}</td>
                      <td>{money(y.balance)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  );
}
