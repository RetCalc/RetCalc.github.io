"use client";

/* The Portfolio Backtest: what a mix of stocks, small value, bonds and cash
   did through any stretch of history since 1926, with its inflation, rolling
   returns and every year. From src/main/05-backtest.html and
   src/js/app/22-backtest.js. */

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Legend } from "@/components/charts/Legend";
import { MultiChart } from "@/components/charts/MultiChart";
import { Field, NumberField, SelectField } from "@/components/fields/Field";
import { Modal } from "@/components/shell/Modal";
import { useToast } from "@/components/shell/Toast";
import { TipDot, Tipped } from "@/components/shell/Tooltips";
import { setToolInputs, toolInputs, useToolState } from "@/components/tools/ToolState";
import { BigValue } from "@/components/common/BigValue";
import { CsvButton } from "@/components/common/CsvButton";
import { KV, Segmented } from "@/components/common/Readout";
import type { BtResult, BtRow } from "@/lib/engine/types";
import { money, parseNum, pctStr } from "@/lib/format";
import { useSort } from "@/lib/useSort";
import { ADVANCED_DEFAULTS } from "@/tools/advanced/model";
import { MixRows, mixForm, mixOk, type MixForm } from "@/tools/drawdown/MixRows";
import { ddN, rebalText } from "@/tools/drawdown/text";
import { BT_DEF, BT_FIRST, BT_LAST, decadeInflation, eraFrom, runBacktest, yearClamp, type BacktestInputs } from "./model";
import { setNavDir } from "@/lib/nav-motion";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const GOLD = "#e9b872", BLUE = "#7d9fd6", RED = "#e2795f";
const MIXES = [["100", "100"], ["80", "80"], ["60", "60"], ["40", "40"], ["0", "0"]] as const;
const ERAS = [["all", "All"], ["50", "Last 50"], ["30", "Last 30"]] as const;

/* The mix on its button: each holding with a share. */
function mixText(B: BtResult) {
  const t = ([[B.stockPct, "US stocks"], [B.svPct, "small value"], [B.bondPct, "bonds"], [B.cashPct, "cash"]] as const)
    .filter((p) => p[0] > 0).map((p) => ddN(p[0]) + "% " + p[1]).join(", ");
  return t || "Nothing invested";
}

/* What the mix is and how it was kept, under the quick mixes. */
function mixNote(B: BtResult, rb: string, from: number) {
  const parts = ([[B.stockPct, "S&P 500"], [B.svPct, "small-cap value"], [B.bondPct, "10-year Treasuries"], [B.cashPct, "cash (one-month Treasury bills)"]] as const)
    .filter((p) => p[0] > 0);
  return (parts.length ? parts.map((p) => ddN(p[0]) + "% " + p[1]).join(", ") : "Nothing invested") +
    (B.rebal === "never" ? ", never rebalanced." : ", rebalanced " + rb.charAt(0).toLowerCase() + rb.slice(1) + ".") +
    (B.minYear > BT_FIRST && from < B.minYear ? " Small value and cash begin in July 1926, so this starts in " + B.minYear + "." : "");
}

/* Where an unrebalanced mix drifted to. */
function rebalNote(B: BtResult) {
  const held = [B.stockPct, B.svPct, B.bondPct, B.cashPct], names = ["stocks", "small value", "bonds", "cash"];
  if (held.filter((v) => v > 0).length < 2) return "With one asset there's nothing to rebalance.";
  if (B.rebal === "year") return "";
  const drift = B.endMix.map((x, j) => Math.round(x * 100) + "% " + names[j]).filter((_, j) => held[j] > 0).join(", ");
  return (B.rebal === "never" ? "The mix drifts with markets." : B.rebal === "every" ? "Between rebalances the mix drifts with markets."
    : "Checked at the start of each year: rebalanced " + B.rebalances + (B.rebalances === 1 ? " time." : " times.")) +
    " By the end of " + B.last + " it stood at " + drift + ".";
}

type SortCol = "year" | "stock" | "sv" | "bond" | "cash" | "ret" | "infl" | "real" | "end" | "endReal";
const signCls = (v: number) => (v < 0 ? "neg" : "pos");

export function Backtest() {
  const router = useRouter();
  const toast = useToast();
  const { state: s, set, setState } = useToolState(BT_DEF);
  const B = useMemo(() => runBacktest(s), [s]);
  const [roll, setRoll] = useState<"nom" | "real">("nom");
  const [mixOpen, setMixOpen] = useState(false);
  const sort = useSort<SortCol>("year", 1);
  const rollTable = useRef<HTMLTableElement>(null), yearTable = useRef<HTMLTableElement>(null);

  const from = Math.max(BT_FIRST, Math.min(BT_LAST, Math.round(parseNum(s.from) || BT_FIRST)));
  const rb = rebalText({ rebal: B.rebal, rebalN: Math.max(1, Math.round(parseNum(s.rebalN) || 1)), rebalBand: parseNum(s.rebalBand) });
  const quickMix = !B.svPct && !B.cashPct ? String(B.stockPct) : "";
  const era = ERAS.find(([e]) => B.first === (e === "all" ? B.minYear : eraFrom(e)) && B.last === BT_LAST)?.[0] ?? "";
  const xFmt = (y: number) => String(B.first + y);
  const head = (y: number) => <b>{B.first + y}</b>;
  const sv = B.svPct > 0, cash = B.cashPct > 0;

  const nom = [{ year: 0, value: B.start }, ...B.rows.map((r, i) => ({ year: i + 1, value: r.end }))];
  const real = [{ year: 0, value: B.start }, ...B.rows.map((r, i) => ({ year: i + 1, value: r.endReal }))];
  const annual = B.rows.map((r, i) => ({ year: i + 1, value: r.infl }));

  const useInAdvanced = () => {
    const f = (v: number) => String(+(v * 100).toFixed(2));
    setToolInputs("advanced", { ...toolInputs("advanced", ADVANCED_DEFAULTS), nominal: f(B.cagr), vol: f(B.vol), inflation: f(B.inflCagr) });
    setNavDir("back");
    router.push("/advanced");
    toast("Return, volatility and inflation updated");
  };

  const yearCols: [SortCol, string, boolean?][] = [["year", "Year"], ["stock", "Stocks"], ["sv", "Small value", !sv], ["bond", "Bonds"], ["cash", "Cash", !cash],
    ["ret", "Your mix"], ["infl", "Inflation"], ["real", "Real"], ["end", "Balance"], ["endReal", "In today's $"]];

  return (
    <>
      <aside id="asideBT">
        <Card>
          <CardHeader><CardTitle>The mix<TipDot k="btdata" /></CardTitle></CardHeader>
          <CardContent>
            <Field id="btMixBtn" label={<Tipped text="Asset mix" k="btmix" />}>
              <Button variant="outline" size="lg" className="w-full justify-between" id="btMixBtn" onClick={() => setMixOpen(true)}><span id="btMixText" className="min-w-0 flex-1 truncate text-left">{mixText(B)}</span>
                <svg className="text-muted-foreground" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M5 3.5l4.5 4.5L5 12.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg></Button>
              <input type="hidden" id="btStock" value={s.stock} /><input type="hidden" id="btSV" value={s.sv} /><input type="hidden" id="btCash" value={s.cash} />
              <div className="btquick">Stocks, the rest in bonds:</div>
              <Segmented id="segBTMix" attr="data-mix" options={MIXES} value={quickMix} onChange={(m) => setState((c) => ({ ...c, stock: m, sv: "0", cash: "0" }))} />
              <div className="hint" id="btMixNote">{mixNote(B, rb, from)}</div>
            </Field>
            <SelectField id="btRebal" label={<Tipped text="Rebalancing" k="btrebal" />} value={s.rebal} onChange={set("rebal")}>
              <option value="year">Every year</option>
              <option value="every">Every few years</option>
              <option value="band">When it drifts from the mix</option>
              <option value="never">Never</option>
            </SelectField>
            <NumberField id="btRebalN" wrapId="btRebalNWrap" hidden={B.rebal !== "every"} label="Rebalance every" unit="years" max={30} value={s.rebalN} onValueChange={set("rebalN")} />
            <NumberField id="btRebalBand" wrapId="btRebalBandWrap" hidden={B.rebal !== "band"} label="When any holding is off by more than" unit="points" max={50} value={s.rebalBand} onValueChange={set("rebalBand")} />
            <div className="hint -mt-1.5 mx-0 mb-3" id="btRebalNote">{rebalNote(B)}</div>
            <div className="two">
              <NumberField id="btFrom" label={<Tipped text="From" k="bthistory" />} max={BT_LAST} value={s.from} onValueChange={set("from")}
                onBlur={() => setState((c) => ({ ...c, from: yearClamp(c.from, BT_FIRST) }))} />
              <NumberField id="btTo" label="Through" max={BT_LAST} value={s.to} onValueChange={set("to")}
                onBlur={() => setState((c) => ({ ...c, to: yearClamp(c.to, BT_LAST) }))} />
            </div>
            <div className="pb-3">
              <Segmented id="segBTEra" attr="data-era" options={ERAS} value={era}
                onChange={(e) => setState((c) => ({ ...c, from: String(eraFrom(e)), to: String(BT_LAST) }))} />
            </div>
            <div className="derived">
              <div><span>Years covered</span><span className="num" id="btYears">{B.years + (B.years === 1 ? " yr" : " yrs")}</span></div>
              <div><span>Rebalanced</span><span className="num" id="btRebalShow">{rb}</span></div>
              <div><span>Dividends</span><span className="num">Reinvested</span></div>
            </div>
          </CardContent>
        </Card>
      </aside>

      <div className="stack" id="tab-backtest">
        <Card size="flush">
          <div className="headline">
            <div>
              <div className="k">Return, per year</div>
              <BigValue className="v gold" id="btCagr" text={pctStr(B.cagr, 2)} />
              <div className="note" id="btCagrNote">{"Compound annual growth, " + B.first + "–" + B.last}</div>
            </div>
            <div>
              <div className="k">After inflation<TipDot k="btreal" /></div>
              <BigValue id="btReal" text={pctStr(B.realCagr, 2)} />
              <div className="note" id="btRealNote">{"Inflation averaged " + pctStr(B.inflCagr, 2) + " a year"}</div>
            </div>
            <div>
              <div className="k">Volatility<TipDot k="btvol" /></div>
              <BigValue id="btVol" text={pctStr(B.vol, 2)} />
              <div className="note">Standard deviation of annual returns</div>
            </div>
          </div>
          <CardContent>
            <div className="grid2">
              <div>
                <KV k="Best year" cls="pos" id="btBest" v={pctStr(B.best.ret, 2) + " in " + B.best.year} />
                <KV k="Worst year" cls="neg" id="btWorst" v={pctStr(B.worst.ret, 2) + " in " + B.worst.year} />
                <KV k={<>Deepest fall<TipDot k="btdd" /></>} id="btDD" v={B.maxDD < 0 ? pctStr(B.maxDD, 2) + " (" + B.ddFrom + "–" + B.ddTo + ")" : "None"} />
              </div>
              <div>
                <KV k="Up years" id="btUp" v={B.upYears + " of " + B.years + " (" + Math.round((B.upYears / B.years) * 100) + "%)"} />
                <KV k="Grew to" id="btEnd" v={money(B.endBal)} />
                <KV k="In today's dollars" id="btEndReal" v={money(B.endReal)} />
              </div>
            </div>
            <div className="mt-3.5">
              <Button id="btUseRate" onClick={useInAdvanced}>Use these figures in Advanced</Button>
              <div className="hint mt-1.5" id="btUseNote">{"Sends " + pctStr(B.cagr, 2) + " return, " + pctStr(B.vol, 2) + " volatility and " +
                pctStr(B.inflCagr, 2) + " inflation to the Advanced tab, so the nominal figure and the inflation it was earned alongside travel together."}</div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Growth of $10,000</CardTitle></CardHeader>
          <MultiChart id="BT" ariaLabel="Historical growth of the chosen mix" maxX={B.years} xFmt={xFmt} head={head}
            series={[{ name: "Balance", color: GOLD, pts: nom }, { name: "In today's dollars", color: BLUE, pts: real, dash: "5 4", width: 2 }]} />
          <Legend id="legendBT" items={[[GOLD, "Balance"], [BLUE, "In today's dollars"]]} />
        </Card>

        <Card>
          <CardHeader><CardTitle>Inflation</CardTitle><CardDescription id="btInflSpan">{B.first + "–" + B.last}</CardDescription></CardHeader>
          <CardContent>
            <div className="grid2">
              <div>
                <KV k="Average, per year" cls="gold" id="btInfl" v={pctStr(B.inflCagr, 2)} />
                <KV k="Highest year" cls="neg" id="btInflHigh" v={pctStr(B.inflHigh.infl, 2) + " in " + B.inflHigh.year} />
                <KV k="Lowest year" cls="pos" id="btInflLow" v={pctStr(B.inflLow.infl, 2) + " in " + B.inflLow.year} />
              </div>
              <div>
                <KV k="Falling-price years" id="btDefl" v={B.deflationYears + " of " + B.years} />
                <KV k={<>Prices multiplied by<TipDot k="btpricelevel" /></>} id="btPriceLevel" v={B.priceLevel.toFixed(1) + "×"} />
                <KV k="$100 then is worth" id="btPriceNow" v={money(100 * B.priceLevel) + " today"} />
              </div>
            </div>
          </CardContent>
          <MultiChart id="BTI" ariaLabel="Annual inflation over the selected period" maxX={B.years} xFmt={xFmt} head={head}
            yFmt={(v) => (v * 100).toFixed(0) + "%"} valFmt={(v) => pctStr(v, 2)}
            series={[{ name: "Annual", color: RED, pts: annual, width: 1.9 }, { name: "Ten-year average", color: BLUE, pts: decadeInflation(B), dash: "5 4", width: 2.2 }]} />
          <Legend id="legendBTI" items={[[RED, "Annual"], [BLUE, "Ten-year average"]]} />
          <CardContent><div className="hint m-0">A high return in a high-inflation
            year buys less than a modest one in a quiet year, which is why the headline above
            shows both. The ten-year line is the one that matters for a plan: single years
            swing hard, but it is the sustained stretches that reprice a retirement.</div></CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Rolling returns</CardTitle><CardDescription id="btRollNote">{roll === "nom" ? "nominal" : "after inflation"}</CardDescription><CardAction>
              <Segmented id="segBTRoll" attr="data-roll" options={[["nom", "Nominal"], ["real", "Real"]] as const} value={roll} onChange={setRoll} />
              <CsvButton table={rollTable} label="Rolling returns" />
            </CardAction></CardHeader>
          <div className="swipehint">Swipe the table sideways to see every column.</div>
          <div className="scroll">
            <table id="btRollTable" ref={rollTable}>
              <thead><tr><th>Window</th><th>Periods</th><th>Worst</th><th>Median</th><th>Best</th><th>Positive</th></tr></thead>
              <tbody>
                {B.rolling.map((r) => {
                  const w = roll === "nom" ? { worst: r.nomWorst, med: r.nomMed, best: r.nomBest, pos: r.nomPos }
                    : { worst: r.realWorst, med: r.realMed, best: r.realBest, pos: r.realPos };
                  return (
                    <tr key={r.len}>
                      <td>{r.len + (r.len === 1 ? " year" : " years")}</td><td>{r.count}</td>
                      <td className={w.worst < 0 ? "neg" : ""}>{pctStr(w.worst, 2)}</td><td>{pctStr(w.med, 2)}</td>
                      <td className="pos">{pctStr(w.best, 2)}</td><td>{Math.round(w.pos * 100) + "%"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <CardContent><div className="hint m-0">Annualized, every overlapping
            window in the range. The worst column is the one that matters: it is the return
            someone actually lived through.</div></CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Year by year</CardTitle><CardAction><CsvButton table={yearTable} label="Year by year" /></CardAction></CardHeader>
          <div className="swipehint">Swipe the table sideways to see every column.</div>
          <div className="scroll">
            <table id="btTable" ref={yearTable}>
              <thead><tr>
                {yearCols.map(([k, label, hide]) => (
                  <th key={k} {...sort.th(k)} data-sort={k} id={k === "sv" ? "btSVHead" : k === "cash" ? "btCashHead" : undefined}
                    hidden={hide}>{label}</th>
                ))}
              </tr></thead>
              <tbody>
                {sort.order(B.rows, (r: BtRow, c) => r[c]).map((r) => (
                  <tr key={r.year}>
                    <td>{r.year}</td>
                    <td className={signCls(r.stock)}>{r.stock.toFixed(2) + "%"}</td>
                    {sv ? <td className={signCls(r.sv)}>{r.sv.toFixed(2) + "%"}</td> : null}
                    <td className={signCls(r.bond)}>{r.bond.toFixed(2) + "%"}</td>
                    {cash ? <td className={signCls(r.cash)}>{r.cash.toFixed(2) + "%"}</td> : null}
                    <td className={signCls(r.ret)}>{pctStr(r.ret, 2)}</td>
                    <td>{pctStr(r.infl, 2)}</td>
                    <td className={signCls(r.real)}>{pctStr(r.real, 2)}</td>
                    <td>{money(r.end)}</td><td>{money(r.endReal)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
      {mixOpen ? <MixDialog s={s} close={() => setMixOpen(false)} save={(f) => setState((c) => ({ ...c, stock: f.stock, sv: f.sv, cash: f.cash }))} /> : null}
    </>
  );
}

/* The mix pop-up: the same four holdings as the Drawdown Simulator's,
   adding up to 100%. */
function MixDialog({ s, close, save }: { s: BacktestInputs; close: () => void; save: (f: MixForm) => void }) {
  const [f, setF] = useState<MixForm>(() => {
    const stock = parseNum(s.stock), sv = parseNum(s.sv), cash = parseNum(s.cash);
    return mixForm({ stock, sv, bond: Math.max(0, 100 - stock - sv - cash), cash });
  });
  const up = (k: keyof MixForm) => (v: string) => setF((c) => ({ ...c, [k]: v }));
  const ok = mixOk(f);
  return (
    <Modal className="popup wide" onClose={close} focus="[data-mix]">
      <h3>Asset mix</h3>
      <div className="formhint">How the portfolio is split at the start, and what each rebalance returns it to. Each holding earns its actual returns; small value and cash start in July 1926, so a mix with either starts in 1927.</div>
      <MixRows f={f} up={up} totId="btMixTot" />
      <div className="formactions"><Button variant="outline" className="flex-1" data-mixcancel onClick={close}>Cancel</Button>
        <Button className="flex-1" data-mixok disabled={!ok} onClick={() => {
          if (!ok) return;
          save({ stock: String(parseNum(f.stock)), sv: String(parseNum(f.sv)), bond: f.bond, cash: String(parseNum(f.cash)) });
          close();
        }}>Use this mix</Button></div>
    </Modal>
  );
}
