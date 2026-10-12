/**
 * Plain-language notes shown under each chart: what it measures, why it
 * matters for a housing downturn, and what to watch for. Keyed by FRED
 * series id or chart name.
 */
export type Explanation = { what: string; why: string; watch: string };

export const EXPLAIN: Record<string, Explanation> = {
  history: {
    what: "The composite score and the stage scores, stored once a day by the refresh job.",
    why: "A level tells you where things are; the slope tells you which way they're going. Leading stages should turn before lagging ones.",
    watch: "Financing and builder scores rising first, then demand and inventory, then prices. Credit following them confirms it.",
  },
  MORTGAGE30US: {
    what: "Freddie Mac's weekly average 30-year fixed rate for prime borrowers putting 20% down.",
    why: "Sets the monthly payment for every buyer. With most owners locked in at far lower rates, high rates mainly cut turnover (the lock-in effect).",
    watch: "Rates rising while the 10-year falls (spread widening), or a fast drop that thaws pent-up listings and sales.",
  },
  spread: {
    what: "30-year mortgage rate minus the 10-year Treasury yield. The pre-2022 norm was about 1.7 points.",
    why: "It's the price of mortgage risk: prepayment, credit and funding. Wide spreads mean lenders and MBS investors are nervous, or rate volatility is high.",
    watch: "A widening while Treasuries rally. That's how credit tightened in 2007–08 even as the Fed cut.",
  },
  sloos: {
    what: "Fed Senior Loan Officer Survey: net share of banks tightening standards on mortgages (positive = tightening), quarterly.",
    why: "Credit availability drives marginal buyers. Tightening came before the 2007 price decline.",
    watch: "Net tightening above +20% on GSE-eligible loans, or non-GSE (jumbo and QM) tightening sharply first.",
  },
  SUBLPDHMDENQ: {
    what: "Net share of banks reporting stronger demand for GSE-eligible mortgages, quarterly.",
    why: "MBA purchase applications aren't free; this is the closest public read on borrowing demand.",
    watch: "Deeply negative readings while rates are flat: buyers stepping back for reasons other than price.",
  },
  builders: {
    what: "Homebuilder stocks and the home-construction ETF rebased to 100, with the S&P 500 dashed.",
    why: "Builders sell into the new-home market with incentives instead of waiting. Their stocks price margin compression before it shows in earnings.",
    watch: "The group lagging the S&P while rates are flat, and the mortgage lender (RKT) following it down.",
  },
  itbspy: {
    what: "ITB (US home construction ETF) divided by SPY, weekly. Falling means builders underperform the market.",
    why: "One of the earliest market reads on housing demand. It peaked in 2005, well before prices did.",
    watch: "A falling ratio while builder sentiment also falls. Six-month declines of 20% or more have marked housing slowdowns.",
  },
  hmi: {
    what: "NAHB/Wells Fargo Housing Market Index: builders' rating of current sales, expected sales and buyer traffic. 50 = neutral.",
    why: "Builders see orders and cancellations in real time. The index leads housing starts by several months.",
    watch: "Readings in the low 30s or below with the share cutting prices above 40%. In 2007 it fell below 20.",
  },
  buildersTable: {
    what: "Cancellation rates, incentives and gross margins from the latest earnings reports, reviewed by hand.",
    why: "Cancellations show buyers walking from signed contracts. Incentives (rate buydowns, closing costs) are hidden price cuts that keep sticker prices up.",
    watch: "Cancellations above 20% of gross orders, incentives above 10% of revenue, and margins falling despite them.",
  },
  MSACSR: {
    what: "Months it would take to sell the current new-home inventory at the current sales pace.",
    why: "Above about 9 months, builders cut prices hard to clear spec homes. It hit 12 in early 2009.",
    watch: "Crossing 9 months, especially if completed homes for sale (not just under construction) drive it.",
  },
  HSN1F: {
    what: "New single-family homes sold, seasonally adjusted annual rate. Counted at contract signing.",
    why: "Records contracts, not closings, so it shows demand before existing-home sales do.",
    watch: "Sales falling while builders are already discounting: demand weakness, not just supply.",
  },
  EXHOSLUSM495S: {
    what: "Existing-home sales from NAR, annualized. FRED only keeps the last 13 months under NAR's license.",
    why: "Low turnover is the signature of a frozen market: few sellers, few buyers, prices holding.",
    watch: "Sales staying low while listings rise. That's sellers who must sell meeting buyers who won't pay.",
  },
  ACTLISCOUUS: {
    what: "Homes actively listed for sale on Realtor.com, monthly.",
    why: "Inventory is the bridge between a freeze and a decline. Prices fall when listings pile up faster than sales.",
    watch: "Inventory back above the 2017–19 norm nationally, and double-digit YoY growth in regions with weak job markets.",
  },
  NEWLISCOUUS: {
    what: "Listings that came on the market during the month (Realtor.com).",
    why: "New supply. Locked-in owners don't list unless they must, so a jump can reflect forced or motivated sellers.",
    watch: "New listings rising while sales fall.",
  },
  cutShare: {
    what: "Share of active listings with at least one price reduction (Realtor.com price-reduced count ÷ active listings).",
    why: "Seller stress shows up as cuts before it shows up in sale prices.",
    watch: "The share above the same month last year for several months in a row.",
  },
  MEDDAYONMARUS: {
    what: "Median days a listing stays on the market (Realtor.com).",
    why: "Homes sitting longer mean buyers are pulling back at current prices.",
    watch: "Days on market above last year's same month, especially with rising inventory.",
  },
  HOUST: {
    what: "New privately owned housing units started, seasonally adjusted annual rate.",
    why: "Builders cut starts when unsold inventory builds. Construction job losses follow.",
    watch: "Single-family starts falling while multifamily completions are still high.",
  },
  PERMIT: {
    what: "New housing units authorized by building permits, annualized.",
    why: "Permits come before starts, so they're the earlier read on builder pullback.",
    watch: "Permits down double digits year over year.",
  },
  payment: {
    what: "Principal and interest on the median-priced home with 20% down at the quarter's average 30-year rate, as a share of estimated median household income.",
    why: "Monthly payment, not price, decides what buyers can afford. Lenders cap total debt at about 43–50% of income.",
    watch: "Shares above 30%. Above about 25% has historically meant falling sales; insurance and taxes add several points on top.",
  },
  pti: {
    what: "Median sales price of houses sold ÷ estimated median household income. Income is the Census annual figure scaled monthly by average hourly earnings.",
    why: "A slow-moving valuation gauge. The mid-2000s peak was about 5.5x on this measure.",
    watch: "High readings plus falling sales. Valuation alone doesn't time a top.",
  },
  ptr: {
    what: "Case-Shiller national index ÷ CPI rent of primary residence, indexed to January 2000 = 100.",
    why: "When owning costs far more than renting, marginal buyers rent instead and investors see thin yields.",
    watch: "The ratio staying near its 2006 peak while rents keep rising slowly.",
  },
  CSUSHPINSA: {
    what: "S&P CoreLogic Case-Shiller US national home price index (repeat sales, not seasonally adjusted). Published with a two-month lag.",
    why: "The cleanest price measure, because it compares the same homes over time.",
    watch: "Year-over-year growth going negative. It turned negative in 2007, about a year after builders cracked.",
  },
  MSPUS: {
    what: "Median sales price of houses sold in the US (Census/HUD), quarterly.",
    why: "Includes new homes, so it reacts to builder price cuts faster than Case-Shiller, but it's mix-sensitive.",
    watch: "Two straight quarters of year-over-year declines.",
  },
  MEDLISPRIUS: {
    what: "Median asking price on Realtor.com, monthly.",
    why: "Asking prices adjust before closed prices.",
    watch: "Year-over-year declines in asking prices across many metros.",
  },
  DRSFRMACBS: {
    what: "Share of single-family residential mortgages held by commercial banks that are 30+ days delinquent, seasonally adjusted, quarterly.",
    why: "The crash confirmation. Banks hold mostly prime loans, so this moves late. FHA delinquencies (MBA, not free) crack first.",
    watch: "Two straight quarterly increases, or +0.15 points year over year, together with rising unemployment.",
  },
  foreclosures: {
    what: "Number of people with a new foreclosure on their credit report each quarter, in thousands (New York Fed Consumer Credit Panel/Equifax).",
    why: "Foreclosures turn delinquent borrowers into forced sellers and add distressed supply. They peaked near 550k a quarter in 2009 and nearly vanished during the 2020–21 moratoriums.",
    watch: "A climb back above the 2017–19 average with year-over-year growth over 25%. Foreclosures lag delinquencies by several quarters.",
  },
  seriousFlow: {
    what: "Annualized share of mortgage balances that became 90+ days delinquent in the quarter, across all lenders (NY Fed/Equifax).",
    why: "Broader than the bank-only delinquency rate: it includes FHA, VA and non-bank loans, where stress shows first.",
    watch: "A rise of a quarter point or more from a year earlier. It ran near 1% in 2017–19 and above 8% in 2009.",
  },
  stateForeclosures: {
    what: "Share of consumers with a new foreclosure in the quarter, for the states the NY Fed reports (dashed: US).",
    why: "Busts start local. In 2007–09 Nevada, Arizona, Florida and California led by a wide margin.",
    watch: "Florida or Texas pulling away from the national line.",
  },
  combo: {
    what: "Mortgage delinquency rate (left) and unemployment rate (right) since 1991.",
    why: "2008 was forced selling: job losses plus bad loans meeting falling prices. Both lines rose together from 2007.",
    watch: "Both lines turning up at the same time. That's what turns a frozen market into a falling one.",
  },
  UNRATE: {
    what: "Civilian unemployment rate, monthly.",
    why: "Forced sellers come from job losses. Owners with equity and fixed low rates rarely have to sell otherwise.",
    watch: "A rise of half a point or more from the 12-month low (the Sahm rule).",
  },
  SAHMREALTIME: {
    what: "Three-month average unemployment rate minus its low over the prior 12 months.",
    why: "Crossing 0.5 has coincided with the start of every US recession since 1970.",
    watch: "Readings above 0.3, then 0.5.",
  },
  ICSA: {
    what: "Initial claims for unemployment insurance, weekly.",
    why: "The fastest read on layoffs.",
    watch: "The 4-week average rising 15–30% year over year.",
  },
  DGS10: {
    what: "10-year Treasury constant-maturity yield, daily.",
    why: "Mortgage rates are priced off it plus the spread.",
    watch: "Yield spikes that push mortgage rates to new cycle highs.",
  },
  T10Y2Y: {
    what: "10-year minus 2-year Treasury yield, daily.",
    why: "An inverted curve has preceded recessions; the un-inversion often comes as layoffs start.",
    watch: "A quick re-steepening from inversion driven by falling short rates (the Fed cutting into weakness).",
  },
  RRVRUSQ156N: {
    what: "Share of rental units that are vacant, quarterly (Census Housing Vacancy Survey).",
    why: "Rising vacancies push rents down, which lowers the price-to-rent ceiling and squeezes investors who bought to rent.",
    watch: "Vacancy climbing above 7.5% while new multifamily supply is still delivering.",
  },
  CUUR0000SEHD: {
    what: "CPI for tenants' and household insurance, national (not seasonally adjusted).",
    why: "Insurance is part of the true monthly cost. In Florida, premium increases and condo special assessments have hit owners hardest.",
    watch: "Continued double-digit increases. National CPI understates Florida and Gulf Coast premiums.",
  },
  regions: {
    what: "Each region's inventory, price cuts, days on market and asking prices from Realtor.com, plus state unemployment and FHFA prices, scored 0–100 on fixed thresholds.",
    why: "Busts start local. National data can look fine while Florida or Texas inventory surges.",
    watch: "Inventory well above the 2017–19 norm with rising price-cut shares, especially where unemployment is also rising.",
  },
};
