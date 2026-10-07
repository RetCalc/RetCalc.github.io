/* The nineteen lessons against doc 2's table ("The lessons, in one list"),
   which is the checklist: each lesson sits on its card, names the glossary
   terms the table names (and each exists in lib/glossary.ts), and links
   the tools the table names. Doc 1's success table: "Every lesson links
   out ... a test over the step declarations". */
import { test } from "node:test";
import assert from "node:assert/strict";
import { GLOSS } from "@/lib/glossary";
import { LESSONS } from "../lessons/index";
import { STEPS } from "../steps/decl";

// Doc 2's table: lesson, card, terms, tools ("—" is none).
const TABLE: [number, string, string, string[], string[]][] = [
  [1, "two-clocks", "about", ["Full retirement age"], []],
  [2, "take-home", "income", ["Take-home pay"], ["Income Tax"]],
  [3, "keystone", "spending", [], ["Budget"]],
  [4, "months", "cash", ["Emergency fund"], ["Budget"]],
  [5, "eight-percent", "debt", ["APR"], ["Debt Payoff"]],
  [6, "order", "debt", ["Employer match"], []],
  [7, "housing", "goals", ["PITI"], ["Mortgage Calculator", "College Savings"]],
  [8, "time", "savings", ["Compound growth"], ["Basic calculator", "Stages"]],
  [9, "real-returns", "invested", ["Real return"], ["Portfolio Backtest"]],
  [10, "buckets", "accounts", ["Roth", "Traditional", "Cost basis"], ["Advanced"]],
  [11, "not-flat", "changes", ["Stage"], ["Stages", "College Savings"]],
  [12, "eighty", "retspend", ["Replacement rate"], ["Budget"]],
  [13, "wait", "social", ["PIA", "Spousal benefit"], ["Plan Optimizer"]],
  [14, "income-sources", "number", ["Safe withdrawal rate"], ["Basic calculator", "Stages"]],
  [15, "sequence", "lasting", ["Sequence-of-returns risk"], ["Drawdown Simulator"]],
  [16, "levers", "adjust", [], ["Stages", "FIRE Calculator"]],
  [17, "flexible", "strategy", ["Guardrails", "VPW"], ["Drawdown Simulator"]],
  [18, "cliff", "health", ["ACA", "MAGI"], ["Healthcare Cost Planner"]],
  [19, "ways-across", "bridge", ["Roth ladder", "72(t)", "Rule of 55"], ["Early Retirement Bridge"]],
];

test("nineteen lessons, each as doc 2's table has it", () => {
  assert.equal(LESSONS.length, 19);
  for (const [n, id, card, terms, tools] of TABLE) {
    const L = LESSONS.find((x) => x.id === id);
    assert.ok(L, id);
    assert.equal(L!.n, n, id);
    assert.equal(L!.card, card, id);
    assert.deepEqual(L!.terms.map((t) => t.label), terms, id + " terms");
    assert.deepEqual(L!.tools.map((t) => t.name), tools, id + " tools");
  }
});

test("every term a lesson names is in the glossary", () => {
  for (const L of LESSONS) for (const t of L.terms) assert.ok(GLOSS[t.key], L.id + ": " + t.key);
});

test("every lesson is taught by its card, and every card teaches a lesson that exists", () => {
  for (const L of LESSONS) {
    const st = STEPS.find((s) => s.id === L.card);
    assert.ok(st, L.id + " sits on " + L.card);
    assert.ok(st!.teaches?.includes(L.id), L.card + " declares " + L.id);
  }
  for (const s of STEPS) for (const id of s.teaches ?? []) assert.ok(LESSONS.some((L) => L.id === id), s.id + " teaches " + id);
  // and every lesson links out: a term, a tool, or both, as the table allows
  for (const L of LESSONS) assert.ok(L.terms.length + L.tools.length > 0, L.id);
});
