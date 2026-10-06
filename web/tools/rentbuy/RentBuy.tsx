"use client";

/* Rent vs. Buy: buyer and renter net worth over any horizon, each side
   investing what it saves in the months it costs less. Ported from
   src/js/app/14-college-rentbuy.js and src/main/07-rentbuy.html. */

import { useRef } from "react";
import { BandChart } from "@/components/charts/BandChart";
import { Legend } from "@/components/charts/Legend";
import { Affixed, Field, FieldHeading, MoneyField, NumberField, SelectField } from "@/components/fields/Field";
import { MoneyInput } from "@/components/fields/NumberInput";
import { useToast } from "@/components/shell/Toast";
import { Tipped } from "@/components/shell/Tooltips";
import { toolInputs, useToolState } from "@/components/tools/ToolState";
import { Figure } from "@/components/common/Readout";
import { CsvButton } from "@/components/common/CsvButton";
import { rentBuyCalc } from "@/lib/engine/typed";
import { DASH, fmtNum, groupDigits, money, parseNum } from "@/lib/format";
import { MORTGAGE_DEFAULTS } from "@/tools/mortgage/model";
import { useShareKit } from "@/components/shell/share";
import { rentBuyShare } from "./share";
import { RENTBUY_DEF as DEF, rentBuyInput, type RentBuyInputs as Inputs } from "./model";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SERIES } from "@/lib/hues";


export function RentBuy() {
  const { state: s, set, setState } = useToolState(DEF);
  const toast = useToast();
  const tableRef = useRef<HTMLTableElement>(null);

  const inp = rentBuyInput(s);
  const R = inp.price > 0 ? rentBuyCalc(inp) : null;
  useShareKit(DEF.id, rentBuyShare(inp));
  const last = R?.years[R.years.length - 1];
  const buyWins = last ? last.buyerNW >= last.renterNW : false;

  // A number field bound to input `k`.
  const num = (id: string, label: React.ReactNode, k: keyof Inputs, unit: string, step: number, max?: number) => (
    <NumberField id={id} label={label} unit={unit} step={step} max={max} value={s[k]} onValueChange={set(k)} />
  );

  return (
    <>
      <aside id="asideRB">
        <Card>
          <CardHeader><CardTitle>Your situation</CardTitle></CardHeader>
          <CardContent>
            <FieldHeading>Buying</FieldHeading>
            <Field id="rbPrice" label="Home price">
              <Affixed prefix="$"><MoneyInput id="rbPrice" nonNeg value={s.price} onValueChange={set("price")} /></Affixed>
              <Button variant="outline" size="sm" className="mt-1.5" id="rbCopyMort"
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
                }}>Copy from Mortgage</Button>
            </Field>
            <div className="two">
              {num("rbDown", "Down payment", "down", "%", 1)}
              {num("rbRate", "Interest rate", "rate", "%", 0.125)}
            </div>
            <div className="two">
              <SelectField id="rbTerm" label="Length" value={s.term} onChange={set("term")}><option value="30">30 years</option><option value="20">20 years</option><option value="15">15 years</option></SelectField>
              {num("rbPropTax", "Property tax", "propTax", "%/yr", 0.1)}
            </div>
            <div className="two">
              <MoneyField id="rbIns" label="Insurance" unit="/yr" value={s.ins} onValueChange={set("ins")} />
              {num("rbMaint", "Maintenance", "maint", "%/yr", 0.1)}
            </div>
            <div className="two">
              {num("rbClose", <Tipped text="Closing costs" k="closingcost" />, "close", "%", 0.1)}
              {num("rbSell", <Tipped text="Selling costs" k="sellingcost" />, "sell", "%", 0.1)}
            </div>
            <FieldHeading className="mt-2">Renting</FieldHeading>
            <div className="two">
              <MoneyField id="rbRent" label="Monthly rent" value={s.rent} onValueChange={set("rent")} />
              {num("rbRentInc", "Annual increase", "rentInc", "%", 0.5)}
            </div>
            <FieldHeading className="mt-2">Assumptions</FieldHeading>
            <div className="two">
              {num("rbAppr", <Tipped text="Home appreciation" k="appreciation" />, "appr", "%/yr", 0.5)}
              {num("rbInvest", "Investment return", "invest", "%/yr", 0.5)}
            </div>
            {num("rbHorizon", "Time horizon", "horizon", "yrs", 1, 40)}
            <div className="two">
              {num("rbGainTax", <Tipped text="Tax on gains" k="rbgaintax" />, "gainTax", "%", 1, 50)}
              <SelectField id="rbStatus" label={<Tipped text="Filing status" k="rbstatus" />} value={s.status} onChange={set("status")}><option value="s">Single</option><option value="m">Married, joint</option></SelectField>
            </div>
            <div className="derived">
              <div><span>Loan amount</span><span className="num" id="rbLoan">{R ? money(R.loan) : ""}</span></div>
              <div><span>Principal &amp; interest</span><span className="num" id="rbPI">{R ? money(R.pi, 0) + "/mo" : ""}</span></div>
              <div><span>All in</span><span className="num" id="rbMonthly">{R ? money(R.monthlyBuy, 0) + "/mo" : ""}</span></div>
            </div>
          </CardContent>
        </Card>
      </aside>
      <div className="stack" id="tab-rentbuy">
        <Card size="flush">
          <div className="headline">
            <Figure label={<>Better after <span id="rbHorizonLbl">{R ? fmtNum(inp.horizon) : ""}</span> yrs</>} id="rbWinner" className="v gold"
              value={last ? (buyWins ? "Buying" : "Renting") : DASH} noteId="rbWinNote" note={last ? "by " + money(Math.abs(last.buyerNW - last.renterNW)) : ""} />
            <Figure label="Buyer net worth" id="rbBuyerNW" value={last ? money(last.buyerNW) : DASH} noteId="rbBuyerNote"
              note={last ? "Home equity after selling, plus whatever's invested in months buying costs less than renting, after tax on the gains" : ""} />
            <Figure label="Renter net worth" id="rbRenterNW" value={last ? money(last.renterNW) : DASH} noteId="rbRenterNote"
              note={last ? "Down payment invested from day one, plus whatever's invested in months renting costs less than buying, after tax on the gains" : ""} />
          </div>
          <CardContent>
            <div className="hint mb-2.5">Every month, whichever side costs less banks the difference and invests it at your chosen return, so a renter paying less than a buyer&apos;s monthly cost keeps growing that gap, and vice versa.</div>
            <div className="kv"><span className="k">Break-even point</span><span className="v" id="rbBreakEven">{R ? (R.breakEven ? "Year " + fmtNum(R.breakEven) + " -- buying pulls ahead" : "Renting stays ahead throughout") : ""}</span></div>
            <div className="kv"><span className="k">Renter invests</span><span className="v" id="rbRenterInvests">{R ? money(R.initialInvest) + " (down payment + closing costs)" : ""}</span></div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Net worth over time</CardTitle></CardHeader>
          {R ? (
            <BandChart id="RB" enhanced maxX={inp.horizon} ariaLabel="Buyer vs renter net worth"
              pts={[{ year: 0, base: 0, hi: 0, lo: 0 }, ...R.years.map((y) => ({ year: y.year, base: y.buyerNW, hi: y.renterNW, lo: Math.min(y.buyerNW, y.renterNW) }))]}
              tip={(b) => (
                <>
                  <b>Year {fmtNum(b.year)}</b>
                  <br /><i className="tipsw bg-series-sky"></i>Buyer <span className="n">{money(b.base)}</span>
                  <br /><i className="tipsw bg-series-teal"></i>Renter <span className="n">{money(b.hi!)}</span>
                </>
              )} />
          ) : <BandChart id="RB" pts={[]} maxX={0} ariaLabel="Buyer vs renter net worth" tip={() => null} />}
          <Legend id="legendRB" items={R ? [[SERIES.sky, "Buyer net worth"], [SERIES.teal, "Renter net worth"]] : []} />
        </Card>
        <Card>
          <CardHeader><CardTitle>Year by year</CardTitle><CardAction><CsvButton table={tableRef} label="Year by year" /></CardAction></CardHeader>
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
        </Card>
      </div>
    </>
  );
}
