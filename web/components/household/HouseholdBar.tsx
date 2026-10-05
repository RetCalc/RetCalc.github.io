"use client";

/* The household bar at the top of each page: a one-line summary that opens
   into a short form. Markup from src/main/00-household.html. */

import { useRef, useState } from "react";
import { MoneyField, NumberField, SelectField } from "@/components/fields/Field";
import { useToast } from "@/components/shell/Toast";
import { groupDigits, parseOptional } from "@/lib/format";
import { householdSummary, isEmptyHousehold, type Household } from "@/lib/household";
import type { StateOption } from "@/lib/states";
import { useHousehold } from "./HouseholdProvider";

type Form = Record<"age" | "spouseAge" | "retire" | "saved" | "monthly" | "income" | "income2" | "spend", string> & {
  status: "s" | "m";
  state: string;
};

function toForm(h: Household | null): Form {
  const n = (v: number | null | undefined) => (v == null ? "" : String(v));
  const m = (v: number | null | undefined) => (v == null ? "" : groupDigits(v, true));
  return {
    status: h?.status === "m" ? "m" : "s",
    age: n(h?.age), spouseAge: n(h?.spouseAge), retire: n(h?.retire), state: h?.state ?? "",
    saved: m(h?.saved), monthly: m(h?.monthly), income: m(h?.income), income2: m(h?.income2), spend: m(h?.spend),
  };
}

function fromForm(f: Form): Household {
  const married = f.status === "m";
  return {
    status: f.status,
    age: parseOptional(f.age),
    spouseAge: married ? parseOptional(f.spouseAge) : null,
    retire: parseOptional(f.retire),
    state: f.state || null,
    saved: parseOptional(f.saved),
    monthly: parseOptional(f.monthly),
    income: parseOptional(f.income),
    income2: married ? parseOptional(f.income2) : null,
    spend: parseOptional(f.spend),
  };
}

const HOUSE_ICON = (
  <svg viewBox="0 0 20 20" fill="none">
    <path d="M3.2 9.2L10 3.6l6.8 5.6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M5.2 8v8.2h9.6V8" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
    <path d="M8.4 16.2v-4.3h3.2v4.3" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
  </svg>
);

/** `states` comes from the server (lib/states.ts), so this bar never needs
    the calculation engine. */
export function HouseholdBar({ states }: { states: StateOption[] }) {
  const { profile, save, shown, setShown } = useHousehold();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Form>(() => toForm(null));
  const firstField = useRef<HTMLInputElement>(null);
  const set = <K extends keyof Form>(k: K) => (v: Form[K]) => setForm((f) => ({ ...f, [k]: v }));

  const openForm = () => {
    setForm(toForm(profile));
    setOpen(true);
    setTimeout(() => firstField.current?.focus({ preventScroll: true }), 0);
  };
  const close = () => setOpen(false);

  const onSave = () => {
    const h = fromForm(form);
    if (h.age != null && h.retire != null && h.retire <= h.age) {
      toast("Retire-at age needs to be after your current age first", "warn");
      return;
    }
    const done = save({ ...h, savedAt: Date.now() });
    setOpen(false);
    if (!done.length) toast("Saved. Add a few numbers to fill in the tools.");
    else toast(`Filled in ${done.length}${done.length === 1 ? " tool: " : " tools: "}${done.join(", ")}`);
  };

  const onClear = () => {
    if (!isEmptyHousehold(profile) &&
        !confirm("Clear your household profile? Numbers already filled in to each tool stay as they are.")) return;
    save(null);
    setForm(toForm(null));
    setOpen(false);
    toast("Household profile cleared");
  };

  const empty = isEmptyHousehold(profile);
  const sum = profile && !empty ? householdSummary(profile, (c) => states.find((s) => s.code === c)?.name) : null;

  return (
    <section className={`hh${(open ? form.status : profile?.status) === "m" ? " married" : ""}`} id="hhCard" aria-label="Your household" hidden={!shown}>
      <div className="hh-bar">
        <span className="hh-ic" aria-hidden="true">{HOUSE_ICON}</span>
        <div className="hh-sum" id="hhSummary">
          <b>Your household</b>
          {sum ? (
            <>
              <span className="hh-bits hh-long">{sum.long.map((b) => <span key={b}>{b}</span>)}</span>
              <span className="hh-bits hh-short">{sum.short.map((b) => <span key={b}>{b}</span>)}</span>
            </>
          ) : (
            "Enter a few details once and every tool starts from your numbers."
          )}
        </div>
        <button className="btn mini" type="button" id="hhEdit" aria-expanded={open} aria-controls="hhBody"
          onClick={() => (open ? close() : openForm())}>
          {open ? "Close" : empty ? "Set up" : "Edit"}
        </button>{" "}
        <button className="hh-x" type="button" id="hhHide" aria-label="Hide your household bar" title="Hide"
          onClick={() => {
            setOpen(false);
            setShown(false);
            toast("Hidden. The house button at the top brings it back.");
          }}>
          <svg viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg>
        </button>
      </div>
      <div className="hh-body" id="hhBody" hidden={!open}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.target as HTMLElement).tagName === "INPUT") {
            e.preventDefault();
            onSave();
          } else if (e.key === "Escape") close();
        }}>
        <div className="hh-grid">
          <SelectField id="hhStatus" label="Household" value={form.status} onChange={(v) => set("status")(v as Form["status"])}>
            <option value="s">Just me</option>
            <option value="m">Me and a spouse</option>
          </SelectField>
          <NumberField inputRef={firstField} id="hhAge" label="Your age" unit="age" value={form.age} onValueChange={set("age")} />
          <NumberField id="hhSpouseAge" className="hh-sp" label="Spouse's age" unit="age" value={form.spouseAge} onValueChange={set("spouseAge")} />
          <NumberField id="hhRetire" label="Retire at" unit="age" value={form.retire} onValueChange={set("retire")} />
          <SelectField id="hhState" label="State" value={form.state} onChange={set("state")}>
            <option value="">Not set</option>
            {states.map((s) => <option key={s.code} value={s.code}>{s.name}</option>)}
          </SelectField>
          <MoneyField id="hhSaved" label="Retirement savings" value={form.saved} onValueChange={set("saved")} />
          <MoneyField id="hhMonthly" label="You save each month" value={form.monthly} onValueChange={set("monthly")} />
          <MoneyField id="hhIncome" label="Your gross income" unit="/yr" value={form.income} onValueChange={set("income")} />
          <MoneyField id="hhIncome2" className="hh-sp" label="Spouse's gross income" unit="/yr" value={form.income2} onValueChange={set("income2")} />
          <MoneyField id="hhSpend" label="Spending in retirement" unit="/yr" value={form.spend} onValueChange={set("spend")} />
        </div>
        <div className="hh-foot">
          <div className="hint">Any field can stay blank. Filling in replaces those numbers in
            Basic, Advanced, Stages and the tools that use them. You can still change any
            tool afterwards without touching this. Stored in this browser only.</div>
          <div className="hh-btns">
            <button className="btn" type="button" id="hhClear" onClick={onClear}>Clear</button>{" "}
            <button className="btn" type="button" id="hhCancel" onClick={close}>Close</button>{" "}
            <button className="btn primary" type="button" id="hhFill" onClick={onSave}>Save and fill in tools</button>
          </div>
        </div>
      </div>
    </section>
  );
}
