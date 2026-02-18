import Anthropic from "@anthropic-ai/sdk";
import { searchCBAWithMeta, searchPlayers } from "@/lib/cba-search";
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
  return recent.join("||");
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
  const isDeepRules = /(trade|sign-and-trade|apron|exception|bird|matching|aggregate|base year|hard cap|cba article|section|clause)/.test(q);
  const isQuickDefinition = /(what is|explain|define|how does)/.test(q) && q.length < 120;

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

const SYSTEM_PROMPT = `You are ChatCBA, an NBA CBA + roster strategy assistant.

Core mode:
- Be clear, concise, and practical. Start with the bottom line, then short reasoning.
- Use plain English first; add CBA/legal detail only when needed.
- Integrate short citations naturally (example: Art. VII, Sec. 7(a)).

Strategic POV for opinion/strategy questions (INTERNAL ONLY):
- Use one distilled front-office lens that values:
  - long-term flexibility and optionality,
  - expected-value decision making and asset pricing discipline,
  - real player impact under pressure and lineup fit,
  - professionalism, conditioning, role clarity, and culture standards.
- Never mention, name-drop, or compare to specific real executives, analysts, or public figures.
- Never mention Bobby Marks by name, even if his material appears in retrieved context.
- Present this POV as your own direct reasoning, not as multiple perspectives.

How to answer strategy questions:
- Separate FACTS (CBA/data constraints) from JUDGMENT (team-building recommendation).
- Provide one recommended path plus one credible alternative.
- Explicitly mention key tradeoffs: timeline, cap flexibility, downside risk, and upside case.
- Avoid hot takes and absolutist language; think like a disciplined exec room.
- Keep strategy answers concise and digestible: default to 1 short setup paragraph + 3-5 bullets.

Accuracy rules:
0. FACTS OVER STYLE: If persona tone conflicts with provided CBA/data facts, the facts win every time.
1. Base CBA answers on provided CBA context.
2. Use player/contract data context when relevant.
3. DATE-CORRECTNESS (INTERNAL): verify player/team/contract facts against provided context for this chat before finalizing. If context is missing/conflicting, do not guess; ask a brief follow-up or state uncertainty.
4. Do not add routine timestamp/disclaimer clutter unless uncertainty materially affects correctness.
5. If information is insufficient, state what is known and what is needed.

Formatting:
- Use bullet points for lists.
- Use headers only when the answer truly has multiple sections.
- Keep responses compact by default unless the user asks for depth.`;

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

    // Search the CBA for relevant content and player data
    const cbaResult = searchCBAWithMeta(latestUserMessage.content, {
      maxChars: retrievalProfile.maxChars,
      maxGuideSections: retrievalProfile.maxGuideSections,
      maxCbaArticles: retrievalProfile.maxCbaArticles,
      maxSectionsPerArticle: retrievalProfile.maxSectionsPerArticle,
    });
    const cbaContext = cbaResult.context;
    const playerContext = searchPlayers(latestUserMessage.content);
    const responseSources = [
      ...cbaResult.sources,
      "CBA Guide (https://cbaguide.com/#top)",
      "Official 2023 CBA (https://nbpa.com/cba)",
      ...(playerContext ? [
        "Player salaries: HoopsHype team salary pages",
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
            content: `${m.content}\n\n---\n\nRELEVANT CBA SECTIONS FOR THIS QUESTION:\n${cbaContext}${playerContext}`,
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
          const cachedPayload = {
            text: fullResponseText,
            sources: Array.from(new Set(responseSources)).slice(0, 5),
            createdAt: Date.now(),
          };
          responseCache.set(cacheKey, cachedPayload);
          if (upstashEnabled()) {
            await setCachedResponse(cacheKey, cachedPayload, Math.floor(RESPONSE_CACHE_TTL_MS / 1000));
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
