import { project } from "@/lib/engine";

/* Phase 1 placeholder: proves the page renders with the site's styles and
   that the engine runs inside Next.js. Replaced by the real home page in
   phase 2. */
export default function Home() {
  const r = project({
    period: "Monthly", years: 30, initial: 10000, contrib: 500, growth: 0,
    nominal: 0.07, inflation: 0.025, withdrawal: 0.04, taxRate: 0.15,
  }) as { fv: number; fvReal: number };
  const usd = (n: number) => "$" + Math.round(n).toLocaleString("en-US");
  return (
    <main style={{ maxWidth: 640, margin: "0 auto", padding: "48px 16px" }}>
      <h1>RetCalc</h1>
      <p>The Next.js version of RetCalc is being built. The live site is at retcalc.app.</p>
      <p>
        Engine check: $10,000 plus $500 a month for 30 years at 7% grows to{" "}
        <strong>{usd(r.fv)}</strong> ({usd(r.fvReal)} in today&apos;s dollars).
      </p>
    </main>
  );
}
