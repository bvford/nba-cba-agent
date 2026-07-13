# Lessons

## 2026-07-12 — Don't use desktop screen control for browsing
Tried to read X bookmarks via macOS computer-use screenshots of Chrome. The screenshot tool visually hides every non-granted app and shuffles window focus — Michael found it alarming ("I don't want you disabling everything else I'm doing"). Rule: for anything browser-shaped, use the Claude in Chrome extension (now installed) or the sandboxed Browser pane. Never grab desktop control for a task a browser tool can do.

## 2026-07-12 — This project's X/GitHub identity
Michael's active X account is @_bvford (not @mikemargo1, which has zero bookmarks). GitHub repo owner is bvford.

## 2026-07-13 — Approval fatigue is Michael's #1 annoyance (3rd correction)
He woke up to a queue of permission prompts and was rightfully annoyed. Operate as if in Auto mode: never prompt for routine reversible repo work. Keep project allowlists generous (he must approve the specific grants — present a table, get a yes). When creating scheduled tasks, structure the work so no prompt can block an unattended run.

## 2026-07-13 — End long runs with a push notification
He had no idea where the overnight work left off. Every scheduled/overnight/long run must end with a PushNotification: what got done, what's left, whether input is needed. Bake this into every scheduled-task prompt.

## 2026-07-13 — Validate data at the SEMANTIC level, not just shape
The overnight team pages shipped with 21/30 teams "over the second apron" and Pistons players on the Nuggets roster. validate-refresh-data.ts checked counts and required fields but not sanity (league-wide apron distribution, duplicate names, roster sizes, cross-source team-code consistency). A human glance at the rendered page would have caught it: "does this match what a fan knows about the league?" Add reality checks to validators (plausible ranges, known-fact spot checks like "Jokić is a Nugget") and eyeball rendered output against common knowledge before shipping data-driven pages. Also: Spotrac "Total Cap Allocations" ≠ payroll (includes cap holds); capsheets.com is Michael's trusted source (he knows the maintainer).

## 2026-07-13 — Tailwind v4: `[--color-x]` brackets vs `(--color-x)` parens are NOT interchangeable
In Tailwind v4, an arbitrary-value class using square brackets with a bare CSS variable — e.g. `bg-[--color-surface]` — compiles to literal, invalid CSS (`background-color: --color-surface`, no `var()` wrapper) and silently does nothing. The correct syntax for "treat this as a CSS variable" is parens: `bg-(--color-surface)`. This entire ChatCBA codebase had used the bracket form everywhere (121 occurrences, 14 files) and it went unnoticed because `body` sets working color defaults via plain CSS and a couple of CTAs used literal hex colors, so the app didn't look obviously broken — panels, hover states, and borders were just quietly not getting their intended shades. Caught it by checking the actual compiled `.next/static/css/*.css` output, not by trusting how a screenshot looked or general Tailwind-version knowledge. Rule: when a subagent (or anyone) flags a CSS/styling bug, verify against compiled output before accepting or dismissing the claim — visual plausibility in a screenshot is not proof a style rule is working as intended.
