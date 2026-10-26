/* Local income taxes, by state: the states where a person can owe one (a
   city's, county's or school district's), what it's usually charged on, a
   line about how it works there, and where to look a rate up. Income Tax
   asks for a local rate only in these states, and the Paycheck and the
   Dashboard count one only there. California's and New Jersey's local
   payroll taxes (San Francisco, Newark) are paid by employers, Arkansas
   allows local income taxes but no city levies one, and Kansas's are small
   taxes on investment income in a few places, so those four aren't here.
   Rates aren't kept here (they're the person's own), so nothing in this file
   goes stale year to year beyond which states have one. */

export interface LocalTaxInfo {
  /** What it's usually charged on: wages, or the state's taxable income. */
  base: "wages" | "state";
  /** How it works in this state, in a sentence or two. */
  note: string;
  /** Official places to look a rate up. */
  links: [label: string, url: string][];
}

export const LOCAL_TAX: Record<string, LocalTaxInfo> = {
  AL: { base: "wages", links: [], note: "Some Alabama cities and counties, Birmingham among them, tax wages earned there (an occupational tax). Your city's revenue office has the rate." },
  CO: { base: "wages", links: [], note: "Denver and a few nearby cities charge a small flat amount each month on wages earned there, not a percentage. You can leave this at 0." },
  DE: { base: "wages", links: [], note: "Wilmington taxes the wages of people who live or work in the city. Elsewhere in Delaware there's none." },
  IN: { base: "state", links: [["Indiana Department of Revenue", "https://www.in.gov/dor/"]], note: "Every Indiana county has an income tax, on your Indiana taxable income. The rate is your county's as of January 1." },
  IA: { base: "state", links: [["Iowa Department of Revenue", "https://tax.iowa.gov"]], note: "Many Iowa school districts add a surtax: a percentage of your Iowa income tax, not of your income. For an estimate here, multiply the surtax by your Iowa tax rate." },
  KY: { base: "wages", links: [], note: "Many Kentucky cities and counties, Louisville and Lexington among them, tax wages earned there (an occupational license tax). Your city's or county's revenue office has the rate." },
  MD: { base: "state", links: [["Maryland Comptroller", "https://www.marylandcomptroller.gov"]], note: "Every Maryland county and Baltimore City has an income tax on your Maryland taxable income, roughly 2.25% to 3.3%." },
  MI: { base: "wages", links: [["Michigan Department of Treasury", "https://www.michigan.gov/taxes"]], note: "About two dozen Michigan cities tax income, Detroit the largest. People who live in the city pay a higher rate than people who only work there." },
  MO: { base: "wages", links: [], note: "Kansas City and St. Louis tax the earnings of people who live or work there. Elsewhere in Missouri there's none." },
  NY: { base: "state", links: [["New York State Department of Taxation and Finance", "https://www.tax.ny.gov"]], note: "New York City taxes its residents on their state taxable income, at about 3% to 3.9%. Yonkers charges a share of your state tax instead. Elsewhere in the state there's none." },
  OH: { base: "wages", links: [["Ohio's The Finder, by address", "https://thefinder.tax.ohio.gov"]], note: "Most Ohio cities and villages tax wages earned there, and many school districts tax income too." },
  OR: { base: "state", links: [["Oregon Department of Revenue", "https://www.oregon.gov/dor"]], note: "In the Portland area, Metro and Multnomah County tax incomes above set thresholds. Elsewhere in Oregon there's none (the small statewide transit tax isn't counted here)." },
  PA: { base: "wages", links: [["Pennsylvania's local rates (DCED)", "https://dced.pa.gov/local-government/local-income-tax-information/psd-codes-and-eit-rates/"]], note: "Almost every Pennsylvania municipality and school district taxes earned income, usually about 1% to 2%; Philadelphia's is higher." },
  WV: { base: "wages", links: [], note: "A few West Virginia cities charge a small flat weekly fee on people who work there, not a percentage. You can leave this at 0." },
};

/** Whether a local income tax can apply in this state. */
export const hasLocalTax = (state: string) => state in LOCAL_TAX;

/** The local tax the engine counts: the rate (0-1) and what it's on, only
    in a state that has one; the base the person picked, or the state's usual. */
export function localFor(state: string, rate: string | undefined, base: string | undefined): { localRate: number; localBase: "wages" | "state" } {
  const info = LOCAL_TAX[state];
  const r = info ? Math.max(0, parseFloat(String(rate ?? "0").replace(/,/g, "")) || 0) / 100 : 0;
  return { localRate: r, localBase: base === "wages" || base === "state" ? base : info?.base ?? "wages" };
}
