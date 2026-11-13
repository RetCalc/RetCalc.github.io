"use client";

/* "Download spreadsheet": the whole plan as a workbook, built on this device
   (nothing is sent anywhere), for Excel or for Google Sheets. The Sheets
   version swaps what Google's import drops (data bars, the Aptos font,
   links between sheets) for what it keeps; after it downloads, a short note
   says how to open it there. The spreadsheet library loads only when asked. */

import { useState } from "react";
import { ChevronDownIcon, SheetIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { readDashboard } from "../store";

type Flavor = "excel" | "sheets";

async function build(flavor: Flavor): Promise<string | null> {
  const [{ default: ExcelJS }, { workbookData }, { buildWorkbook }] = await Promise.all([import("exceljs"), import("./data"), import("./build")]);
  const D = workbookData(readDashboard());
  if ("missing" in D) return D.missing;
  const logo = await fetch("/icon-192.png").then((r) => (r.ok ? r.arrayBuffer() : null)).catch(() => null);
  const wb = new ExcelJS.Workbook();
  buildWorkbook(wb, D, { flavor, logo });
  const buf = await wb.xlsx.writeBuffer();
  const url = URL.createObjectURL(new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = `retcalc-plan-${new Date().toISOString().slice(0, 10)}${flavor === "sheets" ? "-google-sheets" : ""}.xlsx`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
  return null;
}

export function WorkbookButton() {
  const [busy, setBusy] = useState(false);
  const [howTo, setHowTo] = useState(false);
  const make = async (flavor: Flavor) => {
    if (busy) return;
    setBusy(true);
    try {
      const missing = await build(flavor);
      if (missing) window.alert(missing);
      else if (flavor === "sheets") setHowTo(true);
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger render={<Button variant="outline" disabled={busy} title="Your whole plan as a spreadsheet, with formulas and a What If sheet" />}>
          <SheetIcon aria-hidden="true" />{busy ? "Building…" : "Download spreadsheet"}<ChevronDownIcon aria-hidden="true" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => void make("excel")}><SheetIcon />For Excel</DropdownMenuItem>
          <DropdownMenuItem onClick={() => void make("sheets")}><SheetIcon />For Google Sheets</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      {howTo ? (
        <Dialog open onOpenChange={(o) => { if (!o) setHowTo(false); }}>
          <DialogContent aria-labelledby="dshSheetsTitle">
            <h2 id="dshSheetsTitle" className="dsh-dlg-h">Open it in Google Sheets</h2>
            <ol className="dsh-howto">
              <li>Go to <a href="https://drive.google.com" target="_blank" rel="noreferrer">drive.google.com</a> and choose <b>New</b>, then <b>File upload</b>.</li>
              <li>Pick the file that just downloaded, <b>retcalc-plan-…-google-sheets.xlsx</b>.</li>
              <li>Open it, then choose <b>Open with Google Sheets</b> at the top.</li>
            </ol>
            <p className="dsh-cap">It stays in your own Google Drive; RetCalc never sees it.</p>
            <div className="dsh-navbtns"><Button onClick={() => setHowTo(false)}>Got it</Button></div>
          </DialogContent>
        </Dialog>
      ) : null}
    </>
  );
}
