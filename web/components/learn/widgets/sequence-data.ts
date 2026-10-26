/* The sequence-of-returns lesson's thirty years of returns: one made-up
   retirement's real returns (after inflation), averaging 3.7% per year, five
   weak years first. The lesson's chart, widget and Your numbers all use it. */

export const SEQ_RETURNS: number[] = [-14, -11, -9, 3, 6, -4, 9, 7, 11, 5, 8, 10, 6, 12, 4, 9, 7, 11, 5, 13, 6, 8, 10, 9, 7, 12, 8, 11, 9, 10].map((x) => x - 2.2);
export const SEQ_AVG = SEQ_RETURNS.reduce((a, b) => a + b, 0) / SEQ_RETURNS.length;

/** The balance each year: the withdrawal comes out at the start of the
    year, then the year's return applies. Never below zero. */
export function runSeq(returns: number[], start = 1480000, withdraw: number | ((year: number) => number) = 62000): number[] {
  const out = [start];
  let b = start;
  returns.forEach((r, y) => { b = Math.max(0, (b - (typeof withdraw === "number" ? withdraw : withdraw(y))) * (1 + r / 100)); out.push(b); });
  return out;
}

/** The returns with the five weak years moved to start at year `shift` + 1. */
export const shifted = (shift: number) => shift ? SEQ_RETURNS.slice(5, 5 + shift).concat(SEQ_RETURNS.slice(0, 5), SEQ_RETURNS.slice(5 + shift)) : SEQ_RETURNS;
