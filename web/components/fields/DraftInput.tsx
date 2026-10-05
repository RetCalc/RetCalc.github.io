"use client";

/* A number field over a stored number rather than stored text: while it has
   focus it keeps exactly what's typed, and otherwise shows the number as
   the page writes it (an age once a retirement age is set, say). Each
   keystroke is handed on as typed. */
import { useRef, useState } from "react";
import { MoneyInput, NumberInput } from "./NumberInput";

type Attrs = Omit<React.ComponentProps<typeof NumberInput>, "value" | "onValueChange">;

export function DraftInput({ money, value, format, onType, ...attrs }: Attrs & {
  money?: boolean; value: number; format: (v: number) => string; onType: (text: string) => void;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const focused = useRef(false);
  const Input = money ? MoneyInput : NumberInput;
  return (
    <Input {...attrs} value={draft ?? format(value)}
      onValueChange={(t) => {
        if (!focused.current) return;
        setDraft(t);
        onType(t);
      }}
      onFocusCapture={() => {
        focused.current = true;
        setDraft(format(value));
      }}
      onBlurCapture={() => {
        focused.current = false;
        setDraft(null);
      }} />
  );
}
