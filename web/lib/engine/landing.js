/* The strategy pages (/4-percent-rule, /guardrails, /vpw and the rest)
   open the Drawdown Simulator on their strategy, with the article's worked
   example: a retirement starting each January, as the research tested, and
   the portfolio whatever it already is. The tests check the articles'
   figures against these. Moved from src/js/app/15e-drawdown-research.js. */
export var DD_LANDING = {
  "4-percent-rule": {starts: "year", strategy: "fixed", rate: 4, stock: 60, sv: 0, cash: 0, stockEnd: "", years: 30},
  guardrails: {starts: "year", strategy: "guardrails", rate: 5, stock: 60, sv: 0, cash: 0, stockEnd: "", years: 30,
    guardBand: 20, adjust: 10, guardBandLo: 20, adjustLo: 10, gkFinal: false, skipRaise: false},
  vpw: {starts: "year", strategy: "vpw", stock: 60, sv: 0, cash: 0, stockEnd: "", years: 35, retireAge: "65", vpwRate: 3.8, vpwFV: 0},
  "vanguard-dynamic-spending": {starts: "year", strategy: "vanguard", rate: 5, vgCeil: 5, vgFloor: 2.5, stock: 60, sv: 0, cash: 0, stockEnd: "", years: 30},
  "risk-based-guardrails": {starts: "year", strategy: "riskgr", rgTarget: 90, rgLo: 70, rgHi: 99, stock: 60, sv: 0, cash: 0, stockEnd: "", years: 30},
  "rmd-withdrawal-strategy": {starts: "year", strategy: "rmd", stock: 60, sv: 0, cash: 0, stockEnd: "", years: 30, retireAge: "65"},
  "ratcheting-withdrawal": {starts: "year", strategy: "kitces", rate: 4, kitThresh: 50, kitRaise: 10, kitGap: 3, skipRaise: false,
    stock: 60, sv: 0, cash: 0, stockEnd: "", years: 30},
  "cape-withdrawal": {starts: "year", strategy: "cape", capeA: 1.75, capeB: 0.5, stock: 60, sv: 0, cash: 0, stockEnd: "", years: 30}
};
