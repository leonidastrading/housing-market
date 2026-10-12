import raw from "@/data/builders.json";

export type BuilderReport = {
  symbol: string;
  name: string;
  quarter: string;
  periodEnd: string;
  reported: string;
  cancellation: number | null;
  cancellationPrior: number | null;
  cancellationBasis: string;
  incentives: number | null;
  incentivesPrior: number | null;
  grossMargin: number | null;
  grossMarginPrior: number | null;
  comment: string;
  source: string;
};

export const BUILDER_REPORTS = raw as { reviewed: string; note: string; builders: BuilderReport[] };
