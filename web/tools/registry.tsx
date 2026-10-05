/* Which screen each address shows. A page not listed here still shows the
   "being rebuilt" placeholder. Each tool's code only loads on its own page. */
import type { ComponentType } from "react";
import type { Slug } from "@/lib/site";
import { Mortgage } from "./mortgage/Mortgage";

export const TOOL_SCREENS: Partial<Record<Slug, ComponentType>> = {
  mortgage: Mortgage,
};
