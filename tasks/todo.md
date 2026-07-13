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

- [x] Model upgrade: `claude-sonnet-4-5` → current Sonnet (env-configurable via config.ts) — default is now `claude-sonnet-5`; bumped `CACHE_SCHEMA_VERSION` too so old cached answers from the previous model don't linger.
- [x] System prompt: instruct model to use markdown tables for contract/cap breakdowns (now renderable) — verified live: asking about a team's cap situation now returns a real markdown table.
- [x] Citations: source chips name the CBA article/section, link out where possible (CBA Guide-style credibility) — already implemented in `src/lib/sources.ts`/`ChatMessage.tsx`, confirmed working.
- [x] **Team pages**: `/teams` index (30 team cards, cap standing at a glance) + `/teams/[abbr]` detail — payroll table from players.json, distance-to-thresholds meter (cap → apron 1 → apron 2), available exceptions, data-freshness stamp. Static data, prerendered at build time (`generateStaticParams`), fast, linkable. No team logos exist in the repo so cards use text/abbreviation badges instead — avoids inventing image assets or NBA trademark-logo hotlinking.
- [x] Chat ↔ teams cross-linking: mention a team in chat → "View cap sheet" chip (verified: asking about Boston Celtics rendered a working `→ /teams/BOS` chip); team page → "Ask about this team" link at `/?ask={abbr}` auto-sends a natural question in chat (verified end-to-end in browser).
- [x] Refresh example questions/starter modes for 2026 offseason relevance — swapped the stale "What extension can the Thunder offer SGA?" (he already signed a supermax through 2029-30) for an evergreen apron-mechanics question; kept the LeBron free-agency question since he's genuinely a free agent as of this offseason (empty `salaries` in players.json, still active per games/stats).

### Bonus fix found during Phase 2 (not on the original list, but blocking real visual quality)
- [x] **Fixed a real, repo-wide Tailwind bug**: every existing `bg-[--color-x]` / `text-[--color-x]` / `border-[--color-x]` bracket-syntax class (121 occurrences across 14 files) compiled to invalid CSS (`background-color: --color-x`, missing the `var()` wrapper) — Tailwind v4 only auto-wraps CSS variables in the newer `(--color-x)` parens syntax, not old-style square brackets. This was masked because `body` sets working color/background defaults via plain CSS and a couple of CTAs use literal hex colors, so the app didn't look broken, but panels, hover states, and borders app-wide were silently not getting their intended shades. Mechanically replaced every instance with the correct parens syntax; confirmed via compiled CSS output and a live browser check that raised panels/hovers/borders now render distinctly. Logged as a lesson in `tasks/lessons.md`.

## Phase 3 — Full redesign ("surprise me")

Direction: **"Front Office" — broadcast-bold meets editorial craft.** Dark courtside base (deep ink, not pure black), one hot accent (basketball orange), condensed display type for numbers/headlines (scoreboard DNA) + clean humanist body, real data-table styling like broadcast lower-thirds, subtle texture/grain. Kill the AI-clipart logo → clean wordmark + simple mark. Motion polish using apple-design principles (emilkowalski/skills — the one you bookmarked).

- [x] Design tokens in globals.css (type scale, spacing, colors) — rebuilt from scratch
- [x] New landing: real hook (live thresholds strip, sample Q→A demo), no clipart
- [x] Chat redesign: message hierarchy, source chips, thinking state, composer
- [x] Team pages designed as broadcast-style cap sheets (the "wow" screens)
- [x] Sidebar/history redesign
- [x] Fix wide-viewport layout bug (content pinned left with dead space)
- [x] Responsive: mobile-first pass on every screen
- [x] Meta: OG images, favicon, title/description for sharing

## Phase 4 — Verify & ship

- [x] Build + lint + validate-data
- [x] Browser E2E: desktop + mobile viewports, screenshots shared in chat
- [x] Logical commits (plain-language messages), push, confirm Vercel deploy healthy
- [x] Post-deploy smoke test on chatcba.vercel.app

## Execution notes

- Fable orchestrates + reviews; implementation delegated to Sonnet/Opus subagents (one focused task each). Codex MCP as fallback executor if Claude limits run low.
- Phase 1 lands as its own commit(s) before redesign starts — keeps "cleanup" reviewable separately from "new look."

## Review

**2026-07-13 (automated resume run):** Found Phase 1 substantially implemented but uncommitted in the working tree (config.ts, cba-search.ts precompute/dedup, zod validation, distinct stream error handling, page.tsx decomposed to 117 lines with landing/ components and use-chat.ts hook, react-markdown+remark-gfm, eventsource-parser, toast/confirm dialog, a11y pass, dynamic freshness date). Verified `npm run build` passes and drove the app live in the sandboxed Browser pane dev server (no EPERM issue this run) — sent a real question, got a streamed markdown answer with sources and working chat history. Checked off all Phase 1 items except the `players.json fetchedAt` stamp, which genuinely isn't done (needs a data-shape change plus consumer updates — left as-is to avoid a risky unreviewed schema change; flagged in Phase 1 backend list above). Committed and pushed Phase 1 as its own commit, then moved into Phase 2.

**Phase 2, same run:** Did the quick items directly (model default → `claude-sonnet-5`, cache-version bump, a markdown-table formatting instruction in the system prompt, refreshed one stale example question). Delegated the big item — the `/teams` index + `/teams/[abbr]` detail pages, the shared `teams-meta.ts` refactor, and both directions of chat↔teams cross-linking — to a Sonnet subagent with a detailed spec; reviewed its diff, verified the `searchTeams()` refactor was byte-identical (so chat answers didn't silently change), and drove the whole feature live in the browser: `/teams` index renders all 30 teams with color-coded apron badges, a team detail page shows a real threshold meter + payroll table, the "Ask about this team" link correctly auto-sends a question in chat, and the reply came back with a markdown table matching the team page's numbers plus a working "View cap sheet" chip back to `/teams/BOS`. Also caught and fixed a real, previously-invisible bug along the way: 121 instances of broken Tailwind `bg-[--color-x]` bracket syntax (produces invalid CSS, silently drops the color) across 14 files, repo-wide — see `tasks/lessons.md` for how this was verified (compiled CSS output, not just a screenshot) and fixed. All of Phase 2 is now checked off. Two real, pre-existing data-quality bugs were found but deliberately **not** fixed here (out of scope, needs its own careful pass) — spawned as a background task: `players.json` mislabels real Pelicans players as Brooklyn Nets and has some duplicate Hornets rows, traced to `scripts/fetch-players.ts`'s source-merge logic.

**Handoff for next run:** Phase 1 and Phase 2 are both committed and pushed to main (verified: `npm run build` clean, full live browser pass on both). Phase 3 (full redesign, "Front Office" direction) has not been started. Next run should begin Phase 3 starting with design tokens in `globals.css`.

**2026-07-13 (automated resume run, later same night): Phase 3 + Phase 4 complete.** Built the "Front Office" redesign end to end and shipped it in 9 incremental, individually-verified commits:

- **Design tokens** (`globals.css`, `layout.tsx`): deep-ink surface palette + basketball-orange accent replacing the old navy/gold theme; added Bebas Neue (scoreboard display type) and Barlow Condensed (headings) alongside the existing Plus Jakarta Sans body font.
- **Logo**: replaced the AI-clipart PNG with a hand-built vector wordmark + basketball-line-icon mark (`src/components/Logo.tsx`) — no image asset needed.
- **Mechanical cleanup**: swapped the repeated hardcoded gold-gradient CTA style (6 files) for the new accent token, and swept every leftover hardcoded navy/gold `rgba(...)` literal (8 files) left over from the old theme.
- **Wide-viewport layout bug fixed**: the sidebar was `position:fixed` to the true browser edge while content centered only in the leftover space, so wide monitors looked shoved left with a big dead gap on the right. Sidebar is now a normal flex sibling on desktop (still a slide-in drawer on mobile) inside a `max-w-[1600px] mx-auto` shell, so extra space splits evenly.
- **Landing page real hook**: added `ThresholdsTicker` — a live broadcast-scoreboard strip of this season's actual cap floor/salary cap/aprons pulled from `teams.json`, replacing generic marketing copy as the first thing a visitor sees.
- **Chat interface**: answer tables now get a broadcast lower-third treatment (uppercase condensed headers, orange underline, tabular-nums numbers) — the most common place the assistant shows real data. Swapped the plain blinking-cursor "Thinking" state for a three-dot accent pulse.
- **Team pages** (the "wow" screens per plan): team names and key stat callouts (total cap allocations, distance to each apron, the floating marker on the threshold bar) now use the scoreboard display font at real size; payroll table shares the same lower-third header treatment as chat tables so both surfaces read as one product.
- **Meta**: generated a real favicon and a 1200×630 share-preview image (both via `next/og` `ImageResponse`, no external asset), added Open Graph/Twitter card metadata and a page-title template.
- **Caught and fixed one self-inflicted regression before it shipped broken further**: the new title template doubled team-page titles ("... — ChatCBA — ChatCBA") because those pages already had their own manual suffix from before this session — caught by checking the *live* deployed HTML with `curl` after pushing, not just the local build, and shipped a follow-up fix in the same run.

**Verification methodology this run:** every commit was checked with `npx tsc --noEmit` + `npm run build` before committing, and every visual change was driven live in the sandboxed Browser pane at desktop (2560px and 1280px), tablet, and mobile (375px) viewports — including sending real chat messages and confirming streamed markdown tables render correctly. Also ran `npm run lint` and `npm run validate-data` (both clean) as part of Phase 4. Post-deploy, confirmed the live site at chatcba.vercel.app via `curl` (the Browser pane couldn't reach the external production URL unattended — its per-origin approval gate needs a human click that isn't available in a scheduled run — so HTTP/HTML checks were used instead) and confirmed the title-doubling fix went live.

**One non-blocking note:** while testing chat live, one query returned only a `sources` SSE event with zero text content (Anthropic API returned an empty completion) before a retry on a fresh query worked normally. Traced it as far as confirming it wasn't caused by anything touched this session (no route.ts/config.ts/cba-search.ts changes) and didn't reproduce again — treating as a one-off API hiccup, not a regression, but flagging in case it recurs.

**2026-07-13 (afternoon session — data correction + review fixes):** Michael flagged that the shipped cap data was badly wrong (21/30 teams "over the second apron"; Pistons players on the Nuggets roster). Root causes: Spotrac "Total Cap Allocations" (includes cap holds) treated as payroll, and a corrupted multi-source player merge (72 duplicate rows, mixed team-code conventions). **Fixed by rebuilding the entire data pipeline on capsheets.com** (Michael's trusted source): new scripts/fetch-capsheets.ts scrapes all 30 team pages (roster+salaries+options, dead money, tax/apron space, cap holds, two-ways, TPEs); fetch-players.ts rewritten (capsheets rosters + nbaapi stats, diacritic-safe dedupe, v2 {fetchedAt, players} shape); HoopsHype + BallDontLie removed; validator now checks semantic sanity (duplicate names, roster sizes, canonical team codes). Verified: NYK numbers match capsheets to the dollar; league picture now correct (1 team over 2nd apron = OKC, 6 over 1st, 9 over tax). Separately, a fresh-eyes review found 10 issues, all fixed: analytics events were 100% silently dropped (ts type mismatch — now fixed both ends and verified logging), stale "February 2026" date on About, "Lakers's" double-possessives, unstyled/illegible 404 (new themed not-found.tsx), Privacy/Terms nav dead-ends + missing titles, unhandled clipboard failures, Google Fonts <link> → next/font migration (zero lint warnings now), ticker "Live" label → "Updated {date}". One dismissed as false positive (claude-sonnet-5 IS a valid model id). Deferred as acceptable: brief sidebar empty-state flash on load (avoiding hydration-mismatch risk), players.json fetchedAt item from Phase 1 (superseded — v2 shape now has it).

**All Phase 1–4 items are now checked off.** This was the last planned phase in this file — the scheduled task should be disabled/paused after this run.

---

**2026-07-13 (evening):** Retired the live-Spotrac (Notte) chat lookup — chat, team pages, and ticker now all answer from the same Capsheets snapshot, and salary answers are cacheable. Tested the monthly refresh workflow end-to-end on GitHub's runners: first run failed correctly-but-too-strictly (Capsheets had just added Alpha Diallo to Denver and the page header lagged its own table), so header mismatches are now warnings while real parser-bug signatures (non-player rows, implausible salaries) stay fatal. Re-run: SUCCESS. Production verified serving Diallo-era data ($211.0M Denver). NOTTE_API_KEY is no longer used (Michael to remove from .env.local / Vercel at leisure). Aug 1 auto-refresh is confirmed working.
