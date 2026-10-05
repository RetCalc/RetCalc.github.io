"use client";

/* One stage of the Stages calculator: its length, contribution (or the
   three account amounts when split by account type), frequency, growth and
   return, and on the last stage a glide path. From buildStages() and
   stageGridHtml() in src/js/app/08-stages.js. */

import { useState } from "react";
import { CheckToggle, SignFlip } from "@/components/fields/CheckToggle";
import { MoneyInput, NumberInput } from "@/components/fields/NumberInput";
import { useToast } from "@/components/shell/Toast";
import { TipDot, Tipped } from "@/components/shell/Tooltips";
import { ConverterDialog, GrowthRatesDialog } from "@/components/tools/ContribDialogs";
import { groupDigits, parseNum, pctStr } from "@/lib/format";
import { PeriodOptions } from "@/lib/periods";
import { pctField } from "@/tools/advanced/model";
import { stageGlideYears, stageGrowthBlend, stageSplit, type StageInputs, type StageNum } from "./model";

export type StageEdit = (i: number, f: (st: StageInputs) => StageInputs) => void;

const CONV_ICON = (
  <svg viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M3 5.5h9.5M10 3l2.5 2.5L10 8M13 10.5H3.5M6 8l-2.5 2.5L6 13" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" /></svg>
);

interface Props {
  i: number; st: StageInputs; num: StageNum; last: boolean; split: boolean; mc: boolean;
  /** With per-account growth, the blended rate the stage runs on. */
  blend?: number;
  span: string; adjNote: string; fees: number; inflation: number; matchOn: boolean;
  edit: StageEdit; remove: (i: number) => void;
}

export function StageCard({ i, st, num, blend, last, split, mc, span, adjNote, fees, inflation, matchOn, edit, remove }: Props) {
  const [dialog, setDialog] = useState<"conv" | "growth" | null>(null);
  const toast = useToast();
  const label = st.name || "Stage " + (i + 1);
  const aria = "Stage " + (i + 1);
  const up = (f: (st: StageInputs) => StageInputs) => edit(i, f);
  const setF = (k: keyof StageInputs) => (v: string) => up((c) => ({ ...c, [k]: v }));

  /* The split amounts are the stage's total and its split. */
  const sp = stageSplit(st);
  const amt = (x: number) => groupDigits(Math.round(parseNum(st.contrib) * x * 100) / 100, true);
  const shown = { cT: st.cT ?? amt(sp.t), cR: st.cR ?? amt(sp.r), cB: st.cB ?? amt(sp.b) };
  const setSplit = (k: "cT" | "cR" | "cB") => (v: string) => up((c) => {
    const typed = { ...shown, [k]: v };
    const t = parseNum(typed.cT), r = parseNum(typed.cR), b = parseNum(typed.cB), sum = t + r + b;
    return { ...c, ...typed, contrib: String(sum), ...(sum > 0 ? { sTrad: t / sum, sRoth: r / sum } : {}) };
  });

  const blended = split && !!st.gRates;
  const adjRow = i > 0 ? (
    <label className="adjrow" title="Inflation adjusted: grows the amount you type by inflation up to the start of this stage">
      <span className="adjrow-top"><input type="checkbox" data-f="adj" data-i={i} checked={st.adj} onChange={(e) => up((c) => ({ ...c, adj: e.target.checked }))} /><span className="adjtxt">Infl. adj.</span></span>
      <span className="adjnote" data-adj={i}>{adjNote}</span>
    </label>
  ) : null;

  const field = (key: string, labelText: React.ReactNode, input: React.ReactNode, extra?: React.ReactNode, cls?: string, style?: React.CSSProperties) => (
    <div className={cls ? "field " + cls : "field"} key={key} style={style}><label>{labelText}</label>{input}{extra}</div>
  );
  const f: Record<string, React.ReactNode> = {
    years: field("years", "Years", <div className="inputwrap"><NumberInput data-f="years" data-i={i} nonNeg value={st.years} aria-label={aria + " years"}
      onValueChange={(v) => up((c) => ({ ...c, years: v, ...(c.glideYears !== "" ? { glideYears: stageGlideYears(v, c.glideYears) } : {}) }))} /><span className="affix">yrs</span></div>),
    contrib: field("contrib", "Contribution", <div className="inputwrap"><span className="affix">$</span><MoneyInput data-f="contrib" data-i={i} nonNeg value={st.contrib} aria-label={aria + " contribution"} onValueChange={setF("contrib")} /></div>, adjRow),
    freq: field("freq", "Frequency", <select data-f="period" data-i={i} aria-label={aria + " frequency"} value={st.period} onChange={(e) => setF("period")(e.target.value)}><PeriodOptions /></select>,
      <button type="button" className="linkbtn" data-conv={i} onClick={() => setDialog("conv")}>{CONV_ICON}Convert</button>),
    growth: field("growth", <Tipped text="Contribution growth" k="contribgrowth" />, <div className="inputwrap">
      <NumberInput data-f="growth" data-i={i} step={0.5} aria-label={aria + " contribution growth"}
        value={blended ? (blend != null ? String(+(blend * 100).toFixed(2)) : "") : st.growth} onValueChange={setF("growth")}
        readOnly={blended} className={blended ? "blended" : undefined} title={blended ? "Blended from your per-account rates. Click to edit." : undefined}
        onClick={() => blended && setDialog("growth")} />
      <span className="affix">%/yr</span></div>,
      split ? <button type="button" className="linkbtn" data-grate={i} onClick={() => setDialog("growth")}>{st.gRates ? "Edit by account" : "Set by account"}</button> : null),
    vol: field("vol", "Volatility", <div className="inputwrap"><NumberInput data-f="vol" data-i={i} nonNeg value={st.vol} aria-label={aria + " volatility"} onValueChange={setF("vol")} /><span className="affix">%/yr</span></div>,
      undefined, "stagevol", mc ? undefined : { display: "none" }),
    rate: field("rate", <Tipped text="Rate of return" k="nominalreturn" />, <div className="inputwrap">
      <SignFlip value={st.nominal} onFlip={setF("nominal")} />
      <NumberInput data-f="nominal" data-i={i} step={0.5} value={st.nominal} aria-label={aria + " rate of return"} onValueChange={setF("nominal")} />
      <span className="affix">%</span></div>,
      <div className="hint stagereal" data-realrate={i} style={{ margin: "4px 0 0" }}>{pctStr((1 + num.nominal - fees) / (1 + inflation) - 1, 2) + " Real"}</div>),
  };
  if (split) {
    const acct = (k: "cT" | "cR" | "cB", lbl: string) => field(k, lbl, <div className="inputwrap"><span className="affix">$</span>
      <MoneyInput data-f={k} data-i={i} nonNeg value={shown[k]} aria-label={aria + " " + lbl + " contribution"} onValueChange={setSplit(k)} /></div>);
    f.trad = acct("cT", "Traditional");
    f.roth = acct("cR", "Roth");
    f.brok = acct("cB", "Taxable");
    f.total = field("total", "Total", <div className="inputwrap" style={{ boxShadow: "none", background: "transparent" }}><span className="affix">$</span>
      <input type="text" readOnly tabIndex={-1} data-stotal={i} aria-label={aria + " total contribution"} value={groupDigits(Math.round(parseNum(st.contrib) * 100) / 100, true)} /></div>, adjRow);
  }
  const order = split ? ["years", "freq", "growth", "vol", "rate", "trad", "roth", "brok", "total"] : ["years", "contrib", "freq", "growth", "vol", "rate"];
  // Two columns on phones: the glide toggle fills the cell beside the last
  // field when that leaves one free, else it takes its own row.
  const shownCount = order.length - (mc ? 0 : 1);

  /* Defaults to 3 points below this stage's own rate over its final 5 years,
     worked out afresh each time it's turned on. */
  const toggleGlide = () => up((c) => c.glideOn ? { ...c, glideOn: false } : {
    ...c, glideOn: true,
    glideEnd: pctField(Math.max(0, parseNum(c.nominal) - 3) / 100),
    glideYears: String(Math.min(5, Math.max(1, Math.round(Math.min(100, parseNum(c.years)))))),
  });
  const glideBtn = <CheckToggle on={st.glideOn} onToggle={toggleGlide}>Glide path<TipDot k="glide" /></CheckToggle>;

  return (
    <div className="stagecard">
      <div className="stagehead">
        <span className="stagenum" contentEditable suppressContentEditableWarning spellCheck={false} data-name={i} title="Click to rename" aria-label={aria + " name"}
          onFocus={(e) => {
            const range = document.createRange();
            range.selectNodeContents(e.currentTarget);
            const sel = window.getSelection();
            sel?.removeAllRanges();
            sel?.addRange(range);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              e.currentTarget.blur();
            }
          }}
          onBlur={(e) => {
            const raw = (e.currentTarget.textContent ?? "").replace(/\s+/g, " ").trim().slice(0, 40);
            const def = "Stage " + (i + 1);
            const name = raw && raw !== def ? raw : undefined;
            e.currentTarget.textContent = name || def;
            up((c) => {
              const { name: _old, ...rest } = c;
              void _old;
              return name ? { ...rest, name } : rest;
            });
          }}>{label}</span>
        <span className="stagespan" data-span={i}>{span}</span>
        <button className="btn mini" type="button" data-del={i} onClick={() => remove(i)}>Remove</button>
      </div>
      <div className={"stagegrid" + (split ? " split" : "") + (mc ? " withvol" : "")}>
        {order.map((k) => f[k])}
        {last ? <div className={"field stageglide" + (shownCount % 2 === 0 ? " even" : "")}><label aria-hidden="true">&nbsp;</label>{glideBtn}</div> : null}
      </div>
      {last ? (
        <div className="glidewrap">
          {glideBtn}
          <div className="glidefields" hidden={!st.glideOn}>
            <div className="two">
              <div className="field"><label>End at</label><div className="inputwrap">
                <NumberInput data-f="glideEnd" data-i={i} value={st.glideEnd} aria-label={aria + " glide end rate"} onValueChange={setF("glideEnd")} /><span className="affix">%</span></div></div>
              <div className="field"><label>Over final</label><div className="inputwrap">
                <NumberInput data-f="glideYears" data-i={i} nonNeg value={st.glideYears} aria-label={aria + " glide years"}
                  onValueChange={(v) => up((c) => ({ ...c, glideYears: stageGlideYears(c.years, v) }))} /><span className="affix">yrs</span></div></div>
            </div>
            <div className="hint" style={{ margin: 0 }} data-glidenote={i}>{st.glideOn ? glideNote(num) : ""}</div>
          </div>
        </div>
      ) : null}

      {dialog === "conv" ? (
        <ConverterDialog title={label + " contribution"} amount={num.contrib} period={st.period} onClose={() => setDialog(null)}
          apply={(v, period) => up((c) => {
            if (!split) return { ...c, contrib: groupDigits(v, true), period };
            // split by account: scale each account, in whole dollars
            const t = Math.round(v * sp.t), r = Math.round(v * sp.r), b = Math.round(v * sp.b), sum = t + r + b;
            const { cT: _a, cR: _b, cB: _c, ...rest } = c;
            void _a; void _b; void _c;
            return { ...rest, contrib: groupDigits(sum, true), period, ...(sum > 0 ? { sTrad: t / sum, sRoth: r / sum } : {}) };
          })} />
      ) : null}
      {dialog === "growth" && split ? (
        <GrowthRatesDialog title={label + " contribution growth"} onClose={() => setDialog(null)}
          init={st.gRates || { t: num.growth, r: num.growth, b: num.growth }}
          blend={(rates) => stageGrowthBlend(num, fees, rates)}
          note={matchOn ? "Your employer match rises at the blended rate." : ""}
          apply={(rates) => {
            up((c) => {
              if (rates) return { ...c, gRates: rates };
              const { gRates: _g, ...rest } = c;
              void _g;
              return { ...rest, growth: pctField(blend ?? num.growth) };
            });
            toast(rates ? "Contribution growth set by account" : "One contribution growth rate for every account");
          }} />
      ) : null}
    </div>
  );
}

function glideNote(st: StageNum): string {
  const total = Math.max(1, Math.round(st.years));
  const gy = Math.min(total, Math.max(1, Math.round(st.glide?.years || 1)));
  const startYear = Math.max(1, total - gy + 1);
  return "Holds " + pctStr(st.nominal, 1) + " through year " + (startYear - 1) + " of this stage, then eases down to " +
    pctStr(st.glide?.endRate || 0, 1) + " by year " + total + ".";
}
