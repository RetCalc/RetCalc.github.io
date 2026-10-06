"use client";

/* The "By account type" panel of Advanced and Stages: each account at
   retirement, its share of the first year's withdrawal and the tax on it,
   with a link that loads those withdrawals into Income Tax. From
   acRenderTable() in src/js/app/03-projection.js and the .txlink handler in
   18-debt.js. */

import { useRef } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/shell/Toast";
import { CsvButton } from "@/components/common/CsvButton";
import type { AccountResult } from "@/lib/accounts";
import { STATES } from "@/lib/engine/typed";
import { fmtNum, money, pctStr } from "@/lib/format";
import { sendYearToTax } from "@/tools/tax/handoff";
import { SERIES } from "@/lib/hues";
import { CardAction, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const ROWS = [
  { k: "trad", label: "Traditional 401(k) / IRA", c: SERIES.rose },
  { k: "roth", label: "Roth 401(k) / IRA", c: SERIES.teal },
  { k: "brok", label: "Taxable brokerage", c: SERIES.sky },
] as const;

export function AccountTable({ id, B, years }: { id: "acResults" | "saResults"; B: AccountResult; years: number }) {
  const router = useRouter();
  const toast = useToast();
  const table = useRef<HTMLTableElement>(null);
  const a = B.a;
  const st = (STATES as Record<string, { n: string; none?: number }>)[a.state];
  const toTax = (e: React.MouseEvent) => {
    e.preventDefault();
    sendYearToTax({ status: a.status, state: a.state, trad: B.w.trad, roth: B.w.roth, brok: B.w.brok, gainShare: B.gainPct, seniors: B.seniors });
    router.push("/incometax");
    toast("Loaded your first-year withdrawals into Income Tax");
  };
  return (
    <>
      <CardHeader><CardTitle>By account type</CardTitle><CardDescription>at retirement, in today&apos;s dollars</CardDescription>
        <CardAction><CsvButton table={table} label="By account type" /></CardAction></CardHeader>
      <div className="scroll max-h-none">
        <table id={id} ref={table}>
          <thead><tr><th>Account</th><th>Balance</th><th>Share</th><th>First-year withdrawal</th><th>Tax</th><th>After tax</th></tr></thead>
          <tbody>
            {ROWS.map((r, i) => (
              <tr key={r.k}>
                <td><i className="acdot bg-(--swatch)" style={{ "--swatch": r.c } as React.CSSProperties}></i>{r.label}</td>
                <td>{money(B.real[r.k])}</td><td>{pctStr(B.shares[r.k], 0)}</td><td>{money(B.w[r.k])}</td>
                <td>{money(B.tax.buckets[i].tax)}</td><td>{money(B.w[r.k] - B.tax.buckets[i].tax)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr><td>Total</td><td>{money(B.totalReal)}</td><td></td><td>{money(B.wTotal)}</td>
              <td>{money(B.tax.total)} <span className="text-dimmer font-normal">({pctStr(B.effRate, 1)})</span></td>
              <td>{money(B.wTotal - B.tax.total)}</td></tr>
          </tfoot>
        </table>
      </div>
      <div className="mcnote mt-3" id={id + "Note"}>
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
