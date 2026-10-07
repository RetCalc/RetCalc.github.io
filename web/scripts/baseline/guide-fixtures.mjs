/* The readiness guide's fixture households (build brief, section 6): seven
   sets of answers that between them reach every branch of the guide. `a` is
   what today's guide stores (web/tools/guide/store.ts, Answers), so the
   baseline in guide.json is the live guide's own figures for them. `plus`
   holds what only the new guide asks (planned children, for Changes ahead);
   today's code never reads it.

   Maya and Sam and Dan are as the documents give them. The documents name
   only the shape of the other five; the figures filled in here are this
   file's own, chosen to land each household on its branch, and are what the
   baseline records. A field left out is one that household never answered:
   the renter at 29 takes every default, and its retirement spending is the
   new guide's placeholder (80% of take-home, rounded to $500), so the
   figures agree before and after it is entered. */

export const FIXTURES = [
  {
    id: "maya-sam", name: "Maya and Sam", exercises: "A couple, far ahead, retiring before 65",
    a: { status: "m", age: 38, spouseAge: 36, retire: 62, state: "IL", income: 95000, income2: 60000,
      thKnow: "yes", takehome: 9200, bgKnow: "yes", spend: 7000, cash: 12000,
      debtHas: "yes", debtSrc: "quick", debtTotal: 18000, debtHi: 9000,
      home: "mortgage", mortPaid: "no", housePay: 2100, college: "yes", kidAge: 6, collegeMo: 300,
      saved: 210000, rothNow: 40000, contrib: 900, employer: 300, match: "full", risk: 0.0575, saveTo: "trad",
      retSpend: 70000, hcIncl: "no" },
  },
  {
    id: "dan", name: "Dan", exercises: "Behind schedule, the Close the gap branch",
    a: { status: "s", age: 47, retire: 65, state: "TX", income: 78000,
      thKnow: "yes", takehome: 4900, bgKnow: "yes", spend: 4300, cash: 3000,
      debtHas: "yes", debtSrc: "quick", debtTotal: 22000, debtHi: 14000, home: "rent", college: "no",
      saved: 62000, contrib: 300, employer: 150, match: "partial", risk: 0.045, saveTo: "trad", retSpend: 52000 },
  },
  {
    id: "priya-tom", name: "Priya and Tom", exercises: "Changes ahead, the staged schedule, college overlap",
    a: { status: "m", age: 32, spouseAge: 33, retire: 60, state: "TX", income: 240000, income2: 150000,
      thKnow: "yes", takehome: 18500, bgKnow: "yes", spend: 9000, cash: 40000, debtHas: "no",
      home: "mortgage", mortPaid: "yes", housePay: 3800, college: "no",
      saved: 150000, contrib: 8500, employer: 1500, match: "full", risk: 0.0575, saveTo: "half",
      retSpend: 120000, hcIncl: "no" },
    // Two children, the first in three years and the second three after,
    // both in paid childcare before school.
    plus: { kidsNow: [], kidsPlanned: 2, firstIn: 3, spacing: 3, childcare: true },
  },
  {
    id: "renter-29", name: "A single renter at 29", exercises: "Placeholders and badges, the shortest route",
    a: { status: "s", age: 29, retire: 67, income: 52000,
      thKnow: "no", takehome: 3461, bgKnow: "yes", spend: 3100, cash: 2500, debtHas: "no", home: "rent", college: "no",
      saved: 8000, contrib: 150, employer: 0, match: "none", risk: 0.045, saveTo: "trad", retSpend: 33000 },
  },
  {
    id: "couple-58", name: "A couple at 58 with a pension", exercises: "Pre-retiree, pension lines, Medicare at 65",
    a: { status: "m", age: 58, spouseAge: 57, retire: 63, state: "PA", income: 110000, income2: 48000,
      thKnow: "yes", takehome: 8600, bgKnow: "yes", spend: 6800, cash: 45000, debtHas: "no", home: "own", college: "no",
      saved: 780000, rothNow: 60000, brokNow: 90000, contrib: 1600, employer: 550, match: "full", risk: 0.03, saveTo: "trad",
      retSpend: 78000, ssOwn: 3050, ssOwn2: 1480, pension: 1500, pensionCola: "no", hcIncl: "no" },
  },
  {
    id: "early-55", name: "A 52-year-old retiring at 55", exercises: "Getting to 59½, the rule of 55, Healthcare before 65",
    a: { status: "s", age: 52, retire: 55, state: "CO", income: 135000,
      thKnow: "yes", takehome: 6300, bgKnow: "yes", spend: 5200, cash: 30000, debtHas: "no", home: "own", college: "no",
      saved: 950000, rothNow: 140000, brokNow: 260000, contrib: 2000, employer: 650, match: "full", risk: 0.045, saveTo: "half",
      retSpend: 62000, rule55: "yes", hcIncl: "no" },
  },
  {
    id: "self-employed", name: "A self-employed saver", exercises: "The savings-rate wording and the SEP note",
    a: { status: "s", age: 41, retire: 65, state: "FL", income: 88000,
      thKnow: "yes", takehome: 5200, bgKnow: "yes", spend: 4200, cash: 20000, debtHas: "no", home: "rent", college: "no",
      saved: 165000, rothNow: 30000, contrib: 1300, employer: 0, match: "none", risk: 0.045, saveTo: "trad", retSpend: 56000 },
  },
];

/* The lever table's fixed changes (doc 3, section 3, item 8), a superset of
   the rows the documents show for Maya and Sam and for Dan. */
export const LEVERS = [
  { id: "save+100", over: (S) => ({ monthly: S.monthly + 100 }) },
  { id: "save+250", over: (S) => ({ monthly: S.monthly + 250 }) },
  { id: "retire-3", over: (S) => ({ retire: S.retire - 3 }) },
  { id: "retire-1", over: (S) => ({ retire: S.retire - 1 }) },
  { id: "retire+1", over: (S) => ({ retire: S.retire + 1 }) },
  { id: "retire+3", over: (S) => ({ retire: S.retire + 3 }) },
  { id: "spend-5000", over: (S) => ({ spend: S.spend - 5000 }) },
  { id: "spend+5000", over: (S) => ({ spend: S.spend + 5000 }) },
  { id: "spend+10000", over: (S) => ({ spend: S.spend + 10000 }) },
];

/* The figures the documents already published (build brief, section 6),
   checked whenever the baseline is recorded: the harness must reproduce
   them to the dollar before anything is saved. */
export const PUBLISHED = {
  "maya-sam": { pia1: 3251, pia2: 2346, fv: 1518176, portIncome: 60727, ss: 67159, taxYr: 13165, hcYr: 8331, hcYears: 5,
    lifeTax: 422724, survived: 66, total: 66, need: 567000, score: 89,
    "areas.outlook": 40, "areas.rate": 20, "areas.cushion": 7, "areas.debt": 12, "areas.flow": 10,
    "levers.save+100.fv": 1577738, "levers.retire+1.fv": 1620015, "levers.retire+1.need": 478000, "levers.spend-5000.need": 482000,
    "levers.retire-1.fv": 1421875, "levers.retire-1.need": 648000, "levers.spend+10000.need": 929000 },
  dan: { pia1: 2826, fv: 282581, portIncome: 11303, ss: 33911, taxYr: 235, hcYears: 0, lifeTax: 7057, survived: 7, total: 71,
    need: 504000, score: 25, "areas.outlook": 0, "areas.rate": 7, "areas.cushion": 3, "areas.debt": 7, "areas.flow": 8,
    "levers.save+100.successPct": 28, "levers.save+250.successPct": 54, "levers.retire+1.successPct": 49,
    "levers.retire+3.successPct": 89, "levers.spend-5000.successPct": 54 },
  "priya-tom": { fv: 8694813 },
};
