import Anthropic from "@anthropic-ai/sdk";
import { searchCBAWithMeta, searchPlayers } from "@/lib/cba-search";
import { NextRequest } from "next/server";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// Simple in-memory rate limiter: max requests per IP per window
const RATE_LIMIT = 20; // requests per window
const RATE_WINDOW_MS = 60 * 60 * 1000; // 1 hour
const ipRequests = new Map<string, { count: number; resetAt: number }>();

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
    const ip = req.headers.get("x-forwarded-for") ?? req.headers.get("x-real-ip") ?? "unknown";
    if (!checkRateLimit(ip)) {
      return Response.json(
        { error: "Rate limit exceeded. Please try again later." },
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

    // Search the CBA for relevant content and player data
    const cbaResult = searchCBAWithMeta(latestUserMessage.content);
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
    const augmentedMessages = messages.map(
      (m: { role: string; content: string }, i: number) => {
        if (i === messages.length - 1 && m.role === "user") {
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
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      messages: augmentedMessages,
    });

    // Convert to a ReadableStream for the frontend
    const encoder = new TextEncoder();
    const readable = new ReadableStream({
      async start(controller) {
        try {
          for await (const event of stream) {
            if (
              event.type === "content_block_delta" &&
              event.delta.type === "text_delta"
            ) {
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
