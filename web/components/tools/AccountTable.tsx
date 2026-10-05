"use client";

/* The "By account type" panel of Advanced and Stages: each account at
   retirement, its share of the first year's withdrawal and the tax on it,
   with a link that loads those withdrawals into Income Tax. From
   acRenderTable() in src/js/app/03-projection.js and the .txlink handler in
   18-debt.js. */

import { useRef } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/shell/Toast";
import { setToolInputs, toolInputs } from "@/components/tools/ToolState";
import { CsvButton } from "@/components/ui/CsvButton";
import type { AccountResult } from "@/lib/accounts";
import { STATES } from "@/lib/engine/typed";
import { fmtNum, groupDigits, money, pctStr } from "@/lib/format";
import { TAX_DEFAULTS } from "@/tools/tax/model";

const ROWS = [
  { k: "trad", label: "Traditional 401(k) / IRA", c: "#e2795f" },
  { k: "roth", label: "Roth 401(k) / IRA", c: "#4fbf95" },
  { k: "brok", label: "Taxable brokerage", c: "#7d9fd6" },
] as const;

export function AccountTable({ id, B, years }: { id: "acResults" | "saResults"; B: AccountResult; years: number }) {
  const router = useRouter();
  const toast = useToast();
  const table = useRef<HTMLTableElement>(null);
  const a = B.a;
  const st = (STATES as Record<string, { n: string; none?: number }>)[a.state];
  const toTax = (e: React.MouseEvent) => {
    e.preventDefault();
    const r = (v: number) => groupDigits(Math.round(v || 0), true);
    setToolInputs("tax", {
      ...toolInputs("tax", TAX_DEFAULTS), mode: "retire", status: a.status, state: a.state,
      trad: r(B.w.trad), roth: r(B.w.roth), brok: r(B.w.brok), gainPct: String(Math.round(B.gainPct * 1000) / 10),
      seniors: String(B.seniors || 0), ss: "0", pension: "0", other: "0", pre: "0", dedType: "std", item: "0",
    });
    router.push("/incometax");
    toast("Loaded your first-year withdrawals into Income Tax");
  };
  return (
    <>
      <h2>By account type <span className="h2note">at retirement, in today&apos;s dollars</span><span className="h2ctrl"><CsvButton table={table} label="By account type" /></span></h2>
      <div className="scroll" style={{ maxHeight: "none" }}>
        <table id={id} ref={table}>
          <thead><tr><th>Account</th><th>Balance</th><th>Share</th><th>First-year withdrawal</th><th>Tax</th><th>After tax</th></tr></thead>
          <tbody>
            {ROWS.map((r, i) => (
              <tr key={r.k}>
                <td><i className="acdot" style={{ background: r.c }}></i>{r.label}</td>
                <td>{money(B.real[r.k])}</td><td>{pctStr(B.shares[r.k], 0)}</td><td>{money(B.w[r.k])}</td>
                <td>{money(B.tax.buckets[i].tax)}</td><td>{money(B.w[r.k] - B.tax.buckets[i].tax)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr><td>Total</td><td>{money(B.totalReal)}</td><td></td><td>{money(B.wTotal)}</td>
              <td>{money(B.tax.total)} <span style={{ color: "var(--dimmer)", fontWeight: 400 }}>({pctStr(B.effRate, 1)})</span></td>
              <td>{money(B.wTotal - B.tax.total)}</td></tr>
          </tfoot>
        </table>
      </div>
      <div className="mcnote" id={id + "Note"} style={{ paddingTop: "12px" }}>
        {"Taxed with 2026 " + (a.status === "m" ? "married filing jointly" : "single") + " brackets" +
          (st && !st.none ? " and " + st.n + " state tax" : st ? ", no state income tax" : "") +
          (B.seniors ? ", with the age 65+ deduction" : "") + "."}
        {B.w.brok > 0 ? <>{" "}<b>{pctStr(B.gainPct, 0)}</b> of the brokerage balance is growth by then, so only that share of each sale is taxed.</> : null}
        {B.matchTotal > 0 ? <>{" "}Your employer puts in <b>{money(B.matchTotal)}</b> over the {fmtNum(years)} years, before growth.</> : null}
        {" "}Social Security and other income aren&apos;t included here and would raise the tax; the{" "}
        <a href="#" className="txlink" data-txfrom={id} onClick={toTax}>Income Tax tool</a> can add them.
      </div>
    </>
  );
}
