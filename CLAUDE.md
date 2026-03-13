# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This App Is

ChatCBA is an AI-powered NBA salary cap assistant. Users ask questions about CBA rules, player contracts, trades, and roster strategy. The app uses retrieval-augmented generation (RAG) — it searches static JSON data files and injects relevant context into Claude's system prompt before each response.

## Commands

```bash
npm run dev         # Start development server with hot reload
npm run build       # Build for production
npm start           # Run production server

# Data scripts (run as needed to refresh data)
npm run fetch-cba                  # Download CBA articles from GitHub
tsx scripts/fetch-players.ts       # Refresh player stats & salaries
tsx scripts/process-cba101.ts      # Rebuild educational content
tsx scripts/process-guide.ts       # Rebuild guide summaries
```

There are no lint or test scripts configured.

## Environment Variables

**Required:**
- `ANTHROPIC_API_KEY` — Claude API key

**Required for player data refresh:**
- `BALLDONTLIE_API_KEY` — BallDontLie API key (free tier); used by `fetch-players.ts` as the authoritative source for current team assignments

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
| `data/*.json` | Static JSON data — CBA articles (1.3 MB), guide, cba101, players |
| `scripts/` | One-off data fetch/processing scripts; run manually to update data |

### Retrieval System

`cba-search.ts` runs keyword matching against four data sources: `cba-articles.json`, `cba-guide.json`, `cba101.json`, and `players.json`. The retrieval profile (how many tokens, which sources) adapts based on query type — rules questions get more article depth than quick definitions.

The Claude model used is configured in `src/app/api/chat/route.ts` (currently `claude-sonnet-4-5-20250929`).

### Data Updates

The `data/` JSON files are committed to the repo and served statically. To update them, run the fetch scripts and commit the new JSON. Player data and CBA articles are separate fetches.

**Player team accuracy:** `fetch-players.ts` uses three sources merged in priority order:
1. **BallDontLie** (free tier) — authoritative for current team assignments; paginated, rate-limited to ~30 req/min
2. **HoopsHype scraping** — salary/contract data per season
3. **nbaapi.com** — season stats

If BallDontLie hits its rate limit mid-fetch, it stops gracefully after 4 consecutive failures and uses what it collected. Run the script again in a few hours to get full coverage. Do not add hard-coded team overrides — fix data issues by re-running the fetch script instead.

## UI Design

**For any UI work on this project**, read `.claude/skills/SKILL.md` and `.claude/skills/components.md` before generating or modifying UI code. These files contain the design system rules, component best practices, and anti-patterns to avoid.

The current visual style is a retro 90s NBA / premium sports-product aesthetic. Styles live in `src/app/globals.css` (Tailwind + custom CSS) and component-level Tailwind classes.
