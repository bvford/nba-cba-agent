# scripts/

One-off data fetch/processing scripts that build the JSON files in `data/`. These are run manually (or, for the two "fetch" scripts, monthly by `.github/workflows/refresh-players.yml`) — none of them run as part of `npm run dev` or `npm run build`.

## fetch-cba.ts

Downloads all NBA CBA article `.Rmd` files from the [atlhawksfanatic/NBA-CBA](https://github.com/atlhawksfanatic/NBA-CBA) GitHub repo (raw.githubusercontent.com), strips R Markdown/bookdown formatting, and writes the cleaned articles to `data/cba-articles.json`. No inputs required beyond network access.

Run with: `npm run fetch-cba` (or `npx tsx scripts/fetch-cba.ts`)
External source: `raw.githubusercontent.com/atlhawksfanatic/NBA-CBA`

## fetch-capsheets.ts

Scrapes every team's cap sheet page on capsheets.com (server-rendered HTML tables) and writes `data/teams.json` (v2 shape: `{fetchedAt, season, source, thresholds, exceptions, teams}`). Per team it captures: the active roster with salaries (plus player/team-option and non-guaranteed markers), dead money, total payroll, total salaries, luxury-tax threshold/space/repeater status, first- and second-apron space (negative = over), cap holds (kept separate from payroll), two-way players, and the exceptions ledger (MLE type + TPEs with expiry). League thresholds are parsed from the pages themselves (except the cap floor, which the site doesn't print — it's a verified constant in the script). Fetches are sequential with a 500 ms delay, and the script exits non-zero if fewer than 28 teams parse, roster counts disagree with the page's own header, or totals look implausible.

Run with: `npm run fetch-capsheets` (or `npx tsx scripts/fetch-capsheets.ts`)
External source: capsheets.com (scraped HTML)

## fetch-players.ts

Rebuilds `data/players.json` (v2 shape: `{fetchedAt, players}`) from two sources: rosters/teams/salaries from `data/teams.json` (capsheets — **run `fetch-capsheets` first**) and last season's per-player stats from nbaapi.com. Stats rows are matched to roster players by normalized name (diacritics stripped, punctuation removed, Jr./III suffixes dropped) and deduped to one row per player (traded players keep their combined-season stat line). Stats rows with no current roster match are kept with `team: null` and `notOnRoster: true` — never a stat-site pseudo-team like 2TM. Refuses to write if any roster looks wrong (duplicate names, non-canonical team codes, implausible roster sizes).

Run with: `npm run fetch-players` (or `npx tsx scripts/fetch-players.ts`)
Input: `data/teams.json` (from `fetch-capsheets`)
External source: nbaapi.com

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

Sanity-checks `data/players.json` and `data/teams.json` after a refresh — verifies exactly 30 teams with canonical abbreviations, plausible payrolls ($100M–$300M) and roster sizes (12–24 incl. two-ways), zero duplicate normalized player names, no 2TM-style pseudo-team codes, and that thresholds/exception amounts are present. Throws (non-zero exit) on any failure, so it's safe to use as a CI/workflow gate.

Run with: `npm run validate-data` (or `npx tsx scripts/validate-refresh-data.ts`)
Input: `data/players.json` and `data/teams.json` (run after `fetch-capsheets` + `fetch-players`)
