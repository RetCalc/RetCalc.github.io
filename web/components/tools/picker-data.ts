/* The tool list's chart figures, worked out when the site is built (server
   only): the homepage's own (components/home/data.ts), so a chart reads the
   same on both pages, and Rent vs. Buy's blueprint case. */
import { homeData, type HomeData } from "@/components/home/data";
import { RENTBUY_DEFAULTS, rentBuyInput } from "@/tools/rentbuy/model";
import { rentBuyCalc } from "@/lib/engine/typed";

export interface PickerData {
  fan: HomeData["fan"];
  lasted: number;
  tax: HomeData["tax"];
  mortgage: HomeData["mortgage"];
  /** Buyer and renter net worth after 30 years, for Rent vs. Buy's blueprint. An
      illustrative case, rent $2,300 rising 4% a year with the rest the tool's
      defaults, where buying pulls ahead (in year 10): at the defaults renting
      stays ahead, and the card is there to show a comparison, not a verdict.
      The card shows no figures. */
  rentbuy: { buy: number; rent: number };
}

export function pickerData(): PickerData {
  const h = homeData();
  const rb = rentBuyCalc(rentBuyInput({ ...RENTBUY_DEFAULTS, rent: "2300", rentInc: "4" })).years;
  return {
    fan: h.fan, lasted: h.lasted, tax: h.tax, mortgage: h.mortgage,
    rentbuy: { buy: rb[rb.length - 1].buyerNW, rent: rb[rb.length - 1].renterNW },
  };
}
