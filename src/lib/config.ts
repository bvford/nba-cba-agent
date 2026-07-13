// Centralized configuration for ChatCBA's backend.
//
// This is the single source of truth for rate limits, cache TTLs, the model
// id, and the numeric caps used by the retrieval pipeline. Keeping these
// here (instead of scattered magic numbers across route.ts and
// cba-search.ts) means things like the /api/admin/health report can never
// silently drift out of sync with what's actually enforced.

// ---- Rate limiting ----
/** Max chat requests allowed per IP per day. */
export const RATE_LIMIT = 20;
/** Rolling window for the in-memory rate limiter fallback (no Upstash). */
export const RATE_WINDOW_MS = 24 * 60 * 60 * 1000; // 24 hours

// ---- Response cache ----
export const RESPONSE_CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours
export const RESPONSE_CACHE_TTL_SECONDS = Math.floor(RESPONSE_CACHE_TTL_MS / 1000);
/**
 * Bump this whenever a prompt or retrieval change should invalidate
 * previously cached responses (both in-memory and in Upstash).
 */
export const CACHE_SCHEMA_VERSION = "2026-07-13-sonnet-5";
/** How many of the most recent conversation turns are folded into the cache key. */
export const CACHE_KEY_RECENT_MESSAGES = 6;

// ---- Model ----
export const MODEL_ID = process.env.CHATCBA_MODEL || "claude-sonnet-5";

// ---- Sources shown to the user ----
/** Max distinct source citations returned with a response. */
export const MAX_SOURCES = 5;

// ---- Retrieval caps ----
/** How many of the most recent conversation turns are sent to the model. */
export const MESSAGE_HISTORY_TURNS = 8;
/** Max distinct player names extracted from a single query. */
export const PLAYER_NAME_MATCH_CAP = 3;
/** Max players included in the injected PLAYER DATA context block. */
export const PLAYER_SEARCH_RESULT_CAP = 15;
/** Max players shown when a query mentions a team (e.g. "Lakers roster"). */
export const TEAM_ROSTER_PLAYER_CAP = 8;
/** Max CBA 101 FAQ sections considered for inclusion in the retrieval context. */
export const CBA101_SECTION_CAP = 3;

// ---- Request validation (/api/chat) ----
export const MAX_MESSAGES = 50;
export const MAX_MESSAGE_CONTENT_CHARS = 8000;
export const MAX_CHAT_BODY_BYTES = 256 * 1024; // 256KB

// ---- Request validation (/api/events) ----
export const MAX_EVENT_BODY_BYTES = 8 * 1024; // 8KB
export const MAX_EVENT_NAME_CHARS = 64;
export const MAX_EVENT_PROPS_BYTES = 2 * 1024; // 2KB serialized
export const MAX_EVENT_PATH_CHARS = 256;
