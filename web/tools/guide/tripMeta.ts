/* Each trip into a tool, as the guide's step cards describe it: the tool,
   its name, roughly how long, the coach's title, and what the step promises
   before you go. What happens on the way and in the tool is in trips.ts.
   From GD_TRIPS in src/js/app/29-guide-trips.js. */

export interface TripMeta {
  /** The tool's id in the tool list (and its stored inputs). */
  tool: string;
  /** Where it lives on the site. */
  path: string;
  /** The id its inputs are kept under (useToolState). */
  store: string;
  name: string; mins?: number; title: string; preview?: string[];
  /** Tools walked through in parts. */
  pages?: { title: string; focus: string }[];
}

export const TRIP_META: Record<string, TripMeta> = {
  tax: { tool: "tax", path: "/incometax", store: "tax", name: "Income Tax", mins: 3, title: "Find your take-home pay",
    preview: ["We fill in your salary, filing status and state.",
      "You add anything taken out of your paycheck before tax, like 401(k) contributions.",
      "You read off your monthly take-home, and the guide brings it back."] },
  budget: { tool: "budget", path: "/budget", store: "budget", name: "Budget", mins: 15, title: "Build your budget",
    preview: ["Your take-home pay is already filled in.",
      "You go down the list of everyday costs, using a couple of months of bank and card statements.",
      "The guide brings back what you spend and what's left over."] },
  debt: { tool: "debt", path: "/debt", store: "debt", name: "Debt Payoff", mins: 5, title: "Make a payoff plan",
    preview: ["You list each debt with its balance, rate and minimum payment.",
      "You add what you can pay on top of the minimums.",
      "The tool compares the two classic payoff orders and gives you a debt-free date."] },
  mortBuy: { tool: "mortgage", path: "/mortgage", store: "mortgage", name: "Mortgage Calculator", mins: 5, title: "See what a home would cost",
    preview: ["You enter a price you'd shop at, your down payment and a current rate.",
      "The tool adds tax, insurance and PMI to get the real monthly cost.",
      "The guide checks it against your income."] },
  mortOwn: { tool: "mortgage", path: "/mortgage", store: "mortgage", name: "Mortgage Calculator", mins: 5, title: "See what extra payments do",
    preview: ["You enter your loan as it stands today.",
      "You try an extra $100 or $200 a month toward principal.",
      "The tool shows the interest you'd save and how much sooner you'd be done."] },
  college: { tool: "college", path: "/college", store: "college", name: "College Savings", mins: 3, title: "Find your monthly college number",
    preview: ["Years until college is set from your child's age.",
      "You pick a type of school and add what's already saved.",
      "The tool gives the monthly amount to set aside."] },
  basic: { tool: "basic", path: "/", store: "basic", name: "Basic calculator", mins: 3, title: "Explore your projection",
    preview: ["Your age, savings and monthly saving are filled in.",
      "You see what your savings grow to by retirement, in today's dollars.",
      "You try saving more or retiring later, and the guide can keep the change."] },
  drawdown: { tool: "drawdown", path: "/drawdown", store: "drawdown", name: "Drawdown Simulator", mins: 10, title: "Tour the Drawdown Simulator",
    preview: ["Your projected savings, spending, Social Security, any pension and your withdrawal approach are loaded.",
      "Seven short parts walk through each option, with the panel ticking off what you've tried.",
      "A different strategy, stock mix or claiming age can come back into your plan."],
    pages: [{ title: "Your result", focus: "#ddSuccess" }, { title: "A bad start", focus: "#ddYearsPanel" }, { title: "Withdrawal strategies", focus: "#ddStrategy" },
      { title: "Your stock mix", focus: "#ddMixBtn" }, { title: "Social Security timing", focus: "#ddSSMode" }, { title: "Life events", focus: "#ddAddIncome" },
      { title: "Stress tests", focus: "#segDD" }] },
  bridge: { tool: "bridge", path: "/bridge", store: "bridge", name: "Early Retirement Bridge", mins: 6, title: "Plan the years before 59½",
    preview: ["Your projected savings at retirement, split across traditional, Roth and brokerage the way you told us, are filled in with your spending, state and retirement age.",
      "Four short parts walk through the plans it compares, what each one costs, and what you'd have left at 59½.",
      "The plan it picks, and what it leaves you with, come back to the guide."],
    pages: [{ title: "Your numbers", focus: "#asideBR" }, { title: "The best way across", focus: "#brBest" },
      { title: "Compare the routes", focus: "#brCompare" }, { title: "What you'll have at 59½", focus: "#brAtOut" }] },
  healthcare: { tool: "healthcare", path: "/healthcare", store: "healthcare", name: "Healthcare Cost Planner", mins: 4, title: "Price healthcare before Medicare",
    preview: ["Your retirement age, household and state are filled in.",
      "You see marketplace premiums, and subsidies, for the years before 65.",
      "Then what Medicare costs after."] },
  fire: { tool: "fire", path: "/fire", store: "fire", name: "FIRE Calculator", mins: 3, title: "Find your financial independence age",
    preview: ["Your savings, monthly saving and yearly spending are loaded.",
      "You see the age your savings could cover your spending on their own.",
      "Coast FIRE shows when you could stop contributing."] },
  advanced: { tool: "single", path: "/advanced", store: "advanced", name: "Advanced calculator", mins: 10, title: "Tour the Advanced calculator" },
  stages: { tool: "series", path: "/stages", store: "stages", name: "Stages calculator", mins: 10, title: "Tour the Stages calculator" },
  backtest: { tool: "backtest", path: "/backtest", store: "backtest", name: "Portfolio Backtest", mins: 5, title: "See what your mix has earned" },
};
