"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { ChatMessage } from "@/components/ChatMessage";
import { ChatInput } from "@/components/ChatInput";
import { Sidebar } from "@/components/Sidebar";
import {
  Chat,
  loadChats,
  saveChat,
  deleteChat as deleteChatFromStore,
  createChat,
} from "@/lib/chat-store";

interface Message {
  role: "user" | "assistant";
  content: string;
}

const EXAMPLE_QUESTIONS = [
  { label: "What is LeBron James eligible for in free agency?", icon: "👑" },
  { label: "How do Bird rights work?", icon: "🦅" },
  { label: "Explain the second apron and its restrictions", icon: "📊" },
  { label: "What kind of extension can the Thunder offer SGA?", icon: "📝" },
  { label: "What is the mid-level exception?", icon: "💰" },
  { label: "How does restricted free agency work?", icon: "🔒" },
];

export default function Home() {
  const [chats, setChats] = useState<Chat[]>([]);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Load chats from localStorage on mount
  useEffect(() => {
    setChats(loadChats());
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Persist messages to chat store whenever they change
  const persistChat = useCallback(
    (chatId: string, msgs: Message[]) => {
      const existing = chats.find((c) => c.id === chatId);
      if (existing) {
        const updated = { ...existing, messages: msgs };
        saveChat(updated);
        setChats(loadChats());
      }
    },
    [chats]
  );

  const startNewChat = useCallback(() => {
    setActiveChatId(null);
    setMessages([]);
    setSidebarOpen(false);
  }, []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === "k") {
        e.preventDefault();
        startNewChat();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [startNewChat]);

  const selectChat = (id: string) => {
    const chat = chats.find((c) => c.id === id);
    if (chat) {
      setActiveChatId(chat.id);
      setMessages(chat.messages);
    }
    setSidebarOpen(false);
  };

  const handleDeleteChat = (id: string) => {
    const chat = chats.find((c) => c.id === id);
    const confirmed = window.confirm(
      `Delete this chat${chat?.title ? `: "${chat.title}"` : ""}? This cannot be undone.`
    );
    if (!confirmed) return;

    deleteChatFromStore(id);
    setChats(loadChats());
    if (activeChatId === id) {
      setActiveChatId(null);
      setMessages([]);
    }
  };

  const sendMessage = async (content: string) => {
    const userMessage: Message = { role: "user", content };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setIsLoading(true);

    // Create or update chat
    let chatId = activeChatId;
    if (!chatId) {
      const newChat = createChat(content);
      chatId = newChat.id;
      setActiveChatId(chatId);
      saveChat({ ...newChat, messages: newMessages });
      setChats(loadChats());
    } else {
      persistChat(chatId, newMessages);
    }

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

      if (!response.ok) throw new Error("Failed to get response");

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
              // skip
            }
          }
        }
      }

      // Save final messages with assistant response
      const finalMessages = [
        ...newMessages,
        { role: "assistant" as const, content: assistantContent },
      ];
      setMessages(finalMessages);
      if (chatId) persistChat(chatId, finalMessages);
    } catch (error) {
      console.error("Error:", error);
      const errorMessages = [
        ...newMessages,
        {
          role: "assistant" as const,
          content: "Sorry, I encountered an error. Please check your API key and try again.",
        },
      ];
      setMessages(errorMessages);
      if (chatId) persistChat(chatId, errorMessages);
    } finally {
      setIsLoading(false);
    }
  };

  const isLanding = messages.length === 0;

  return (
    <div className="flex h-screen bg-gradient-page">
      {/* Sidebar */}
      <Sidebar
        chats={chats}
        activeChatId={activeChatId}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        onSelectChat={selectChat}
        onNewChat={startNewChat}
        onDeleteChat={handleDeleteChat}
      />

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <header className="border-b border-[--color-border] bg-[--color-surface-raised]/85 backdrop-blur-md sticky top-0 z-10">
          <div className="max-w-4xl mx-auto px-4 py-3 flex items-center gap-3">
            {/* Hamburger / sidebar toggle */}
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="p-1.5 rounded-lg hover:bg-[--color-surface-hover] text-[--color-text-muted] hover:text-[--color-text-secondary] transition-colors lg:hidden"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="18" x2="21" y2="18" />
              </svg>
            </button>

            {/* Logo - click to go home */}
            <button
              onClick={startNewChat}
              className="flex items-center gap-2.5 hover:opacity-85 transition-opacity"
              title="Home (new chat)"
            >
              <div className="text-left">
                <h1 className="text-sm font-semibold tracking-tight text-[--color-text-primary] leading-tight">
                  NBA CBA Chat Bot
                </h1>
                <p className="text-[10px] text-[--color-text-muted] hidden sm:block">
                  2023 CBA &middot; Live 2025-26 Stats
                </p>
              </div>
            </button>
          </div>
        </header>

        {/* Messages area */}
        <main className="flex-1 overflow-y-auto">
          <div className="max-w-4xl mx-auto px-4 py-6 md:py-8">
            {isLanding ? (
              <div className="flex flex-col items-center justify-center min-h-[calc(100vh-12rem)]">
                {/* Hero */}
                <div className="text-center mb-10">
                  <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-[--color-nba-red]/15 border border-[--color-nba-red]/35 mb-5 shadow-[0_0_40px_rgba(200,16,46,0.28)]">
                    <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-[--color-nba-red]">
                      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                      <circle cx="10" cy="10" r="1" />
                      <circle cx="14" cy="10" r="1" />
                      <circle cx="18" cy="10" r="1" />
                    </svg>
                  </div>
                  <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-[--color-text-primary] mb-3">
                    Your AI Salary Cap Expert
                  </h2>
                  <p className="text-[--color-text-secondary] max-w-xl mx-auto text-sm md:text-base leading-relaxed">
                    Ask about CBA rules, player contracts, trade legality,
                    free agency, cap exceptions, and more.
                  </p>
                </div>

                {/* Example questions */}
                <div className="w-full max-w-2xl">
                  <p className="text-xs font-semibold text-[--color-text-muted] uppercase tracking-[0.18em] mb-3 text-center">
                    Try asking
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {EXAMPLE_QUESTIONS.map((q) => (
                      <button
                        key={q.label}
                        onClick={() => sendMessage(q.label)}
                        className="group text-left text-sm px-3.5 py-2.5 rounded-xl
                          bg-[--color-surface-raised] border border-[--color-border]
                          hover:bg-[--color-surface-hover] hover:border-[--color-border-light] hover:-translate-y-0.5
                          transition-all duration-150 shadow-sm
                          text-[--color-text-secondary] hover:text-[--color-text-primary]"
                      >
                        <span className="mr-2">{q.icon}</span>
                        {q.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="mt-7 text-center text-xs text-[--color-text-muted]">
                  Tip: press <span className="text-[--color-text-secondary] font-medium">Cmd/Ctrl + Shift + K</span> to start a new chat
                </div>
              </div>
            ) : (
              <div className="max-w-3xl mx-auto w-full">
                {messages.map((msg, i) => (
                  <ChatMessage key={i} role={msg.role} content={msg.content} />
                ))}
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        </main>

        {/* Input */}
        <ChatInput onSend={sendMessage} disabled={isLoading} />
      </div>
    </div>
  );
}
