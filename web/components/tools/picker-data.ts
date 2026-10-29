/* The tool list's chart figures, worked out when the site is built (server
   only): the homepage's own (components/home/data.ts), so a chart reads the
   same on both pages. */
import { homeData, type HomeData } from "@/components/home/data";

export interface PickerData {
  fan: HomeData["fan"];
  lasted: number;
  tax: HomeData["tax"];
  mortgage: HomeData["mortgage"];
  rentbuy: HomeData["rentbuy"];
  /** The example household's savings by age (the homepage's Calculator tile). */
  growth: HomeData["growth"];
}

export function pickerData(): PickerData {
  const h = homeData();
  return { fan: h.fan, lasted: h.lasted, tax: h.tax, rentbuy: h.rentbuy, mortgage: h.mortgage, growth: h.growth };
}
