"use client";

/* Rent vs. Buy: buyer and renter net worth over any horizon, each side
   investing what it saves in the months it costs less. Ported from
   src/js/app/14-college-rentbuy.js and src/main/07-rentbuy.html.

   Laid out answer-first (the rent vs. buy critique, 2026-10-06), in Basic's
   thirds: the inputs a third, Time horizon first (it frames the answer),
   then Buying, Renting and Assumptions; then one reading whose hero is the
   verdict, the margin under it and the break-even as its sentence, with the
   two net worths beside it in plain text. The monthly costs that drive the
   result follow in the same card, then the chart (the break-even year
   marked on screen only) and Year by year, folded. With no price the field
   is marked, the reading says what's missing and the rest folds away. On a
   phone a compact reading leads and stays pinned. */

import { useRef } from "react";
import { ChevronDownIcon, CircleAlertIcon, InfoIcon } from "lucide-react";
import { BandChart, type ChartGeometry } from "@/components/charts/BandChart";
import { Legend } from "@/components/charts/Legend";
import { Affixed, Field, MoneyField, NumberField, SelectField } from "@/components/fields/Field";
import { MoneyInput } from "@/components/fields/NumberInput";
import { useToast } from "@/components/shell/Toast";
import { Tipped } from "@/components/shell/Tooltips";
import { toolInputs, useToolState } from "@/components/tools/ToolState";
import { KV } from "@/components/common/Readout";
import { HeroReading, PinnedReading, type ReadingFigure } from "@/components/common/Reading";
import { CsvButton } from "@/components/common/CsvButton";
import { rentBuyCalc } from "@/lib/engine/typed";
import { DASH, fmtNum, groupDigits, money, parseNum } from "@/lib/format";
import { MORTGAGE_DEFAULTS } from "@/tools/mortgage/model";
import { useShareKit } from "@/components/shell/share";
import { rentBuyShare } from "./share";
import { RENTBUY_DEF as DEF, rentBuyInput, type RentBuyInputs as Inputs } from "./model";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { SERIES } from "@/lib/hues";

function GroupHead({ children }: { children: React.ReactNode }) {
  return <h3 className="m-0 mt-1 mb-3 border-t border-border pt-4 text-sm font-semibold">{children}</h3>;
}

/** The break-even year on the buyer's line: a tick through it and its name
    above. Screen only: the printed summary and share card copy this chart. */
function BreakEvenMark({ g, year, value }: { g: ChartGeometry; year: number; value: number }) {
  const x = g.X(year), y = g.Y(value);
  return (
    <g aria-hidden="true" data-screen-only>
      <line x1={x} x2={x} y1={y - 6} y2={y + 6} stroke="var(--ds-text)" strokeOpacity={0.7} strokeWidth={g.narrow ? 1.8 : 1.2} />
      <text x={x} y={y - 11} textAnchor="middle" fontSize={g.narrow ? 13 : 11} fill="var(--axis)">Break-even</text>
    </g>
  );
}

export function RentBuy() {
  const { state: s, set, setState } = useToolState(DEF);
  const toast = useToast();
  const tableRef = useRef<HTMLTableElement>(null);

  const inp = rentBuyInput(s);
  const R = inp.price > 0 ? rentBuyCalc(inp) : null;
  useShareKit(DEF.id, rentBuyShare(inp));
  const last = R?.years[R.years.length - 1];
  const buyWins = last ? last.buyerNW >= last.renterNW : false;
  const ready = !!last;
  const noPrice = !(inp.price > 0);
  const beRow = R?.breakEven ? R.years.find((y) => y.year === R.breakEven) : undefined;

  // A number field bound to input `k`.
  const num = (id: string, label: React.ReactNode, k: keyof Inputs, unit: string, step: number, max?: number) => (
    <NumberField id={id} label={label} unit={unit} step={step} max={max} value={s[k]} onValueChange={set(k)} />
  );

  const winner = last ? (buyWins ? "Buying" : "Renting") : DASH;
  const margin = last ? money(Math.abs(last.buyerNW - last.renterNW)) : "";
  const horizonLbl = <>Better after <span id="rbHorizonLbl">{fmtNum(inp.horizon)}</span> years</>;
  // Notes wrap at a short measure, so the two net worths sit side by side.
  const fig = (t: string) => (t ? <span className="block max-w-52">{t}</span> : "");
  const hero: ReadingFigure = { label: horizonLbl, id: "rbWinner", value: winner,
    note: <span className="text-body text-foreground">{last ? "Ahead " : ""}<span id="rbWinNote">{last ? "by " + margin : ""}</span></span> };
  const figures: ReadingFigure[] = [
    { label: "Buyer net worth", id: "rbBuyerNW", value: last ? money(last.buyerNW) : DASH, noteId: "rbBuyerNote",
      note: fig(last ? "Home equity after selling, plus whatever's invested in months buying costs less than renting, after tax on the gains" : "") },
    { label: "Renter net worth", id: "rbRenterNW", value: last ? money(last.renterNW) : DASH, noteId: "rbRenterNote",
      note: fig(last ? "Down payment invested from day one, plus whatever's invested in months renting costs less than buying, after tax on the gains" : "") },
  ];

  return (
    <div className="col-span-full grid grid-cols-1 items-start gap-5 max-sm:gap-3.5 lg:grid-cols-3">
      <div className="min-w-0 lg:col-span-1 lg:self-stretch">
        {/* Phones and narrow screens: the answer leads, and stays under the
            tab rail while the inputs are on screen. The inputs don't pin on
            desktop: sixteen fields are taller than a laptop's screen, and a
            scroller inside the page hid the tax fields. */}
        <PinnedReading tone={ready ? "answer" : "text"} main={{ label: "Better after " + fmtNum(inp.horizon) + " years", value: winner }} side={{ label: "Ahead by", value: margin || DASH }} />

        <aside id="asideRB" className="static max-h-none overflow-visible">
          <Card>
            <CardHeader>
              <CardTitle>Your situation</CardTitle>
              <CardDescription>The home you&apos;d buy, the place you&apos;d rent, and how long you&apos;d stay.</CardDescription>
            </CardHeader>
            <CardContent>
              {num("rbHorizon", "Time horizon", "horizon", "yrs", 1, 40)}

              <GroupHead>Buying</GroupHead>
              <Field id="rbPrice" label="Home price">
                <Affixed prefix="$"><MoneyInput id="rbPrice" nonNeg value={s.price} onValueChange={set("price")}
                  aria-invalid={noPrice || undefined} aria-describedby={noPrice ? "rbPriceWarn" : undefined} /></Affixed>
                {noPrice ? (
                  <div className="mt-1.5 flex items-start gap-2 text-note text-destructive">
                    <CircleAlertIcon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                    <span id="rbPriceWarn">Enter a home price to compare.</span>
                  </div>
                ) : null}
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
              <div className="two max-sm:grid-cols-2">
                {num("rbDown", "Down payment", "down", "%", 1)}
                {num("rbRate", "Interest rate", "rate", "%", 0.125)}
              </div>
              <div className="two max-sm:grid-cols-2">
                <SelectField id="rbTerm" label="Length" value={s.term} onChange={set("term")}><option value="30">30 years</option><option value="20">20 years</option><option value="15">15 years</option></SelectField>
                {num("rbPropTax", "Property tax", "propTax", "%/yr", 0.1)}
              </div>
              <div className="two max-sm:grid-cols-2">
                <MoneyField id="rbIns" label="Insurance" unit="/yr" value={s.ins} onValueChange={set("ins")} />
                {num("rbMaint", "Maintenance", "maint", "%/yr", 0.1)}
              </div>
              <div className="two max-sm:grid-cols-2">
                {num("rbClose", <Tipped text="Closing costs" k="closingcost" />, "close", "%", 0.1)}
                {num("rbSell", <Tipped text="Selling costs" k="sellingcost" />, "sell", "%", 0.1)}
              </div>

              <GroupHead>Renting</GroupHead>
              <div className="two bottomalign max-sm:grid-cols-2">
                <MoneyField id="rbRent" label="Monthly rent" value={s.rent} onValueChange={set("rent")} />
                {num("rbRentInc", "Annual increase", "rentInc", "%", 0.5)}
              </div>

              <GroupHead>Assumptions</GroupHead>
              <div className="two bottomalign max-sm:grid-cols-2">
                {num("rbAppr", <Tipped text="Home appreciation" k="appreciation" />, "appr", "%/yr", 0.5)}
                {num("rbInvest", "Investment return", "invest", "%/yr", 0.5)}
              </div>
              <div className="two bottomalign max-sm:grid-cols-2">
                {num("rbGainTax", <Tipped text="Tax on gains" k="rbgaintax" />, "gainTax", "%", 1, 50)}
                <SelectField id="rbStatus" label={<Tipped text="Filing status" k="rbstatus" />} value={s.status} onChange={set("status")}><option value="s">Single</option><option value="m">Married, joint</option></SelectField>
              </div>
            </CardContent>
          </Card>
        </aside>
      </div>

      <div className="stack min-w-0 lg:col-span-2" id="tab-rentbuy">
        <Card size="flush" className="min-w-0" id="rbReading">
          <HeroReading tone={ready ? "answer" : "text"} sized={ready} hero={hero} figures={figures}>
            <div className="mt-4" hidden={!R}>
              <span className="block text-label text-muted-foreground">Break-even</span>
              <span className="text-body text-foreground" id="rbBreakEven">{R ? (R.breakEven ? "Year " + fmtNum(R.breakEven) + " \u2014 buying pulls ahead" : "Renting stays ahead throughout") : ""}</span>
            </div>
          </HeroReading>
          {!ready ? (
            <div id="rbEmpty" className="flex items-start gap-2 border-t border-border px-5.5 py-3.5 text-body text-foreground max-sm:px-4">
              <InfoIcon className="mt-1 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
              <p className="m-0 max-w-copy">Enter a home price to see which comes out ahead.</p>
            </div>
          ) : null}
          {/* What each side pays: why the verdict goes the way it does. */}
          <div className="grid grid-cols-1 gap-x-8 border-t border-border px-5.5 pt-2 pb-1 max-sm:px-4 sm:grid-cols-2" hidden={!R}>
            <div className="min-w-0">
              <h3 className="m-0 pt-2.5 pb-1 text-label font-normal text-muted-foreground">Each month, to start</h3>
              <KV k="Buying, all in" id="rbMonthly" v={R ? money(R.monthlyBuy, 0) + "/mo" : ""} />
              <KV k="Renting" v={R ? money(inp.rent, 0) + "/mo" : ""} />
              <KV k="Principal & interest" id="rbPI" v={R ? money(R.pi, 0) + "/mo" : ""} />
            </div>
            <div className="min-w-0">
              <h3 className="m-0 pt-2.5 pb-1 text-label font-normal text-muted-foreground">Up front</h3>
              <KV k="Loan amount" id="rbLoan" v={R ? money(R.loan) : ""} />
              <KV k="Renter invests" id="rbRenterInvests" v={R ? money(R.initialInvest) + " (down payment + closing costs)" : ""} />
            </div>
          </div>
        </Card>

        <Card className="min-w-0" hidden={!R}>
          <CardHeader>
            <CardTitle>Net worth over time</CardTitle>
            <CardDescription>Every month, whichever side costs less banks the difference and invests it at your chosen return, so a renter paying less than a buyer&apos;s monthly cost keeps growing that gap, and vice versa.</CardDescription>
          </CardHeader>
          {R ? (
            <BandChart id="RB" enhanced colors={{ base: SERIES.sky, hi: SERIES.teal }} maxX={inp.horizon} ariaLabel="Buyer vs renter net worth"
              pts={[{ year: 0, base: 0, hi: 0, lo: 0 }, ...R.years.map((y) => ({ year: y.year, base: y.buyerNW, hi: y.renterNW, lo: Math.min(y.buyerNW, y.renterNW) }))]}
              extras={beRow ? (g) => <BreakEvenMark g={g} year={beRow.year} value={beRow.buyerNW} /> : undefined}
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

        <div className="min-w-0" hidden={!R}>
          <Collapsible render={<Card />}>
            <CardHeader>
              <CardTitle><CollapsibleTrigger>Year by year<ChevronDownIcon aria-hidden="true" /></CollapsibleTrigger></CardTitle>
              <CardAction><CsvButton table={tableRef} label="Year by year" /></CardAction>
            </CardHeader>
            <CollapsibleContent keepMounted>
              <div className="swipehint">Swipe the table sideways to see every column.</div>
              <div className="scroll max-h-none">
                <table id="rbTable" ref={tableRef}>
                  <thead><tr><th>Year</th><th>Buyer net worth</th><th>Renter net worth</th><th>Difference</th><th>Home value</th><th>Mortgage balance</th></tr></thead>
                  <tbody>
                    {R?.years.map((y) => {
                      const diff = y.buyerNW - y.renterNW;
                      return (
                        <tr key={y.year}>
                          <td>{fmtNum(y.year)}</td>
                          <td>{money(y.buyerNW)}</td>
                          <td>{money(y.renterNW)}</td>
                          <td>{(diff >= 0 ? "+" : "") + money(diff)}</td>
                          <td>{money(y.homeVal)}</td>
                          <td>{money(y.balance)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </CollapsibleContent>
          </Collapsible>
        </div>
      </div>
    </div>
  );
}
