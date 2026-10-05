"use client";

/* The short message that slides up after an action ("Saved", "Copied").
   Ported from toast() in src/js/app/00-core.js. */

import { createContext, use, useCallback, useRef, useState } from "react";

type Kind = "ok" | "warn";
type ToastFn = (msg: string, kind?: Kind) => void;

const ToastContext = createContext<ToastFn>(() => {});

export function useToast(): ToastFn {
  return use(ToastContext);
}

const ICONS: Record<Kind, React.ReactNode> = {
  warn: (
    <svg className="toast-ic" viewBox="0 0 20 20" aria-hidden="true">
      <circle cx="10" cy="10" r="8.2" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <path d="M10 5.8v5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      <circle cx="10" cy="14.1" r="1" fill="currentColor" />
    </svg>
  ),
  ok: (
    <svg className="toast-ic" viewBox="0 0 20 20" aria-hidden="true">
      <circle cx="10" cy="10" r="8.2" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <path d="M6.3 10.4l2.5 2.5 4.9-5.3" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<{ msg: string; kind: Kind; show: boolean }>({ msg: "", kind: "ok", show: false });
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const toast = useCallback<ToastFn>((msg, kind = "ok") => {
    setState({ msg, kind, show: true });
    // 3.5s for a short note, plus reading time past 60 characters, at most 7s.
    const ms = Math.min(7000, 3500 + Math.max(0, msg.length - 60) * 50);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setState((s) => ({ ...s, show: false })), ms);
  }, []);
  return (
    <ToastContext value={toast}>
      {children}
      <div className={`toast ${state.kind}${state.show ? " show" : ""}`} id="toast" role="status">
        {state.msg ? ICONS[state.kind] : null}
        {state.msg ? <span className="toast-msg">{state.msg}</span> : null}
      </div>
    </ToastContext>
  );
}
