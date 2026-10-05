"use client";

import { useEffect } from "react";
import { initSelectMenus } from "@/lib/select-menus";

/** Turns on the site's own dropdown lists for every <select> on the page. */
export function SelectMenus() {
  useEffect(() => initSelectMenus(), []);
  return null;
}
