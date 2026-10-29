/* The Income Tax tool's state rules table: everything the tax modes did at
   the state level, said in English, generated from the same state figures
   (the year's states.tax and states.retire) the calculation runs on. Moved
   unchanged from src/js/app/11-income-tax.js; only the two exports at the
   end replace the function that wrote the table into the page, and the
   year's figures are passed along. */
import { yearData } from "@/lib/engine/core";
import { money } from "@/lib/format";

/* ---------- the state rules table ----------
   Everything the two tax modes just did at the state level, said in English.
   The rows are generated from the same states.tax and states.retire data the
   calculation runs on, so the table cannot drift away from the numbers above
   it. The same seven rows show in both modes: someone still working wants to
   know what retirement will cost in the state they are in, and someone
   retired wants to know how ordinary income is treated. */

/* A rate, with trailing zeros trimmed: 4.95%, 5%, 2.5%. */
function rp(r){ return (r * 100).toFixed(2).replace(/\.?0+$/, "") + "%"; }

/* "$3,000 single / $6,000 joint", or "$3,000" when the two are the same. */
function sj(pair){
  return pair[0] === pair[1] ? money(pair[0])
    : money(pair[0]) + " single / " + money(pair[1]) + " joint";
}

/* An age as people say it: 59.5 is "59½". */
function ageWord(a){ return a === Math.floor(a) ? String(a) : Math.floor(a) + "\u00bd"; }

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
      "levies a separate excise tax on long-term gains above about $278,000 " +
      "per year (the 2025 figure, adjusted each year): 7%, and 9.9% above $1 million. " +
      "Real estate and retirement accounts are exempt. That tax is not calculated here."
    : "Not taxed.";
  let out = "";
  if (R.cgPct) out = rp(R.cgPct) + " of net long-term gain is excluded from the " +
    "state base. The remainder is taxed at the ordinary rates above. ";
  else if (R.cgFlat) out = sj(R.cgFlat) + " of long-term gain is excluded. The " +
    "remainder is taxed at the ordinary rates above. ";
  else if (R.cgMax) out = "Long-term gain is capped at " + rp(R.cgMax) +
    ", computed as an alternative that can never cost more than ordinary rates. ";
  else if (R.cgB) out = "Long-term gain gets its own reduced schedule: " +
    R.cgB.s.map(x => rp(x[1])).join(" then ") + ", instead of the ordinary rates. ";
  else out = "Taxed at the same ordinary rates as everything else. No preferential " +
    "long-term rate, and no equivalent of the federal 0% band. ";
  out += "Only the gain portion of a brokerage sale is taxed. Your basis comes back " +
    "untouched, as federally.";
  return out;
}

/* Row 3: Social Security. */
function ruleSS(code, S, R, taxed){
  if (S.none) return "Not taxed.";
  if (!taxed)
    return "Fully exempt. Benefits are subtracted from the state base no matter " +
      "how large they are or what else you earn.";
  let out = "Taxed, on the amount that is taxable federally under \u00a786. ";
  if (R.ssFullAge) out += "Fully exempt once you are " + ageWord(R.ssFullAge) +
    " or older" + (R.ssFullMid ? ", and from " + ageWord(R.ssFullMid.age) + " while AGI is " +
    sj(R.ssFullMid.cap) + " or less" : "") + ".";
  else if (R.ssCredit) out += "A credit then refunds the tax on those benefits, " +
    "withdrawn at " + rp(R.ssCredit.phase) + " of income above " + sj(R.ssCredit.cap) +
    ", so the relief disappears well before the top of the income range.";
  else if (R.ssAge && R.ssCap) out += "From age " + ageWord(R.ssAge) + ", fully exempt below " +
    sj(R.ssCap) + " of AGI and fully taxable above it. Before that age, fully taxable.";
  else if (R.ssCap && R.ssPct) out += "Fully exempt below " + sj(R.ssCap) +
    " of AGI; above that, " + rp(R.ssPct) + " of the federally taxable benefit stays " +
    "in the base.";
  else if (R.ssCap && R.ssRange) out += "Fully exempt below " + sj(R.ssCap) +
    " of AGI, phasing back in over the next " + money(R.ssRange) + ".";
  else if (R.ssCap && R.ssStep) out += "Fully exempt below " + sj(R.ssCap) +
    " of AGI. Above that, 10% more of the federally taxable benefit stays in the base " +
    "for each " + money(R.ssStep) + " of AGI (or part of it) over, all of it once AGI is " +
    money(R.ssStep * 10) + " over.";
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
  else bits.push("Taxed at ordinary rates.");
  if (code === "HI") bits.push("Hawaii's exemption covers only the employer-funded " +
    "share of a plan, so the part of a 401(k) that came from your own deferrals " +
    "stays taxable. This treats the whole balance as your own deferrals, which is " +
    "the conservative reading.");
  if (code === "MD") bits.push("Maryland's pension exclusion specifically does " +
    "not reach IRA distributions.");
  const ex = exclusionSentence(R, "t");
  if (ex) bits.push((R.exSrc === "t" ? "" :
    "It shares one allowance with pension income. ") + ex);
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
  if (R.exTiers) out = "Up to " + R.exTiers.map(t => money(t[1]) + " from " + ageWord(t[0])).join(", then ") +
    " is excluded";
  if (R.exPer) out += " per person";
  if (src === "all") out += ", and the same allowance covers interest, dividends, " +
    "rent and capital gain";
  if (src === "pub") out += ", and only for government pensions";
  out += R.exAge ? ", from age " + ageWord(R.exAge) : ", at any age";
  if (R.exAge && !R.exPer) out += " (one person at that age is enough)";
  out += ".";
  if (R.exLow) out += " Before that, " + money(R.exLow.amt) + " per person" +
    (R.exLow.src === "p" ? ", pension income only." : ".");
  if (R.exLessSS === "gross") out += " The allowance is reduced dollar for dollar " +
    "by the Social Security you receive, so a large benefit can consume it outright.";
  else if (R.exLessSS === "taxable") out += " Taxable Social Security comes out of " +
    "that ceiling first, which exempts benefits in full and leaves whatever is " +
    "left over for the rest.";
  if (R.exCap){
    if (R.exPhase === "nm") out += " Each person's amount falls by " + money(R.exStep) +
      " for every " + sj(R.exBand) + " of AGI over " + sj(R.exFull) + ", and is gone above " + sj(R.exCap) + ".";
    else if (R.exPhase === "nj") out += " Full below " + money(R.exCap[0]) +
      " of income, then a share of retirement income itself: 50% joint (37.5% single) to " +
      money(R.exCap[0] + 25000) + ", half that to " +
      money(R.exCap[0] + 50000) + ", nothing above.";
    else if (R.exPhase === "lin") out += " Phased out evenly as AGI " +
      "rises above " + sj(R.exCap) + ", so it is gone by " +
      money(R.exCap[0] + R.exRange) + " single / " +
      money(R.exCap[1] + R.exRange) + " joint.";
    else out += " Lost entirely above " + sj(R.exCap) + " of AGI.";
  }
  return out;
}

/* Row 6: what arrives with age, each at the age the state names. */
function ruleSenior(code, S, R){
  if (S.none) return "No income tax, so nothing to give.";
  const bits = [];
  const at = a => " at " + ageWord(a || 65);
  if (R.sdAge) bits.push("Extra deduction of " + sj(R.sdAge) + " per person" + at(R.sdAt) +
    (R.sdStdOnly ? ", if you take the standard deduction." : ", against income of any kind."));
  if (R.agePh) bits.push("Deduction of " + money(R.agePh.amt) + " per person" + at(R.agePhAt) + ", " +
    "withdrawn dollar for dollar above " + sj(R.agePh.cap) + " of income, so one person's is " +
    "gone by " + money(R.agePh.cap[0] + R.agePh.amt) + " single / " +
    money(R.agePh.cap[1] + R.agePh.amt) + " joint.");
  if (R.peAge || S.peAge) bits.push("Extra personal exemption of " +
    money(R.peAge || S.peAge) + " per person" + at(R.peAt || S.peAt) + ".");
  if (R.credAge) bits.push("Credit of " + sj(R.credAge) + (R.credOnce ? " per return" : " per person") +
    at(R.credAt) + (R.ohRet ? ", plus a retirement income credit of up to $200, both lost above " +
      sj(R.exCap) + " of state income." : "."));
  else if (R.ohRet) bits.push("Retirement income credit of up to $200.");
  if (R.exAge && R.exAmt && R.exAge !== 65) bits.push("The retirement exclusion in the rows above " +
    "starts at " + ageWord(R.exAge) + ", not 65.");
  else if (R.exAge && R.exAmt) bits.push("Reaching 65 also qualifies you for the " +
    "retirement exclusion in the rows above.");
  if (R.ssFullAge) bits.push("Social Security becomes fully exempt at " + ageWord(R.ssFullAge) + ".");
  if (R.ssAge) bits.push("Social Security relief starts at " + ageWord(R.ssAge) + ".");
  return bits.length ? bits.join(" ")
    : "Nothing beyond the federal age-65 deductions. The state gives no extra " +
      "deduction, exemption or credit for age.";
}

/* Row 7: pre-tax deductions going in, by kind, from the year's
   states.preTaxed: what comes off the state's tax the way it comes off the
   federal, and what stays in its base. */
const PRE_NAMES = {k401:"401(k), 403(b) and 457 deferrals", ira:"a deductible traditional IRA",
  hsa:"HSA contributions", health:"health, dental and vision premiums paid through work"};
function rulePreTax(code, S, keep){
  if (S.none) return "No income tax, so they save federal tax and, for HSA contributions and " +
    "premiums through work, FICA, but nothing at the state level.";
  const kinds = Object.keys(PRE_NAMES);
  const taxed = kinds.filter(k => keep[k]), off = kinds.filter(k => !keep[k]);
  // The names have commas of their own, so the list runs on semicolons.
  const list = ks => ks.map(k => PRE_NAMES[k]).join("; ");
  if (!taxed.length) return "Follows the federal treatment. All of these come off the state " +
    "base too: " + list(off) + ".";
  let out = "Come off the state base: " + list(off) + ". Stay taxed by " + (S.n || "the state") +
    " in the year you contribute: " + list(taxed) + ".";
  if (code === "NJ") out += " Of retirement-plan deferrals only 401(k)s come off. 403(b) and " +
    "457 deferrals stay taxed, and the figure above treats the line as a 401(k).";
  if (code === "PA") out += " In return, Pennsylvania doesn't tax plan or IRA withdrawals " +
    "after 59½: the money was taxed going in.";
  if (code === "MA") out += " What you put in comes back tax-free first when you withdraw.";
  return out;
}

/* What is knowingly missing. Two or three real items per state, not a
   disclaimer wall: the point is that you know where to go look. */
const STATE_GAPS = {
  AL:"Municipal occupational taxes of roughly 1% to 2% in Birmingham and other cities. Alabama's standard deduction phases down with income.",
  AZ:"Arizona's small-business alternative return, and the full exemption for military retirement pay.",
  AR:"Arkansas's low-income tax tables, which override the brackets at the bottom of the range.",
  CA:"State disability insurance, 1.3% of all wages with no cap, which works like a payroll tax on the working side. California's own itemized deduction rules differ from the federal ones.",
  CO:"TABOR-driven rate reductions that temporarily cut the flat rate in some years. The rule that IRA withdrawals before 59½ do not count for the pension subtraction.",
  CT:"Connecticut's benefit recapture, which claws back the value of the lower brackets at higher incomes and can add several hundred dollars. Also the personal exemption's own phase-out.",
  DE:"Wilmington's 1.25% city wage tax on earned income.",
  GA:"The $5,000 sublimit on earned income inside the retirement exclusion. The amount at 65 rises to $70,000 in 2027.",
  HI:"Working out how much of a 401(k) was employer-funded, since that share is exempt too. This assumes none of it was, so the real Hawaii bill may be lower.",
  ID:"Idaho's retirement benefits deduction for federal Civil Service, military and public-safety retirees, which is generous where it applies.",
  IL:"Nothing large. Illinois has no local income taxes and its retirement treatment is unusually simple.",
  IN:"County income taxes, which run roughly 1% to 3% on top of the state rate and apply to retirement income too. Indiana's military retirement exemption.",
  IA:"Iowa's retired-farmer and employee-stock-ownership elections, and its inheritance tax.",
  KS:"Kansas's food sales tax credit and homestead property tax refund, both of which matter at lower retirement incomes.",
  KY:"Local occupational license taxes of roughly 1% to 2.5% on earned income in Louisville, Lexington and elsewhere. The full exemption for service credited before 1998.",
  LA:"Parish-level differences and Louisiana's own itemized deduction rules, which depart from the federal ones.",
  ME:"Maine's alternative minimum tax and the phase-out of its personal exemption at higher incomes.",
  MD:"County and Baltimore City income taxes, which run 2.25% to 3.3% on top of the state rate and apply to retirement income. Maryland's senior tax credit of $1,000 to $1,750 below $100,000 / $150,000 of income.",
  MA:"Working out the previously-taxed contribution basis in an IRA, which Massachusetts lets you recover tax-free. The 4% surtax above roughly $1.08 million is in the brackets above.",
  MI:"City income taxes in Detroit, Grand Rapids and about two dozen others, roughly 1% to 2.4%, which reach retirement income.",
  MN:"Minnesota's alternative minimum tax and its separate public-pension subtraction for certain retirees.",
  MS:"The rule that early distributions taken before the plan's retirement age lose the exemption and are taxed in full. This treats every withdrawal as exempt.",
  MO:"Earnings taxes of 1% in Kansas City and St. Louis. The $6,000 private pension exemption below $25,000 / $32,000 of income.",
  MT:"Montana's capital gain credit interaction with its reduced gain rates, and its elderly homeowner credit.",
  NE:"Nebraska's full exemption for military retirement benefits.",
  NJ:"New Jersey taxes IRA, 403(b) and 457 contributions going in, so part of every withdrawal is a tax-free return of basis that this does not track. The real New Jersey bill is usually lower than shown. Also the property tax deduction and senior freeze.",
  NM:"New Mexico's 40% capital gain deduction for selling a New Mexico business.",
  NY:"New York City resident tax of roughly 3.1% to 3.9%, and Yonkers's surcharge, both of which reach pension and retirement-account income. New York's supplemental tax recapture at high incomes.",
  NC:"The Bailey exemption for government retirees vested before August 1989, which exempts their pensions entirely.",
  ND:"Nothing large. North Dakota's rates are low enough that the gain exclusion does most of the work.",
  OH:"Municipal income taxes of roughly 1% to 3% and school district income taxes, though most Ohio municipalities exempt retirement income. Ohio's joint filing credit and lump-sum retirement credit.",
  OK:"Oklahoma's full exemption for military retirement and its separate federal Civil Service allowance.",
  OR:"Multnomah County and Portland-area local income taxes, which stack to several percent on higher incomes. Oregon's retirement income credit at low household incomes, and its federal tax subtraction.",
  PA:"Local earned income taxes of roughly 1% to 3.9%, though these fall on wages rather than retirement income. Distributions taken before retirement age lose the exemption.",
  RI:"The 2026 income limits, which the state has not published yet (this uses 2025's). Each spouse's own full retirement age, which this sets at 67 for everyone.",
  SC:"South Carolina's separate treatment of military retirement, and its two-wage-earner credit.",
  UT:"Utah's credit phase-out runs on a modified AGI that adds back some untaxed income, so the real credit can be smaller than shown. The $450 retirement credit for taxpayers born before 1953.",
  VT:"Vermont's alternative minimum tax, and the $10,000 exclusion for Civil Service and military retirement.",
  VA:"The rule that the age deduction is unlimited for taxpayers born before 1939, and Virginia's separate military benefits subtraction.",
  WV:"West Virginia's separate full exemptions for state police, teachers' and federal Civil Service retirement, and its senior citizen property tax credit.",
  WI:"The credits you give up by taking the $24,000 subtraction, among them the school property tax credit and the married couple credit, and the separate $5,000 subtraction at 65 for low incomes.",
  DC:"The District's own itemized deduction limits. DC does not follow the federal senior deduction.",
  AK:"Nothing. Alaska has no individual income tax and no local income taxes.",
  FL:"Nothing at the income tax level. Florida's tangible and documentary taxes are unrelated.",
  NV:"Nothing. Nevada has no individual income tax.",
  NH:"New Hampshire's interest and dividends tax was fully repealed effective 2025, so there is nothing left to model.",
  SD:"Nothing. South Dakota has no individual income tax.",
  TN:"Nothing. Tennessee's Hall tax on interest and dividends was repealed in 2021.",
  TX:"Nothing. Texas has no individual income tax.",
  WA:"The excise tax on long-term capital gains above about $278,000 per year (the 2025 figure, adjusted each year), at 7%, and 9.9% above $1 million. It is not calculated here. Real estate and retirement accounts are exempt from it.",
  WY:"Nothing. Wyoming has no individual income tax."
};

/* Things true of every state, worth saying once rather than fifty-one times. */
const GAPS_UNIVERSAL = "Everywhere: state credits that phase out on income " +
  "(property tax, renter, low-income and dependent credits), state alternative " +
  "minimum taxes, differences between state and federal itemized deductions, " +
  "part-year and non-resident apportionment, and estate or inheritance taxes.";

/** The seven rows of the state rules table for a state and filing status, by
    a tax year's state figures (the newest year's when `year` is left off). */
export function stateRuleRows(code, st, year){
  const SD = yearData(year).states;
  const S = SD.tax[code] || {none:1, n:"None"};
  const R = SD.retire[code] || {};
  return [
    ["Ordinary income", ruleOrdinary(code, S, st)],
    ["Long-term capital gain", ruleGain(code, S, R)],
    ["Social Security", ruleSS(code, S, R, !!SD.ssTaxed[code])],
    ["Pension / annuity", rulePension(code, S, R)],
    ["Traditional 401(k) / IRA", ruleTrad(code, S, R)],
    ["Age-based rules", ruleSenior(code, S, R)],
    ["Pre-tax deductions", rulePreTax(code, S, (SD.preTaxed || {})[code] || {})]
  ];
}
/** What's knowingly left out, for a state, then for every state. */
export function stateGaps(code){
  return (STATE_GAPS[code] || "") + " " + GAPS_UNIVERSAL;
}
