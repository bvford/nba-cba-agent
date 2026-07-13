# Lessons

## 2026-07-12 — Don't use desktop screen control for browsing
Tried to read X bookmarks via macOS computer-use screenshots of Chrome. The screenshot tool visually hides every non-granted app and shuffles window focus — Michael found it alarming ("I don't want you disabling everything else I'm doing"). Rule: for anything browser-shaped, use the Claude in Chrome extension (now installed) or the sandboxed Browser pane. Never grab desktop control for a task a browser tool can do.

## 2026-07-12 — This project's X/GitHub identity
Michael's active X account is @_bvford (not @mikemargo1, which has zero bookmarks). GitHub repo owner is bvford.

## 2026-07-13 — Tailwind v4: `[--color-x]` brackets vs `(--color-x)` parens are NOT interchangeable
In Tailwind v4, an arbitrary-value class using square brackets with a bare CSS variable — e.g. `bg-[--color-surface]` — compiles to literal, invalid CSS (`background-color: --color-surface`, no `var()` wrapper) and silently does nothing. The correct syntax for "treat this as a CSS variable" is parens: `bg-(--color-surface)`. This entire ChatCBA codebase had used the bracket form everywhere (121 occurrences, 14 files) and it went unnoticed because `body` sets working color defaults via plain CSS and a couple of CTAs used literal hex colors, so the app didn't look obviously broken — panels, hover states, and borders were just quietly not getting their intended shades. Caught it by checking the actual compiled `.next/static/css/*.css` output, not by trusting how a screenshot looked or general Tailwind-version knowledge. Rule: when a subagent (or anyone) flags a CSS/styling bug, verify against compiled output before accepting or dismissing the claim — visual plausibility in a screenshot is not proof a style rule is working as intended.
