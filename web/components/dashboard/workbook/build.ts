/* The plan spreadsheet: the whole Dashboard plan as a workbook someone can
   keep, read and play with. Each sheet is one part of the plan; totals,
   shares, rates and links between sheets are formulas, so editing a figure
   (a budget line, a balance) carries through; What If is a small model of
   its own, driven by inputs prefilled from the plan. The figures themselves
   come from the printed report's model (data.ts), so the two agree. */

import type { Workbook } from "exceljs";
import { kindName, groupOf, ownerOf } from "../kinds";
import { nameOf } from "../model";
import { STRESS_NAMES } from "../stress-plan";
import type { WorkbookData } from "./data";
import { C, Sheet, col, fx, ref, type Col, type Val } from "./style";

const N = {
  overview: "Overview", worth: "Net Worth", income: "Income & Saving", spending: "Spending", years: "Year by Year",
  retire: "Retirement", taxes: "Retirement Taxes", stress: "Stress Tests", social: "Social Security", assume: "Assumptions", whatif: "What If",
} as const;

const TREAT: Record<string, string> = {
  workplace: "Tax-deferred", g457: "Tax-deferred", ira: "Tax-deferred", roth: "Roth (tax-free)", hsa: "HSA",
  brokerage: "Taxable", cash: "Cash", home: "Home", other: "Other",
};
const TREATS = ["Tax-deferred", "Roth (tax-free)", "HSA", "Taxable", "Cash", "Home", "Other"];

const r0 = (v: number) => Math.round(v);
const pctOf = (a: number, b: number) => (b > 0 ? a / b : 0);

export function buildWorkbook(wb: Workbook, D: WorkbookData) {
  const { M } = D;
  const two = M.who.two, names: [string, string] = [M.who.First, M.who.Second];
  const sub = `${M.who.title} · Prepared ${M.date} with RetCalc · Today's dollars unless noted`;
  wb.creator = "RetCalc"; wb.lastModifiedBy = "RetCalc"; wb.created = M.today; wb.modified = M.today;
  wb.title = M.who.title + ": retirement plan";
  wb.calcProperties = { fullCalcOnLoad: true };

  // Every sheet up front, in reading order; Overview is filled last, from the others' cells.
  const S = {
    overview: new Sheet(wb, N.overview, C.amber, [20, 15, 20, 15, 20, 15, 20, 15]),
    worth: new Sheet(wb, N.worth, C.teal, [26, 22, 16, 14, 16, 16, 13, 13]),
    income: new Sheet(wb, N.income, C.sky, [32, 16, 16, 16, 14, 16, 14]),
    spending: new Sheet(wb, N.spending, C.lav, [22, 34, 15, 15, 12, 14]),
    years: new Sheet(wb, N.years, C.sky, [8, 11, 13, ...(two ? [13] : []), 12, 13, 12, 13, 13, 13, 13, 12, 12, 13, 10, 14]),
    retire: new Sheet(wb, N.retire, C.jade, [8, 8, 13, 13, 13, 13, 13, 12, 12, 13, 13, 13, 12, 12, 13]),
    taxes: D.tax ? new Sheet(wb, N.taxes, C.rose, [8, 10, 13, 13, 13, 12, 12, 12, 13, 12, 11, 12, 12, 13, 10]) : null,
    stress: M.stress ? new Sheet(wb, N.stress, C.rose, [30, 22, 14, 12, 28, 14]) : null,
    social: M.social ? new Sheet(wb, N.social, C.sky, [14, 16, 16, 16, 15, 15, 15]) : null,
    assume: new Sheet(wb, N.assume, C.faint, [46, 20, 20, 30]),
    whatif: new Sheet(wb, N.whatif, C.amber, [30, 14, 15, 34, 3, 9, 14, 13, 13, 14, 14, 14, 14]),
  };
  S.retire.kvAt = 6; if (S.taxes) S.taxes.kvAt = 6; if (S.social) S.social.kvAt = 5; if (S.stress) S.stress.kvAt = 4;
  S.overview.kvAt = 4; S.whatif.kvAt = 4; S.assume.kvAt = 3;
  const link: Record<string, string> = {};

  /* ======================= Net Worth ======================= */
  {
    const s = S.worth;
    s.title(N.worth, sub, 8);
    const last = M.entries[M.entries.length - 1];
    const items = (last?.items ?? []).filter((i) => i.value > 0);
    const assets = items.filter((i) => i.side === "asset").sort((a, b) => groupOf(a.kind).localeCompare(groupOf(b.kind)) || b.value - a.value);
    const debts = items.filter((i) => i.side === "debt").sort((a, b) => b.value - a.value);
    const nm: [string, string] | null = two ? [M.pr.p1.name, M.pr.p2.name] : null;
    s.section("What you own", 8, last ? `Balances as of ${new Date(last.date + "T12:00:00").toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}. Change a balance and every total, share and the Overview follow.` : "No balances entered yet on Net worth: these are setup's figures.");
    type It = (typeof assets)[number];
    const A = s.table<It>([
      { key: "name", h: "Account", v: (i) => i.name.trim() || kindName(i.kind) },
      { key: "kind", h: "Type", v: (i) => kindName(i.kind) },
      { key: "treat", h: "Taxed as", v: (i) => TREAT[i.kind] ?? "Other" },
      { key: "whose", h: two ? "Whose" : "", v: (i) => { if (!two) return null; const w = ownerOf(i, nm); return w == null ? "Shared" : nameOf(M.pr, w); } },
      { key: "bal", h: "Balance", fmt: "money", v: (i) => r0(i.value), input: true, total: "sum" },
      { key: "basis", h: "Cost basis or contributions", fmt: "money", v: (i) => (i.basis != null ? r0(i.basis) : null) },
      { key: "share", h: "Share of assets", fmt: "pct", f: (r, L) => `IF(SUM(${L("bal")}$${0}:${L("bal")}$${0})=0,0,${L("bal")}${r}/SUM(${L("bal")}$${0}:${L("bal")}$${0}))`, res: (i) => pctOf(i.value, M.worth.assets) },
    ], assets, { totalLabel: "Total assets" });
    // The share column needs the table's own range: fill it in now it's known.
    for (let r = A.first; r <= A.last; r++) {
      const rng = `${A.L("bal")}$${A.first}:${A.L("bal")}$${A.last}`;
      s.cell(A.c("share"), r).value = { formula: `IF(SUM(${rng})=0,0,${A.L("bal")}${r}/SUM(${rng}))`, result: pctOf(assets[r - A.first].value, M.worth.assets) };
    }
    const assetsTot = A.total ? ref(N.worth, A.c("bal"), A.total) : "0";
    s.section("What you owe", 8);
    type Dt = (typeof debts)[number];
    const Dd = s.table<Dt>([
      { key: "name", h: "Debt", v: (i) => i.name.trim() || kindName(i.kind) },
      { key: "kind", h: "Type", v: (i) => kindName(i.kind) },
      { key: "rate", h: "Interest rate", fmt: "pct", v: (i) => i.rate ?? null, input: true },
      { key: "bal", h: "Balance", fmt: "money", v: (i) => r0(i.value), input: true, total: "sum" },
      { key: "int", h: "Interest per year, about", fmt: "money", f: (r, L) => `${L("rate")}${r}*${L("bal")}${r}`, res: (i) => (i.rate ?? 0) * i.value, total: "sum" },
    ], debts, { totalLabel: "Total debts" });
    const debtsTot = Dd.total ? ref(N.worth, Dd.c("bal"), Dd.total) : "0";
    s.section("Net worth", 8);
    s.kv("Total assets", fx(assetsTot.replace(/^'[^']*'!/, ""), M.worth.assets), "money");
    s.kv("Total debts", fx(debts.length ? debtsTot.replace(/^'[^']*'!/, "") : "0", M.worth.debts), "money");
    link.net = s.kv("Net worth today", fx(`${assetsTot.replace(/^'[^']*'!/, "")}-${debts.length ? debtsTot.replace(/^'[^']*'!/, "") : "0"}`, M.worth.net), "money", { bold: true });
    s.skip();
    // By how each is taxed: what comes out tax-free, taxed as income, or at capital-gains rates.
    if (assets.length) {
      s.section("By how it's taxed", 8, "Tax-deferred money is taxed as income when it comes out; Roth comes out tax-free; a brokerage account is taxed only on its gains. The mix decides what you keep in retirement.");
      const rng = (k: string) => `$${A.L(k)}$${A.first}:$${A.L(k)}$${A.last}`;
      const T = s.table<string>([
        { key: "t", h: "Taxed as", v: (t) => t },
        { key: "v", h: "Balance", fmt: "money", f: (_r, _L, t) => `SUMIF(${rng("treat")},"${t}",${rng("bal")})`, res: (t) => assets.filter((i) => (TREAT[i.kind] ?? "Other") === t).reduce((a, i) => a + i.value, 0), total: "sum" },
        { key: "sh", h: "Share", fmt: "pct", f: (r, L) => `IF(${assetsTot}=0,0,${L("v")}${r}/${assetsTot})`, res: (t) => pctOf(assets.filter((i) => (TREAT[i.kind] ?? "Other") === t).reduce((a, i) => a + i.value, 0), M.worth.assets) },
      ], TREATS.filter((t) => assets.some((i) => (TREAT[i.kind] ?? "Other") === t)));
      link.cash = T.first ? `SUMIF(${ref(N.worth, A.c("treat"), A.first)}:${ref(N.worth, A.c("treat"), A.last).replace(/^'[^']*'!/, "")},"Cash",${ref(N.worth, A.c("bal"), A.first)}:${ref(N.worth, A.c("bal"), A.last).replace(/^'[^']*'!/, "")})` : "0";
      s.ws.addConditionalFormatting({ ref: `${T.L("sh")}${T.first}:${T.L("sh")}${T.last}`, rules: [{ type: "dataBar", priority: 1, cfvo: [{ type: "num", value: 0 }, { type: "num", value: 1 }], color: { argb: "FF46B9A6" } } as never] });
    }
    // Every entry, with the plan as it stood then.
    const hist = M.entries.slice().sort((a, b) => a.date.localeCompare(b.date));
    if (hist.length > 1) {
      s.section("Over time", 8, "Each time you updated your balances, with the plan's figures as they stood that day (where kept).");
      type H = (typeof hist)[number];
      const sumSide = (e: H, side: "asset" | "debt") => e.items.filter((i) => i.side === side).reduce((a, i) => a + i.value, 0);
      s.table<H>([
        { key: "d", h: "Date", fmt: "date", v: (e) => new Date(e.date + "T12:00:00") },
        { key: "a", h: "Assets", fmt: "money", v: (e) => r0(sumSide(e, "asset")) },
        { key: "b", h: "Debts", fmt: "money", v: (e) => r0(sumSide(e, "debt")) },
        { key: "n", h: "Net worth", fmt: "money", f: (r, L) => `${L("a")}${r}-${L("b")}${r}`, res: (e) => sumSide(e, "asset") - sumSide(e, "debt"), bold: true },
        { key: "ch", h: "Change", fmt: "money", f: (r, L, _e, i) => (i === 0 ? `0` : `${L("n")}${r}-${L("n")}${r - 1}`), res: (e, i) => (i === 0 ? 0 : sumSide(e, "asset") - sumSide(e, "debt") - (sumSide(hist[i - 1], "asset") - sumSide(hist[i - 1], "debt"))) },
        { key: "sp", h: "Spending your plan supports, per month", fmt: "money", v: (e) => (e.plan?.supports != null ? r0(e.plan.supports) : null) },
        { key: "ch2", h: "Chance of success", fmt: "pct0", v: (e) => e.plan?.chance ?? null },
      ], hist, { headHeight: 44 });
    }
    s.freeze(5);
  }

  /* ======================= Income & Saving ======================= */
  {
    const s = S.income, Fl = M.F, T = Fl.tax;
    s.title(N.income, sub, 7);
    s.section("Pay", 7, M.abroad ? "Living outside the US, pay is entered after taxes, and the plan counts no US taxes or Social Security." : "Pay before taxes, per year.");
    const payT = s.table([
      { key: "who", h: "Who", v: (p: (typeof M.pay)[number]) => p.name },
      { key: "y", h: M.abroad ? "Pay per year, after taxes" : "Pay per year", fmt: "money", v: (p) => r0(p.year), total: "sum" },
      { key: "m", h: "Per month", fmt: "money", f: (r, L) => `${L("y")}${r}/12`, res: (p) => p.year / 12, total: "sum" },
      { key: "ret", h: "Retires at", fmt: "int", v: (p) => p.retire ?? null },
    ], M.pay, { totalLabel: "Household" });
    const payYear = ref(N.income, payT.c("y"), payT.total ?? payT.first);
    if (M.other.length) {
      s.section("Other income", 7);
      s.table([
        { key: "n", h: "Income", v: (o: (typeof M.other)[number]) => o.name || "Other income" },
        { key: "m", h: "Per month, after taxes", fmt: "money", v: (o) => r0(o.amount ?? 0), total: "sum" },
        { key: "y", h: "Per year", fmt: "money", f: (r, L) => `${L("m")}${r}*12`, res: (o) => (o.amount ?? 0) * 12, total: "sum" },
      ], M.other);
    }
    let taxTot = "0";
    if (!M.abroad && T) {
      s.section("Taxes on pay, this year", 7, "Worked out by the Dashboard's paycheck calculator with your filing status, state, deductions and what goes in before tax.");
      const rows: [string, number][] = [["Federal income tax", T.federal], ["State income tax", T.state], ...(T.local > 0 ? [["Local income tax", T.local] as [string, number]] : []), ["Social Security and Medicare", T.fica]];
      const tt = s.table<[string, number]>([
        { key: "t", h: "Tax", v: (x) => x[0] },
        { key: "y", h: "Per year", fmt: "money", v: (x) => r0(x[1]), total: "sum" },
        { key: "m", h: "Per month", fmt: "money", f: (r, L) => `${L("y")}${r}/12`, res: (x) => x[1] / 12, total: "sum" },
        { key: "rate", h: "Share of pay", fmt: "pct", f: (r, L) => `IF(${payYear}=0,0,${L("y")}${r}/${payYear})`, res: (x) => pctOf(x[1], Fl.gross * 12), total: "Share" },
      ], rows, { totalLabel: "All taxes" });
      taxTot = ref(N.income, tt.c("y"), tt.total!);
      // The total's rate refers to its own row.
      s.cell(tt.c("rate"), tt.total!).value = { formula: `IF(${payYear}=0,0,${tt.L("y")}${tt.total}/${payYear})`, result: pctOf(T.total, Fl.gross * 12) };
    }
    s.section("Where each month's pay goes", 7, "Change any line below and Left over follows; Left over is money not yet given a job.");
    type Ln = { t: string; v: number; out: boolean };
    const flowRows: Ln[] = [
      ...(M.abroad ? [{ t: "Pay after taxes", v: Fl.afterTax, out: false }] : [{ t: "Pay before taxes", v: Fl.gross, out: false }, { t: "Taxes", v: Fl.taxes, out: true }]),
      ...(Fl.health > 0 ? [{ t: "Health premiums from pay", v: Fl.health, out: true }] : []),
      { t: "Saving and investing", v: Fl.invested, out: true },
      ...(Fl.ef > 0 ? [{ t: "Emergency fund", v: Fl.ef, out: true }] : []),
      { t: "Spending", v: Fl.spendPaid, out: true },
    ];
    const ft = s.table<Ln>([
      { key: "t", h: "", v: (x) => x.t, bold: false },
      { key: "m", h: "Per month", fmt: "money", v: (x) => r0(x.out ? -x.v : x.v), input: true },
      { key: "y", h: "Per year", fmt: "money", f: (r, L) => `${L("m")}${r}*12`, res: (x) => (x.out ? -x.v : x.v) * 12 },
      { key: "sh", h: "Share of pay", fmt: "pct", f: (r, L) => `IF($${L("m")}$${0}=0,0,ABS(${L("m")}${r})/$${L("m")}$${0})` },
    ], flowRows, { totalLabel: "Left over" });
    // Left over: what's in less what's out, and each share of the pay line.
    const lr = s.r - 1;
    s.r = lr;
    s.put(s.c0, "Left over", { font: { bold: true } });
    s.put(ft.c("m"), fx(`SUM(${ft.L("m")}${ft.first}:${ft.L("m")}${ft.last})`, Fl.left), { fmt: "money", font: { bold: true }, align: { horizontal: "right" } });
    s.put(ft.c("y"), fx(`${ft.L("m")}${lr}*12`, Fl.left * 12), { fmt: "money", font: { bold: true }, align: { horizontal: "right" } });
    s.put(ft.c("sh"), fx(`IF(${ft.L("m")}${ft.first}=0,0,${ft.L("m")}${lr}/${ft.L("m")}${ft.first})`, pctOf(Fl.left, M.abroad ? Fl.afterTax : Fl.gross)), { fmt: "pct", font: { bold: true }, align: { horizontal: "right" } });
    for (let c = s.c0; c <= ft.c("sh"); c++) s.cell(c, lr).border = { top: { style: "thin", color: { argb: C.ink } }, bottom: { style: "double", color: { argb: C.ink } } };
    for (let r = ft.first; r <= ft.last; r++) s.cell(ft.c("sh"), r).value = { formula: `IF($${ft.L("m")}$${ft.first}=0,0,ABS(${ft.L("m")}${r})/$${ft.L("m")}$${ft.first})`, result: pctOf(flowRows[r - ft.first].v, flowRows[0].v) };
    s.r = lr + 2;
    link.left = ref(N.income, ft.c("m"), lr);
    // Saving: each line, its yearly limit and the room under it.
    s.section("Saving, line by line", 7, "Per month from pay, with the employer's match. A yearly limit is the law's (it rises with inflation, so in today's dollars it holds still).");
    type Sl = { name: string; m: number; cap: number | null };
    const lines: Sl[] = [...M.save.lines.map((l) => ({ name: l.name, m: l.amount, cap: isFinite(l.cap) && l.cap > 0 ? l.cap : null })), ...(Fl.match > 0 ? [{ name: "Employer match", m: Fl.match, cap: null }] : [])];
    const st = s.table<Sl>([
      { key: "n", h: "Line", v: (x) => x.name },
      { key: "m", h: "Per month", fmt: "money", v: (x) => r0(x.m), input: true, total: "sum" },
      { key: "y", h: "Per year", fmt: "money", f: (r, L) => `${L("m")}${r}*12`, res: (x) => x.m * 12, total: "sum" },
      { key: "cap", h: "Yearly limit", fmt: "money", v: (x) => (x.cap != null ? r0(x.cap * 12) : null) },
      { key: "room", h: "Room under the limit", fmt: "money", f: (r, L) => `IF(${L("cap")}${r}="","",MAX(0,${L("cap")}${r}-${L("y")}${r}))`, res: (x) => (x.cap != null ? Math.max(0, x.cap * 12 - x.m * 12) : "") },
    ], lines, { totalLabel: "All saving" });
    const savedM = ref(N.income, st.c("m"), st.total ?? st.first);
    s.kv("Savings rate (saving and match, as a share of pay)", fx(M.abroad ? `0` : `IF(${payYear}=0,0,${savedM}*12/${payYear})`, M.save.rate ?? 0), "pct", { bold: true, note: "About 15% of pay is a common goal." });
    link.rate = ref(N.income, s.c0 + 2, s.r - 1);
    link.taxTot = taxTot;
    s.freeze(5);
  }

  /* ======================= Spending ======================= */
  {
    const s = S.spending, sp = M.spend;
    s.title(N.spending, sub, 6);
    s.section("Your budget", 6, "Per month, in today's dollars. Change any line: totals, the groups, the emergency fund and the Overview follow.");
    type Bl = (typeof sp.lines)[number];
    const lines = sp.lines.slice().sort((a, b) => a.group.localeCompare(b.group) || b.month - a.month);
    const bt = s.table<Bl>([
      { key: "g", h: "Group", v: (x) => x.group },
      { key: "d", h: "Item", v: (x) => x.desc },
      { key: "m", h: "Per month", fmt: "money", v: (x) => r0(x.month), input: true, total: "sum" },
      { key: "y", h: "Per year", fmt: "money", f: (r, L) => `${L("m")}${r}*12`, res: (x) => x.month * 12, total: "sum" },
      { key: "sh", h: "Share", fmt: "pct", f: () => "0" },
    ], lines, { totalLabel: "All spending" });
    const tot = `$${bt.L("m")}$${bt.total ?? bt.first}`;
    const totalMonth = lines.reduce((a, x) => a + x.month, 0);
    for (let r = bt.first; r <= bt.last; r++) s.cell(bt.c("sh"), r).value = { formula: `IF(${tot}=0,0,${bt.L("m")}${r}/${tot})`, result: pctOf(lines[r - bt.first].month, totalMonth) };
    if (bt.total) s.cell(bt.c("sh"), bt.total).value = { formula: `IF(${tot}=0,0,1)`, result: 1 };
    s.ws.addConditionalFormatting({ ref: `${bt.L("sh")}${bt.first}:${bt.L("sh")}${bt.last}`, rules: [{ type: "dataBar", priority: 1, cfvo: [{ type: "num", value: 0 }, { type: "max" }], color: { argb: "FF9B87D9" } } as never] });
    link.spendMonth = ref(N.spending, bt.c("m"), bt.total ?? bt.first);
    const groups = Array.from(new Set(lines.map((x) => x.group)));
    if (groups.length > 1) {
      s.section("By group", 6);
      const gr = (k: string) => `$${bt.L(k)}$${bt.first}:$${bt.L(k)}$${bt.last}`;
      s.table<string>([
        { key: "g", h: "Group", v: (g) => g },
        { key: "m", h: "Per month", fmt: "money", f: (_r, _L, g) => `SUMIF(${gr("g")},"${g.replace(/"/g, '""')}",${gr("m")})`, res: (g) => lines.filter((x) => x.group === g).reduce((a, x) => a + x.month, 0), total: "sum" },
        { key: "y", h: "Per year", fmt: "money", f: (r, L) => `${L("m")}${r}*12`, res: (g) => lines.filter((x) => x.group === g).reduce((a, x) => a + x.month, 0) * 12, total: "sum" },
        { key: "sh", h: "Share", fmt: "pct", f: (r, L) => `IF(${tot}=0,0,${L("m")}${r}/${tot})`, res: (g) => pctOf(lines.filter((x) => x.group === g).reduce((a, x) => a + x.month, 0), totalMonth) },
      ], groups.sort((a, b) => lines.filter((x) => x.group === b).reduce((t, x) => t + x.month, 0) - lines.filter((x) => x.group === a).reduce((t, x) => t + x.month, 0)));
    }
    s.section("Emergency fund", 6, "Cash set aside for a job loss or a big surprise bill, counted in months of spending.");
    const basis = sp.efMonths > 0 ? sp.efTarget / sp.efMonths : totalMonth;
    const mo = s.kv("Months to cover", sp.efMonths, "months", { input: true, note: "6 is typical; up to 12 if income varies." });
    const per = s.kv("Spending it covers, per month", r0(basis), "money", { input: true, note: basis !== totalMonth ? "Your emergency budget." : "Your budget." });
    const tgt = s.kv("Target", fx(`${mo}*${per}`, sp.efTarget), "money", { bold: true });
    const cash = s.kv("Cash on hand (checking and savings, from Net Worth)", fx(link.cash ?? "0", sp.cash ?? 0), "money");
    link.efMonths = s.kv("Months it covers today", fx(`IF(${per}=0,0,${cash}/${per})`, basis > 0 ? (sp.cash ?? 0) / basis : 0), "months", { bold: true });
    s.kv("Still to set aside", fx(`MAX(0,${tgt}-${cash})`, Math.max(0, sp.efTarget - (sp.cash ?? 0))), "money");
    s.skip();
    s.section("Once retired", 6);
    if (sp.goal != null) link.goal = s.kv("You plan to spend, per month", r0(sp.goal), "money", { note: sp.own ? "Your goal; your strategy's starting rate sets what the plan spends." : "After taxes, in today's dollars." });
    if (sp.own && sp.planSpend != null) s.kv("Your strategy spends, per month", r0(sp.planSpend), "money");
    s.freeze(5);
  }

  /* ======================= Year by Year ======================= */
  {
    const s = S.years, Y = D.years.filter((y) => y.age < M.retire);
    s.title(N.years, sub, 16);
    s.section("Every year until you retire", 16, "Per year, in today's dollars: pay, its taxes, what's spent and what's saved, by account. Spending is everything not taxed or saved, money not yet given a job included. Income, total saved and the savings rate are formulas.");
    const path = new Map(M.save.path.map((p) => [p.age, p.v]));
    type Yr = (typeof Y)[number];
    const ys = (y: Yr) => (y.saved.trad + y.saved.roth + y.saved.hsa + y.saved.brok + y.ef + y.match) * 12;
    const t = s.table<Yr>([
      { key: "yr", h: "Year", fmt: "year", v: (y) => y.year },
      { key: "age", h: two ? "Ages" : "Age", align: "center", v: (y) => (two ? `${y.age} · ${M.who.mine(y.age) === y.age ? y.age : Math.round(y.age - (M.who.mine(y.age) - y.age))}` : y.age) },
      { key: "p1", h: two ? names[0] + "'s pay" : "Pay", fmt: "money", v: (y) => r0(y.pay[0] * 12), total: "sum" },
      ...(two ? [{ key: "p2", h: names[1] + "'s pay", fmt: "money", v: (y: Yr) => r0(y.pay[1] * 12), total: "sum" } as Col<Yr>] : []),
      { key: "oth", h: "Other income", fmt: "money", v: (y) => r0(y.other * 12), total: "sum" },
      { key: "inc", h: "Income", fmt: "money", f: (r, L) => `SUM(${L("p1")}${r}:${L("oth")}${r})`, res: (y) => (y.pay[0] + y.pay[1] + y.other) * 12, total: "sum", bold: true },
      { key: "tax", h: "Taxes", fmt: "money", v: (y) => r0(y.taxes * 12), total: "sum" },
      { key: "sp", h: "Spending", fmt: "money", v: (y) => r0(y.spending * 12), total: "sum" },
      { key: "t", h: "Traditional", fmt: "money", v: (y) => r0(y.saved.trad * 12), total: "sum" },
      { key: "r", h: "Roth and HSA", fmt: "money", v: (y) => r0((y.saved.roth + y.saved.hsa) * 12), total: "sum" },
      { key: "b", h: "Brokerage", fmt: "money", v: (y) => r0(y.saved.brok * 12), total: "sum" },
      { key: "ef", h: "Emergency fund", fmt: "money", v: (y) => r0(y.ef * 12), total: "sum" },
      { key: "m", h: "Employer match", fmt: "money", v: (y) => r0(y.match * 12), total: "sum" },
      { key: "sv", h: "All saved", fmt: "money", f: (r, L) => `SUM(${L("t")}${r}:${L("m")}${r})`, res: (y) => ys(y), total: "sum", bold: true },
      { key: "rt", h: "Savings rate", fmt: "pct", f: (r, L) => `IF(${L("inc")}${r}=0,0,${L("sv")}${r}/${L("inc")}${r})`, res: (y) => pctOf(ys(y), (y.pay[0] + y.pay[1] + y.other) * 12),
        total: (a, b, L) => `IF(SUM(${L("inc")}${a}:${L("inc")}${b})=0,0,SUM(${L("sv")}${a}:${L("sv")}${b})/SUM(${L("inc")}${a}:${L("inc")}${b}))` },
      { key: "bal", h: "Savings at year's start", fmt: "money", v: (y) => (path.has(y.age) ? r0(path.get(y.age)!) : null) },
    ], Y, { totalLabel: `All ${Y.length} years`, group: [{ label: "Coming in", from: "p1", to: "inc" }, { label: "Going out", from: "tax", to: "sp" }, { label: "Saved", from: "t", to: "rt" }], headHeight: 34 });
    s.ws.addConditionalFormatting({ ref: `${t.L("bal")}${t.first}:${t.L("bal")}${t.last}`, rules: [{ type: "dataBar", priority: 1, cfvo: [{ type: "num", value: 0 }, { type: "max" }], color: { argb: "FF5AA9E6" } } as never] });
    s.freeze(t.first, 3);
    if (Y.length) link.firstYearSaved = ref(N.years, t.c("sv"), t.first);
  }

  /* ======================= Retirement ======================= */
  {
    const s = S.retire, H = M.hist, at = M.save.atRetire;
    s.title(N.retire, sub, 15);
    s.section("When you retire", 15);
    s.kv("Retirement starts", M.yearOf(M.retire), "year", { note: two ? M.who.pair(M.retire) : "Age " + M.retire });
    const tr = s.kv("Traditional 401(k)s and IRAs", r0(at.trad), "money", { note: "Taxed as income when it comes out." });
    const ro = s.kv("Roth", r0(at.roth), "money", { note: "Tax-free." });
    const br = s.kv("Brokerage", r0(at.brok), "money", { note: "Taxed only on its gains." });
    link.atRetire = s.kv("Savings at retirement", fx(`SUM(${tr},${ro},${br})`, at.trad + at.roth + at.brok), "money", { bold: true });
    s.skip();
    s.section("How it's drawn down", 15, "Your withdrawal strategy, tested in every month's start since " + H.first + ": the chance of success is how often the money lasted to the end of the plan.");
    s.kv("Withdrawal strategy", H.strat?.name ?? "A fixed amount, rising with prices", "text");
    const fw = s.kv("First year's withdrawal from savings", r0(H.firstSpend), "money");
    s.kv("Starting withdrawal rate", fx(`IF(${link.atRetire}=0,0,${fw}/${link.atRetire})`, pctOf(H.firstSpend, at.trad + at.roth + at.brok)), "pct");
    if (M.R.goal != null) link.retSpend = s.kv("Spending in retirement, per month", r0(M.R.spend ?? M.R.goal), "money", { note: "After taxes." });
    if (!M.abroad && M.R.ss != null) link.ss = s.kv("Social Security, per month", r0(M.R.ss), "money", { note: M.R.ssYear ? "From " + M.R.ssYear : undefined });
    const ok = s.kv("Past starts that lasted", H.ok, "num");
    const of = s.kv("Past starts tested", H.of, "num");
    link.chance = s.kv("Chance of success", fx(`IF(${of}=0,0,${ok}/${of})`, H.ok / Math.max(1, H.of)), "pct", { bold: true });
    s.skip();
    // Year by year: the spread across past markets, and the plan's steady path.
    s.section("Year by year in retirement", 15, "Balances at each year's end across every past market (10th, middle, 90th percentile), and the steady path: the plan with average returns, where each year's money comes from and goes.");
    const band = new Map(H.band.map((b) => [b.age, b])), spB = new Map(H.spendBand.map((b) => [b.age, b]));
    type Rw = (typeof M.rows)[number];
    const rt = s.table<Rw>([
      { key: "age", h: "Age", fmt: "int", align: "center", v: (r) => r.age },
      { key: "yr", h: "Year", fmt: "year", v: (r) => M.yearOf(r.age) },
      { key: "lo", h: "10th", fmt: "money", v: (r) => (band.get(r.age + 1) ? r0(band.get(r.age + 1)!.lo) : null) },
      { key: "mid", h: "Middle", fmt: "money", v: (r) => (band.get(r.age + 1) ? r0(band.get(r.age + 1)!.mid) : null), bold: true },
      { key: "hi", h: "90th", fmt: "money", v: (r) => (band.get(r.age + 1) ? r0(band.get(r.age + 1)!.hi) : null) },
      { key: "sp", h: "Spending, middle", fmt: "money", v: (r) => (spB.get(r.age + 1) ? r0(spB.get(r.age + 1)!.mid) : null) },
      { key: "ss", h: "Social Security", fmt: "money", v: (r) => r0(r.ss), total: "sum" },
      { key: "pen", h: "Pension and pay", fmt: "money", v: (r) => r0(r.pension + (r.work ?? 0)), total: "sum" },
      { key: "tr", h: "From traditional", fmt: "money", v: (r) => r0(r.trad), total: "sum" },
      { key: "ro", h: "From Roth", fmt: "money", v: (r) => r0(r.roth), total: "sum" },
      { key: "br", h: "From brokerage", fmt: "money", v: (r) => r0(r.brok), total: "sum" },
      { key: "tx", h: "Taxes", fmt: "money", v: (r) => r0(r.tax + r.irmaa + r.pen), total: "sum" },
      { key: "hl", h: "Health premiums", fmt: "money", v: (r) => r0(r.health), total: "sum" },
      { key: "bal", h: "Savings at year's end", fmt: "money", v: (r) => r0(r.end) },
    ], M.rows, { totalLabel: "All years", group: [{ label: "Savings across past markets", from: "lo", to: "sp" }, { label: "The steady path", from: "ss", to: "bal" }], headHeight: 34 });
    s.ws.addConditionalFormatting({ ref: `${rt.L("mid")}${rt.first}:${rt.L("mid")}${rt.last}`, rules: [{ type: "dataBar", priority: 1, cfvo: [{ type: "num", value: 0 }, { type: "max" }], color: { argb: "FF4FBF95" } } as never] });
    // Every January start.
    s.section("Every past start", 15, "Retiring in January of each year the record covers: the lowest the savings fell, and what was left at the end (or the age it ran out).");
    type Rn = (typeof M.runs)[number];
    const pr = s.table<Rn>([
      { key: "y", h: "Start", fmt: "year", v: (r) => r.y },
      { key: "ok", h: "Lasted", align: "center", v: (r) => (r.ok ? "Yes" : "No"), ink: (r) => (r.ok ? C.gain : C.loss) },
      { key: "low", h: "Lowest", fmt: "money", v: (r) => r0(r.low) },
      { key: "la", h: "At age", fmt: "int", v: (r) => r.lowAge },
      { key: "end", h: "Left at the end", fmt: "money", v: (r) => (r.ok ? r0(r.end) : 0) },
      { key: "out", h: "Ran out at", fmt: "int", v: (r) => r.outAge ?? null },
    ], M.runs);
    s.ws.addConditionalFormatting({ ref: `${pr.L("end")}${pr.first}:${pr.L("end")}${pr.last}`, rules: [{ type: "colorScale", priority: 1, cfvo: [{ type: "min" }, { type: "percentile", value: 50 }, { type: "max" }], color: [{ argb: "FFFDE8EA" }, { argb: "FFFFFFFF" }, { argb: "FFE6F4EA" }] } as never] });
    s.freeze(5);
  }

  /* ======================= Retirement Taxes ======================= */
  if (S.taxes && D.tax) {
    const s = S.taxes, T = D.tax, rows = T.run.rows;
    s.title(N.taxes, sub, 15);
    s.section("Your tax plan", 15, "Your withdrawal strategy sets how much comes out of savings each year; the tax plan decides which accounts pay and how much traditional money to convert to Roth. Each year's tax comes out of that year's withdrawal.");
    s.kv("The plan", T.words, "text");
    s.kv("Market shown", `The median past market, like retiring in ${T.year}`, "text");
    s.skip();
    s.section("Against no conversions", 15);
    type Cm = [string, number, number, boolean];
    const cmp: Cm[] = [
      ["Tax over retirement", T.run.res.tax, T.base.res.tax, false],
      ["Spent over retirement", T.run.res.spent, T.base.res.spent, true],
      ["Left for heirs, after their tax", T.run.res.legacy, T.base.res.legacy, true],
      ["Converted to Roth", T.run.res.conv, T.base.res.conv, true],
      ["All of it, valued at the start of retirement", T.run.res.pv, T.base.res.pv, true],
    ];
    const ct = s.table<Cm>([
      { key: "t", h: "", v: (x) => x[0], span: 4 },
      { key: "a", h: T.converts ? "This plan" : "Your plan", fmt: "money", v: (x) => r0(x[1]) },
      { key: "b", h: "No conversions", fmt: "money", v: (x) => r0(x[2]) },
      { key: "d", h: "Difference", fmt: "money", f: (r, L) => `${L("a")}${r}-${L("b")}${r}`, res: (x) => x[1] - x[2], bold: true },
    ], cmp);
    s.ws.addConditionalFormatting({ ref: `${ct.L("d")}${ct.first}:${ct.L("d")}${ct.last}`, rules: [{ type: "cellIs", operator: "lessThan", priority: 1, formulae: ["0"], style: { font: { color: { argb: C.loss } } } } as never] });
    if (T.converts) s.note(`Valued at the start of retirement, this plan comes out ahead of no conversions in ${T.cmp.ahead} of ${T.cmp.of} past markets. Tax paid early could have stayed invested, so each year is valued back at what savings earned in that market.`, 15);
    s.skip();
    s.section("Year by year, in the median market", 15, "Spending is a formula: the withdrawal, Social Security and other income, less tax and premiums. The effective rate is tax as a share of everything that came in.");
    type Tr = (typeof rows)[number];
    const other = (r: Tr) => r.left - (r.out + r.ss - (r.tax + r.pen) - (r.irmaa + r.aca));
    const t = s.table<Tr>([
      { key: "yr", h: "Year", fmt: "year", v: (_r, i) => T.year0 + i },
      { key: "age", h: two ? "Ages" : "Age", align: "center", v: (r) => (r.age2 != null ? `${r.age} · ${r.age2}` : r.age) },
      { key: "w", h: "Withdrawal", fmt: "money", v: (r) => r0(r.out), total: "sum", bold: true },
      { key: "br", h: "From brokerage", fmt: "money", v: (r) => r0(r.brok), total: "sum" },
      { key: "tr", h: "From traditional", fmt: "money", v: (r) => r0(r.trad), total: "sum" },
      { key: "ro", h: "From Roth", fmt: "money", v: (r) => r0(r.roth), total: "sum" },
      { key: "rmd", h: "Required", fmt: "money", v: (r) => r0(r.rmd), total: "sum" },
      { key: "cv", h: "Converted", fmt: "money", v: (r) => r0(r.conv), total: "sum" },
      { key: "ti", h: "Taxable income", fmt: "money", v: (r) => r0(r.taxable) },
      { key: "tx", h: "Tax", fmt: "money", v: (r) => r0(r.tax + r.pen), total: "sum" },
      { key: "pm", h: "Premiums", fmt: "money", v: (r) => r0(r.irmaa + r.aca), total: "sum" },
      { key: "ss", h: "Social Security", fmt: "money", v: (r) => r0(r.ss), total: "sum" },
      { key: "oi", h: "Other income", fmt: "money", v: (r) => r0(other(r)), total: "sum" },
      { key: "sp", h: "Spending", fmt: "money", f: (r, L) => `${L("w")}${r}+${L("ss")}${r}+${L("oi")}${r}-${L("tx")}${r}-${L("pm")}${r}`, res: (r) => r.left, total: "sum", bold: true },
      { key: "er", h: "Effective rate", fmt: "pct", f: (r, L) => `IF((${L("w")}${r}+${L("ss")}${r}+${L("oi")}${r})=0,0,${L("tx")}${r}/(${L("w")}${r}+${L("ss")}${r}+${L("oi")}${r}))`, res: (r) => pctOf(r.tax + r.pen, r.out + r.ss + other(r)),
        total: (a, b, L) => `IF(SUM(${L("w")}${a}:${L("w")}${b})+SUM(${L("ss")}${a}:${L("ss")}${b})+SUM(${L("oi")}${a}:${L("oi")}${b})=0,0,SUM(${L("tx")}${a}:${L("tx")}${b})/(SUM(${L("w")}${a}:${L("w")}${b})+SUM(${L("ss")}${a}:${L("ss")}${b})+SUM(${L("oi")}${a}:${L("oi")}${b})))` },
    ], rows, { totalLabel: "All years", group: [{ label: "Where the withdrawal comes from", from: "br", to: "ro" }, { label: "Tax", from: "ti", to: "pm" }], headHeight: 34 });
    link.taxRet = ref(N.taxes, t.c("tx"), t.total ?? t.first);
    s.freeze(5);
  }

  /* ======================= Stress Tests ======================= */
  if (S.stress && M.stress) {
    const s = S.stress, X = M.stress;
    s.title(N.stress, sub, 6);
    s.section("If things go wrong", 6, "Your plan run again with one hard event added: the same strategy and every past market. Change the threshold and the verdicts follow.");
    const base = s.kv("Chance of success, as planned", X.base.rate, "pct", { bold: true });
    const thr = s.kv("Holds up if no more than this far below", 0.1, "pct0", { input: true });
    s.skip();
    type St = (typeof X.tests)[number];
    const when = (t: St) => (t.id === "ss" && t.ss ? Math.round(t.ss.share * 100) + "% of benefits paid" : t.year == null ? "" : `${t.year}, ${two || t.id === "work" ? t.who + " " : "age "}${t.age}`);
    const mid = (m: { end: number; outAge: number | null }) => (m.outAge != null ? "Runs out at " + m.outAge : "$" + (Math.round(m.end / 1000) * 1000).toLocaleString("en-US") + " left at the end");
    const tests = X.tests.filter((t) => t.id !== "market");
    const tt = s.table<St>([
      { key: "n", h: "If this happens", v: (t) => STRESS_NAMES[t.id] },
      { key: "w", h: "When, or how much", v: (t) => when(t) },
      { key: "c", h: "Chance of success", fmt: "pct", v: (t) => t.event?.rate ?? null },
      { key: "d", h: "Change", fmt: "pts", f: (r, L) => `ROUND((${L("c")}${r}-${base})*100,0)`, res: (t) => Math.round(((t.event?.rate ?? 0) - X.base.rate) * 100) },
      { key: "m", h: "Middle market", v: (t) => (t.event ? mid(t.event.mid) : "") },
      { key: "h", h: "Verdict", align: "center", f: (r, L) => `IF(${L("c")}${r}>=${base}-${thr}-0.0000001,"Holds up","Falls short")`, res: (t) => (t.holds ? "Holds up" : "Falls short") },
    ], tests);
    s.ws.addConditionalFormatting({ ref: `${tt.L("h")}${tt.first}:${tt.L("h")}${tt.last}`, rules: [
      { type: "containsText", operator: "containsText", text: "Holds", priority: 1, style: { font: { color: { argb: C.gain }, bold: true }, fill: { type: "pattern", pattern: "solid", bgColor: { argb: C.gainSoft } } } } as never,
      { type: "containsText", operator: "containsText", text: "Falls", priority: 2, style: { font: { color: { argb: C.loss }, bold: true }, fill: { type: "pattern", pattern: "solid", bgColor: { argb: C.lossSoft } } } } as never,
    ] });
    const life = tests.find((t) => t.id === "death");
    if (life) s.kv("Life insurance that would keep the chance after a death", X.cover == null ? "No sum tried is enough" : X.cover === 0 ? "None needed" : r0(X.cover), X.cover == null || X.cover === 0 ? "text" : "money", { note: "Paid in the year of the death." });
    const mk = X.tests.find((t) => t.id === "market");
    if (mk?.starts?.length) {
      s.skip();
      s.section("Retiring into a bad market", 6, "Your retirement started in January of a year that began a hard market.");
      type Bs = (typeof mk.starts)[number];
      s.table<Bs>([
        { key: "y", h: "Retiring in", fmt: "year", v: (b) => b.year },
        { key: "r", h: "Result", v: (b) => (b.outAge != null ? "Runs out at " + b.outAge : "Lasts"), ink: (b) => (b.outAge != null ? C.loss : C.gain) },
        { key: "e", h: "Left at the end", fmt: "money", v: (b) => (b.outAge != null ? 0 : r0(b.end)) },
      ], mk.starts);
    }
    link.stressHeld = `"${X.held} of ${X.of}"`;
  }

  /* ======================= Social Security ======================= */
  if (S.social && M.social) {
    const s = S.social, Ss = M.social;
    s.title(N.social, sub, 7);
    s.section("Your benefits", 7, `Per month, in today's dollars${Ss.pct < 100 ? `, at the ${Ss.pct}% of the full benefit your plan expects` : ""}.`);
    const people = [{ n: names[0], fra: Ss.fra1, pia: Ss.pia1, claim: Ss.claim1, a: Ss.a1 }, ...(two ? [{ n: names[1], fra: Ss.fra2 ?? 67, pia: Ss.pia2, claim: Ss.claim2, a: Ss.a2 }] : [])];
    s.table<(typeof people)[number]>([
      { key: "n", h: "Who", v: (p) => p.n },
      { key: "fra", h: "Full retirement age", v: (p) => (p.fra % 1 ? `${Math.floor(p.fra)} and ${Math.round((p.fra % 1) * 12)} months` : String(p.fra)), align: "right" },
      { key: "pia", h: "At full retirement age", fmt: "money", v: (p) => r0(p.pia) },
      { key: "c", h: "Claims at", fmt: "int", v: (p) => p.claim },
      { key: "m", h: "Per month then", fmt: "money", v: (p) => r0(p.a / 12), total: "sum" },
      { key: "y", h: "Per year", fmt: "money", f: (r, L) => `${L("m")}${r}*12`, res: (p) => p.a, total: "sum" },
    ], people, { totalLabel: "Household" });
    if (two) s.kv("If one of you dies, the survivor keeps the larger, per month", r0(Ss.survivor / 12), "money");
    s.skip();
    const ladder = (who: string, L: { age: number; v: number }[], fra: number) => {
      s.section(`When ${who === names[0] && !two ? "you claim" : who + " claims"}`, 7, "Each claiming age from 62 to 70, and the total paid by the age you live to: waiting pays more for life, claiming early pays for more years. The totals are formulas; the best column for you depends on how long you live.");
      const lt = s.table<{ age: number; v: number }>([
        { key: "age", h: "Claiming at", fmt: "int", align: "center", v: (x) => x.age },
        { key: "m", h: "Per month", fmt: "money", v: (x) => r0(x.v / 12) },
        { key: "y", h: "Per year", fmt: "money", f: (r, Lc) => `${Lc("m")}${r}*12`, res: (x) => x.v },
        { key: "vs", h: "Against full retirement age", fmt: "pct", f: () => "0" },
        { key: "p80", h: "Paid by 80", fmt: "money", f: (r, Lc) => `${Lc("y")}${r}*MAX(0,80-${Lc("age")}${r})`, res: (x) => x.v * Math.max(0, 80 - x.age) },
        { key: "p85", h: "Paid by 85", fmt: "money", f: (r, Lc) => `${Lc("y")}${r}*MAX(0,85-${Lc("age")}${r})`, res: (x) => x.v * Math.max(0, 85 - x.age) },
        { key: "p90", h: "Paid by 90", fmt: "money", f: (r, Lc) => `${Lc("y")}${r}*MAX(0,90-${Lc("age")}${r})`, res: (x) => x.v * Math.max(0, 90 - x.age) },
      ], L);
      const fraRow = lt.first + Math.max(0, L.findIndex((x) => x.age >= Math.round(fra)));
      for (let r = lt.first; r <= lt.last; r++) s.cell(lt.c("vs"), r).value = { formula: `IF($${lt.L("m")}$${fraRow}=0,0,${lt.L("m")}${r}/$${lt.L("m")}$${fraRow}-1)`, result: pctOf(L[r - lt.first].v, L[fraRow - lt.first].v) - 1 };
      for (const k of ["p80", "p85", "p90"]) s.ws.addConditionalFormatting({ ref: `${lt.L(k)}${lt.first}:${lt.L(k)}${lt.last}`, rules: [{ type: "top10", rank: 1, priority: 1, style: { font: { bold: true, color: { argb: C.gain } }, fill: { type: "pattern", pattern: "solid", bgColor: { argb: C.gainSoft } } } } as never] });
    };
    ladder(names[0], Ss.ladder1, Ss.fra1);
    if (two && Ss.ladder2.length) ladder(names[1], Ss.ladder2, Ss.fra2 ?? 67);
  }

  /* ======================= Assumptions ======================= */
  {
    const s = S.assume, pr = M.pr;
    s.title(N.assume, sub, 4);
    s.section("Your household", 4);
    const ppl = [pr.p1, ...(two ? [pr.p2] : [])];
    ppl.forEach((p, i) => {
      const nmI = names[i];
      if (p.by != null) {
        const b = s.kv(`${nmI}: born`, p.by, "year");
        s.kv(`${nmI}: age this year`, fx(`YEAR(TODAY())-${b}`, M.today.getFullYear() - p.by), "int");
        if (p.retire != null) s.kv(`${nmI}: retires`, fx(`${b}+${p.retire}`, p.by + p.retire), "year", { note: "At " + p.retire });
      }
    });
    s.kv("State", pr.state === "nonus" ? "Outside the US" : pr.state || "Not set", "text");
    s.kv("Filing", two ? "Married filing jointly" : "Single", "text");
    s.skip();
    s.section("Markets and money", 4, "The guesses about the future your plan runs on. Change them on your Dashboard's Profile.");
    s.kv("Growth before retiring, per year (before inflation)", pr.assume.growth, "pct");
    s.kv("Inflation, per year", pr.assume.inflation, "pct");
    s.kv("Mix once retired", M.mixWords, "text");
    s.kv("Withdrawal strategy", M.hist.strat?.name ?? "A fixed amount, rising with prices", "text");
    if (M.social) s.kv("Share of Social Security expected", (pr.ss.pct ?? 100) / 100, "pct0");
    if (D.tax) s.kv("Tax plan in retirement", D.tax.words, "text");
    s.kv("Emergency fund", `${M.spend.efMonths} months`, "text");
    if (M.assume) {
      s.skip();
      const BAND: Record<string, string> = { vcons: "very conservative", cons: "conservative", bal: "balanced", aggr: "aggressive", vaggr: "very aggressive" };
      s.section("How your assumptions compare", 4, `Against the balanced figures most planners use, your plan reads as ${BAND[M.assume.band] ?? M.assume.band}.`);
      type Ar = (typeof M.assume.rows)[number];
      s.table<Ar>([
        { key: "n", h: "Assumption", v: (x) => x.name },
        { key: "y", h: "Yours", v: (x) => x.yours, align: "right" },
        { key: "b", h: "Balanced", v: (x) => x.balanced, align: "right" },
        { key: "r", h: "Range", v: (x) => x.range, wrap: true },
      ], M.assume.rows);
    }
    s.skip();
    s.section("Data and method", 4);
    s.note(`Taxes use ${M.year0}'s federal and state rules, held in today's dollars (the $6,000 senior deduction only through 2028). Markets are U.S. stocks, bonds and inflation since 1926. Every figure is in today's dollars unless a column says otherwise. This is an educational tool, not financial or tax advice; past returns don't predict future ones.`, 4);
  }

  /* ======================= What If ======================= */
  buildWhatIf(S.whatif, M, link);

  /* ======================= Overview (last: it reads the others) ======================= */
  {
    const s = S.overview, R = M.R;
    s.title(M.who.title, `Your retirement plan · Prepared ${M.date} with RetCalc · Today's dollars`, 8);
    // Key figures: four cards a row, each a link to where it's worked out.
    type Card = { t: string; v: Val; fmt: "money" | "pct" | "months" | "text" | "int"; note: string };
    const cards: Card[] = [
      { t: "Net worth today", v: fx(link.net, M.worth.net), fmt: "money", note: "Net Worth" },
      { t: `Savings at retirement, ${M.yearOf(M.retire)}`, v: fx(link.atRetire, M.save.atRetire.trad + M.save.atRetire.roth + M.save.atRetire.brok), fmt: "money", note: "Retirement" },
      { t: "Chance of success", v: fx(link.chance, M.hist.ok / Math.max(1, M.hist.of)), fmt: "pct", note: "Retirement" },
      { t: "Readiness score", v: M.score ?? "–", fmt: "int", note: "Out of 100" },
      { t: "Spending once retired, per month", v: link.retSpend ? fx(link.retSpend, R.spend ?? R.goal ?? 0) : "–", fmt: "money", note: "After taxes" },
      { t: "Social Security, per month", v: link.ss ? fx(link.ss, R.ss ?? 0) : "–", fmt: "money", note: R.ssYear ? "From " + R.ssYear : "" },
      { t: "Savings rate", v: fx(link.rate, M.save.rate ?? 0), fmt: "pct", note: "Income & Saving" },
      { t: "Emergency fund", v: fx(link.efMonths, M.spend.efMonths > 0 && M.spend.efTarget > 0 ? (M.spend.cash ?? 0) / (M.spend.efTarget / M.spend.efMonths) : 0), fmt: "months", note: "Spending" },
    ];
    for (let row = 0; row < 2; row++) {
      const lr = s.r, vr = s.r + 1, nr = s.r + 2;
      s.ws.getRow(lr).height = 18; s.ws.getRow(vr).height = 30; s.ws.getRow(nr).height = 16;
      for (let k = 0; k < 4; k++) {
        const c = cards[row * 4 + k], c1 = s.c0 + k * 2;
        s.ws.mergeCells(lr, c1, lr, c1 + 1); s.ws.mergeCells(vr, c1, vr, c1 + 1); s.ws.mergeCells(nr, c1, nr, c1 + 1);
        s.put(c1, c.t, { r: lr, font: { size: 9.5, color: { argb: C.muted } }, fill: C.amberSoft });
        s.put(c1, c.v, { r: vr, fmt: c.fmt === "text" ? undefined : c.fmt, font: { size: 18, bold: true, color: { argb: row === 0 && k < 2 ? C.amber : C.ink } }, fill: C.amberSoft, align: { horizontal: "left" } });
        s.put(c1, c.note, { r: nr, font: { size: 9, color: { argb: C.faint } }, fill: C.amberSoft });
        for (const r of [lr, vr, nr]) for (const cc of [c1, c1 + 1]) s.cell(cc, r).border = { left: cc === c1 ? { style: "medium", color: { argb: C.headInk } } : undefined, right: cc === c1 + 1 ? { style: "medium", color: { argb: C.headInk } } : undefined };
      }
      s.r += 4;
    }
    // The plan in a few lines.
    s.section("Your plan in brief", 8);
    const p2Age = (a: number) => (M.who.pair(a).split(", ")[1] ?? "").replace(/^\D+/, "");
    const brief: string[] = [
      two ? `${names[0]} retires at ${M.retire} in ${M.yearOf(M.retire)}${M.r2 != null && M.r2 !== M.retire ? `, and ${names[1]} at ${p2Age(M.r2)} in ${M.yearOf(M.r2)}` : `, and ${names[1]} at ${p2Age(M.retire)}`}; the plan runs to ${names[0]}'s ${M.end}.`
        : `You retire at ${M.retire} in ${M.yearOf(M.retire)}; the plan runs to ${M.end}.`,
      `Withdrawals follow ${M.hist.strat?.name ?? "a fixed amount rising with prices"}; the money lasted in ${M.hist.ok} of ${M.hist.of} past starts.`,
      ...(D.tax ? [`Tax plan in retirement: ${D.tax.words.charAt(0).toLowerCase() + D.tax.words.slice(1)}.`] : []),
      ...(M.stress ? [`It holds up in ${M.stress.held} of ${M.stress.of} stress tests.`] : []),
    ];
    for (const b of brief) { s.ws.mergeCells(s.r, s.c0, s.r, s.c0 + 7); s.put(s.c0, "•  " + b, { font: { size: 11 } }); s.r++; }
    s.skip();
    // Milestones.
    s.section("Milestones", 8);
    type Stp = (typeof M.stops)[number];
    s.table<Stp>([
      { key: "y", h: "Year", fmt: "year", align: "left", v: (x) => M.yearOf(x.age) },
      { key: "a", h: M.who.axis, fmt: "int", align: "center", v: (x) => x.age },
      { key: "t", h: "What happens", v: (x) => x.t, bold: true, span: 2 },
      { key: "d", h: "", v: (x) => x.d, span: 4 },
    ], M.stops);
    // Readiness: each area's points, a formula total.
    if (M.score != null) {
      s.section("Readiness score", 8, "Five areas, weighted. The total is a formula over them.");
      type Ar = (typeof M.areas)[number];
      const pts = (a: Ar) => (a.part ? Math.round(a.part.p * a.w) : null);
      const at2 = s.table<Ar>([
        { key: "n", h: "Area", v: (a) => a.name, span: 2 },
        { key: "p", h: "Points", fmt: "int", v: (a) => pts(a), total: "sum" },
        { key: "w", h: "Out of", fmt: "int", v: (a) => (a.part ? a.w : null), total: "sum" },
        { key: "s", h: "Score", fmt: "pct0", f: (r, L) => `IF(${L("w")}${r}="","",${L("p")}${r}/${L("w")}${r})`, res: (a) => (a.part ? a.part.p : ""), total: (a, b, L) => `IF(SUM(${L("w")}${a}:${L("w")}${b})=0,0,SUM(${L("p")}${a}:${L("p")}${b})/SUM(${L("w")}${a}:${L("w")}${b}))`, totalRes: (M.score ?? 0) / 100 },
        { key: "h", h: "What would raise it", v: (a) => a.why.how[0] ?? (a.part ? "Full marks" : a.why.why), span: 3, wrap: true },
      ], M.areas);
      s.ws.addConditionalFormatting({ ref: `${at2.L("s")}${at2.first}:${at2.L("s")}${at2.last}`, rules: [{ type: "dataBar", priority: 1, cfvo: [{ type: "num", value: 0 }, { type: "num", value: 1 }], color: { argb: "FFE9B872" } } as never] });
      // The card shows the formula total.
      if (at2.total) s.cell(s.c0 + 6, 6).value = { formula: `${at2.L("p")}${at2.total}`, result: M.score };
    }
    // Next steps.
    const steps = M.steps.filter((x) => !x.done).slice(0, 6);
    if (steps.length) {
      s.section("What to do next", 8, "Ordered by how much each moves your plan.");
      s.table<(typeof steps)[number]>([
        { key: "i", h: "#", fmt: "int", align: "center", v: (_x, i) => i + 1 },
        { key: "t", h: "Step", v: (x) => x.title, bold: true, span: 3, wrap: true },
        { key: "w", h: "Why", v: (x) => x.why, span: 4, wrap: true },
      ], steps);
    }
    // Contents.
    s.section("In this workbook", 8);
    const toc: [string, string][] = [
      [N.worth, "What you own and owe, how it's taxed, and how it has changed"],
      [N.income, "Pay, taxes, where each month's pay goes, and saving line by line"],
      [N.spending, "Your budget, by item and group, and your emergency fund"],
      [N.years, "Every working year: pay, taxes, spending and saving by account"],
      [N.retire, "Savings at retirement, the strategy, and every year and past market"],
      ...(D.tax ? [[N.taxes, "Which accounts pay, Roth conversions, and the tax each year"] as [string, string]] : []),
      ...(M.stress ? [[N.stress, "How the plan holds up when hard things happen"] as [string, string]] : []),
      ...(M.social ? [[N.social, "Your benefits and every claiming age from 62 to 70"] as [string, string]] : []),
      [N.assume, "The household and the guesses about the future the plan runs on"],
      [N.whatif, "A model of your own: change the inputs and watch the plan move"],
    ];
    for (const [n, d] of toc) {
      s.ws.mergeCells(s.r, s.c0, s.r, s.c0 + 1);
      s.put(s.c0, { text: n, hyperlink: `#'${n}'!A1` } as unknown as Val, { font: { color: { argb: C.inInk }, underline: true } });
      s.ws.mergeCells(s.r, s.c0 + 2, s.r, s.c0 + 7);
      s.put(s.c0 + 2, d, { font: { color: { argb: C.muted } } });
      s.r++;
    }
    s.skip();
    s.note("Blue figures on yellow are inputs you can change; everything else is worked out. Figures come from your RetCalc Dashboard on the date above.", 8);
  }
}

/* ======================= What If ======================= */
function buildWhatIf(s: Sheet, M: WorkbookData["M"], link: Record<string, string>) {
  s.title("What If", "A model of your own: change any blue input and everything below follows · Today's dollars", 11);
  s.note("A simple projection at steady returns, for trying ideas. Your Dashboard's own figures test every past market and work out each year's tax, so they'll differ; use this to see which way, and how much, a change moves things.", 11);
  s.skip();
  const age0 = M.age0, ret = M.retire, end = M.end + 1;
  const total0 = Math.round(M.worth.H.trad + M.worth.H.roth + M.worth.H.brok);
  const sv = Math.round(M.F.invested + M.F.match);
  const g = M.pr.assume.growth, inf = M.pr.assume.inflation, realPre = Math.round(((1 + g) / (1 + inf) - 1) * 1000) / 1000;
  const atR = M.save.atRetire.trad + M.save.atRetire.roth + M.save.atRetire.brok;
  const ss = Math.round(M.R.ss ?? 0), ssAge = M.firstClaim < 200 ? M.firstClaim : 67;
  const spend = Math.round(M.R.spend ?? M.R.goal ?? 0);
  // The plan's own tax on what comes out of savings, over its steady path.
  const outT = M.rows.reduce((t, r) => t + r.trad + r.roth + r.brok, 0), taxT = M.rows.reduce((t, r) => t + r.tax + r.irmaa + r.pen, 0);
  const taxRate = Math.round(Math.min(0.3, Math.max(0.05, outT > 0 ? taxT / outT : 0.12)) * 1000) / 1000;
  const realPost = 0.035;
  s.section("Inputs", 2);
  const I = {
    age: s.kv("Your age today", age0, "int", { input: true }),
    ret: s.kv("Retire at age", ret, "int", { input: true }),
    end: s.kv("Plan to age", end, "int", { input: true }),
    bal: s.kv("Savings today", total0, "money", { input: true, note: "Retirement accounts and brokerage, not cash or home." }),
    sav: s.kv("Saving per month, with any match", sv, "money", { input: true }),
    grow: s.kv("Saving rises each year, beyond inflation", 0.01, "pct", { input: true }),
    rPre: s.kv("Return before retiring, after inflation", realPre, "pct", { input: true }),
    rPost: s.kv("Return once retired, after inflation", realPost, "pct", { input: true, note: "Usually lower: a safer mix." }),
    spend: s.kv("Spending once retired, per month", spend, "money", { input: true, note: "After taxes." }),
    tax: s.kv("Tax on withdrawals, about", taxRate, "pct", { input: true }),
    ss: s.kv("Social Security, per month", ss, "money", { input: true }),
    ssAge: s.kv("Social Security starts at age", ssAge, "int", { input: true }),
    other: s.kv("Other income once retired, per month", 0, "money", { input: true, note: "A pension, rent, part-time work." }),
  };
  s.skip();
  const Lr = (a: string) => a.replace(/^'[^']*'!/, "");
  const i = Object.fromEntries(Object.entries(I).map(([k, v]) => [k, Lr(v)])) as Record<keyof typeof I, string>;
  // The year table sits to the right of the inputs and results.
  // Inputs and results in B:E (label, value in D, a note in E); the year table from G.
  const T0 = 8, top = 6;
  const hdr = ["Age", "Start", "Saved", "Growth", "Spent, after tax", "Social Security and other", "Taken out, before tax", "End"];
  const fmts = ["int", "money", "money", "money", "money", "money", "money", "money"] as const;
  hdr.forEach((h, k) => {
    const cell = s.put(T0 + k - 1, h, { r: top, font: { bold: true, size: 10, color: { argb: C.headInk } }, fill: C.head, align: { horizontal: k ? "right" : "center", wrapText: true } });
    cell.border = { bottom: { style: "thin", color: { argb: C.head } } };
  });
  s.ws.getRow(top).height = 32;
  const rows = Math.max(1, end - age0 + 1), first = top + 1, last = top + rows;
  const cA = col(T0 - 1), cS = col(T0), cV = col(T0 + 1), cG = col(T0 + 2), cP = col(T0 + 3), cI = col(T0 + 4), cW = col(T0 + 5), cE = col(T0 + 6);
  // Projection rows (results are filled with the same arithmetic, for previews).
  let bal = total0, sav = sv, balAtRet = 0, wdAtRet = 0, lasts: number | null = null;
  for (let k = 0; k < rows; k++) {
    const r = first + k, a = age0 + k, retired = a >= ret;
    const savedY = retired ? 0 : sav * 12;
    const rr = retired ? realPost : realPre;
    const need = retired ? spend * 12 : 0, inc = retired ? (a >= ssAge ? ss * 12 : 0) : 0;
    const wd = retired ? Math.max(0, need - inc) / (1 - taxRate) : 0;
    const grow = (bal + savedY / 2 - wd / 2) * rr;
    const endB = Math.max(0, bal + savedY + grow - wd);
    const vals: Val[] = [
      k === 0 ? fx(i.age, a) : fx(`${cA}${r - 1}+1`, a),
      k === 0 ? fx(i.bal, bal) : fx(`${cE}${r - 1}`, bal),
      fx(`IF(${cA}${r}<${i.ret},${i.sav}*12*(1+${i.grow})^(${cA}${r}-${i.age}),0)`, savedY),
      fx(`(${cS}${r}+${cV}${r}/2-${cW}${r}/2)*IF(${cA}${r}<${i.ret},${i.rPre},${i.rPost})`, grow),
      fx(`IF(${cA}${r}>=${i.ret},${i.spend}*12,0)`, need),
      fx(`IF(${cA}${r}>=${i.ret},IF(${cA}${r}>=${i.ssAge},${i.ss}*12,0)+${i.other}*12,0)`, inc),
      fx(`IF(${cA}${r}>=${i.ret},MAX(0,${cP}${r}-${cI}${r})/(1-${i.tax}),0)`, wd),
      fx(`MAX(0,${cS}${r}+${cV}${r}+${cG}${r}-${cW}${r})`, endB),
    ];
    vals.forEach((v, k2) => {
      const cell = s.put(T0 + k2 - 1, v, { r, fmt: fmts[k2], fill: k % 2 ? C.band : undefined, font: { size: 10.5, bold: k2 === 7 }, align: { horizontal: k2 ? "right" : "center" } });
      cell.border = { bottom: { style: "thin", color: { argb: C.hair } } };
    });
    if (a === ret) { balAtRet = bal; wdAtRet = wd; }
    if (lasts == null && endB <= 0) lasts = a;
    bal = endB; sav = sav * 1.01;
  }
  s.ws.addConditionalFormatting({ ref: `${cE}${first}:${cE}${last}`, rules: [
    { type: "cellIs", operator: "lessThanOrEqual", formulae: ["0"], priority: 1, style: { font: { color: { argb: C.loss }, bold: true }, fill: { type: "pattern", pattern: "solid", bgColor: { argb: C.lossSoft } } } } as never,
    { type: "dataBar", priority: 2, cfvo: [{ type: "num", value: 0 }, { type: "max" }], color: { argb: "FFE9B872" } } as never,
  ] });
  s.ws.addConditionalFormatting({ ref: `${cA}${first}:${cA}${last}`, rules: [{ type: "expression", formulae: [`${cA}${first}=${i.ret}`], priority: 1, style: { font: { bold: true, color: { argb: C.amber } } } } as never] });
  // Results, under the inputs.
  s.section("What it comes to", 2);
  const rng = (c: string) => `${c}${first}:${c}${last}`;
  const atRet = s.kv("Savings at retirement", fx(`IFERROR(INDEX(${rng(cS)},MATCH(${i.ret},${rng(cA)},0)),0)`, balAtRet), "money", { bold: true });
  s.kv("Your Dashboard says", fx(link.atRetire, atR), "money", { note: "Every past market, real taxes." });
  const fwd = s.kv("First year's withdrawal, before tax", fx(`IFERROR(INDEX(${rng(cW)},MATCH(${i.ret},${rng(cA)},0)),0)`, wdAtRet), "money");
  s.kv("Starting withdrawal rate", fx(`IF(${Lr(atRet)}=0,0,${Lr(fwd)}/${Lr(atRet)})`, pctOf(wdAtRet, balAtRet)), "pct", { note: "About 4% is a common guide." });
  s.kv("Money lasts to age", fx(`IFERROR(INDEX(${rng(cA)},MATCH(0,${rng(cE)},0)),"Past "&${i.end})`, lasts ?? "Past " + end), "int", { bold: true });
  s.kv("Left at the end", fx(`INDEX(${rng(cE)},ROWS(${rng(cE)}))`, bal), "money");
  const nPay = end - ret + 1, carry = (realPost > 0 ? balAtRet * realPost / (1 - Math.pow(1 + realPost, -nPay)) / (1 + realPost) : balAtRet / nPay) * (1 - taxRate) / 12 + ss;
  s.kv("Spending it could carry, per month", fx(`IFERROR(-PMT(${i.rPost},${i.end}-${i.ret}+1,${Lr(atRet)},0,1)*(1-${i.tax})/12+${i.ss}+${i.other},0)`, carry), "money", { note: "Spends savings down to nothing by the end at the retired return, with Social Security and other income on top (counted from retirement)." });
  s.skip();
  // Sensitivity: savings at retirement for other returns and saving, under the year table.
  const deltas = [-500, 0, 500, 1000];
  const rets = [-0.02, -0.01, 0, 0.01, 0.02];
  const gr = last + 3;
  s.put(T0 - 1, "Savings at retirement for other returns (down) and saving (across)", { r: gr - 1, font: { bold: true, color: { argb: C.amber } } });
  const gHead = gr;
  s.put(T0 - 1, "", { r: gHead, fill: C.head });
  deltas.forEach((dd, k) => s.put(T0 + k, fx(`${i.sav}+(${dd})`, sv + dd), { r: gHead, fmt: "money", font: { bold: true, color: { argb: C.headInk } }, fill: C.head, align: { horizontal: "right" } }));
  rets.forEach((dr, j) => {
    const r = gHead + 1 + j;
    s.put(T0 - 1, fx(`${i.rPre}+(${dr})`, realPre + dr), { r, fmt: "pct", font: { bold: true }, fill: C.band, align: { horizontal: "center" } });
    deltas.forEach((_dd, k) => {
      const cc = col(T0 + k), rr = `$${col(T0 - 1)}${r}`, sav2 = `${cc}$${gHead}`, n = `(${i.ret}-${i.age})`;
      // Savings grown, plus a year's saving rising by `grow` each year, grown to retirement.
      const fvF = `${i.bal}*(1+${rr})^${n}+IF(ABS(${rr}-${i.grow})<0.000001,${sav2}*12*${n}*(1+${rr})^(${n}-1),${sav2}*12*((1+${rr})^${n}-(1+${i.grow})^${n})/(${rr}-${i.grow}))`;
      const rv = realPre + dr, sv2 = sv + deltas[k], nn = ret - age0, gg = 0.01;
      const fvR = total0 * Math.pow(1 + rv, nn) + (Math.abs(rv - gg) < 1e-6 ? sv2 * 12 * nn * Math.pow(1 + rv, nn - 1) : sv2 * 12 * (Math.pow(1 + rv, nn) - Math.pow(1 + gg, nn)) / (rv - gg));
      s.put(T0 + k, fx(fvF, fvR), { r, fmt: "money", font: { bold: dr === 0 && deltas[k] === 0, color: { argb: dr === 0 && deltas[k] === 0 ? C.amber : C.ink } }, align: { horizontal: "right" } });
    });
  });
  s.ws.addConditionalFormatting({ ref: `${col(T0)}${gHead + 1}:${col(T0 + deltas.length - 1)}${gHead + rets.length}`, rules: [{ type: "colorScale", priority: 1, cfvo: [{ type: "min" }, { type: "max" }], color: [{ argb: "FFFFFFFF" }, { argb: "FFFDF3E3" }] } as never] });
  s.freeze(6);
}
