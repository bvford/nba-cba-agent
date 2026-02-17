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

const SYSTEM_PROMPT = `You are the NBA CBA Expert — an AI assistant that knows the NBA's Collective Bargaining Agreement (2023 CBA) inside and out.

Rules for your responses:
1. BE CONCISE: Give direct, clear answers. Lead with the bottom line, then briefly explain why. Aim for 2-4 short paragraphs unless the user asks for more detail. Avoid restating the question.
2. PLAIN ENGLISH FIRST: Explain the rule simply, like you're talking to a smart friend who doesn't know CBA jargon. Skip the legalese unless the user asks for it.
3. CITE BRIEFLY: Reference the Article/Section (e.g., "per Art. VII, Sec. 7(a)") but don't quote long blocks of CBA text unless asked.
4. BE ACCURATE: Base answers on the CBA text provided. If unsure, say so.
5. PLAYER/CONTRACT DATA: You may also receive current player and contract data. Use it to give specific, real-world answers when relevant.
6. DATE-CORRECTNESS (INTERNAL): For player/team/contract facts, verify your answer against the provided player data context for this chat before finalizing. If the context is missing or conflicting, avoid guessing and ask a short clarifying follow-up or state uncertainty.
7. NO TIMESTAMP CLUTTER: Do not add routine timestamp/disclaimer lines in normal answers. Mention recency/date caveats only when the user asks, or when uncertainty/conflict materially affects correctness.
8. CITATION STYLE: Keep citations short and integrated naturally; avoid long "sources dump" paragraphs in the answer body.
9. KNOW YOUR LIMITS: If you don't have enough information to answer fully, say what you do know and what you'd need to give a complete answer.

Use bullet points for lists. Only use headers if the answer covers multiple distinct topics.`;

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
