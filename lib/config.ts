// Everything the dashboard tracks lives here, so adding a ticker, a FRED
// series or a region is a one-line change.

export const REVALIDATE_SECONDS = 60 * 60 * 24;
export const CACHE_TAG = "housing-data";

/**
 * The order a housing bust usually shows up in. Sections on the page and
 * stages in the composite follow it top to bottom.
 */
export const STAGES = [
  { id: "financing", label: "Financing", short: "1 · Financing", lead: "leading", weight: 1.5 },
  { id: "builders", label: "Builders", short: "2 · Builders", lead: "leading", weight: 1.5 },
  { id: "supply", label: "Demand & inventory", short: "3 · Demand & inventory", lead: "coincident", weight: 1.25 },
  { id: "affordability", label: "Affordability", short: "4 · Affordability", lead: "coincident", weight: 1 },
  { id: "prices", label: "Prices", short: "5 · Prices", lead: "lagging", weight: 0.75 },
  { id: "credit", label: "Credit stress", short: "6 · Credit stress", lead: "lagging", weight: 1 },
  { id: "macro", label: "Macro triggers", short: "7 · Macro triggers", lead: "trigger", weight: 1 },
] as const;

export type StageId = (typeof STAGES)[number]["id"];

export type FredSeries = {
  id: string;
  title: string;
  unit: "%" | "$" | "k" | "M" | "" | "idx" | "days" | "mo";
  stage: StageId | "context";
  /** Years of history to fetch (default 12: ten years for the z-score plus a YoY buffer). */
  years?: number;
  /** Fetched only as an input to a derived chart or signal, not shown as its own card. */
  hidden?: boolean;
  /** Reference lines drawn on the chart. */
  refs?: { y: number; label: string; tone: "calm" | "stress" | "watch" }[];
};

export const FRED_SERIES: FredSeries[] = [
  // 1. Financing
  { id: "MORTGAGE30US", title: "30-year mortgage rate (Freddie Mac)", unit: "%", stage: "financing", years: 31 },
  { id: "DGS10", title: "10-year Treasury yield", unit: "%", stage: "macro" },
  { id: "SUBLPDHMSENQ", title: "Banks tightening GSE-eligible mortgage standards (net %)", unit: "%", stage: "financing", refs: [{ y: 0, label: "neutral", tone: "watch" }] },
  { id: "SUBLPDHMSQNQ", title: "Banks tightening non-GSE (QM) mortgage standards (net %)", unit: "%", stage: "financing", refs: [{ y: 0, label: "neutral", tone: "watch" }] },
  { id: "SUBLPDHMDENQ", title: "Banks reporting stronger mortgage demand (net %)", unit: "%", stage: "financing", refs: [{ y: 0, label: "neutral", tone: "watch" }] },
  // 3. Demand & supply
  { id: "HSN1F", title: "New home sales (SAAR)", unit: "k", stage: "supply" },
  { id: "MSACSR", title: "Months' supply of new homes", unit: "mo", stage: "supply", refs: [{ y: 9, label: "warning", tone: "stress" }, { y: 6, label: "balanced", tone: "watch" }] },
  { id: "EXHOSLUSM495S", title: "Existing home sales (SAAR, NAR; FRED keeps 13 months)", unit: "M", stage: "supply" },
  { id: "ACTLISCOUUS", title: "Active listings (Realtor.com)", unit: "", stage: "supply" },
  { id: "NEWLISCOUUS", title: "New listings (Realtor.com)", unit: "", stage: "supply" },
  { id: "PRIREDCOUUS", title: "Listings with a price cut (Realtor.com)", unit: "", stage: "supply", hidden: true },
  { id: "MEDDAYONMARUS", title: "Median days on market (Realtor.com)", unit: "days", stage: "supply" },
  { id: "MEDLISPRIUS", title: "Median list price (Realtor.com)", unit: "$", stage: "prices" },
  { id: "HOUST", title: "Housing starts (SAAR)", unit: "k", stage: "supply" },
  { id: "PERMIT", title: "Building permits (SAAR)", unit: "k", stage: "supply" },
  // 4. Affordability inputs
  { id: "MEHOINUSA646N", title: "Median household income (nominal)", unit: "$", stage: "affordability", years: 30, hidden: true },
  { id: "CES0500000003", title: "Average hourly earnings", unit: "$", stage: "affordability", years: 25, hidden: true },
  { id: "CUSR0000SEHA", title: "CPI: rent of primary residence", unit: "idx", stage: "affordability", years: 30, hidden: true },
  { id: "CUUR0000SEHD", title: "CPI: tenants' & household insurance", unit: "idx", stage: "context" },
  // 5. Prices
  { id: "CSUSHPINSA", title: "Case-Shiller US national home price index", unit: "idx", stage: "prices", years: 30 },
  { id: "MSPUS", title: "Median sales price of houses sold", unit: "$", stage: "prices", years: 30 },
  // 6. Credit
  { id: "DRSFRMACBS", title: "Mortgage delinquency rate (banks, SA)", unit: "%", stage: "credit", years: 36 },
  { id: "RRVRUSQ156N", title: "Rental vacancy rate", unit: "%", stage: "context" },
  { id: "RHORUSQ156N", title: "Homeownership rate", unit: "%", stage: "context" },
  // 7. Macro
  { id: "UNRATE", title: "Unemployment rate", unit: "%", stage: "macro", years: 36 },
  { id: "SAHMREALTIME", title: "Sahm rule recession indicator", unit: "%", stage: "macro", years: 30, refs: [{ y: 0.5, label: "recession", tone: "stress" }] },
  { id: "ICSA", title: "Initial jobless claims (weekly)", unit: "", stage: "macro" },
  { id: "T10Y2Y", title: "Yield curve (10y − 2y)", unit: "%", stage: "macro", refs: [{ y: 0, label: "inverted", tone: "stress" }] },
];

export type TickerGroup = { id: string; title: string; tickers: { symbol: string; name: string }[] };

export const BUILDERS: TickerGroup = {
  id: "builders",
  title: "Homebuilders",
  tickers: [
    { symbol: "ITB", name: "Home construction ETF" },
    { symbol: "XHB", name: "Homebuilders ETF" },
    { symbol: "DHI", name: "D.R. Horton" },
    { symbol: "LEN", name: "Lennar" },
    { symbol: "PHM", name: "PulteGroup" },
    { symbol: "NVR", name: "NVR" },
    { symbol: "TOL", name: "Toll Brothers" },
    { symbol: "KBH", name: "KB Home" },
    { symbol: "RKT", name: "Rocket (mortgages)" },
    { symbol: "SPY", name: "S&P 500" },
  ],
};

/**
 * Regional drill-down. Realtor.com publishes the same series per state
 * (two-letter code) and per metro (CBSA code) on FRED. States also get
 * their unemployment rate and FHFA house price index.
 */
export type Region = { code: string; name: string; kind: "state" | "metro"; state: string };

export const REGIONS: Region[] = [
  { code: "US", name: "United States", kind: "state", state: "US" },
  { code: "FL", name: "Florida", kind: "state", state: "FL" },
  { code: "TX", name: "Texas", kind: "state", state: "TX" },
  { code: "AZ", name: "Arizona", kind: "state", state: "AZ" },
  { code: "CO", name: "Colorado", kind: "state", state: "CO" },
  { code: "CA", name: "California", kind: "state", state: "CA" },
  { code: "GA", name: "Georgia", kind: "state", state: "GA" },
  { code: "NC", name: "North Carolina", kind: "state", state: "NC" },
  { code: "SC", name: "South Carolina", kind: "state", state: "SC" },
  { code: "TN", name: "Tennessee", kind: "state", state: "TN" },
  { code: "NV", name: "Nevada", kind: "state", state: "NV" },
  { code: "UT", name: "Utah", kind: "state", state: "UT" },
  { code: "ID", name: "Idaho", kind: "state", state: "ID" },
  { code: "WA", name: "Washington", kind: "state", state: "WA" },
  { code: "NY", name: "New York", kind: "state", state: "NY" },
  { code: "IL", name: "Illinois", kind: "state", state: "IL" },
  { code: "OH", name: "Ohio", kind: "state", state: "OH" },
  { code: "33100", name: "Miami", kind: "metro", state: "FL" },
  { code: "45300", name: "Tampa", kind: "metro", state: "FL" },
  { code: "36740", name: "Orlando", kind: "metro", state: "FL" },
  { code: "27260", name: "Jacksonville", kind: "metro", state: "FL" },
  { code: "15980", name: "Cape Coral–Fort Myers", kind: "metro", state: "FL" },
  { code: "35840", name: "North Port–Sarasota", kind: "metro", state: "FL" },
  { code: "12420", name: "Austin", kind: "metro", state: "TX" },
  { code: "19100", name: "Dallas–Fort Worth", kind: "metro", state: "TX" },
  { code: "26420", name: "Houston", kind: "metro", state: "TX" },
  { code: "41700", name: "San Antonio", kind: "metro", state: "TX" },
  { code: "38060", name: "Phoenix", kind: "metro", state: "AZ" },
  { code: "19740", name: "Denver", kind: "metro", state: "CO" },
  { code: "12060", name: "Atlanta", kind: "metro", state: "GA" },
  { code: "34980", name: "Nashville", kind: "metro", state: "TN" },
  { code: "29820", name: "Las Vegas", kind: "metro", state: "NV" },
  { code: "16740", name: "Charlotte", kind: "metro", state: "NC" },
  { code: "39580", name: "Raleigh", kind: "metro", state: "NC" },
];

export const NEWS_FEEDS = [
  { id: "market", title: "Housing market", query: '"housing market" (slowdown OR crash OR correction OR inventory)' },
  { id: "rates", title: "Mortgage rates & applications", query: '"mortgage rates" OR "mortgage applications" OR "purchase applications"' },
  { id: "builders", title: "Homebuilders: incentives & cancellations", query: 'homebuilder (incentives OR cancellations OR "price cuts" OR earnings)' },
  { id: "credit", title: "Delinquencies & foreclosures", query: '"mortgage delinquencies" OR "foreclosure filings" OR "FHA delinquency" OR ATTOM foreclosure' },
  { id: "florida", title: "Florida: condos & insurance", query: 'Florida ("condo assessments" OR "special assessment" OR "home insurance" OR "condo reserves" OR "Citizens Property Insurance" OR "condo market") -site:realtor.com -site:zillow.com -site:redfin.com' },
  { id: "texas", title: "Texas & Sun Belt inventory", query: '(Texas OR Austin OR Phoenix OR Florida) housing inventory "price cuts"' },
];

// SEC-style descriptive User-Agent, also polite for NAHB.
export const CONTACT_USER_AGENT =
  process.env.SEC_USER_AGENT ?? "Housing Market Monitor housing-market-monitor@users.noreply.github.com";
