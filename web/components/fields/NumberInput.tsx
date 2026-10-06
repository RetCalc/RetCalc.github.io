"use client";

/* The site's number fields. They're text inputs with inputmode="decimal", so
   phones raise the number keypad rather than the punctuation keyboard; the
   filtering and arrow-key stepping that type="number" would give are done
   here. Ported from initFields() in src/js/app/01-inputs.js:

   - money fields group digits with commas as you type, keeping the caret
     after the same digit
   - plain number fields drop anything that isn't part of a number, cap at
     `max`, and step with the arrow keys
   - `nonNeg` fields refuse a minus sign
   - focusing a field selects what's in it, so typing replaces it

   Both are controlled: the parent holds the text as typed. Inside an
   Affixed group they render as the group's input, otherwise on their own. */

import { createContext, use, useLayoutEffect, useRef, type InputHTMLAttributes, type Ref } from "react";
import { Input } from "@/components/ui/input";
import { InputGroupInput } from "@/components/ui/input-group";
import { groupDigits, parseNum, sanitizeNumeric } from "@/lib/format";

/** True inside an input group, where a field drops its own border. */
export const InGroup = createContext(false);

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "type" | "max" | "step"> & {
  value: string;
  onValueChange: (value: string) => void;
  nonNeg?: boolean;
  ref?: Ref<HTMLInputElement>;
};

/* Selecting on focus: the mouseup that gave focus would otherwise collapse
   the selection straight back to a caret. */
function useSelectOnFocus() {
  const armed = useRef(false);
  return {
    onFocus: (e: React.FocusEvent<HTMLInputElement>) => {
      armed.current = true;
      const el = e.currentTarget;
      setTimeout(() => {
        if (document.activeElement === el) el.select();
      }, 0);
    },
    onMouseUp: (e: React.MouseEvent<HTMLInputElement>) => {
      if (armed.current) {
        e.preventDefault();
        armed.current = false;
      }
    },
    onBlurArm: () => {
      armed.current = false;
    },
  };
}

/* After React writes a reformatted value, put the caret back where the
   person was typing. */
function useCaret(inner: React.RefObject<HTMLInputElement | null>) {
  const pending = useRef<number | null>(null);
  useLayoutEffect(() => {
    if (pending.current !== null && inner.current && document.activeElement === inner.current) {
      inner.current.setSelectionRange(pending.current, pending.current);
    }
    pending.current = null;
  });
  return pending;
}

function setRefs<T>(a: Ref<T> | undefined, b: React.RefObject<T | null>, el: T | null) {
  b.current = el;
  if (typeof a === "function") a(el);
  else if (a) (a as React.RefObject<T | null>).current = el;
}

export function MoneyInput({ value, onValueChange, nonNeg = false, ref, onBlur, ...rest }: Props) {
  const inner = useRef<HTMLInputElement>(null);
  const caretRef = useCaret(inner);
  const sel = useSelectOnFocus();
  const Control = use(InGroup) ? InputGroupInput : Input;
  return (
    <Control
      {...rest}
      variant="numeric"
      ref={(el) => setRefs(ref, inner, el)}
      type="text"
      inputMode="decimal"
      value={value}
      onKeyDown={(e) => {
        if (nonNeg && (e.key === "-" || e.key === "Subtract")) e.preventDefault();
        rest.onKeyDown?.(e);
      }}
      onChange={(e) => {
        const before = e.target.value;
        const at = e.target.selectionStart ?? before.length;
        const digitsBefore = before.slice(0, at).replace(/[^0-9.\-]/g, "").length;
        const after = groupDigits(before, nonNeg);
        let pos = after.length;
        for (let i = 0, seen = 0; i < after.length; i++) {
          if (/[0-9.\-]/.test(after[i])) seen++;
          if (seen === digitsBefore) {
            pos = i + 1;
            break;
          }
        }
        caretRef.current = digitsBefore === 0 ? 0 : pos;
        onValueChange(after);
      }}
      onFocus={sel.onFocus}
      onMouseUp={sel.onMouseUp}
      onBlur={(e) => {
        sel.onBlurArm();
        const g = groupDigits(value, nonNeg);
        if (g !== value) onValueChange(g);
        onBlur?.(e);
      }}
    />
  );
}

export function NumberInput({
  value, onValueChange, nonNeg = false, step = 1, max, ref, ...rest
}: Props & { step?: number; max?: number }) {
  const inner = useRef<HTMLInputElement>(null);
  const caretRef = useCaret(inner);
  const sel = useSelectOnFocus();
  const Control = use(InGroup) ? InputGroupInput : Input;
  return (
    <Control
      {...rest}
      variant="numeric"
      ref={(el) => setRefs(ref, inner, el)}
      type="text"
      inputMode="decimal"
      value={value}
      onChange={(e) => {
        const raw = e.target.value;
        let next = sanitizeNumeric(raw, nonNeg);
        if (next !== raw) {
          const at = e.target.selectionStart;
          if (at !== null) caretRef.current = Math.max(0, at - 1);
        }
        if (max !== undefined && parseNum(next) > max) next = String(max);
        onValueChange(next);
      }}
      onKeyDown={(e) => {
        if (nonNeg && (e.key === "-" || e.key === "Subtract")) e.preventDefault();
        if ((e.key === "ArrowUp" || e.key === "ArrowDown") && !rest.readOnly) {
          e.preventDefault();
          let v = parseNum(value) + (e.key === "ArrowUp" ? step : -step);
          if (nonNeg) v = Math.max(0, v);
          if (max !== undefined) v = Math.min(max, v);
          onValueChange(String(Math.round(v * 1e6) / 1e6));
        }
        rest.onKeyDown?.(e);
      }}
      onFocus={sel.onFocus}
      onMouseUp={sel.onMouseUp}
      onBlur={(e) => {
        sel.onBlurArm();
        rest.onBlur?.(e);
      }}
    />
  );
}
