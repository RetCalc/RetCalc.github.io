/* Figures as the Dashboard shows them. */

import { money } from "@/lib/format";

export { money };

/** $1.9M, $450K, $800: for chart axes and secondary figures. */
export function shortMoney(n: number): string {
  const a = Math.abs(n), sign = n < 0 ? "-" : "";
  if (a >= 1e6) return sign + "$" + (a / 1e6).toFixed(a >= 1e7 ? 0 : 1).replace(/\.0$/, ".0") + "M";
  if (a >= 1e3) return sign + "$" + Math.round(a / 1e3) + "K";
  return sign + "$" + Math.round(a);
}

/** To the nearest $10, for monthly figures that come from a projection. */
export const money10 = (n: number) => money(Math.round(n / 10) * 10);

export const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

/** "September 21, 2026" from YYYY-MM-DD. */
export function longDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return `${MONTHS[m - 1]} ${d}, ${y}`;
}
/** Whole days from YYYY-MM-DD to today. */
export function daysSince(iso: string): number {
  const [y, m, d] = iso.split("-").map(Number);
  const then = new Date(y, m - 1, d), now = new Date();
  return Math.round((new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime() - then.getTime()) / 864e5);
}

/** A chance of success as a whole percent, rounded down so 99.7% never
    reads as 100%: only a plan that lasted every time shows 100. */
export const pctDown = (v: number) => {
  const p = Math.round(v * 10000) / 100;
  // Between 99% and 100% a tenth is kept (99.7%, as the simulator shows it),
  // so a near miss never reads as a whole 99 or rounds up to 100.
  return p >= 99 && p < 100 ? Math.floor(p * 10) / 10 : Math.floor(p);
};

/** How often the plan lasted, in words: "every past market since 1926"
    only when it truly did; otherwise the count of retirements when the
    run gives it ("773 of 775 past retirements since 1926"), or the share
    rounded down. */
export function lastedWords(success: number, runs?: { ok: number; of: number } | null): string {
  if (success >= 1) return "every past market since 1926";
  if (runs && runs.of > 0) return `${runs.ok} of ${runs.of} past retirements since 1926`;
  return `${pctDown(success)}% of past markets since 1926`;
}
