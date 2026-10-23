"use client";

/* The fine print at the foot of the About pages (the site's and the
   Dashboard's): who makes this, how to get in touch, and the disclaimer.
   One copy, so the two pages always say the same thing. Styled by
   #tab-about .about-fine (styles/08-about-budget.css). */

import { MailMe } from "./MailMe";

export function FinePrint() {
  return (
    <section className="about-group about-fine" id="about-fineprint" aria-labelledby="about-fineprint-h">
      <h2 className="toolgroup-h" id="about-fineprint-h">Fine print</h2>
      <div className="about" id="about-who">
        <h3>Who makes this</h3>
        <p>RetCalc is an independent project. It&apos;s free to use and has no ads.
        Every figure comes from a published source or from the historical record
        described above, each tool says what it assumes, and the numbers quoted in
        the articles are checked against the calculators before anything is published.</p>
      </div>
      <div className="about" id="about-contact">
        <h3>Contact</h3>
        <p>Found a bug, a number that looks off, or have an idea for a tool? Email{" "}
        <MailMe user="contact" domain="retcalc.app" />.
        Every message is read, and reports of anything that looks wrong are the most
        useful of all.</p>
        <p>One thing it can&apos;t do: give personal financial or tax advice. For decisions
        about your own money, a fee-only financial planner or a tax professional can
        look at your whole situation.</p>
      </div>
      <div className="about" id="disclaimer">
        <h3>Disclaimer</h3>
        <p><b>Tax figures are estimates.</b> The income tax tool uses published 2026
        rates but omits credits, local taxes and many special cases, and tax law
        changes. It is not tax advice and should not be used to file or to decide
        withholding. For anything that matters, talk to a tax professional.</p>
        <p><b>This is an educational tool, not financial advice.</b> It doesn&apos;t know
        your circumstances, goals, debts, taxes or risk tolerance, and nothing it
        produces is a recommendation to buy, sell or hold anything.</p>
        <p><b>Past performance does not predict future returns.</b> Historical averages
        are context, not forecasts. Markets can and do deliver long stretches well
        below their historical average, and the figures suggested above may not hold
        in future. The Drawdown Simulator&apos;s historical backtest uses 100 years of US
        market data, which is a real record, not a hypothesis, but it is one
        record of one country, and surviving every year in it is evidence a plan is
        reasonable, not proof it&apos;s safe.</p>
        <p>Projections are arithmetic applied to assumptions you chose. They are not
        predictions, and the true range of outcomes is wider than any model shows.
        For decisions that matter, talk to a qualified financial professional or tax
        adviser who can look at your whole situation.</p>
      </div>
    </section>
  );
}
