"use client";

/* The pieces every guide step is built from: choice buttons, answer fields,
   the box for a trip into a tool, and the note a step shows on your return.
   Each step reads two copies of the answers: `v`, as they were when the card
   was last drawn, for what the card shows and hides (so typing never pulls
   a field out from under you), and `a`, as they are now, for the notes that
   change while you type. From src/js/app/29-guide-trips.js. */

import { createContext, use } from "react";
import { DraftInput } from "@/components/fields/DraftInput";
import { ToolIcon } from "@/components/tools/ToolIcon";
import { Html } from "@/components/common/Html";
import { parseNum } from "@/lib/format";
import type { ToolSub } from "@/lib/tools";
import { gdM, ok } from "./calc";
import type { AnswerKey, Answers, GuideState } from "./store";
import { TRIP_META } from "./tripMeta";
import { Button } from "@/components/ui/button";
import { Affixed } from "@/components/fields/Field";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { CircleAlertIcon } from "lucide-react";

export interface GuideView {
  g: GuideState;
  /** The answers now. */
  a: Answers;
  /** The answers as the card was last drawn. */
  v: Answers;
  /** Draws the card again from the answers now. */
  redraw: () => void;
  /** Changes one answer; `redraw` draws the card again too. */
  set: <K extends AnswerKey>(k: K, val: Answers[K], redraw?: boolean) => void;
  trip: (id: string, from?: string) => void;
  go: (step: string) => void;
  /** The guide's own buttons: next, prev, undo, apply... */
  act: (what: string) => void;
}
export const GuideCtx = createContext<GuideView | null>(null);
export function useGuideView(): GuideView {
  const v = use(GuideCtx);
  if (!v) throw new Error("useGuideView needs the guide around it");
  return v;
}

export function Choice({ k, val, title, sub }: { k: AnswerKey; val: string; title: React.ReactNode; sub?: React.ReactNode }) {
  const G = useGuideView();
  const on = G.a[k] === val;
  return (
    <button type="button" className={"gd-choice" + (on ? " on" : "")} data-set={k} data-val={val} aria-pressed={on}
      onClick={() => G.set(k, val as Answers[typeof k], true)}>
      <i className="dot" aria-hidden="true"></i><span className="t"><b>{title}</b>{sub ? <span>{sub}</span> : null}</span>
    </button>
  );
}

interface FieldOpts { full?: boolean; hint?: React.ReactNode; /** What's wrong with the answer, under the field. */ err?: React.ReactNode }
function Wrap({ k, label, full, hint, err, children }: FieldOpts & { k: string; label: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className={"field" + (full ? " full" : "")}><Label className="mb-1.5" htmlFor={"gdf-" + k}><span>{label}</span></Label>{children}
      {err ? <div className="mt-1.5 flex items-start gap-2 text-note text-destructive"><CircleAlertIcon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
        <span id={"gdf-" + k + "-err"} role="alert">{err}</span></div> : null}
      {hint && !err ? <div className="hint">{hint}</div> : null}</div>
  );
}
/** Marks a field whose answer can't be used, and points it at the reason. */
const invalid = (k: string, err: React.ReactNode) => (err ? { "aria-invalid": true, "aria-describedby": "gdf-" + k + "-err" } : {});
const typed = (t: string) => (t.trim() === "" ? null : parseNum(t));

export function MoneyF({ k, label, per, ph, ...o }: FieldOpts & { k: AnswerKey; label: React.ReactNode; per?: string; ph?: string }) {
  const G = useGuideView();
  const val = G.a[k];
  return (
    <Wrap k={k} label={label} {...o}>
      <Affixed prefix="$" suffix={per}>
        <DraftInput money nonNeg id={"gdf-" + k} data-a={k} placeholder={ph} value={ok(val) ? val : NaN} format={gdM}
          onType={(t) => G.set(k, typed(t) as Answers[typeof k])} /></Affixed>
    </Wrap>
  );
}
export function NumF({ k, label, affix, ...o }: FieldOpts & { k: AnswerKey; label: React.ReactNode; affix: string }) {
  const G = useGuideView();
  const val = G.a[k];
  return (
    <Wrap k={k} label={label} {...o}>
      <Affixed suffix={affix}>
        <DraftInput nonNeg step={1} id={"gdf-" + k} data-a={k} {...invalid(k, o.err)} value={ok(val) ? val : NaN} format={(x) => (ok(x) ? String(x) : "")}
          onType={(t) => G.set(k, typed(t) as Answers[typeof k])} />
        </Affixed>
    </Wrap>
  );
}
export function SelF({ k, label, opts, num, redraw, ...o }: FieldOpts & {
  k: AnswerKey; label: React.ReactNode; opts: [value: string | number, label: string][]; num?: boolean; redraw?: boolean;
}) {
  const G = useGuideView();
  const cur = G.a[k] == null ? "" : String(G.a[k]);
  return (
    <Wrap k={k} label={label} {...o}>
      <NativeSelect id={"gdf-" + k} data-a={k} value={cur} onChange={(e) => {
        const t = e.target.value;
        G.set(k, (num ? (t === "" ? null : parseFloat(t)) : t || null) as Answers[typeof k], redraw);
      }}>
        {opts.map(([val, lab]) => <option key={String(val)} value={String(val)}>{lab}</option>)}
      </NativeSelect>
    </Wrap>
  );
}
export const Fields = ({ className = "gd-fields", children }: { className?: string; children: React.ReactNode }) => <div className={className}>{children}</div>;
export const Callout = ({ cls, children, style }: { cls?: string; children: React.ReactNode; style?: React.CSSProperties }) => (
  <div className={"gd-callout" + (cls ? " " + cls : "")} style={style}>{children}</div>
);
export const Q = ({ children }: { children: React.ReactNode }) => <h2 className="gd-q" tabIndex={-1}>{children}</h2>;
export const Lead = ({ children }: { children: React.ReactNode }) => <p className="gd-lead">{children}</p>;
export const H3 = ({ children }: { children: React.ReactNode }) => <div className="gd-h3">{children}</div>;

/* The Basic calculator has no card in the tool list, so its icon is here. */
const BASIC_ICON = (
  <svg viewBox="0 0 40 40" fill="none"><path d="M5 33h30" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /><path d="M7 29 C15 27 22 22 33 9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    <path d="M27 9h6v6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
);

/** The trip box: which tool, why, what you'll do there, and the button. */
export function Task({ id, head, label, after }: { id: string; head: string; label?: string | null; after?: React.ReactNode }) {
  const G = useGuideView();
  const T = TRIP_META[id];
  return (
    <div className="gd-task">
      <div className="gd-task-h"><div className="gd-task-ic" aria-hidden="true">{T.tool === "basic" ? BASIC_ICON : <ToolIcon sub={T.tool as ToolSub} />}</div>
        <div><b>{head}</b><span>{T.name + (T.mins ? " · about " + T.mins + " minutes" : "")}</span></div></div>
      {T.preview?.length ? <ol className="gd-steps">{T.preview.map((t) => <li key={t}>{t}</li>)}</ol> : null}
      <Button variant="outline" size="lg" data-trip={id} onClick={() => G.trip(id)}>{label || "Open " + T.name}<i className="arw" aria-hidden="true"></i></Button>
      {after}
    </div>
  );
}
/** "Optional. Continue whenever you're ready." under a trip box. */
export const After = ({ children }: { children: React.ReactNode }) => <div className="hint mt-2.5">{children}</div>;

/** The note a step shows on your return from a tool, or after a change:
    the guide's own words, with Undo when it can be taken back. */
export function BackNote({ step }: { step: string }) {
  const G = useGuideView();
  const B = G.g.back;
  if (!B || B.step !== step || !B.msg) return null;
  const see = B.see;
  return (
    <div className="gd-callout ok">
      <Html as="span" html={B.msg} />
      {see ? <><br /><Button variant="outline" size="sm" className="mt-2" data-trip={see.trip} data-from={step} onClick={() => G.trip(see.trip, step)}>
        {see.label}<i className="arw" aria-hidden="true"></i></Button></> : null}
      {B.undo ? <><br /><Button variant="outline" size="sm" className="mt-2" data-gd="undo" onClick={() => G.act("undo")}>Undo</Button></> : null}
    </div>
  );
}
