"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { ChatMessage } from "@/components/ChatMessage";
import { ChatInput } from "@/components/ChatInput";
import { Sidebar } from "@/components/Sidebar";
import { trackEvent } from "@/lib/analytics";
import {
  Chat,
  loadChats,
  saveChat,
  deleteChat as deleteChatFromStore,
  createChat,
} from "@/lib/chat-store";

type FeedbackValue = "up" | "down";

interface Message {
  role: "user" | "assistant";
  content: string;
  sources?: string[];
  feedback?: FeedbackValue;
}

const EXAMPLE_QUESTIONS = [
  { label: "What is LeBron James eligible for in free agency?", icon: "👑" },
  { label: "How do Bird rights work?", icon: "🦅" },
  { label: "Explain the second apron and its restrictions", icon: "📊" },
  { label: "What kind of extension can the Thunder offer SGA?", icon: "📝" },
  { label: "What is the mid-level exception?", icon: "💰" },
  { label: "How does restricted free agency work?", icon: "🔒" },
];

const STARTER_MODES = [
  {
    label: "Contracts",
    prompt:
      "Break down this player's contract in plain English. Player: [name]. Include years, salary by season, guarantees, options, bonuses, and extension eligibility.",
  },
  {
    label: "Trades",
    prompt:
      "Evaluate whether this trade is legal and smart under the current CBA. Team A sends: [players/picks], Team B sends: [players/picks]. Explain salary matching, apron constraints, and long-term cap impact.",
  },
  {
    label: "Free Agency",
    prompt:
      "Map this team's offseason options under the current CBA. Team: [name]. Include cap room estimate, key free agents, exceptions available, and realistic move paths.",
  },
  {
    label: "Cap Exceptions",
    prompt:
      "Identify which cap exceptions this team can use right now and rank them by usefulness. Team: [name]. Explain eligibility, spending limits, and apron-related restrictions.",
  },
];

const FEATURE_CARDS = [
  {
    title: "NBA Salary Cap Tool",
    description:
      "Understand team flexibility, apron pressure, and realistic offseason pathways in one answer.",
    prompt:
      "Map this team's offseason options under the current CBA. Team: [name]. Include cap room estimate, key free agents, exceptions available, and realistic move paths.",
  },
  {
    title: "Trade Rules Explorer",
    description:
      "Pressure-test a deal for legality and strategic fit with salary matching and apron constraints.",
    prompt:
      "Evaluate whether this trade is legal and smart under the current CBA. Team A sends: [players/picks], Team B sends: [players/picks]. Explain salary matching, apron constraints, and long-term cap impact.",
  },
  {
    title: "Contract Examples",
    description:
      "Get a plain-English breakdown of contract structure, guarantees, options, and extension leverage.",
    prompt:
      "Break down this player's contract in plain English. Player: [name]. Include years, salary by season, guarantees, options, bonuses, and extension eligibility.",
  },
];

export default function Home() {
  const [chats, setChats] = useState<Chat[]>([]);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
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
    trackEvent("new_chat_clicked", { had_messages: messages.length > 0 });
    setActiveChatId(null);
    setMessages([]);
    setDraft("");
    setEditingIndex(null);
    setSidebarOpen(false);
  }, [messages.length]);

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
      trackEvent("chat_selected", { title_length: chat.title.length });
      setActiveChatId(chat.id);
      setMessages(chat.messages as Message[]);
      setEditingIndex(null);
      setDraft("");
    }
    setSidebarOpen(false);
  };

  const handleDeleteChat = (id: string) => {
    const chat = chats.find((c) => c.id === id);
    const confirmed = window.confirm(
      `Delete this chat${chat?.title ? `: "${chat.title}"` : ""}? This cannot be undone.`
    );
    if (!confirmed) return;

    trackEvent("chat_deleted");
    deleteChatFromStore(id);
    setChats(loadChats());
    if (activeChatId === id) {
      setActiveChatId(null);
      setMessages([]);
    }
  };

  const streamAssistantResponse = async (baseMessages: Message[], chatId: string | null) => {
    setIsLoading(true);
    let assistantContent = "";
    let assistantSources: string[] = [];

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: baseMessages.map((m) => ({
            role: m.role,
            content: m.content,
          })),
        }),
      });

      if (!response.ok) throw new Error("Failed to get response");

      const reader = response.body?.getReader();
      if (!reader) throw new Error("No reader");

      const decoder = new TextDecoder();

      setMessages((prev) => [...prev, { role: "assistant", content: "" }]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split("\n");

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;

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
                  sources: assistantSources,
                };
                return updated;
              });
            }
            if (Array.isArray(parsed.sources)) {
              assistantSources = parsed.sources;
              setMessages((prev) => {
                const updated = [...prev];
                const last = updated[updated.length - 1];
                updated[updated.length - 1] = {
                  ...last,
                  role: "assistant",
                  content: assistantContent,
                  sources: assistantSources,
                };
                return updated;
              });
            }
          } catch {
            // skip malformed chunks
          }
        }
      }

      const finalMessages: Message[] = [
        ...baseMessages,
        { role: "assistant", content: assistantContent, sources: assistantSources },
      ];
      setMessages(finalMessages);
      if (chatId) persistChat(chatId, finalMessages);
    } catch (error) {
      console.error("Error:", error);
      const errorMessages: Message[] = [
        ...baseMessages,
        {
          role: "assistant",
          content: "Sorry, I encountered an error. Please check your API key and try again.",
        },
      ];
      setMessages(errorMessages);
      if (chatId) persistChat(chatId, errorMessages);
    } finally {
      setIsLoading(false);
    }
  };

  const sendMessage = async (content: string) => {
    trackEvent("message_sent", { chars: content.length, source: "new" });
    const userMessage: Message = { role: "user", content };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);

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

    await streamAssistantResponse(newMessages, chatId);
  };

  const sendEditedMessage = async (content: string, index: number) => {
    trackEvent("message_sent", { chars: content.length, source: "edit_resend" });
    const rewritten: Message = { role: "user", content };
    const baseMessages = [...messages.slice(0, index), rewritten];
    setMessages(baseMessages);

    let chatId = activeChatId;
    if (!chatId) {
      const newChat = createChat(content);
      chatId = newChat.id;
      setActiveChatId(chatId);
      saveChat({ ...newChat, messages: baseMessages });
      setChats(loadChats());
    } else {
      persistChat(chatId, baseMessages);
    }

    await streamAssistantResponse(baseMessages, chatId);
  };

  const handleInputSend = async (content: string) => {
    if (editingIndex !== null) {
      const target = editingIndex;
      setEditingIndex(null);
      setDraft("");
      await sendEditedMessage(content, target);
      return;
    }
    setDraft("");
    await sendMessage(content);
  };

  const regenerateLast = async () => {
    if (isLoading || messages.length === 0) return;
    trackEvent("regenerate_clicked");

    const baseMessages = messages[messages.length - 1].role === "assistant"
      ? messages.slice(0, -1)
      : messages;

    if (baseMessages.length === 0) return;

    setMessages(baseMessages);
    if (activeChatId) persistChat(activeChatId, baseMessages);
    await streamAssistantResponse(baseMessages, activeChatId);
  };

  const exportChat = async () => {
    if (messages.length === 0) return;
    const timestamp = new Date().toLocaleString();
    const markdown = [
      `# NBA CBA Chat Export`,
      ``,
      `Exported: ${timestamp}`,
      ``,
      ...messages.flatMap((m) => [
        `## ${m.role === "user" ? "User" : "Assistant"}`,
        "",
        m.content,
        "",
        ...(m.sources && m.sources.length > 0
          ? [`Sources: ${m.sources.join("; ")}`, ""]
          : []),
      ]),
    ].join("\n");

    await navigator.clipboard.writeText(markdown);
    trackEvent("export_chat_clicked", { message_count: messages.length });
    window.alert("Chat copied to clipboard as markdown.");
  };

  const handleFeedback = (index: number, feedback: FeedbackValue) => {
    trackEvent("answer_feedback", { feedback, index });
    setMessages((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], feedback };
      return updated;
    });
  };

  const beginEditUserMessage = (index: number) => {
    if (messages[index]?.role !== "user") return;
    setEditingIndex(index);
    setDraft(messages[index].content);
  };

  const goToChatComposer = () => {
    trackEvent("chat_nav_clicked");
    const composer = document.querySelector("textarea");
    if (composer instanceof HTMLTextAreaElement) {
      composer.focus();
      composer.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  };

  const canRegenerate = !isLoading && messages.some((m) => m.role === "assistant");
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
        <header className="border-b border-[--color-border] bg-[--color-surface-raised]/75 backdrop-blur-xl sticky top-0 z-10">
          <div className="max-w-5xl mx-auto px-4 py-3 flex items-center gap-3">
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
                  ChatCBA
                </h1>
                <p className="text-[10px] text-[--color-text-muted] hidden sm:block">
                  2023 CBA &middot; Live 2025-26 Stats
                </p>
              </div>
            </button>

            <nav className="ml-auto hidden md:flex items-center gap-1 rounded-full border border-[--color-border] bg-[--color-surface]/45 px-1.5 py-1">
              <button
                onClick={startNewChat}
                className="text-xs px-3 py-1.5 rounded-full text-[--color-text-secondary] hover:text-[--color-text-primary] hover:bg-[--color-surface-hover] transition-colors"
              >
                Home
              </button>
              <button
                onClick={goToChatComposer}
                className="text-xs px-3 py-1.5 rounded-full text-[--color-text-secondary] hover:text-[--color-text-primary] hover:bg-[--color-surface-hover] transition-colors"
              >
                Chat
              </button>
              <a
                href="/about"
                className="text-xs px-3 py-1.5 rounded-full text-[--color-text-secondary] hover:text-[--color-text-primary] hover:bg-[--color-surface-hover] transition-colors"
              >
                About
              </a>
            </nav>

            {messages.length > 0 && (
              <button
                onClick={exportChat}
                className="text-xs px-3 py-1.5 rounded-full border border-[--color-border] text-[--color-text-secondary] hover:text-[--color-text-primary] hover:bg-[--color-surface-hover] hover:border-[--color-border-light] transition-colors"
                title="Copy chat as markdown"
              >
                Export Chat
              </button>
            )}
          </div>
        </header>

        {/* Messages area */}
        <main id="chat" className="flex-1 overflow-y-auto">
          <div className="max-w-4xl mx-auto px-4 py-6 md:py-8">
            {isLanding ? (
              <div className="flex flex-col min-h-[calc(100vh-12rem)]">
                {/* Hero */}
                <section className="text-center pt-8 md:pt-14 mb-10 md:mb-12">
                  <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-[linear-gradient(145deg,rgba(77,111,240,0.28),rgba(79,210,184,0.18))] border border-[--color-border-light] mb-5 shadow-[0_16px_45px_rgba(8,10,15,0.55)]">
                    <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-[--color-nba-red]">
                      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                      <circle cx="10" cy="10" r="1" />
                      <circle cx="14" cy="10" r="1" />
                      <circle cx="18" cy="10" r="1" />
                    </svg>
                  </div>
                  <h2 className="text-4xl md:text-5xl font-bold tracking-tight text-[--color-text-primary] mb-3">
                    Your AI Salary Cap Expert
                  </h2>
                  <p className="text-[--color-text-secondary] max-w-2xl mx-auto text-sm md:text-base leading-relaxed">
                    Ask questions about cap mechanics, contract structure, and roster-building strategy.
                    Get concise answers grounded in the 2023 CBA and updated salary/stat context.
                  </p>
                  <div className="mt-6 flex flex-wrap items-center justify-center gap-2.5">
                    <button
                      onClick={goToChatComposer}
                      className="text-sm px-4 py-2 rounded-full bg-[linear-gradient(135deg,var(--color-nba-blue),var(--color-nba-blue-light))] text-white font-semibold shadow-[0_12px_30px_rgba(43,90,224,0.32)] hover:-translate-y-0.5 transition-all"
                    >
                      Start Chatting
                    </button>
                    <a
                      href="/about"
                      className="text-sm px-4 py-2 rounded-full border border-[--color-border-light] text-[--color-text-secondary] hover:text-[--color-text-primary] hover:bg-[--color-surface-hover] transition-colors"
                    >
                      Learn More
                    </a>
                  </div>
                </section>

                <section className="mb-8">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4">
                    {FEATURE_CARDS.map((card) => (
                      <button
                        key={card.title}
                        onClick={() => sendMessage(card.prompt)}
                        className="text-left p-4 rounded-2xl border border-[--color-border] bg-[--color-surface-raised]/88 hover:bg-[--color-surface-hover]/85 hover:border-[--color-border-light] hover:-translate-y-1 transition-all duration-200 shadow-[0_10px_24px_rgba(6,9,16,0.34)]"
                      >
                        <h3 className="text-base font-semibold text-[--color-text-primary] mb-1.5">{card.title}</h3>
                        <p className="text-xs leading-relaxed text-[--color-text-secondary]">{card.description}</p>
                      </button>
                    ))}
                  </div>
                </section>

                <div className="w-full max-w-2xl mx-auto mb-4">
                  <p className="text-xs font-semibold text-[--color-text-muted] uppercase tracking-[0.18em] mb-2 text-center">
                    Starter modes
                  </p>
                  <div className="flex flex-wrap justify-center gap-2">
                    {STARTER_MODES.map((mode) => (
                      <button
                        key={mode.label}
                        onClick={() => sendMessage(mode.prompt)}
                        className="text-xs px-3 py-1.5 rounded-full border border-[--color-border] bg-[--color-surface-raised]/85 text-[--color-text-secondary] hover:text-[--color-text-primary] hover:border-[--color-border-light] hover:bg-[--color-surface-hover] transition-colors"
                      >
                        {mode.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Example questions */}
                <div className="w-full max-w-2xl mx-auto">
                  <p className="text-xs font-semibold text-[--color-text-muted] uppercase tracking-[0.18em] mb-3 text-center">
                    Try asking
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {EXAMPLE_QUESTIONS.map((q) => (
                      <button
                        key={q.label}
                        onClick={() => sendMessage(q.label)}
                        className="group text-left text-sm px-3.5 py-2.5 rounded-xl
                          bg-[--color-surface-raised]/92 border border-[--color-border]
                          hover:bg-[--color-surface-hover] hover:border-[--color-border-light] hover:-translate-y-0.5
                          transition-all duration-150 shadow-sm
                          text-[--color-text-secondary] hover:text-[--color-text-primary] hover:shadow-[0_14px_30px_rgba(8,11,18,0.5)]"
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

                <footer className="mt-auto pt-10 pb-2 border-t border-[--color-border]/80">
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-2 text-[11px] text-[--color-text-muted]">
                    <p>© {new Date().getFullYear()} ChatCBA. All rights reserved.</p>
                    <div className="flex items-center gap-3">
                      <a href="/privacy" className="hover:text-[--color-text-secondary] transition-colors">Privacy</a>
                      <a href="/terms" className="hover:text-[--color-text-secondary] transition-colors">Terms</a>
                    </div>
                  </div>
                </footer>
              </div>
            ) : (
              <div className="max-w-3xl mx-auto w-full">
                {messages.map((msg, i) => (
                  <ChatMessage
                    key={i}
                    role={msg.role}
                    content={msg.content}
                    sources={msg.sources}
                    feedback={msg.feedback}
                    onFeedback={(value) => handleFeedback(i, value)}
                    onEditResend={msg.role === "user" ? () => beginEditUserMessage(i) : undefined}
                  />
                ))}
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        </main>

        {/* Input */}
        <ChatInput
          value={draft}
          onValueChange={setDraft}
          onSend={handleInputSend}
          disabled={isLoading}
          isEditing={editingIndex !== null}
          onCancelEdit={() => {
            setEditingIndex(null);
            setDraft("");
          }}
          onRegenerate={regenerateLast}
          canRegenerate={canRegenerate}
        />
      </div>
    </div>
  );
}
