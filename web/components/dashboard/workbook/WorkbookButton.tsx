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

/** The RetCalc mark and name drawn as one picture for the top of each sheet,
    at three times its size so it stays sharp. The name is in the
    Dashboard's own type. */
async function drawMark(): Promise<{ png: ArrayBuffer; w: number; h: number } | null> {
  const icon = await new Promise<HTMLImageElement | null>((done) => {
    const i = new Image();
    i.onload = () => done(i);
    i.onerror = () => done(null);
    i.src = "/icon-192.png";
  });
  if (!icon) return null;
  const S = 3, H = 40, gap = 11;
  const font = `700 ${25 * S}px -apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", Inter, Helvetica, Arial, sans-serif`;
  const c = document.createElement("canvas"), x = c.getContext("2d");
  if (!x) return null;
  x.font = font;
  const W = H + gap + Math.ceil(x.measureText("RetCalc").width / S) + 4;
  c.width = W * S; c.height = H * S;
  x.font = font;
  x.fillStyle = "#1d1d1f";
  x.textBaseline = "middle";
  x.drawImage(icon, 0, 0, H * S, H * S);
  x.fillText("RetCalc", (H + gap) * S, (H / 2 + 1.5) * S);
  const blob = await new Promise<Blob | null>((done) => c.toBlob(done, "image/png"));
  return blob ? { png: await blob.arrayBuffer(), w: W, h: H } : null;
}

async function build(flavor: Flavor): Promise<string | null> {
  const [{ default: ExcelJS }, { workbookData }, { buildWorkbook }] = await Promise.all([import("exceljs"), import("./data"), import("./build")]);
  const D = workbookData(readDashboard());
  if ("missing" in D) return D.missing;
  const mark = await drawMark().catch(() => null);
  const wb = new ExcelJS.Workbook();
  buildWorkbook(wb, D, { flavor, mark });
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
              <li>Go to <a href="https://drive.google.com" target="_blank" rel="noreferrer">drive.google.com</a>, choose <b>New</b>, then <b>File upload</b>, and pick <b>retcalc-plan-…-google-sheets.xlsx</b>.</li>
              <li>Open it and choose <b>Open with Google Sheets</b> at the top.</li>
              <li>Choose <b>File</b>, then <b>Save as Google Sheets</b>. That makes it a real Google Sheet, and the note about an Excel file goes away. You can delete the uploaded .xlsx after.</li>
            </ol>
            <p className="dsh-cap">To skip the last step next time, turn on <b>Convert uploads</b> in Google Drive&apos;s settings. The file stays in your own Google Drive; RetCalc never sees it.</p>
            <div className="dsh-navbtns"><Button onClick={() => setHowTo(false)}>Got it</Button></div>
          </DialogContent>
        </Dialog>
      ) : null}
    </>
  );
}
