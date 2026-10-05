/* Shapes of what the engine returns, for the TypeScript screens that read
   them. The engine itself stays plain JavaScript (moved unchanged); these
   describe it and grow as each tool is ported. */

export interface MortgageInput {
  price: number; down: number; rate: number; term: number; taxPct: number; ins: number;
  pmiPct: number; hoa: number; maintPct: number; util: number;
  extraMonthly: number; extraOnce: number; extraOnceMonth: number; recast: boolean;
  refiOn?: boolean; refiRate?: number; refiTerm?: number; refiCost?: number;
}

export interface MortgageYear { year: number; interest: number; principal: number; paid: number; balance: number; pmi: number }

export interface MortgageResult {
  loan: number; pi: number; tax: number; ins: number; pmi: number; hoa: number; maint: number; util: number;
  total: number; years: MortgageYear[]; totalInterest: number; pmiPaid: number; ltv: number; n: number;
  payoffMonth: number; pmiEndMonth: number | null; recastPI: number | null; extraActive: boolean;
}

export interface RefiResult {
  now: MortgageResult; then: MortgageResult; monthlyDelta: number;
  breakEvenMonths: number | null; lifetimeDelta: number;
}
