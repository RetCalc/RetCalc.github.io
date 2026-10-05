/* The Income Tax tool's state rules table: everything the tax modes did at
   the state level, said in English, generated from the same STATES and
   RET_STATE data the calculation runs on. Moved unchanged from
   src/js/app/11-income-tax.js; only the two exports at the end replace the
   function that wrote the table into the page. */
import { STATES, RET_STATE, SS_TAX_STATES } from "@/lib/engine/core";
import { money } from "@/lib/format";

/* ---------- the state rules table ----------
   Everything the two tax modes just did at the state level, said in English.
   The rows are generated from the same STATES and RET_STATE data the
   calculation runs on, so the table cannot drift away from the numbers above
   it. The same six rows show in both modes: someone still working wants to
   know what retirement will cost in the state they are in, and someone
   retired wants to know how ordinary income is treated. */

/* A rate, with trailing zeros trimmed: 4.95%, 5%, 2.5%. */
function rp(r){ return (r * 100).toFixed(2).replace(/\.?0+$/, "") + "%"; }

/* "$3,000 single / $6,000 joint", or "$3,000" when the two are the same. */
function sj(pair){
  return pair[0] === pair[1] ? money(pair[0])
    : money(pair[0]) + " single / " + money(pair[1]) + " joint";
}

/* Row 1: how the state taxes a dollar of ordinary income. */
function ruleOrdinary(code, S, st){
  if (S.none) return "No individual income tax. Wages, pensions, retirement-account " +
    "withdrawals, Social Security and investment income are all untaxed.";
  const b = S.b[st];
  const rates = b.map(x => x[1]);
  const top = rates[rates.length - 1];
  const paid = b.filter(x => x[1] > 0);
  let out;
  if (paid.length === 1){
    out = "Flat " + rp(top) + " on all taxable income";
    out += b[0][1] === 0
      ? ", with a zero-rate band up to " + money(paid[0][0]) + ". " : ". ";
  } else {
    out = b.length + " brackets, " + rp(paid[0][1]) + " to " + rp(top) + ". ";
    if (b[0][1] === 0) out += "The first " + money(paid[0][0]) +
      " of taxable income is taxed at zero. ";
    out += "The top rate starts at " + money(S.b.s[S.b.s.length - 1][0]) +
      " single / " + money(S.b.m[S.b.m.length - 1][0]) + " joint. ";
  }
  const d = [];
  if (S.sd) d.push("standard deduction " + sj(S.sd));
  if (S.pe) d.push("personal exemption " + sj(S.pe));
  if (S.pec) d.push("exemption credit " + sj(S.pec) + " rather than a deduction");
  if (S.sdc) d.push("deduction delivered as a " + sj(S.sdc) + " credit");
  out += d.length ? "Against that: " + d.join(", ") + "."
                  : "No standard deduction or personal exemption.";
  if (S.agiCap) out += " The exemption is lost outright: a cliff, not a " +
    "phase-out, above " + sj(S.agiCap) + " of AGI.";
  return out;
}

/* Row 2: long-term capital gain and other investment income. */
function ruleGain(code, S, R){
  if (S.none) return code === "WA"
    ? "No tax on ordinary capital gain at the individual level, but Washington " +
      "levies a separate 7% excise tax on long-term gains above roughly $270,000 " +
      "a year, with real estate and retirement accounts exempt. That tax is not " +
      "calculated here."
    : "Not taxed.";
  let out = "";
  if (R.cgPct) out = rp(R.cgPct) + " of net long-term gain is excluded from the " +
    "state base; the remainder is taxed at the ordinary rates above. ";
  else if (R.cgFlat) out = sj(R.cgFlat) + " of long-term gain is excluded; the " +
    "remainder is taxed at the ordinary rates above. ";
  else if (R.cgMax) out = "Long-term gain is capped at " + rp(R.cgMax) +
    ", computed as an alternative that can never cost more than ordinary rates. ";
  else if (R.cgB) out = "Long-term gain gets its own reduced schedule: " +
    R.cgB.s.map(x => rp(x[1])).join(" then ") + ", instead of the ordinary rates. ";
  else out = "Taxed at the same ordinary rates as everything else. No preferential " +
    "long-term rate, and no equivalent of the federal 0% band. ";
  out += "Only the gain portion of a brokerage sale is taxed; your basis comes back " +
    "untouched, as federally.";
  return out;
}

/* Row 3: Social Security. */
function ruleSS(code, S, R){
  if (S.none) return "Not taxed.";
  if (!SS_TAX_STATES[code])
    return "Fully exempt. Benefits are subtracted from the state base no matter " +
      "how large they are or what else you earn.";
  let out = "Taxed, on the amount that is taxable federally under \u00a786. ";
  if (R.ssFullAge) out += "Fully exempt once you are 65 or older, which is what " +
    "this assumes when you mark someone 65+.";
  else if (R.ssCredit) out += "A credit then refunds the tax on those benefits, " +
    "withdrawn at " + rp(R.ssCredit.phase) + " of income above " + sj(R.ssCredit.cap) +
    ", so the relief disappears well before the top of the income range.";
  else if (R.ssCap && R.ssPct) out += "Fully exempt below " + sj(R.ssCap) +
    " of AGI; above that, " + rp(R.ssPct) + " of the federally taxable benefit stays " +
    "in the base.";
  else if (R.ssCap && R.ssRange) out += "Fully exempt below " + sj(R.ssCap) +
    " of AGI, phasing back in over the next " + money(R.ssRange) + ".";
  else if (R.ssCap) out += "Fully exempt below " + sj(R.ssCap) + " of AGI and fully " +
    "taxable above it, a cliff, not a phase-out.";
  else out += "No income test and no exemption: the federal taxable amount goes " +
    "straight into the state base.";
  return out;
}

/* Rows 4 and 5: pension income, then traditional 401(k) and IRA withdrawals.
   They are separate rows because roughly a dozen states treat them
   differently, which is the whole reason the tool asks for them separately. */
function rulePension(code, S, R){
  if (S.none) return "Not taxed.";
  const bits = [];
  if (R.penFull) bits.push("Fully exempt, public or private.");
  else if (R.pubFull) bits.push("Government pensions, federal, state and local, " +
    "are fully exempt. Private-employer pensions are taxed at ordinary rates.");
  else bits.push("Taxed at ordinary rates.");
  const ex = exclusionSentence(R, "p");
  if (ex) bits.push(ex);
  return bits.join(" ");
}
function ruleTrad(code, S, R){
  if (S.none) return "Not taxed.";
  const bits = [];
  if (R.tradFull) bits.push("Fully exempt. Qualified plan and IRA distributions " +
    "are outside the state base entirely.");
  else bits.push("Taxed at ordinary rates, the same as a pension would be.");
  if (code === "HI") bits.push("Hawaii's exemption covers only the employer-funded " +
    "share of a plan, so the part of a 401(k) that came from your own deferrals " +
    "stays taxable. This treats the whole balance as your own deferrals, which is " +
    "the conservative reading.");
  if (code === "MD") bits.push("Maryland's pension exclusion specifically does " +
    "not reach IRA distributions.");
  const ex = exclusionSentence(R, "t");
  if (ex) bits.push((R.exSrc === "t" ? "" :
    "It shares one allowance with pension income rather than getting its own. ") + ex);
  return bits.join(" ");
}

/* The shared description of a state's retirement-income exclusion, written
   once and shown on whichever of the two rows it actually applies to. */
function exclusionSentence(R, which){
  if (!R.exAmt) return "";
  const src = R.exSrc || "tp";
  const hits = src === "all" || src === "tp" ? true
             : src === "pub" || src === "p" ? which === "p"
             : which === "t";
  if (!hits) return "";
  const big = R.exAmt[0] >= 1e11;
  let out = big ? "Exempt in full" : "Up to " + sj(R.exAmt) + " is excluded";
  if (R.exPer) out += " per person";
  if (src === "all") out += ", and the same allowance covers interest, dividends, " +
    "rent and capital gain";
  if (src === "pub") out += ", and only for government pensions";
  out += R.exAge ? ", from age 65 as modeled here" : ", at any age";
  out += ".";
  if (R.exLessSS === "gross") out += " The allowance is reduced dollar for dollar " +
    "by the Social Security you receive, so a large benefit can consume it outright.";
  else if (R.exLessSS === "taxable") out += " Taxable Social Security comes out of " +
    "that ceiling first, which exempts benefits in full and leaves whatever is " +
    "left over for the rest.";
  if (R.exCap){
    if (R.exPhase === "nj") out += " Full below " + money(R.exCap[0]) +
      " of income, half to " + money(R.exCap[0] + 25000) + ", a quarter to " +
      money(R.exCap[0] + 50000) + ", nothing above.";
    else if (R.exPhase === "lin") out += " Withdrawn dollar for dollar as AGI " +
      "rises above " + sj(R.exCap) + ", so it is gone by " +
      money(R.exCap[0] + R.exRange) + " single / " +
      money(R.exCap[1] + R.exRange) + " joint.";
    else out += " Lost entirely above " + sj(R.exCap) + " of AGI.";
  }
  return out;
}

/* Row 6: what arrives at 65. */
function ruleSenior(code, S, R){
  if (S.none) return "No income tax, so nothing to give.";
  const bits = [];
  if (R.sdAge) bits.push("Extra deduction of " + sj(R.sdAge) + " per person, " +
    "against income of any kind.");
  if (R.agePh) bits.push("Deduction of " + money(R.agePh.amt) + " per person, " +
    "withdrawn dollar for dollar above " + sj(R.agePh.cap) + " of income, so it is " +
    "gone by " + money(R.agePh.cap[0] + R.agePh.amt) + " single / " +
    money(R.agePh.cap[1] + R.agePh.amt) + " joint.");
  if (R.peAge || S.peAge) bits.push("Extra personal exemption of " +
    money(R.peAge || S.peAge) + " per person.");
  if (R.credAge) bits.push("Credit of " + sj(R.credAge) + " per person" +
    (R.ohRet ? ", plus a retirement income credit of up to $200, both lost above " +
      sj(R.exCap) + " of state income." : "."));
  else if (R.ohRet) bits.push("Retirement income credit of up to $200.");
  if (R.exAge && R.exAmt) bits.push("Reaching 65 is also what unlocks the " +
    "retirement exclusion in the rows above, which is the main thing age buys " +
    "here, rather than a separate senior deduction.");
  if (R.ssFullAge) bits.push("Social Security becomes fully exempt at 65.");
  return bits.length ? bits.join(" ")
    : "Nothing beyond the federal age-65 deductions. The state gives no extra " +
      "deduction, exemption or credit at 65.";
}

/* What is knowingly missing. Two or three real items per state, not a
   disclaimer wall: the point is that you know where to go look. */
const STATE_GAPS = {
  AL:"Municipal occupational taxes of roughly 1% to 2% in Birmingham and other cities. Alabama's standard deduction phases down with income.",
  AZ:"Arizona's small-business alternative return, and the full exemption for military retirement pay.",
  AR:"Arkansas's low-income tax tables, which override the brackets at the bottom of the range.",
  CA:"State disability insurance, 1.2% of all wages with no cap, which functions like a payroll tax on the working side. California's own itemized deduction rules differ from the federal ones.",
  CO:"The $20,000 version of the pension subtraction available from 55 to 64, and TABOR-driven rate reductions that temporarily cut the flat rate in some years.",
  CT:"Connecticut's benefit recapture, which claws back the value of the lower brackets at higher incomes and can add several hundred dollars. Also the personal exemption's own phase-out.",
  DE:"Wilmington's 1.25% city wage tax on earned income.",
  GA:"The $5,000 sublimit on earned income inside the retirement exclusion, and the $35,000 version available from 62 to 64.",
  HI:"Working out how much of a 401(k) was employer-funded, since that share is exempt too. This assumes none of it was, so the real Hawaii bill may be lower.",
  ID:"Idaho's retirement benefits deduction for federal Civil Service, military and public-safety retirees, which is generous where it applies.",
  IL:"Nothing large. Illinois has no local income taxes and its retirement treatment is unusually simple.",
  IN:"County income taxes, which run roughly 1% to 3% on top of the state rate and apply to retirement income too. Indiana's military retirement exemption.",
  IA:"Iowa's retired-farmer and employee-stock-ownership elections, and its inheritance tax.",
  KS:"Kansas's food sales tax credit and homestead property tax refund, both of which matter at lower retirement incomes.",
  KY:"Local occupational license taxes of roughly 1% to 2.5% on earned income in Louisville, Lexington and elsewhere. The full exemption for service credited before 1998.",
  LA:"Parish-level differences and Louisiana's own itemized deduction rules, which depart from the federal ones.",
  ME:"Maine's alternative minimum tax and the phase-out of its personal exemption at higher incomes.",
  MD:"County and Baltimore City income taxes, which run 2.25% to 3.20% on top of the state rate and apply to retirement income. Maryland's senior tax credit of $1,000 to $1,750 below $100,000 / $150,000 of income.",
  MA:"Working out the previously-taxed contribution basis in an IRA, which Massachusetts lets you recover tax-free. The 4% surtax above roughly $1.08 million is in the brackets above.",
  MI:"City income taxes in Detroit, Grand Rapids and about two dozen others, roughly 1% to 2.4%, which reach retirement income.",
  MN:"Minnesota's alternative minimum tax and its separate public-pension subtraction for certain retirees.",
  MS:"The rule that early distributions taken before the plan's retirement age lose the exemption and are taxed in full.",
  MO:"Earnings taxes of 1% in Kansas City and St. Louis. The $6,000 private pension exemption below $25,000 / $32,000 of income.",
  MT:"Montana's capital gain credit interaction with its reduced gain rates, and its elderly homeowner credit.",
  NE:"Nebraska's full exemption for military retirement benefits.",
  NJ:"New Jersey taxes 401(k) contributions going in, so part of every withdrawal is a tax-free return of basis that this does not track; the real New Jersey bill is usually lower than shown. Also the property tax deduction and senior freeze.",
  NM:"The cap on New Mexico's capital gain deduction, which limits the 40% figure at higher gain amounts.",
  NY:"New York City resident tax of roughly 3.1% to 3.9%, and Yonkers's surcharge, both of which reach pension and retirement-account income. New York's supplemental tax recapture at high incomes.",
  NC:"The Bailey exemption for government retirees vested before August 1989, which exempts their pensions entirely.",
  ND:"Nothing large. North Dakota's rates are low enough that the gain exclusion does most of the work.",
  OH:"Municipal income taxes of roughly 1% to 3% and school district income taxes, though most Ohio municipalities exempt retirement income. Ohio's joint filing credit and lump-sum retirement credit.",
  OK:"Oklahoma's full exemption for military retirement and its separate federal Civil Service allowance.",
  OR:"Multnomah County and Portland-area local income taxes, which stack to several percent on higher incomes. Oregon's retirement income credit at low household incomes, and its federal tax subtraction.",
  PA:"Local earned income taxes of roughly 1% to 3.9%, though these fall on wages rather than retirement income. Distributions taken before retirement age lose the exemption.",
  RI:"The requirement that you have actually reached full retirement age, not merely 65, for either the Social Security or pension relief.",
  SC:"South Carolina's separate treatment of military retirement, and its two-wage-earner credit.",
  UT:"Utah's credit phase-out runs on a modified AGI that adds back some untaxed income, so the real credit can be smaller than shown. The $450 retirement credit for taxpayers born before 1953.",
  VT:"Vermont's alternative minimum tax, and the $10,000 exclusion for Civil Service and military retirement.",
  VA:"The rule that the age deduction is unlimited for taxpayers born before 1939, and Virginia's separate military benefits subtraction.",
  WV:"West Virginia's separate full exemptions for state police, teachers' and federal Civil Service retirement, and its senior citizen property tax credit.",
  WI:"The requirement that you are 67, not 65, for the $24,000 exclusion, marking someone 65+ here grants it two years early. Wisconsin's married-couple credit and school property tax credit.",
  DC:"The District's $3,000 exclusion for government pensions at 62, and its own itemized deduction limits.",
  AK:"Nothing. Alaska has no individual income tax and no local income taxes.",
  FL:"Nothing at the income tax level. Florida's tangible and documentary taxes are unrelated.",
  NV:"Nothing. Nevada has no individual income tax.",
  NH:"New Hampshire's interest and dividends tax was fully repealed effective 2025, so there is nothing left to model.",
  SD:"Nothing. South Dakota has no individual income tax.",
  TN:"Nothing. Tennessee's Hall tax on interest and dividends was repealed in 2021.",
  TX:"Nothing. Texas has no individual income tax.",
  WA:"The 7% excise tax on long-term capital gains above roughly $270,000 a year, which is not calculated here. Real estate and retirement accounts are exempt from it.",
  WY:"Nothing. Wyoming has no individual income tax."
};

/* Things true of every state, worth saying once rather than fifty-one times. */
const GAPS_UNIVERSAL = "Everywhere: state credits that phase out on income " +
  "(property tax, renter, low-income and dependent credits), state alternative " +
  "minimum taxes, differences between state and federal itemized deductions, " +
  "part-year and non-resident apportionment, and estate or inheritance taxes.";

/** The six rows of the state rules table for a state and filing status. */
export function stateRuleRows(code, st){
  const S = STATES[code] || {none:1, n:"None"};
  const R = RET_STATE[code] || {};
  return [
    ["Ordinary income", ruleOrdinary(code, S, st)],
    ["Long-term capital gain", ruleGain(code, S, R)],
    ["Social Security", ruleSS(code, S, R)],
    ["Pension / annuity", rulePension(code, S, R)],
    ["Traditional 401(k) / IRA", ruleTrad(code, S, R)],
    ["Age 65 and over", ruleSenior(code, S, R)]
  ];
}
/** What's knowingly left out, for a state, then for every state. */
export function stateGaps(code){
  return (STATE_GAPS[code] || "") + " " + GAPS_UNIVERSAL;
}
