"use client";

import { useState, useRef, useEffect } from "react";
import { ChatMessage } from "@/components/ChatMessage";
import { ChatInput } from "@/components/ChatInput";

interface Message {
  role: "user" | "assistant";
  content: string;
}

const EXAMPLE_QUESTIONS = [
  {
    label: "What is LeBron James eligible for in free agency?",
    icon: "👑",
  },
  {
    label: "How do Bird rights work?",
    icon: "🦅",
  },
  {
    label: "Explain the second apron and its restrictions",
    icon: "📊",
  },
  {
    label: "What kind of extension can the Thunder offer SGA?",
    icon: "📝",
  },
  {
    label: "What is the mid-level exception?",
    icon: "💰",
  },
  {
    label: "How does restricted free agency work?",
    icon: "🔒",
  },
];

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = async (content: string) => {
    const userMessage: Message = { role: "user", content };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setIsLoading(true);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: newMessages.map((m) => ({
            role: m.role,
            content: m.content,
          })),
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to get response");
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error("No reader");

      const decoder = new TextDecoder();
      let assistantContent = "";

      setMessages((prev) => [...prev, { role: "assistant", content: "" }]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split("\n");

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const data = line.slice(6);
            if (data === "[DONE]") break;
            try {
              const parsed = JSON.parse(data);
              if (parsed.text) {
                assistantContent += parsed.text;
                setMessages((prev) => {
                  const updated = [...prev];
                  updated[updated.length - 1] = {
                    role: "assistant",
                    content: assistantContent,
                  };
                  return updated;
                });
              }
            } catch {
              // skip malformed chunks
            }
          }
        }
      }
    } catch (error) {
      console.error("Error:", error);
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content:
            "Sorry, I encountered an error. Please make sure your API key is configured and try again.",
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-screen">
      {/* Header */}
      <header className="border-b border-[--color-border] bg-[--color-surface-raised]/80 backdrop-blur-md sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-[--color-nba-blue] flex items-center justify-center text-white font-bold text-sm shrink-0">
            CBA
          </div>
          <div>
            <h1 className="text-base font-semibold text-[--color-text-primary] leading-tight">
              NBA CBA Expert
            </h1>
            <p className="text-xs text-[--color-text-muted]">
              2023 CBA &middot; Live 2025-26 Stats &middot; Player Contracts
            </p>
          </div>
        </div>
      </header>

      {/* Messages area */}
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-4 py-6">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center min-h-[calc(100vh-12rem)]">
              {/* Hero */}
              <div className="text-center mb-10">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-[--color-nba-blue]/20 border border-[--color-nba-blue]/30 mb-5">
                  <svg
                    width="32"
                    height="32"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="text-[--color-accent]"
                  >
                    <circle cx="12" cy="12" r="10" />
                    <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
                  </svg>
                </div>
                <h2 className="text-2xl font-bold text-[--color-text-primary] mb-2">
                  Your AI Salary Cap Expert
                </h2>
                <p className="text-[--color-text-secondary] max-w-md mx-auto text-sm leading-relaxed">
                  Ask about CBA rules, player contracts, trade legality,
                  free agency, cap exceptions, and more. Backed by the full
                  2023 CBA text with live player data.
                </p>
              </div>

              {/* Example questions */}
              <div className="w-full max-w-lg">
                <p className="text-xs font-medium text-[--color-text-muted] uppercase tracking-wider mb-3 text-center">
                  Try asking
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {EXAMPLE_QUESTIONS.map((q) => (
                    <button
                      key={q.label}
                      onClick={() => sendMessage(q.label)}
                      className="group text-left text-sm px-3.5 py-2.5 rounded-xl
                        bg-[--color-surface-raised] border border-[--color-border]
                        hover:bg-[--color-surface-hover] hover:border-[--color-border-light]
                        transition-all duration-150
                        text-[--color-text-secondary] hover:text-[--color-text-primary]"
                    >
                      <span className="mr-2">{q.icon}</span>
                      {q.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Data badges */}
              <div className="flex flex-wrap gap-2 mt-8 justify-center">
                {[
                  "Full 2023 CBA",
                  "Plain-English Guide",
                  "700+ Player Stats",
                  "Live 2025-26 Season",
                ].map((badge) => (
                  <span
                    key={badge}
                    className="text-xs px-2.5 py-1 rounded-full
                      bg-[--color-accent-glow] text-[--color-accent]
                      border border-[--color-accent]/20"
                  >
                    {badge}
                  </span>
                ))}
              </div>
            </div>
          ) : (
            messages.map((msg, i) => (
              <ChatMessage key={i} role={msg.role} content={msg.content} />
            ))
          )}
          <div ref={messagesEndRef} />
        </div>
      </main>

      {/* Input */}
      <ChatInput onSend={sendMessage} disabled={isLoading} />
    </div>
  );
}
