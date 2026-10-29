"use client";

/* Changes ahead, the parts both calculators share: the Dashboard's
   Calculator and the main site's Advanced. The kind picker, the form for
   one change with its sentence and effect, and the big view of them all
   (the lanes across the years, and every change with its switch). Each
   calculator says how a change's effect is worked out, which kinds it
   offers, whether accounts are named, and how years read ("Age 47" or
   "Year 5"). Every figure is in today's dollars. */

import { useEffect, useState, type ReactNode } from "react";
import { GiftIcon, LineChartIcon, PlusIcon, TrendingUpIcon, UsersIcon, XIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, MoneyField, NumberField, SelectField } from "@/components/fields/Field";
import { Modal, ModalTop } from "@/components/shell/Modal";
import { Segmented } from "@/components/common/Readout";
import { Input } from "@/components/ui/input";
import { parseNum } from "@/lib/format";
import { COVER_ORDER, type CoverLine } from "@/tools/plan/model";
import { ACCT_NAMES, pctOf, scenarioName, spanOf, type Scenario, type ScenarioKind } from "@/components/dashboard/scenarios";

/** The kind's colour, as a class on the row's mark and lane. */
export function kindClass(s: Scenario): string {
  if (s.kind === "children") return "dsh-sc-children";
  if (s.kind === "returns") return "dsh-sc-returns";
  if (s.kind === "lump") return s.amount < 0 ? "dsh-sc-down" : "dsh-sc-lump";
  return s.amount < 0 ? "dsh-sc-down" : "dsh-sc-up";
}

/** "+$1.2M", "−$472K", for an effect at retirement. */
export function fx(v: number): string {
  const a = Math.abs(v), sign = v < 0 ? "−" : "+";
  if (a < 500) return sign + "$0";
  return sign + (a >= 1e6 ? "$" + (a / 1e6).toFixed(a >= 1e7 ? 0 : 1) + "M" : a >= 1e3 ? "$" + Math.round(a / 1e3) + "K" : "$" + Math.round(a));
}

/** A lane's short figure: the change it makes, in a few characters. */
export function laneFigure(s: Scenario, kids: { peak: number } | null): string {
  if (s.kind === "children") return kids && kids.peak ? "up to " + (kids.peak < 0 ? "−" : "+") + "$" + Math.round(Math.abs(kids.peak)).toLocaleString("en-US") + "/mo" : "";
  if (s.kind === "returns") return pctOf(s.nominal);
  if (s.kind === "lump") return (s.amount < 0 ? "−" : "+") + "$" + Math.round(Math.abs(s.amount)).toLocaleString("en-US");
  const sign = s.amount < 0 ? "−" : "+";
  if (s.mode === "amount") return sign + "$" + Math.round(Math.abs(s.amount)).toLocaleString("en-US") + "/mo";
  return sign + Math.abs(s.amount) + "%" + (s.mode === "pctYearly" ? "/yr" : "");
}

/** How a calculator counts the years: by age (the Dashboard, or Advanced
    with your age in), or by years from now. `base` is the first one,
    `end` the plan's end (retirement). */
export interface Years { base: number; end: number; ages: boolean }
/** A year as a field option or an axis label: "47", or "Year 5". */
export const yearWord = (Y: Years, n: number) => (Y.ages ? String(n) : "Year " + n);

/* ---------- the big view: the lanes and every change ---------- */

export function ChangesDialog({ rows, years: Y, kidSpan, figureOf, sentenceOf, warnOf, edit, remove, add, close, fixed }: {
  rows: Scenario[]; years: Years;
  /** A row that can't be removed here (the Dashboard's children, kept in Profile). */
  fixed?: (r: Scenario) => boolean;
  kidSpan: { from: number; to: number; peak: number } | null;
  figureOf: (r: Scenario) => ReactNode; sentenceOf: (r: Scenario) => string; warnOf: (r: Scenario) => string | null;
  edit: (r: Scenario) => void; remove: (id: string) => void; add: () => void; close: () => void;
}) {
  // Which row is asking "remove this?". A change is switched on or off in
  // the calculator's own list; here, clicking one opens it.
  const [confirm, setConfirm] = useState<string | null>(null);
  const { base, end } = Y, span = Math.max(1, end - base);
  const lanes = (
    <div className="dsh-sc-lanes" role="group" aria-label={Y.ages ? "Your changes across your ages" : "Your changes across the years"}>
      {rows.map((r, i) => {
        const [f, t] = r.kind === "children" ? [kidSpan?.from ?? base, kidSpan?.to ?? end] : spanOf(r, end);
        const left = ((Math.max(base, f) - base) / span) * 100, width = ((Math.min(end, t) - Math.max(base, f)) / span) * 100;
        if (!(width > 0)) return null;
        const fig = laneFigure(r, kidSpan), text = `${i + 1}. ${scenarioName(r)}${fig ? "  " + fig : ""}`;
        // The words sit in the bar when it's wide enough for them, and
        // just after it when it isn't (a lump sum, a short stretch).
        const inside = width >= Math.min(60, 4 + text.length * 1.1);
        return (
          <div key={r.id} className="dsh-sc-lane">
            <button type="button" className={"dsh-sc-bar " + kindClass(r) + (r.on ? "" : " dsh-sc-off") + (inside ? "" : " dsh-sc-narrow")} style={{ "--sc-l": left + "%", "--sc-w": width + "%" } as React.CSSProperties} onClick={() => edit(r)}
              title={scenarioName(r) + ": " + sentenceOf(r) + (r.on ? "" : " Switched off.") + " Click to edit."}>
              <span className="dsh-sc-lbl"><span className="dsh-sc-n">{i + 1}.</span> {scenarioName(r)}{fig ? <span className="dsh-sc-lfig">{fig}</span> : null}</span>
            </button>
          </div>
        );
      })}
      <div className="dsh-sc-axis">{Y.ages
        ? <><span>Age {base}, today</span><span>{Math.round((base + end) / 2)}</span><span>Retiring at {end}</span></>
        : <><span>Today</span><span>Year {Math.round((base + end) / 2)}</span><span>Year {end}</span></>}</div>
    </div>
  );
  return (
    <Modal size="table" onClose={close}>
      <ModalTop title="Changes ahead" onClose={close} />
      <div className="dsh-ch">
        <div className="dsh-ch-lanes">{lanes}</div>
        <ol className="dsh-sc-rows dsh-sc-list" aria-label="Changes ahead">
          {rows.map((r, i) => {
            const warn = warnOf(r);
            return (
              <li key={r.id} className={"dsh-sc-row" + (r.on ? "" : " dsh-sc-off")}>
                <div className="dsh-sc-top">
                  <button type="button" className="dsh-sc-open" onClick={() => edit(r)} aria-label={"Edit " + scenarioName(r)}>
                    <span className="dsh-sc-name"><span className={"dsh-sc-mark " + kindClass(r)} aria-hidden="true" /><span className="dsh-sc-n">{i + 1}.&nbsp;</span>{scenarioName(r)}{r.on ? null : <span className="dsh-sc-offtag">Off</span>}</span>
                    {figureOf(r)}
                    <span className="dsh-sc-sent">{sentenceOf(r)}</span>
                  </button>
                  {fixed?.(r) ? <span className="dsh-sc-xgap" aria-hidden="true" /> : <Button variant="ghost" size="icon-sm" aria-label={"Remove " + scenarioName(r)} onClick={() => setConfirm(r.id)}><XIcon aria-hidden="true" /></Button>}
                </div>
                {warn ? <p className="dsh-sc-warn">{warn}</p> : null}
                {confirm === r.id ? (
                  <div className="dsh-sc-confirm" role="alertdialog" aria-label={"Remove " + scenarioName(r) + "?"}>
                    <span>Remove <b>{scenarioName(r)}</b>? It can&apos;t be brought back.</span>
                    <Button variant="destructive" size="sm" onClick={() => { remove(r.id); setConfirm(null); }}>Remove</Button>
                    <Button variant="outline" size="sm" onClick={() => setConfirm(null)}>Keep</Button>
                  </div>
                ) : null}
              </li>
            );
          })}
        </ol>
      </div>
      <div className="formactions mt-4">
        <Button variant="outline" className="flex-1" onClick={add}><PlusIcon aria-hidden="true" />Add a change</Button>
        <Button className="flex-1" onClick={close}>Done</Button>
      </div>
    </Modal>
  );
}

/* ---------- adding one: the kind, then its form ---------- */

export interface Kind { kind: ScenarioKind; icon: ReactNode; title: string; sub: string; over: Partial<Scenario> }
export const SAVING_KIND: Kind = { kind: "saving", icon: <TrendingUpIcon aria-hidden="true" />, title: "Save more or less", sub: "A raise, a bigger house, easing off: more or less saving from an age on, by dollars a month or a share, all at once or phased in.", over: { name: "", amount: 500, acct: "auto" } };
export const LUMP_KIND: Kind = { kind: "lump", icon: <GiftIcon aria-hidden="true" />, title: "A lump sum", sub: "An inheritance or a home sale put in, or a big expense taken out, at an age.", over: {} };
export const RETURNS_KIND: Kind = { kind: "returns", icon: <LineChartIcon aria-hidden="true" />, title: "Different returns", sub: "A higher or lower return from an age on, stepped or climbing.", over: {} };
export const CHILDREN_KIND: Kind = { kind: "children", icon: <UsersIcon aria-hidden="true" />, title: "Children", sub: "Children you have or plan to have: what they cost as they grow, out of what you save.", over: {} };

export function PickKind({ kinds, note, close, pick }: { kinds: Kind[]; note: string; close: () => void; pick: (k: Kind) => void }) {
  return (
    <Modal size="wide" onClose={close}>
      <ModalTop title="Add a change" onClose={close} />
      <p className="hint mt-0 mb-3">{note}</p>
      <div className="dsh-choices dsh-sc-kinds">
        {kinds.map((k) => <button key={k.title} type="button" className="dsh-choice" aria-pressed={false} onClick={() => pick(k)}>{k.icon}<b>{k.title}</b><span>{k.sub}</span></button>)}
      </div>
    </Modal>
  );
}

const span = (from: number, to: number) => { const o: number[] = []; for (let a = from; a <= to; a++) o.push(a); return o; };

/** A field's label with its tip: which tip, by the form's own names for its fields. */
export type ChangeTip = "from" | "amount" | "pct" | "acct" | "lump" | "return";

/** One change's form, its sentence and what it does at retirement. The
    change's years here are as the calculator counts them (`years`). */
export function ChangeDialog({ s: s0, fresh, years: Y, accounts, label, sentence, effectOf, where, note, close, save, remove }: {
  s: Scenario; fresh: boolean; years: Years;
  /** Whether a change names an account (the account split is on). */
  accounts: boolean;
  label: (text: string, tip: ChangeTip) => ReactNode;
  sentence: (s: Scenario) => string;
  /** The change's effect at retirement with the others as they are, and
      why it can't be kept as it stands (null when it can). */
  effectOf: (s: Scenario) => { fv: number | null; cant: string | null };
  /** What a cut out of one account does once that account runs out. */
  where?: (acct: CoverLine) => string;
  /** A line under the sentence about how the calculator counts this change. */
  note?: (s: Scenario) => string | null;
  close: () => void; save: (s: Scenario) => void; remove: () => void;
}) {
  const [s, setS] = useState<Scenario>(s0);
  // Typed figures as typed, so a sign or a decimal point can be entered.
  const [txt, setTxt] = useState({ amount: String(s0.amount), ramp: String(s0.ramp), nominal: (s0.nominal * 100).toFixed(2) });
  const up = (patch: Partial<Scenario>) => setS((c) => ({ ...c, ...patch }));
  const typed = (k: "amount" | "ramp" | "nominal") => (v: string) => {
    setTxt((c) => ({ ...c, [k]: v }));
    const n = parseNum(v);
    if (!isFinite(n)) return;
    up(k === "nominal" ? { nominal: n / 100 } : k === "ramp" ? { ramp: Math.max(0, Math.round(n)) } : { amount: n });
  };
  // The effect, worked out a moment behind the typing.
  const [effect, setEffect] = useState<{ fv: number | null; cant: string | null } | null>(null);
  const sKey = JSON.stringify(s);
  useEffect(() => {
    const t = setTimeout(() => setEffect(effectOf(s)), 150);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- the draft as a whole, by its key
  }, [sKey, effectOf]);
  const cant = !!effect?.cant;
  const less = s.amount < 0;
  const acctOpts = (lead: string) => <>
    <option value="auto">{lead}</option>
    {COVER_ORDER.map((k: CoverLine) => <option key={k} value={k}>{ACCT_NAMES[k]}</option>)}
  </>;
  const word = (n: number) => yearWord(Y, n);
  const from = <SelectField id="scFrom" label={label(s.kind === "lump" ? (Y.ages ? "At age" : "In year") : (Y.ages ? "Starting at age" : "Starting in year"), "from")} value={String(s.from)} onChange={(v) => up({ from: parseNum(v), until: s.until > parseNum(v) || s.until === 0 ? s.until : 0 })}>
    {span(Y.base, Y.end - 1).map((a) => <option key={a} value={a}>{Y.ages ? a : a - Y.base === 0 ? "Now" : "Year " + (a - Y.base)}</option>)}
  </SelectField>;
  const name = <Field id="scName" label="Name" className="dsh-sc-full"><Input id="scName" value={s.name} placeholder={scenarioName(s)} onChange={(e) => up({ name: e.target.value })} /></Field>;
  let form: ReactNode;
  if (s.kind === "returns") {
    form = <>
      {from}
      <NumberField id="scNominal" label={label("Return, before inflation", "return")} unit="%" step={0.25} value={txt.nominal} onValueChange={typed("nominal")} />
      <Field id="scHow" label="How">
        <Segmented id="scHow" size="fill" attr="data-how" options={[["0", "All at once"], ["1", "Climb over"]] as const} value={s.ramp > 0 ? "1" : "0"} onChange={(v) => { const r = v === "1" ? Math.max(1, s.ramp || 10) : 0; up({ ramp: r }); setTxt((c) => ({ ...c, ramp: String(r) })); }} />
      </Field>
      {s.ramp > 0 ? <NumberField id="scRamp" label="Years to climb" unit="years" value={txt.ramp} onValueChange={typed("ramp")} /> : null}
    </>;
  } else if (s.kind === "lump") {
    form = <>
      {from}
      <MoneyField id="scAmount" label={label("Amount", "lump")} value={txt.amount.replace(/^-/, "")} onValueChange={(v) => typed("amount")((less ? "-" : "") + v)} />
      <Field id="scSign" label="Which way">
        <Segmented id="scSign" size="fill" attr="data-sign" options={[["in", "Put in"], ["out", "Taken out"]] as const} value={less ? "out" : "in"} onChange={(v) => typed("amount")((v === "out" ? "-" : "") + txt.amount.replace(/^-/, ""))} />
      </Field>
      {accounts ? <SelectField id="scAcct" label={label(less ? "Taken out of" : "Put into", "acct")} value={s.acct} onChange={(v) => up({ acct: v as Scenario["acct"] })}>{acctOpts("Brokerage")}</SelectField> : null}
    </>;
  } else {
    form = <>
      {from}
      <SelectField id="scUntil" label="Until" value={String(s.until)} onChange={(v) => up({ until: parseNum(v) })}>
        <option value="0">{Y.ages ? "Retirement" : "The end"}</option>
        {span(s.from + 1, Y.end - 1).map((a) => <option key={a} value={a}>{Y.ages ? "Age " + a : "Year " + (a - Y.base)}</option>)}
      </SelectField>
      <Field id="scMode" label="As" className="dsh-sc-full">
        <Segmented id="scMode" size="fill" attr="data-mode" options={[["amount", "$ per month"], ["pct", "% of saving"], ["pctYearly", "% each year"]] as const} value={s.mode}
          onChange={(v) => { const m = v as Scenario["mode"]; const a = m === "amount" ? (less ? -500 : 500) : less ? -10 : 10; up({ mode: m, amount: a }); setTxt((c) => ({ ...c, amount: String(a) })); }} />
      </Field>
      <div className="dsh-sc-amt">
        {s.mode === "amount"
          ? <MoneyField id="scAmount" label={label("Change saving by", "amount")} unit="/mo" value={txt.amount.replace(/^-/, "")} onValueChange={(v) => typed("amount")((less ? "-" : "") + v)} />
          : <NumberField id="scAmount" label={label("Change saving by", "pct")} unit="%" max={100} value={txt.amount.replace(/^-/, "")} onValueChange={(v) => typed("amount")((less ? "-" : "") + v)} />}
        <Field id="scSign" label="Which way">
          <Segmented id="scSign" size="fill" attr="data-sign" options={[["more", "More"], ["less", "Less"]] as const} value={less ? "less" : "more"} onChange={(v) => typed("amount")((v === "less" ? "-" : "") + txt.amount.replace(/^-/, ""))} />
        </Field>
      </div>
      {s.mode !== "pctYearly" ? <Field id="scHow" label="How">
        <Segmented id="scHow" size="fill" attr="data-how" options={[["0", "All at once"], ["1", "Phased in"]] as const} value={s.ramp > 0 ? "1" : "0"} onChange={(v) => { const r = v === "1" ? Math.max(1, s.ramp || 3) : 0; up({ ramp: r }); setTxt((c) => ({ ...c, ramp: String(r) })); }} />
      </Field> : null}
      {s.mode !== "pctYearly" && s.ramp > 0 ? <NumberField id="scRamp" label="Over" unit="years" value={txt.ramp} onValueChange={typed("ramp")} /> : null}
      {accounts ? <SelectField id="scAcct" label={label(less ? "Comes out of" : "Goes into", "acct")} value={s.acct} onChange={(v) => up({ acct: v as Scenario["acct"] })} className="dsh-sc-full">
        {acctOpts(less ? "Brokerage first, then the others" : "Brokerage")}
      </SelectField> : null}
    </>;
  }
  const after = accounts && where && s.kind === "saving" && s.acct !== "auto" && less ? " " + where(s.acct) : "";
  const title = fresh ? ({ saving: SAVING_KIND, lump: LUMP_KIND, returns: RETURNS_KIND, children: CHILDREN_KIND } as const)[s.kind].title : scenarioName(s);
  return (
    <Modal size="wide" onClose={close} focus="#scName">
      <ModalTop title={title} onClose={close} />
      <div className="dsh-sc-form">
        {name}
        {form}
      </div>
      <div className="dsh-sc-preview" aria-live="polite">
        <b>{sentence(s)}</b>{after}
        {note?.(s) ? <div className="dsh-sc-pe dsh-muted">{note(s)}</div> : null}
        <div className="dsh-sc-pe">At {Y.ages ? "retirement" : word(Y.end).toLowerCase()}: {effect == null ? <span className="dsh-muted">working it out…</span> : effect.fv == null ? <span className="dsh-muted">not known yet</span> : <b className={effect.fv < 0 ? "dsh-dn" : effect.fv > 0 ? "dsh-up" : ""}>{fx(effect.fv)}</b>} in today&apos;s dollars, with your other changes as they are.</div>
        {effect?.cant ? <div className="dsh-sc-pe dsh-sc-warn">You can&apos;t afford this as it stands. {effect.cant}</div> : null}
      </div>
      <div className="formactions mt-4">
        {!fresh ? <Button variant="link" className="mr-auto" onClick={remove}>Remove this change</Button> : null}
        <Button variant="outline" onClick={close}>Cancel</Button>
        <Button disabled={cant} onClick={() => { if (!cant) save({ ...s, name: s.name.trim() }); }}>{fresh ? "Add it" : "Save"}</Button>
      </div>
    </Modal>
  );
}
