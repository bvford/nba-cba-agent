# AGENTS.md

This file provides guidance to AI coding agents (Codex, and others) working in this repository.

## What This App Is

ChatCBA is an AI-powered NBA salary cap assistant. Users ask questions about CBA rules, player contracts, trades, and roster strategy. The app uses retrieval-augmented generation (RAG) — it searches static JSON data files and injects relevant context into Claude's system prompt before each response.

## Commands

```bash
npm run dev         # Start development server with hot reload
npm run build       # Build for production
npm start           # Run production server

# Data scripts (run as needed to refresh data)
npm run fetch-cba                    # Download CBA articles from GitHub
npm run fetch-capsheets              # Refresh team cap data from capsheets.com (run FIRST)
npm run fetch-players                # Refresh player rosters/salaries (from teams.json) + stats (nbaapi.com)
npm run validate-data                # Sanity-check the refreshed JSON
npx tsx scripts/process-cba101.ts    # Rebuild educational content
npx tsx scripts/process-guide.ts     # Rebuild guide summaries
```

There are no lint or test scripts configured.

## Environment Variables

**Required:**
- `ANTHROPIC_API_KEY` — Claude API key

**Optional (falls back to in-memory if missing):**
- `UPSTASH_REDIS_REST_URL` — Upstash Redis for distributed rate limiting & response caching
- `UPSTASH_REDIS_REST_TOKEN` — Upstash auth token

## Architecture

### Request Flow

```
Browser (React chat UI)
  → localStorage: chat history (max 50 chats, via src/lib/chat-store.ts)
  → POST /api/chat
      1. Rate limit check: 20 req/IP/day (Upstash Redis or in-memory)
      2. Cache lookup: hash of recent messages → cached response if hit
      3. CBA retrieval: keyword search across articles, guide, cba101 (src/lib/cba-search.ts)
      4. Player lookup: search players.json for any mentioned player names
      5. Message trimming: keep last 8 turns to control token cost
      6. System prompt injection: inject retrieved context into Claude's system prompt
      7. Streaming response via Anthropic SDK (SSE)
      8. Cache response for 6 hours
  → Streamed text rendered in ChatMessage component
```

### Key Files

| File | Purpose |
|------|---------|
| `src/app/api/chat/route.ts` | Core backend: rate limiting, CBA retrieval, Claude calls |
| `src/lib/cba-search.ts` | Keyword-based search across CBA data; adaptive retrieval profiles |
| `src/lib/upstash.ts` | Redis wrapper; gracefully degrades to in-memory if not configured |
| `src/lib/chat-store.ts` | localStorage chat persistence (client-side only) |
| `data/*.json` | Static JSON data — CBA articles (1.3 MB), guide, cba101, players, teams |
| `scripts/` | One-off data fetch/processing scripts; run manually to update data |

### Retrieval System

`cba-search.ts` runs keyword matching across five data sources: `cba-articles.json`, `cba-guide.json`, `cba101.json`, `players.json`, and `teams.json`. When a team is mentioned, `searchTeams()` injects that team's payroll, dead money, cap holds, luxury-tax/apron status (with exact over/under space), two-way players, and its exceptions ledger. The retrieval profile (how many tokens, which sources) adapts based on query type.

The Claude model id is configured in `src/lib/config.ts` (`MODEL_ID`).

### Data Updates

The `data/` JSON files are committed to the repo and served statically. To update them, run the fetch scripts and commit the new JSON. Player data and CBA articles are separate fetches.

**Team cap data (authoritative):** `fetch-capsheets.ts` scrapes each team's cap sheet on **capsheets.com** (server-rendered HTML tables) and writes `data/teams.json` (v2 shape: `{fetchedAt, season, source, thresholds, exceptions, teams}`). Each team entry has the active roster with salaries and option/non-guaranteed notes, dead money, total payroll, total salaries, luxury-tax space + repeater flag, first/second apron space (negative = over — these fields, not raw payroll comparisons, determine apron status), cap holds (separate from payroll), two-way players, and exceptions (MLE + TPEs with expiry).

**Player data:** `fetch-players.ts` (run *after* `fetch-capsheets`) rebuilds `data/players.json` (v2 shape: `{fetchedAt, players}`). Rosters, team assignments, and 2026-27 salaries come from `data/teams.json`; last season's stats come from nbaapi.com, matched by normalized name (diacritics stripped, suffixes dropped) and deduped to one row per player. Stats rows with no roster match keep `team: null` + `notOnRoster: true` — never a stat-site pseudo-team like 2TM. Do not add hard-coded team overrides — fix data issues by re-running the fetch scripts instead.

**Automated refresh:** `.github/workflows/refresh-players.yml` runs `fetch-capsheets.ts` then `fetch-players.ts` on the 1st of each month at 8am UTC, validates, commits changes, and pushes. No API keys required.

## UI Design

**For any UI work on this project**, read `.claude/skills/SKILL.md` and `.claude/skills/components.md` before generating or modifying UI code. These files contain the design system rules, component best practices, and anti-patterns to avoid.

The current visual style is a retro 90s NBA / premium sports-product aesthetic. Styles live in `src/app/globals.css` (Tailwind + custom CSS) and component-level Tailwind classes.
