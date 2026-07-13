import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { searchCBAWithMeta, searchPlayers, searchTeams, findPlayerNamesInQuery } from "@/lib/cba-search";
import { fetchPlayerContract, formatNotteContract } from "@/lib/notte";
import {
  getCachedResponse,
  incrementDailyLimit,
  setCachedResponse,
  upstashEnabled,
} from "@/lib/upstash";
import {
  CACHE_KEY_RECENT_MESSAGES,
  CACHE_SCHEMA_VERSION,
  MAX_CHAT_BODY_BYTES,
  MAX_MESSAGES,
  MAX_MESSAGE_CONTENT_CHARS,
  MAX_SOURCES,
  MESSAGE_HISTORY_TURNS,
  MODEL_ID,
  NOTTE_PLAYER_LOOKUP_CAP,
  RATE_LIMIT,
  RATE_WINDOW_MS,
  RESPONSE_CACHE_TTL_MS,
  RESPONSE_CACHE_TTL_SECONDS,
} from "@/lib/config";
import { NextRequest } from "next/server";
import { createHash } from "crypto";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// ---- Request validation ----

const ChatMessageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().max(MAX_MESSAGE_CONTENT_CHARS),
});

const ChatRequestSchema = z.object({
  messages: z.array(ChatMessageSchema).min(1).max(MAX_MESSAGES),
});

type ChatMessage = z.infer<typeof ChatMessageSchema>;

type ParsedChatRequest =
  | { success: true; data: { messages: ChatMessage[] } }
  | { success: false; error: string };

function parseChatRequestBody(bodyText: string): ParsedChatRequest {
  let json: unknown;
  try {
    json = JSON.parse(bodyText);
  } catch {
    return { success: false, error: "Request body must be valid JSON." };
  }

  const result = ChatRequestSchema.safeParse(json);
  if (!result.success) {
    const firstIssue = result.error.issues[0];
    const detail = firstIssue ? `${firstIssue.path.join(".") || "messages"}: ${firstIssue.message}` : "malformed request";
    return { success: false, error: `Invalid request: ${detail}` };
  }

  return { success: true, data: result.data };
}

// ---- Rate limiting: in-memory fallback used when Upstash isn't configured ----

const ipRequests = new Map<string, { count: number; resetAt: number }>();
const responseCache = new Map<string, { text: string; sources: string[]; createdAt: number }>();

function getClientIp(req: NextRequest): string {
  const ipHeader = req.headers.get("x-forwarded-for") ?? req.headers.get("x-real-ip") ?? "unknown";
  return ipHeader.split(",")[0]?.trim() || "unknown";
}

function checkInMemoryRateLimit(ip: string): boolean {
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

function dayKeyUTC(): string {
  return new Date().toISOString().slice(0, 10);
}

async function isRequestAllowed(ip: string): Promise<boolean> {
  const rateKey = `chatcba:rate:${dayKeyUTC()}:${ip}`;
  const redisLimit = await incrementDailyLimit(rateKey, RATE_LIMIT);
  if (redisLimit) return redisLimit.allowed;
  return checkInMemoryRateLimit(ip);
}

// ---- Response caching ----

function buildCacheKey(messages: ChatMessage[]): string {
  const recent = messages
    .slice(-CACHE_KEY_RECENT_MESSAGES)
    .map((m) => `${m.role}:${m.content.trim().toLowerCase()}`);
  return [CACHE_SCHEMA_VERSION, ...recent].join("||");
}

function makeStableHash(value: string): string {
  return createHash("sha256").update(value).digest("hex").slice(0, 32);
}

function buildCachedSseResponse(cached: { text: string; sources: string[] }): Response {
  const encoder = new TextEncoder();
  const readable = new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text: cached.text })}\n\n`));
      controller.enqueue(encoder.encode(`data: ${JSON.stringify({ sources: cached.sources })}\n\n`));
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

// ---- Retrieval profile ----
//
// Each rule pairs a query-shape test with a retrieval budget. The table is
// evaluated top to bottom and the first match wins, so ordering encodes
// priority:
//   1. negotiation-short — short negotiation/free-agency question, tightest budget & fastest reply
//   2. negotiation        — longer negotiation/free-agency question, a bit more room
//   3. deep-rules          — trade/exception/apron mechanics; needs the most official-text context
//   4. quick-definition    — "what is X" / "explain X" style, small and fast
//   5. default             — everything else, moderate general-purpose budget

interface RetrievalProfile {
  maxChars: number;
  maxGuideSections: number;
  maxCbaArticles: number;
  maxSectionsPerArticle: number;
  maxOutputTokens: number;
}

interface RetrievalRule {
  name: string;
  test: (query: string, wordCount: number) => boolean;
  profile: RetrievalProfile;
}

const DEEP_RULES_RE = /(trade|sign-and-trade|apron|exception|bird|matching|aggregate|base year|hard cap|cba article|section|clause)/;
const QUICK_DEFINITION_RE = /(what is|explain|define|how does)/;
const NEGOTIATION_RE = /(negotia|extension|player option|opt[- ]?in|opt[- ]?out|re-sign|re sign|new deal|leverage|free agenc)/;

const RETRIEVAL_RULES: RetrievalRule[] = [
  {
    name: "negotiation-short",
    test: (q, wordCount) => NEGOTIATION_RE.test(q) && wordCount <= 18,
    profile: { maxChars: 11000, maxGuideSections: 3, maxCbaArticles: 3, maxSectionsPerArticle: 2, maxOutputTokens: 850 },
  },
  {
    name: "negotiation",
    test: (q) => NEGOTIATION_RE.test(q),
    profile: { maxChars: 16000, maxGuideSections: 4, maxCbaArticles: 4, maxSectionsPerArticle: 3, maxOutputTokens: 1300 },
  },
  {
    name: "deep-rules",
    test: (q) => DEEP_RULES_RE.test(q),
    profile: { maxChars: 18000, maxGuideSections: 4, maxCbaArticles: 5, maxSectionsPerArticle: 3, maxOutputTokens: 1400 },
  },
  {
    name: "quick-definition",
    test: (q) => QUICK_DEFINITION_RE.test(q) && q.length < 120,
    profile: { maxChars: 9000, maxGuideSections: 3, maxCbaArticles: 3, maxSectionsPerArticle: 2, maxOutputTokens: 900 },
  },
  {
    name: "default",
    test: () => true,
    profile: { maxChars: 12000, maxGuideSections: 4, maxCbaArticles: 4, maxSectionsPerArticle: 2, maxOutputTokens: 1100 },
  },
];

function getRetrievalProfile(query: string): RetrievalProfile {
  const q = query.toLowerCase();
  const wordCount = q.split(/\s+/).filter(Boolean).length;
  const rule = RETRIEVAL_RULES.find((r) => r.test(q, wordCount)) ?? RETRIEVAL_RULES[RETRIEVAL_RULES.length - 1];
  return rule.profile;
}

// ---- Context retrieval (CBA text, player data, team cap data, Notte) ----

const SALARY_QUERY_RE = /\b(salary|salaries|contract|cap hit|cap space|money|earn|paid|worth|extension|opt[- ]?in|opt[- ]?out|re-?sign|buyout|deal|offer|max contract|supermax|bird rights|guaranteed)\b/i;

interface RetrievalContext {
  cbaContext: string;
  playerContext: string;
  teamContext: string;
  notteContext: string;
  sources: string[];
}

async function gatherRetrievalContext(query: string, retrievalProfile: RetrievalProfile): Promise<RetrievalContext> {
  // Detect salary/contract questions and fetch real-time data from Spotrac via Notte
  const isSalaryQuery = SALARY_QUERY_RE.test(query);
  let notteContext = "";
  let notteAttempted = false;

  if (isSalaryQuery && process.env.NOTTE_API_KEY) {
    const playerNames = findPlayerNamesInQuery(query);
    if (playerNames.length > 0) {
      notteAttempted = true;
      const notteResults = await Promise.all(
        playerNames.slice(0, NOTTE_PLAYER_LOOKUP_CAP).map((name) => fetchPlayerContract(name))
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
  const cbaResult = searchCBAWithMeta(query, {
    maxChars: retrievalProfile.maxChars,
    maxGuideSections: retrievalProfile.maxGuideSections,
    maxCbaArticles: retrievalProfile.maxCbaArticles,
    maxSectionsPerArticle: retrievalProfile.maxSectionsPerArticle,
  });
  const cbaContext = cbaResult.context;

  // On salary queries where Notte failed, force a player lookup so HoopsHype data is always present as fallback
  const playerContext =
    searchPlayers(query) ||
    (notteAttempted && !notteContext ? searchPlayers(findPlayerNamesInQuery(query).join(" ")) : "");
  const teamContext = searchTeams(query);

  const sources = [
    ...cbaResult.sources,
    "CBA Guide (https://cbaguide.com/#top)",
    "Official 2023 CBA (https://nbpa.com/cba)",
    ...(notteContext ? ["Contract data: Spotrac (real-time)"] : []),
    ...(playerContext
      ? [
          ...(notteAttempted && !notteContext
            ? ["Contract data: HoopsHype (cached snapshot — Spotrac unavailable)"]
            : ["Player salaries: HoopsHype team salary pages"]),
          "Player stats: NBA stats feed (2025-26)",
        ]
      : []),
    ...(teamContext ? ["Team cap data: Spotrac (2025-26 snapshot)"] : []),
  ];

  return { cbaContext, playerContext, teamContext, notteContext, sources };
}

function buildAugmentedMessages(
  messages: ChatMessage[],
  currentDateContext: string,
  context: Pick<RetrievalContext, "cbaContext" | "playerContext" | "teamContext" | "notteContext">
): Array<{ role: "user" | "assistant"; content: string }> {
  // Keep only the most recent turns to reduce token usage.
  const trimmedMessages = messages.slice(-MESSAGE_HISTORY_TURNS);
  return trimmedMessages.map((m, i) => {
    if (i === trimmedMessages.length - 1 && m.role === "user") {
      return {
        role: "user" as const,
        content: `${m.content}\n\n---\n\nCurrent date context: ${currentDateContext}\nCurrent NBA season context in this app: 2025-26\n\nRELEVANT CBA SECTIONS FOR THIS QUESTION:\n${context.cbaContext}${context.notteContext}${context.playerContext}${context.teamContext}`,
      };
    }
    return { role: m.role, content: m.content };
  });
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
- Bullet points for lists. Headers only when there are genuinely multiple distinct sections. Compact by default unless the user asks for more depth.
- Use a markdown table for any season-by-season salary, contract-year, or multi-team cap breakdown — this renders as a real table for the user. Reserve bullets for everything else.`;

// ---- Anthropic error classification ----

function classifyAnthropicError(err: unknown): { status: number; message: string } {
  if (err instanceof Anthropic.APIError) {
    const body = err.error as { type?: string; error?: { type?: string } } | undefined;
    const errType = body?.error?.type ?? body?.type;

    if (err.status === 429) {
      return {
        status: 429,
        message: "We're getting a lot of requests right now. Please wait a moment and try again.",
      };
    }
    if (err.status === 529 || errType === "overloaded_error") {
      return {
        status: 503,
        message: "The assistant is briefly overloaded, try again.",
      };
    }
  }
  return {
    status: 500,
    message: "Something went wrong processing your request. Please try again.",
  };
}

// ---- Streaming the Claude response ----

async function streamChatCompletion(params: {
  augmentedMessages: Array<{ role: "user" | "assistant"; content: string }>;
  maxOutputTokens: number;
  sources: string[];
  cacheKey: string;
  shouldCache: boolean;
}): Promise<Response> {
  const { augmentedMessages, maxOutputTokens, sources, cacheKey, shouldCache } = params;

  const anthropicStream = anthropic.messages.stream({
    model: MODEL_ID,
    max_tokens: maxOutputTokens,
    system: SYSTEM_PROMPT,
    messages: augmentedMessages,
  });

  // Wait for the connection to actually succeed before committing to a
  // streaming HTTP response. This lets genuine request-time failures (rate
  // limited, overloaded, auth, etc.) still be reported with a real status
  // code and a plain JSON body, instead of being silently swallowed inside
  // an SSE stream that already returned 200.
  try {
    await anthropicStream.emitted("connect");
  } catch (err) {
    console.error("Anthropic connection error:", err);
    const { status, message } = classifyAnthropicError(err);
    return Response.json({ error: message }, { status });
  }

  const encoder = new TextEncoder();
  let fullResponseText = "";
  let bytesSent = false;

  const readable = new ReadableStream({
    async start(controller) {
      try {
        for await (const event of anthropicStream) {
          if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
            fullResponseText += event.delta.text;
            bytesSent = true;
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text: event.delta.text })}\n\n`));
          }
        }

        const finalSources = Array.from(new Set(sources)).slice(0, MAX_SOURCES);
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ sources: finalSources })}\n\n`));

        // Don't cache responses that include real-time Notte data
        if (shouldCache) {
          const cachedPayload = { text: fullResponseText, sources: finalSources, createdAt: Date.now() };
          responseCache.set(cacheKey, cachedPayload);
          if (upstashEnabled()) {
            await setCachedResponse(cacheKey, cachedPayload, RESPONSE_CACHE_TTL_SECONDS);
          }
        }

        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        controller.close();
      } catch (err) {
        console.error("Chat stream error (mid-stream):", err);
        // Headers/status are already committed at this point — the best we
        // can do is close out the SSE stream gracefully rather than drop
        // the socket, so the frontend sees a clean [DONE] either way.
        try {
          if (bytesSent) {
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({ text: "\n\n_Connection interrupted — please try again._" })}\n\n`
              )
            );
          } else {
            const { message } = classifyAnthropicError(err);
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text: message })}\n\n`));
          }
          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
          controller.close();
        } catch (closeErr) {
          console.error("Failed to close chat stream cleanly:", closeErr);
        }
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
}

export async function POST(req: NextRequest) {
  try {
    // Rate limit by IP
    const ip = getClientIp(req);
    if (!(await isRequestAllowed(ip))) {
      return Response.json(
        { error: `Daily request limit reached (${RATE_LIMIT}/day). Please try again tomorrow.` },
        { status: 429 }
      );
    }

    // Reject oversized bodies before parsing.
    const contentLengthHeader = req.headers.get("content-length");
    if (contentLengthHeader && Number(contentLengthHeader) > MAX_CHAT_BODY_BYTES) {
      return Response.json({ error: "Request body is too large." }, { status: 400 });
    }
    const bodyText = await req.text();
    if (Buffer.byteLength(bodyText, "utf8") > MAX_CHAT_BODY_BYTES) {
      return Response.json({ error: "Request body is too large." }, { status: 400 });
    }

    const parsedBody = parseChatRequestBody(bodyText);
    if (!parsedBody.success) {
      return Response.json({ error: parsedBody.error }, { status: 400 });
    }
    const { messages } = parsedBody.data;

    // Get the latest user message to search the CBA
    const latestUserMessage = [...messages].reverse().find((m) => m.role === "user");
    if (!latestUserMessage) {
      return Response.json({ error: "No user message found" }, { status: 400 });
    }

    const now = new Date();
    const currentDateContext = now.toISOString().slice(0, 10);
    const cacheKey = `chatcba:resp:${makeStableHash(buildCacheKey(messages))}`;

    const redisCached = await getCachedResponse<{ text: string; sources: string[]; createdAt: number }>(cacheKey);
    const inMemoryCached = responseCache.get(cacheKey);
    const cached = redisCached ?? inMemoryCached ?? null;
    if (cached && Date.now() - cached.createdAt <= RESPONSE_CACHE_TTL_MS) {
      return buildCachedSseResponse(cached);
    }

    const retrievalProfile = getRetrievalProfile(latestUserMessage.content);
    const { cbaContext, playerContext, teamContext, notteContext, sources } = await gatherRetrievalContext(
      latestUserMessage.content,
      retrievalProfile
    );

    const augmentedMessages = buildAugmentedMessages(messages, currentDateContext, {
      cbaContext,
      playerContext,
      teamContext,
      notteContext,
    });

    return await streamChatCompletion({
      augmentedMessages,
      maxOutputTokens: retrievalProfile.maxOutputTokens,
      sources,
      cacheKey,
      shouldCache: !notteContext,
    });
  } catch (error) {
    console.error("Chat API error:", error);
    return Response.json(
      { error: "Failed to process request" },
      { status: 500 }
    );
  }
}
