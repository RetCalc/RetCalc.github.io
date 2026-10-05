/* How often a contribution is paid, as the retirement calculators name it.
   From PERIOD_NAMES, PERIOD_ADV and AC_PER in src/js/app/08-stages.js and
   02-accounts-advanced.js. */
export const PERIOD_NAMES = ["Weekly", "Bi-Weekly", "Monthly", "Quarterly", "Annually"] as const;

/** Mid-sentence: "$500 bi-weekly". */
export const PERIOD_ADV: Record<string, string> = {
  Weekly: "weekly", "Bi-Weekly": "bi-weekly", Monthly: "monthly", Quarterly: "quarterly", Annually: "annually",
};

/** After a dollar field: "$500/2wk". */
export const PERIOD_SHORT: Record<string, string> = {
  Weekly: "/wk", "Bi-Weekly": "/2wk", Monthly: "/mo", Quarterly: "/qtr", Annually: "/yr",
};

export function PeriodOptions() {
  return <>{PERIOD_NAMES.map((n) => <option key={n}>{n}</option>)}</>;
}
