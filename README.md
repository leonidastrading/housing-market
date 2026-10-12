# Housing Market Monitor

A one-page Next.js dashboard of US housing stress, ordered by timing. A housing bust usually shows up in this order:
**financing → builders → demand & inventory → prices → defaults**, so leading signals sit at the top and confirmation at the bottom.

It refreshes once a day on Vercel and needs no API keys.

## What's on the page

| Section | What it shows | Source |
| --- | --- | --- |
| Stress level | One gauge: 26 signals, each a z-score vs. its own 10-year history, mapped to 0–100 and weighted toward leading stages. Green < 40, yellow 40–59, red ≥ 60 | derived |
| Forced-selling check | Flags when mortgage delinquencies and unemployment rise together: the combination that turns a frozen market into a falling one | FRED, NY Fed |
| 1 · Financing | 30-year mortgage rate, mortgage spread over the 10-year, Fed senior loan officer survey (tightening and demand) | FRED (Freddie Mac, Fed) |
| 2 · Builders | Builder stocks vs. S&P, ITB/SPY ratio, NAHB builder sentiment with the share of builders cutting prices and using incentives, cancellation and incentive table from earnings | Yahoo Finance, NAHB, `data/builders.json` |
| 3 · Demand & supply | New home sales, months' supply, existing sales, active and new listings, price-cut share, days on market, starts, permits | FRED (Census, NAR, Realtor.com) |
| 4 · Affordability | Payment on the median home as a share of median income, price-to-income, price-to-rent | derived from FRED |
| 5 · Prices | Case-Shiller national YoY, median sales price, median list price | FRED |
| 6 · Credit stress | Bank mortgage delinquency rate, delinquencies vs. unemployment since 1991, new foreclosures per quarter, mortgages newly 90+ days late across all lenders, foreclosure rates by state | FRED, NY Fed household debt report (Equifax) |
| 7 · Macro triggers | Unemployment, Sahm rule, jobless claims, 10-year yield, 10y−2y curve, rental vacancy | FRED |
| Regional drill-down | 16 states and 17 metros: inventory vs. last year and vs. the 2017–19 norm, price cuts, days on market, list prices, state unemployment and FHFA prices, with a region picker for charts | FRED (Realtor.com, BLS, FHFA) |
| Florida | Florida metros, household insurance CPI, condo and insurance news | FRED, Google News |
| News | Six Google News searches over the last 7 days | Google News RSS |

Series, regions and news queries live in `lib/config.ts`; signal definitions and weights in `lib/signals.ts`.

## How the score works

- Each signal is transformed where needed (year-over-year change for seasonal series such as listings, a ratio for ITB/SPY, a spread for mortgage minus 10-year), then z-scored against its last 10 years of monthly observations. The sign is flipped where lower is worse, so a positive z always means more stress.
- z maps to 0–100: −1σ → 0, 0 → 33, +1σ → 67, +2σ → 100.
- Signals average within each stage; stages average with weights: financing and builders 1.5×, demand & inventory 1.25×, prices 0.75×, the rest 1×.
- Five signals use fixed thresholds instead: the Sahm rule and jobless claims (the 2020 spike swamps a 10-year σ), new foreclosures and the 90+ flow (2020–21 moratoriums and forbearance), and NAHB's price-cut share (no published history). The table shows each signal's basis.
- Regions use fixed thresholds too; Realtor.com local data starts in 2016.

## Updating the builder table

`data/builders.json` holds the latest cancellation rate, incentive load and gross margin per builder from earnings releases, each with a source link. Update it after each earnings season and push; Vercel redeploys on push.

## Not automated

MBA weekly purchase applications, FHA delinquencies (MBA National Delinquency Survey) and ATTOM monthly foreclosure filings are paywalled. Foreclosures come instead from the New York Fed's free quarterly household debt report (people with a new foreclosure on their credit report); the fetcher picks up each new report automatically. The page covers them with news feeds and uses the Fed's bank-reported mortgage demand as a free proxy for purchase applications.

## How the daily refresh works

- The page is statically generated with `revalidate = 86400`, and every upstream fetch is cached under one tag.
- `vercel.json` schedules a cron job at 22:00 UTC daily that calls `/api/refresh`. It clears the cache tag, re-fetches everything, saves a snapshot and rebuilds the page.
- Feeds fail independently. If one is down, its card says so and the rest of the page still renders. Failures are listed at the bottom of the page.

### Optional: score history

FRED series carry their own history; the composite and stage scores don't. Connect a **private Vercel Blob** store (Storage → Create → Blob) to record a daily snapshot. The score-history chart appears after the second run.

### Optional environment variables

- `CRON_SECRET`: if set, `/api/refresh` only accepts requests carrying it. Vercel Cron sends it automatically.
- `SEC_USER_AGENT`: contact User-Agent sent to NAHB, for example `"Your Name you@example.com"`.

## Develop

```bash
npm install
npm run dev        # http://localhost:3000
npm run typecheck
npm run build
```

Not investment advice. The composite score is a heuristic, not a forecast.
