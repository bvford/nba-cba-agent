# scripts/

One-off data fetch/processing scripts that build the JSON files in `data/`. These are run manually (or, for the two "fetch" scripts, monthly by `.github/workflows/refresh-players.yml`) — none of them run as part of `npm run dev` or `npm run build`.

## fetch-cba.ts

Downloads all NBA CBA article `.Rmd` files from the [atlhawksfanatic/NBA-CBA](https://github.com/atlhawksfanatic/NBA-CBA) GitHub repo (raw.githubusercontent.com), strips R Markdown/bookdown formatting, and writes the cleaned articles to `data/cba-articles.json`. No inputs required beyond network access.

Run with: `npm run fetch-cba` (or `npx tsx scripts/fetch-cba.ts`)
External source: `raw.githubusercontent.com/atlhawksfanatic/NBA-CBA`

## fetch-players.ts

Refreshes `data/players.json` with current rosters, stats, and salary/contract data. Merges three sources in priority order: BallDontLie (authoritative for current team assignments, requires `BALLDONTLIE_API_KEY`), HoopsHype (scraped for salary/contract data), and nbaapi.com (season stats). If BallDontLie's rate limit is hit mid-run, the script stops gracefully after 4 consecutive failures and keeps whatever it collected — rerun later for full coverage.

Run with: `npm run fetch-players` (or `npx tsx scripts/fetch-players.ts`)
Requires: `BALLDONTLIE_API_KEY` environment variable
External sources: BallDontLie API, HoopsHype (scraped), nbaapi.com

## fetch-teams.ts

Scrapes Spotrac's `/nba/cap/_/year/2025` page (server-rendered HTML table) and writes `data/teams.json` with per-team payroll, cap space, league-wide thresholds (cap floor, salary cap, first/second apron), and exception amounts (MLE, biannual, etc.). Can be run any time to pull current numbers.

Run with: `npm run fetch-teams` (or `npx tsx scripts/fetch-teams.ts`)
External source: Spotrac (scraped HTML)

## process-cba101.ts

**Currently not runnable — source input file missing; kept for reference.**

Parses a raw text dump of the CBA 101 FAQ (expected at `data/cba101-raw.txt`) into structured Q&A sections and writes `data/cba101.json`. The raw source text is not checked into this repo, so the script will throw a file-not-found error until that input is supplied.

Run with: `npx tsx scripts/process-cba101.ts`
Input: `data/cba101-raw.txt` (not present in repo — must be sourced/created manually)

## process-guide.ts

**Currently not runnable — source input file missing; kept for reference.**

Splits a markdown export of the cbaguide.com site into sections (by `#`/`##` headings) and writes `data/cba-guide.json`. Takes the path to the markdown file as a CLI argument (it no longer has a hardcoded path) — the script exits with a usage message if no argument is given. No copy of the source markdown is checked into this repo.

Run with: `npx tsx scripts/process-guide.ts <path-to-cbaguide-markdown-file>`
Input: a markdown export of cbaguide.com (not present in repo — must be sourced manually, e.g. saved from a browser export)

## validate-refresh-data.ts

Sanity-checks `data/players.json` and `data/teams.json` after a refresh — verifies minimum player/team counts, that players have stats and salary data, that team cap thresholds and exception amounts are present, and that team rows aren't missing/duplicated. Throws (non-zero exit) on any failure, so it's safe to use as a CI/workflow gate.

Run with: `npm run validate-data` (or `npx tsx scripts/validate-refresh-data.ts`)
Input: `data/players.json` and `data/teams.json` (run after `fetch-players`/`fetch-teams`)
