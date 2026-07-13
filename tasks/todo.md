# ChatCBA Overhaul — July 2026

## Context

First-ever vibe-coded project, untouched for months. Three goals, in order:
1. **Clean up** the codebase (it works, but it's sloppy — audits confirmed).
2. **Improve the product** — chat stays the hero but gets richer answers; add browsable team cap-sheet pages. Competitive references: Over the Apron (overtheapron.com, CBA-cited trade verdicts), CapMVP, CBA Guide (great reference content, but NO chatbot — chat is our differentiator).
3. **Redesign completely** — current look is generic dark-SaaS with a broken wide-viewport layout and AI-clipart logo. Direction: my call ("surprise me"). Aim: people are wowed.

Live site: chatcba.vercel.app · Repo: github.com/bvford/nba-cba-agent · Deploys via Vercel on push to main.

---

## Phase 1 — Cleanup (no behavior changes)

### Repo hygiene
- [x] Delete stray `.claude/worktrees/crazy-swanson/` leftover worktree
- [x] Add `tsconfig.tsbuildinfo` to `.gitignore`
- [x] Fix `AGENTS.md` (broken sed copy: "Codex API key", "Codex's system prompt" → should mirror CLAUDE.md correctly)
- [x] Move `cheerio` to devDependencies
- [x] Add ESLint (next/core-web-vitals) + `npm run lint`
- [x] Delete or fix orphaned scripts: `process-cba101.ts` (missing input file), `process-guide.ts` (hardcoded ~/Downloads path) — document what they were for in scripts/README

### Backend (src/app/api, src/lib)
- [x] Create `src/lib/config.ts`: rate limit, cache TTL, model ID (env-overridable), retrieval caps — single source of truth (currently duplicated between chat route and health route)
- [x] `cba-search.ts`: precompute document sections at module load (currently re-split on EVERY request); dedupe copy-pasted player-matching logic; remove dead exports (`searchCBA`, `getCBAToc`); centralize PHX/PHO normalization; fix 4-vs-5 sources truncation mismatch
- [x] `route.ts`: convert if/else regex chain (`getRetrievalProfile`) to ordered config table; add zod input validation on `/api/chat` and `/api/events` (size limits!); handle Anthropic stream errors distinctly (429 vs overloaded vs generic)
- [ ] Stamp `fetchedAt` in `players.json` (teams.json has it, players doesn't) and expose a `/api/meta` or import for dynamic freshness display — **not done yet**: `players.json` is a bare array (no top-level metadata slot); `data-meta.ts` currently only reads `teams.fetchedAt`. Needs `fetch-players.ts` updated to wrap output as `{ fetchedAt, players: [...] }` plus every consumer of the array updated to unwrap it.

### Frontend (src/app, src/components)
- [x] Decompose 606-line `page.tsx`: `Hero`, `FeatureCards`, `ExampleQuestions` components + `useChat` hook; content arrays to `src/lib/content.ts` (now 117 lines; landing pieces in `src/components/landing/`, chat logic in `src/lib/use-chat.ts`)
- [x] Replace regex-markdown + dangerouslySetInnerHTML with `react-markdown` + `remark-gfm` (gets us TABLES — critical for contract data)
- [x] Replace hand-rolled SSE parsing with chunk-boundary-safe parsing (`eventsource-parser`)
- [x] Single source-links module (currently duplicated in ChatMessage, Sidebar, About) — `src/lib/sources.ts`
- [x] Replace `window.alert`/`window.confirm` with styled toast + confirm dialog
- [x] Real error states: distinguish rate-limit vs server error, retry button, remove nonsense "check your API key" copy
- [x] Accessibility pass: aria-labels on all icon buttons, focus-visible rings, min 12px text, touch-visible action buttons (no hover-only opacity)
- [x] Fix mobile navigation dead-end (About/Privacy/Terms unreachable mid-chat)
- [x] Replace hardcoded "Feb 17, 2026" freshness date with dynamic value

### Verify Phase 1
- [x] `npm run build` + lint clean
- [x] Drive app end-to-end in browser: send question, get streamed answer, sources render, history persists — confirmed 2026-07-13 via sandboxed Browser pane dev server: asked "What is the mid-level exception?", got a streamed markdown answer with headers/bold/bullets, source chips, and the chat appeared in history.

## Phase 2 — Product upgrades

- [ ] Model upgrade: `claude-sonnet-4-5` → current Sonnet (env-configurable via config.ts)
- [ ] System prompt: instruct model to use markdown tables for contract/cap breakdowns (now renderable)
- [ ] Citations: source chips name the CBA article/section, link out where possible (CBA Guide-style credibility)
- [ ] **Team pages**: `/teams` index (30 logos/cards, cap standing at a glance) + `/teams/[abbr]` detail — payroll table from players.json, distance-to-thresholds meter (cap → tax → apron 1 → apron 2), available exceptions, data-freshness stamp. Static data, fast, linkable.
- [ ] Chat ↔ teams cross-linking: mention a team in chat → "View cap sheet" chip; team page → "Ask about this team" prefill
- [ ] Refresh example questions/starter modes for 2026 offseason relevance

## Phase 3 — Full redesign ("surprise me")

Direction: **"Front Office" — broadcast-bold meets editorial craft.** Dark courtside base (deep ink, not pure black), one hot accent (basketball orange), condensed display type for numbers/headlines (scoreboard DNA) + clean humanist body, real data-table styling like broadcast lower-thirds, subtle texture/grain. Kill the AI-clipart logo → clean wordmark + simple mark. Motion polish using apple-design principles (emilkowalski/skills — the one you bookmarked).

- [ ] Design tokens in globals.css (type scale, spacing, colors) — rebuilt from scratch
- [ ] New landing: real hook (live thresholds strip, sample Q→A demo), no clipart
- [ ] Chat redesign: message hierarchy, source chips, thinking state, composer
- [ ] Team pages designed as broadcast-style cap sheets (the "wow" screens)
- [ ] Sidebar/history redesign
- [ ] Fix wide-viewport layout bug (content pinned left with dead space)
- [ ] Responsive: mobile-first pass on every screen
- [ ] Meta: OG images, favicon, title/description for sharing

## Phase 4 — Verify & ship

- [ ] Build + lint + validate-data
- [ ] Browser E2E: desktop + mobile viewports, screenshots shared in chat
- [ ] Logical commits (plain-language messages), push, confirm Vercel deploy healthy
- [ ] Post-deploy smoke test on chatcba.vercel.app

## Execution notes

- Fable orchestrates + reviews; implementation delegated to Sonnet/Opus subagents (one focused task each). Codex MCP as fallback executor if Claude limits run low.
- Phase 1 lands as its own commit(s) before redesign starts — keeps "cleanup" reviewable separately from "new look."

## Review

**2026-07-13 (automated resume run):** Found Phase 1 substantially implemented but uncommitted in the working tree (config.ts, cba-search.ts precompute/dedup, zod validation, distinct stream error handling, page.tsx decomposed to 117 lines with landing/ components and use-chat.ts hook, react-markdown+remark-gfm, eventsource-parser, toast/confirm dialog, a11y pass, dynamic freshness date). Verified `npm run build` passes and drove the app live in the sandboxed Browser pane dev server (no EPERM issue this run) — sent a real question, got a streamed markdown answer with sources and working chat history. Checked off all Phase 1 items except the `players.json fetchedAt` stamp, which genuinely isn't done (needs a data-shape change plus consumer updates — left as-is to avoid a risky unreviewed schema change; flagged in Phase 1 backend list above). Committed Phase 1 as its own commit, then continued into Phase 2 (see below).

---
