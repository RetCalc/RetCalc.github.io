"use client";

/* The way to the Dashboard's printed report, in a page's title bar. */

import Link from "next/link";
import { PrinterIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ReportButton() {
  return <Button variant="outline" nativeButton={false} render={<Link href="/dashboard/report" />}><PrinterIcon aria-hidden="true" />Print your plan</Button>;
}
