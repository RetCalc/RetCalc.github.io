"use client";

/* "Download spreadsheet": the whole plan as an Excel workbook, built on this
   device (nothing is sent anywhere). The spreadsheet library loads only
   when it's asked for. */

import { useState } from "react";
import { SheetIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { readDashboard } from "../store";

export function WorkbookButton() {
  const [busy, setBusy] = useState(false);
  const make = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const [{ default: ExcelJS }, { workbookData }, { buildWorkbook }] = await Promise.all([import("exceljs"), import("./data"), import("./build")]);
      const D = workbookData(readDashboard());
      if ("missing" in D) { window.alert(D.missing); return; }
      const wb = new ExcelJS.Workbook();
      buildWorkbook(wb, D);
      const buf = await wb.xlsx.writeBuffer();
      const url = URL.createObjectURL(new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
      const a = document.createElement("a");
      a.href = url;
      a.download = `retcalc-plan-${new Date().toISOString().slice(0, 10)}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Button variant="outline" onClick={make} disabled={busy} title="Your whole plan as an Excel workbook, with formulas and a What If sheet">
      <SheetIcon aria-hidden="true" />{busy ? "Building…" : "Download spreadsheet"}
    </Button>
  );
}
