import Anthropic from "@anthropic-ai/sdk";
import { searchCBAWithMeta, searchPlayers, findPlayerNamesInQuery } from "@/lib/cba-search";
import { fetchPlayerContract, formatNotteContract } from "@/lib/notte";
import {
  getCachedResponse,
  incrementDailyLimit,
  setCachedResponse,
  upstashEnabled,
} from "@/lib/upstash";
import { NextRequest } from "next/server";
import { createHash } from "crypto";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// Simple in-memory rate limiter: max requests per IP per window
const RATE_LIMIT = 20; // requests per window
const RATE_WINDOW_MS = 24 * 60 * 60 * 1000; // 24 hours
const ipRequests = new Map<string, { count: number; resetAt: number }>();
const RESPONSE_CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours
const responseCache = new Map<string, { text: string; sources: string[]; createdAt: number }>();
const CACHE_SCHEMA_VERSION = "2026-02-18-team-context-v2";

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = ipRequests.get(ip);
  if (!entry || now > entry.resetAt) {
    ipRequests.set(ip, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return true;
  }
  if (entry.count >= RATE_LIMIT) return false;
  entry.count++;
  return true;
}

function buildCacheKey(messages: Array<{ role: string; content: string }>): string {
  const recent = messages.slice(-6).map((m) => `${m.role}:${m.content.trim().toLowerCase()}`);
  return [CACHE_SCHEMA_VERSION, ...recent].join("||");
}

function makeStableHash(value: string): string {
  return createHash("sha256").update(value).digest("hex").slice(0, 32);
}

function dayKeyUTC(): string {
  return new Date().toISOString().slice(0, 10);
}

function getRetrievalProfile(query: string): {
  maxChars: number;
  maxGuideSections: number;
  maxCbaArticles: number;
  maxSectionsPerArticle: number;
  maxOutputTokens: number;
} {
  const q = query.toLowerCase();
  const wordCount = q.split(/\s+/).filter(Boolean).length;
  const isDeepRules = /(trade|sign-and-trade|apron|exception|bird|matching|aggregate|base year|hard cap|cba article|section|clause)/.test(q);
  const isQuickDefinition = /(what is|explain|define|how does)/.test(q) && q.length < 120;
  const isNegotiation = /(negotia|extension|player option|opt[- ]?in|opt[- ]?out|re-sign|re sign|new deal|leverage|free agenc)/.test(q);
  const isShortPrompt = wordCount <= 18;

  if (isNegotiation && isShortPrompt) {
    return {
      maxChars: 11000,
      maxGuideSections: 3,
      maxCbaArticles: 3,
      maxSectionsPerArticle: 2,
      maxOutputTokens: 850,
    };
  }

  if (isNegotiation) {
    return {
      maxChars: 16000,
      maxGuideSections: 4,
      maxCbaArticles: 4,
      maxSectionsPerArticle: 3,
      maxOutputTokens: 1300,
    };
  }

  if (isDeepRules) {
    return {
      maxChars: 18000,
      maxGuideSections: 4,
      maxCbaArticles: 5,
      maxSectionsPerArticle: 3,
      maxOutputTokens: 1400,
    };
  }

  if (isQuickDefinition) {
    return {
      maxChars: 9000,
      maxGuideSections: 3,
      maxCbaArticles: 3,
      maxSectionsPerArticle: 2,
      maxOutputTokens: 900,
    };
  }

  return {
    maxChars: 12000,
    maxGuideSections: 4,
    maxCbaArticles: 4,
    maxSectionsPerArticle: 2,
    maxOutputTokens: 1100,
  };
}

function trimMessagesForModel(messages: Array<{ role: string; content: string }>) {
  // Keep only the most recent turns to reduce token usage.
  return messages.slice(-8);
}

const SYSTEM_PROMPT = `You are ChatCBA, an NBA CBA and roster strategy assistant.

## Tone and style
Be clear, concise, and practical. Lead with the answer, then the reasoning. Use plain English first; add CBA article citations only when they add precision (e.g., Art. VII, Sec. 5(b)). Never cite, quote, or name-drop specific analysts, journalists, or media personalities — present all analysis as your own reasoning.

## Answering by question type

**Factual CBA questions** (rules, definitions, how something works):
Answer directly from the provided CBA context. State the baseline rule first, then exceptions if relevant. Cite the article and section when it helps.

**Strategy and opinion questions** (what a team should do, player value, roster construction):
Separate FACTS (CBA constraints, contract data) from JUDGMENT (your recommendation). Reason like a disciplined front-office decision-maker that values long-term flexibility, expected-value thinking, real on-court impact under pressure, and culture/role fit. Provide one recommended path plus one credible alternative. Name the key tradeoffs explicitly: timeline, cap flexibility, downside risk, upside case. Default format: one short setup paragraph + 3–5 bullets.

**Trade and transaction legality questions** (can a team do X given their situation):
State the legality verdict first (legal / not legal / conditional), then explain the salary matching, exception usage, or apron implications that determine it. Ground the analysis in the player contract data and team cap context provided.

**Historical questions** (how was X deal done, what exception was used in year Y, why was a team able to do something):
Answer from general knowledge and flag it plainly: note that this answer is based on general knowledge and is not verified against the provided CBA data. If the rule that applied historically differs from the current CBA, note the distinction.

## Contract negotiation policy
- Do not default to "max contract" conclusions. Recommend max or supermax only when the provided context clearly shows: (1) the player is eligible, (2) the market justifies it, and (3) the team's cap and apron situation supports it.
- Otherwise, propose a realistic value band and structure (years, guarantees, options) plus a walk-away price.
- For player-option decisions, evaluate opt-in vs. opt-out expected value, injury risk, market risk, and leverage for both sides.
- Option semantics (must be correct): a player option gives the player flexibility and reduces team control; a team option gives the team control and reduces player flexibility. When you use the word "flexibility," always specify whose flexibility.
- Use probability-style framing where useful (likely / plausible / low-probability) rather than false certainty.

## Accuracy standards
- Treat the injected "Current date context" as authoritative for timing all contract years, options, and free agency windows.
- For negotiation and transaction questions, ground the analysis in the specific contract structure, team cap/apron situation, and player status from the provided context. If that context is missing or ambiguous, say what is known and what would be needed to answer fully — do not fill gaps with guesses.
- Before finalizing any answer involving options, guarantees, or leverage: verify that every claim is directionally correct for the right party (team vs. player).
- Facts from the provided CBA and player data override stylistic defaults. If context contradicts a general rule, follow the context.
- Do not add disclaimers or timestamps unless the uncertainty materially changes the answer.

## Formatting
- Bullet points for lists. Headers only when there are genuinely multiple distinct sections. Compact by default unless the user asks for more depth.`;

export async function POST(req: NextRequest) {
  try {
    // Rate limit by IP
    const ipHeader = req.headers.get("x-forwarded-for") ?? req.headers.get("x-real-ip") ?? "unknown";
    const ip = ipHeader.split(",")[0]?.trim() || "unknown";
    const rateKey = `chatcba:rate:${dayKeyUTC()}:${ip}`;
    let allowed = false;

    const redisLimit = await incrementDailyLimit(rateKey, RATE_LIMIT);
    if (redisLimit) {
      allowed = redisLimit.allowed;
    } else {
      allowed = checkRateLimit(ip);
    }

    if (!allowed) {
      return Response.json(
        { error: "Daily request limit reached (20/day). Please try again tomorrow." },
        { status: 429 }
      );
    }

    const { messages } = await req.json();

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return Response.json({ error: "Messages are required" }, { status: 400 });
    }

    // Get the latest user message to search the CBA
    const latestUserMessage = [...messages]
      .reverse()
      .find((m: { role: string }) => m.role === "user");

    if (!latestUserMessage) {
      return Response.json(
        { error: "No user message found" },
        { status: 400 }
      );
    }

    const retrievalProfile = getRetrievalProfile(latestUserMessage.content);
    const now = new Date();
    const currentDateContext = now.toISOString().slice(0, 10);
    const cacheKey = `chatcba:resp:${makeStableHash(buildCacheKey(messages))}`;
    const redisCached = await getCachedResponse<{ text: string; sources: string[]; createdAt: number }>(cacheKey);
    const inMemoryCached = responseCache.get(cacheKey);
    const cached = redisCached ?? inMemoryCached ?? null;
    if (cached && Date.now() - cached.createdAt <= RESPONSE_CACHE_TTL_MS) {
      const encoder = new TextEncoder();
      const readable = new ReadableStream({
        start(controller) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text: cached.text })}\n\n`));
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ sources: cached.sources })}\n\n`)
          );
          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
          controller.close();
        },
      });
      return new Response(readable, {
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
        },
      });
    }

    // Detect salary/contract questions and fetch real-time data from Spotrac via Notte
    const isSalaryQuery = /\b(salary|salaries|contract|cap hit|cap space|money|earn|paid|worth|extension|opt[- ]?in|opt[- ]?out|re-?sign|buyout|deal|offer|max contract|supermax|bird rights|guaranteed)\b/i.test(latestUserMessage.content);
    let notteContext = "";
    let notteAttempted = false;
    if (isSalaryQuery && process.env.NOTTE_API_KEY) {
      const playerNames = findPlayerNamesInQuery(latestUserMessage.content);
      if (playerNames.length > 0) {
        notteAttempted = true;
        const notteResults = await Promise.all(
          playerNames.slice(0, 2).map((name) => fetchPlayerContract(name))
        );
        const formatted = notteResults
          .filter((r): r is NonNullable<typeof r> => r !== null)
          .map(formatNotteContract)
          .filter(Boolean);
        if (formatted.length > 0) {
          notteContext = "\n\n--- REAL-TIME CONTRACT DATA (Spotrac via Notte) ---\n\n" + formatted.join("\n\n");
        }
      }
    }

    // Search the CBA for relevant content and player data
    const cbaResult = searchCBAWithMeta(latestUserMessage.content, {
      maxChars: retrievalProfile.maxChars,
      maxGuideSections: retrievalProfile.maxGuideSections,
      maxCbaArticles: retrievalProfile.maxCbaArticles,
      maxSectionsPerArticle: retrievalProfile.maxSectionsPerArticle,
    });
    const cbaContext = cbaResult.context;
    // On salary queries where Notte failed, force a player lookup so HoopsHype data is always present as fallback
    const playerContext = searchPlayers(latestUserMessage.content) ||
      (notteAttempted && !notteContext ? searchPlayers(findPlayerNamesInQuery(latestUserMessage.content).join(" ")) : "");
    const responseSources = [
      ...cbaResult.sources,
      "CBA Guide (https://cbaguide.com/#top)",
      "Official 2023 CBA (https://nbpa.com/cba)",
      ...(notteContext ? ["Contract data: Spotrac (real-time)"] : []),
      ...(playerContext ? [
        ...(notteAttempted && !notteContext ? ["Contract data: HoopsHype (cached snapshot — Spotrac unavailable)"] : ["Player salaries: HoopsHype team salary pages"]),
        "Player stats: NBA stats feed (2025-26)",
      ] : []),
    ];

    // Build the messages array with CBA context injected
    const trimmedMessages = trimMessagesForModel(messages);
    const augmentedMessages = trimmedMessages.map(
      (m: { role: string; content: string }, i: number) => {
        if (i === trimmedMessages.length - 1 && m.role === "user") {
          return {
            role: "user" as const,
            content: `${m.content}\n\n---\n\nCurrent date context: ${currentDateContext}\nCurrent NBA season context in this app: 2025-26\n\nRELEVANT CBA SECTIONS FOR THIS QUESTION:\n${cbaContext}${notteContext}${playerContext}`,
          };
        }
        return { role: m.role as "user" | "assistant", content: m.content };
      }
    );

    // Stream the response
    const stream = await anthropic.messages.stream({
      model: "claude-sonnet-4-5-20250929",
      max_tokens: retrievalProfile.maxOutputTokens,
      system: SYSTEM_PROMPT,
      messages: augmentedMessages,
    });

    // Convert to a ReadableStream for the frontend
    const encoder = new TextEncoder();
    let fullResponseText = "";
    const readable = new ReadableStream({
      async start(controller) {
        try {
          for await (const event of stream) {
            if (
              event.type === "content_block_delta" &&
              event.delta.type === "text_delta"
            ) {
              fullResponseText += event.delta.text;
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify({ text: event.delta.text })}\n\n`)
              );
            }
          }
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({ sources: Array.from(new Set(responseSources)).slice(0, 5) })}\n\n`
            )
          );
          // Don't cache responses that include real-time Notte data
          if (!notteContext) {
            const cachedPayload = {
              text: fullResponseText,
              sources: Array.from(new Set(responseSources)).slice(0, 5),
              createdAt: Date.now(),
            };
            responseCache.set(cacheKey, cachedPayload);
            if (upstashEnabled()) {
              await setCachedResponse(cacheKey, cachedPayload, Math.floor(RESPONSE_CACHE_TTL_MS / 1000));
            }
          }
          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
          controller.close();
        } catch (err) {
          controller.error(err);
        }
      },
    });

    return new Response(readable, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    console.error("Chat API error:", error);
    return Response.json(
      { error: "Failed to process request" },
      { status: 500 }
    );
  }
}
