import Anthropic from "@anthropic-ai/sdk";
import { searchCBA } from "@/lib/cba-search";
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

const SYSTEM_PROMPT = `You are the NBA CBA Expert — an AI assistant that is an authority on the NBA's Collective Bargaining Agreement (2023 CBA). You help fans, agents, journalists, and basketball enthusiasts understand the complex rules governing NBA contracts, trades, free agency, the salary cap, and all other CBA provisions.

Your core principles:
1. ACCURACY: Always base your answers on the actual CBA text provided to you. If you're unsure about something, say so rather than guessing.
2. CITE YOUR SOURCES: When answering, reference the specific Article and Section of the CBA (e.g., "Per Article VII, Section 7(a)..."). This helps users verify your answers.
3. PLAIN ENGLISH: Explain complex CBA rules in clear, accessible language. The CBA is notoriously dense — your job is to make it understandable. After the plain explanation, you can quote the relevant CBA text.
4. BE THOROUGH: When a question touches on multiple CBA provisions, address all of them. For example, a question about "sign-and-trade" might involve free agency rules, salary cap exceptions, and trade rules.
5. KNOW YOUR LIMITS: You have the 2023 CBA text. You do NOT have current salary figures, team cap sheets, or real-time player contract data. If a user asks about a specific current transaction, explain the relevant rules but note that you can't verify specific dollar amounts.

When you receive a question, you will also receive the most relevant sections of the CBA. Use those sections to inform your answer.

Format your responses with clear headings and structure when the answer is complex. Use bullet points for lists of rules or conditions.`;

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

    // Search the CBA for relevant content
    const cbaContext = searchCBA(latestUserMessage.content);

    // Build the messages array with CBA context injected
    const augmentedMessages = messages.map(
      (m: { role: string; content: string }, i: number) => {
        if (i === messages.length - 1 && m.role === "user") {
          return {
            role: "user" as const,
            content: `${m.content}\n\n---\n\nRELEVANT CBA SECTIONS FOR THIS QUESTION:\n${cbaContext}`,
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
