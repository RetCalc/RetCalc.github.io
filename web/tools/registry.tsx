/* Which screen each address shows. A page not listed here still shows the
   "being rebuilt" placeholder. Each tool's code only loads on its own page. */
import type { ComponentType } from "react";
import type { Slug } from "@/lib/site";
import { Budget } from "./budget/Budget";
import { College } from "./college/College";
import { Debt } from "./debt/Debt";
import { Mortgage } from "./mortgage/Mortgage";
import { RentBuy } from "./rentbuy/RentBuy";
import { Tax } from "./tax/Tax";

export const TOOL_SCREENS: Partial<Record<Slug, ComponentType>> = {
  budget: Budget,
  college: College,
  debt: Debt,
  mortgage: Mortgage,
  rentbuy: RentBuy,
  incometax: Tax,
};
