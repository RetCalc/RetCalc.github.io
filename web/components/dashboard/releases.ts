/* What's new: every release of RetCalc, newest first, shown in the
   Dashboard's About. The first entry is the current version, and the
   About tab is marked New until it's been opened since that version.

   Versions are major.minor.patch: a major is a rebuild or redesign of the
   whole site, a minor a new feature, a patch fixes and wording. Each push
   to main gets the next number here, in web/package.json, and as a git tag
   (v4.13.0). Write what you can do now, in the reader's words, and link to
   where it is. */

export interface Release {
  version: string;
  /** The day it went live, YYYY-MM-DD. */
  date: string;
  title: string;
  items?: { text: string; href?: string }[];
}

export const RELEASES: Release[] = [
  { version: "4.13.1", date: "2026-11-16", title: "College saving follows your plan, down as well as up", items: [
    { text: "When your plan now needs less for college than your budget sets aside, Spending offers to lower the College savings line, or take it out if you're no longer helping.", href: "/dashboard/spending" },
    { text: "Apply to my plan in College Savings updates your budget's College savings line too." },
  ] },
  { version: "4.13.0", date: "2026-11-16", title: "What's new and version numbers", items: [
    { text: "This list: every release of RetCalc, with what changed and where to find it.", href: "/dashboard/about#about-whatsnew" },
    { text: "About is marked New when there's a release you haven't seen." },
  ] },
  { version: "4.12.0", date: "2026-11-16", title: "How your spending compares to the usual budget rules", items: [
    { text: "Cards under your budget for housing, debt payments, getting around and saving, each against its usual guideline. Owners and renters each get the rules that fit.", href: "/dashboard/spending#rules" },
    { text: "Needs, wants and saving against the 50/30/20 rule." },
    { text: "Each budget line says whether it counts as a need or a want; lines you add or rename have a switch." },
  ] },
  { version: "4.11.0", date: "2026-11-15", title: "Year by year: see how each figure is worked out", items: [
    { text: "Click a spending or tax figure to see what makes it up.", href: "/dashboard/years" },
  ] },
  { version: "4.10.1", date: "2026-11-13", title: "Spreadsheet header and the Dashboard tour", items: [
    { text: "The plan spreadsheet opens with a RetCalc header and a step for saving it as a Google Sheet." },
    { text: "A 90-second tour of the Dashboard on its front page, on phones too.", href: "/dashboard" },
  ] },
  { version: "4.10.0", date: "2026-11-13", title: "Download your plan as a spreadsheet", items: [
    { text: "Your whole plan as a formatted workbook for Excel or Google Sheets, with a What If sheet to try changes.", href: "/dashboard/summary" },
  ] },
  { version: "4.9.0", date: "2026-11-13", title: "Your plan over time, stress tests and taxes in retirement", items: [
    { text: "Each Net worth entry keeps your plan as it stood that day, so you can see how it has moved.", href: "/dashboard/accounts" },
    { text: "\"If things go wrong\" runs your plan again with a hard event added: retiring into a bad market, a year without work, long-term care and more.", href: "/dashboard/summary" },
    { text: "Taxes in retirement, year by year, as a fourth view on Retirement.", href: "/dashboard/retirement" },
  ] },
  { version: "4.8.0", date: "2026-11-12", title: "Plan debt payments on Net worth", items: [
    { text: "Set what you pay on each loan or card; once one is paid off, what you paid goes to saving.", href: "/dashboard/accounts" },
    { text: "Spending holds steady through pay changes, and saving limits follow each person's pay." },
  ] },
  { version: "4.7.1", date: "2026-11-12", title: "Fixes", items: [
    { text: "The emergency budget's column can be hidden and still sizes the fund.", href: "/dashboard/spending" },
    { text: "Phone tab bars hold still between pages; the home-screen app clears the top of newer iPhones." },
  ] },
  { version: "4.7.0", date: "2026-11-11", title: "How your assumptions compare", items: [
    { text: "Your plan's guesses, growth, inflation, Social Security and more, rated from very conservative to very aggressive, with what each does to your savings.", href: "/dashboard/summary#assumption-check" },
  ] },
  { version: "4.6.0", date: "2026-11-11", title: "More than one Dashboard", items: [
    { text: "Keep several profiles on one account, starting fresh or from a copy, and switch between them.", href: "/dashboard/profile" },
  ] },
  { version: "4.5.0", date: "2026-11-11", title: "Learn: interactive lessons", items: [
    { text: "29 hands-on widgets across the lessons, and a new bookshelf to browse the tracks.", href: "/learn" },
    { text: "College Savings uses the 2026–27 College Board costs." },
  ] },
  { version: "4.4.0", date: "2026-11-10", title: "Learn: 10 new lessons", items: [
    { text: "Every lesson checked again, 10 new ones, and charts you can read values off.", href: "/learn" },
    { text: "Layout fixes across the site." },
  ] },
  { version: "4.3.0", date: "2026-11-05", title: "Children's costs: one rule", items: [
    { text: "Say how your children's costs are covered once, by account order or a share of each, instead of amounts for every stage.", href: "/dashboard/profile" },
  ] },
  { version: "4.2.0", date: "2026-11-04", title: "Clearer page headers, and copy the Calculator into Drawdown", items: [
    { text: "Each Dashboard tab opens with its name, where it sits and its status." },
    { text: "Drawdown can start from your Calculator's figures.", href: "/dashboard/retirement" },
  ] },
  { version: "4.1.0", date: "2026-11-03", title: "The Dashboard Calculator runs on Advanced", items: [
    { text: "One calculator for the site and the Dashboard, with Advanced's asset mix, goal, chart and year table.", href: "/dashboard/calculator" },
    { text: "A new Guide landing page.", href: "/guide" },
  ] },
  { version: "4.0.0", date: "2026-11-02", title: "A new look, everywhere", items: [
    { text: "The whole site and Dashboard redesigned: cleaner, lighter and easier to read, in light and dark." },
    { text: "A new homepage, and Learn in the site's header.", href: "/" },
  ] },
  { version: "3.0.0", date: "2026-10-12", title: "Accounts and the Dashboard", items: [
    { text: "Sign in to keep your plan, and a Dashboard that turns your whole financial picture into one plan." },
    { text: "Through October: Learn's lessons, the plan report and monthly check-in email, Calculator scenarios, Year by year, and the Dashboard on phones." },
  ] },
  { version: "2.0.0", date: "2026-10-05", title: "RetCalc, rebuilt", items: [
    { text: "The site rebuilt from the ground up and redesigned, with the Calculator, the Guide and 14 tools." },
  ] },
  { version: "1.0.0", date: "2026-09-02", title: "The first RetCalc", items: [
    { text: "The original retirement calculator and tools." },
  ] },
];

export const CURRENT = RELEASES[0];
