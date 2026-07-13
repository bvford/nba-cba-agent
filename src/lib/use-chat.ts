"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createParser } from "eventsource-parser";
import { trackEvent } from "@/lib/analytics";
import type { FeedbackValue, Message } from "@/lib/chat-types";
import {
  type Chat,
  createChat,
  deleteChat as deleteChatFromStore,
  loadChats,
  saveChat,
} from "@/lib/chat-store";
import { TEAM_FULL_NAMES, normalizeTeamAbbr } from "@/lib/teams-meta";

const RATE_LIMIT_ERROR = "You've hit today's free limit (20 questions/day). Come back tomorrow!";
const OVERLOADED_ERROR = "The assistant is briefly overloaded — try again in a moment.";
const GENERIC_ERROR = "Something went wrong — try again.";

// Proper English possessive: names ending in "s" (Lakers, Celtics, Pacers…)
// take a bare apostrophe; everything else takes 's.
function possessive(name: string): string {
  return name.endsWith("s") ? `${name}'` : `${name}'s`;
}

class ChatRequestError extends Error {
  constructor(public readonly status: number) {
    super(`Chat request failed with status ${status}`);
  }
}

export function useChat() {
  const [chats, setChats] = useState<Chat[]>([]);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [chatPendingDelete, setChatPendingDelete] = useState<Chat | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const searchParams = useSearchParams();
  const askHandledRef = useRef(false);

  const refreshChats = useCallback(() => setChats(loadChats()), []);

  useEffect(() => {
    const timeoutId = window.setTimeout(refreshChats, 0);
    return () => window.clearTimeout(timeoutId);
  }, [refreshChats]);

  useEffect(() => {
    if (messages.length === 0) return;
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const persistChat = useCallback(
    (chatId: string, nextMessages: Message[]) => {
      const existing = loadChats().find((chat) => chat.id === chatId);
      if (!existing) return;
      saveChat({ ...existing, messages: nextMessages });
      refreshChats();
    },
    [refreshChats]
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
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.shiftKey && event.key.toLowerCase() === "k") {
        event.preventDefault();
        startNewChat();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [startNewChat]);

  const selectChat = (id: string) => {
    const chat = chats.find((candidate) => candidate.id === id);
    if (chat) {
      trackEvent("chat_selected", { title_length: chat.title.length });
      setActiveChatId(chat.id);
      setMessages(chat.messages);
      setEditingIndex(null);
      setDraft("");
    }
    setSidebarOpen(false);
  };

  const requestDeleteChat = (id: string) => {
    const chat = chats.find((candidate) => candidate.id === id);
    if (chat) setChatPendingDelete(chat);
  };

  const cancelDeleteChat = () => setChatPendingDelete(null);

  const confirmDeleteChat = () => {
    if (!chatPendingDelete) return;
    const id = chatPendingDelete.id;
    trackEvent("chat_deleted");
    deleteChatFromStore(id);
    refreshChats();
    setChatPendingDelete(null);
    if (activeChatId === id) {
      setActiveChatId(null);
      setMessages([]);
    }
  };

  const streamAssistantResponse = useCallback(
    async (baseMessages: Message[], chatId: string | null) => {
      setIsLoading(true);
      let assistantContent = "";
      let assistantSources: string[] = [];

      const updateAssistant = () => {
        setMessages((current) => {
          const updated = [...current];
          updated[updated.length - 1] = {
            role: "assistant",
            content: assistantContent,
            sources: assistantSources,
          };
          return updated;
        });
      };

      try {
        const response = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: baseMessages.map((message) => ({
              role: message.role,
              content: message.content,
            })),
          }),
        });

        if (!response.ok) throw new ChatRequestError(response.status);
        if (!response.body) throw new Error("Chat response did not include a stream.");

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let streamFinished = false;
        const parser = createParser({
          onEvent: (event) => {
            if (event.data === "[DONE]") {
              streamFinished = true;
              return;
            }

            try {
              const parsed: unknown = JSON.parse(event.data);
              if (!isRecord(parsed)) return;

              if (typeof parsed.text === "string" && parsed.text) {
                assistantContent += parsed.text;
                updateAssistant();
              }
              if (Array.isArray(parsed.sources)) {
                assistantSources = parsed.sources.filter(
                  (source): source is string => typeof source === "string"
                );
                updateAssistant();
              }
            } catch {
              // Preserve the previous behavior of ignoring malformed stream events.
            }
          },
        });

        setMessages((current) => [...current, { role: "assistant", content: "" }]);

        while (!streamFinished) {
          const { done, value } = await reader.read();
          if (done) break;
          parser.feed(decoder.decode(value, { stream: true }));
        }
        if (streamFinished) await reader.cancel();
        parser.feed(decoder.decode());

        const finalMessages: Message[] = [
          ...baseMessages,
          { role: "assistant", content: assistantContent, sources: assistantSources },
        ];
        setMessages(finalMessages);
        if (chatId) persistChat(chatId, finalMessages);
      } catch (error) {
        console.error("Chat request failed:", error);
        const errorMessage: Message = {
          role: "assistant",
          content: getErrorMessage(error),
          isError: true,
        };
        const errorMessages = [...baseMessages, errorMessage];
        setMessages(errorMessages);
        if (chatId) persistChat(chatId, errorMessages);
      } finally {
        setIsLoading(false);
      }
    },
    [persistChat]
  );

  const ensureChat = useCallback(
    (content: string, nextMessages: Message[]) => {
      if (activeChatId) {
        persistChat(activeChatId, nextMessages);
        return activeChatId;
      }

      const newChat = createChat(content);
      saveChat({ ...newChat, messages: nextMessages });
      setActiveChatId(newChat.id);
      refreshChats();
      return newChat.id;
    },
    [activeChatId, persistChat, refreshChats]
  );

  const sendMessage = useCallback(
    async (content: string) => {
      if (isLoading) return;
      trackEvent("message_sent", { chars: content.length, source: "new" });
      const nextMessages: Message[] = [...messages, { role: "user", content }];
      setMessages(nextMessages);
      const chatId = ensureChat(content, nextMessages);
      await streamAssistantResponse(nextMessages, chatId);
    },
    [isLoading, messages, ensureChat, streamAssistantResponse]
  );

  const sendEditedMessage = async (content: string, index: number) => {
    trackEvent("message_sent", { chars: content.length, source: "edit_resend" });
    const baseMessages: Message[] = [...messages.slice(0, index), { role: "user", content }];
    setMessages(baseMessages);
    const chatId = ensureChat(content, baseMessages);
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
    const baseMessages =
      messages[messages.length - 1].role === "assistant" ? messages.slice(0, -1) : messages;
    if (baseMessages.length === 0) return;

    setMessages(baseMessages);
    if (activeChatId) persistChat(activeChatId, baseMessages);
    await streamAssistantResponse(baseMessages, activeChatId);
  };

  const retryError = async (errorIndex: number) => {
    if (isLoading) return;
    const baseMessages = messages.slice(0, errorIndex);
    const lastUserMessage = [...baseMessages].reverse().find((message) => message.role === "user");
    if (!lastUserMessage) return;

    trackEvent("error_retry_clicked");
    setMessages(baseMessages);
    if (activeChatId) persistChat(activeChatId, baseMessages);
    await streamAssistantResponse(baseMessages, activeChatId);
  };

  const exportChat = async () => {
    if (messages.length === 0) return;
    const markdown = [
      "# NBA CBA Chat Export",
      "",
      `Exported: ${new Date().toLocaleString()}`,
      "",
      ...messages.flatMap((message) => [
        `## ${message.role === "user" ? "User" : "Assistant"}`,
        "",
        message.content,
        "",
        ...(message.sources?.length ? [`Sources: ${message.sources.join("; ")}`, ""] : []),
      ]),
    ].join("\n");

    try {
      await navigator.clipboard.writeText(markdown);
      trackEvent("export_chat_clicked", { message_count: messages.length });
      setToast("Chat copied to clipboard as markdown.");
    } catch (error) {
      console.error("Could not copy chat:", error);
      setToast("Could not copy the chat to your clipboard.");
    }
  };

  const handleFeedback = (index: number, feedback: FeedbackValue) => {
    trackEvent("answer_feedback", { feedback, index });
    setMessages((current) => {
      const updated = [...current];
      updated[index] = { ...updated[index], feedback };
      return updated;
    });
  };

  const beginEditUserMessage = (index: number) => {
    if (messages[index]?.role !== "user") return;
    setEditingIndex(index);
    setDraft(messages[index].content);
  };

  const cancelEdit = () => {
    setEditingIndex(null);
    setDraft("");
  };

  const goToChatComposer = () => {
    trackEvent("chat_nav_clicked");
    const composer = document.querySelector("textarea");
    if (composer instanceof HTMLTextAreaElement) {
      composer.focus();
      composer.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  };

  // Handles the "Ask about the {Team}" link from a /teams/[abbr] page
  // (/?ask=ATL). askHandledRef — not the dependency array — is what stops
  // this from firing more than once. The send itself is deferred a tick
  // (same pattern as refreshChats above) so the effect body never calls
  // setState synchronously.
  useEffect(() => {
    if (askHandledRef.current) return;
    const ask = searchParams.get("ask");
    if (!ask) return;
    askHandledRef.current = true;

    const abbr = normalizeTeamAbbr(ask.toUpperCase());
    const teamName = TEAM_FULL_NAMES[abbr];
    router.replace("/", { scroll: false });
    if (!teamName) return;

    const timeoutId = window.setTimeout(() => {
      trackEvent("team_ask_link_used", { abbr });
      void sendMessage(`What's the ${possessive(teamName)} cap situation and available exceptions this offseason?`);
    }, 0);
    return () => window.clearTimeout(timeoutId);
  }, [searchParams, router, sendMessage]);

  return {
    chats,
    activeChatId,
    messages,
    isLoading,
    sidebarOpen,
    setSidebarOpen,
    draft,
    setDraft,
    editingIndex,
    messagesEndRef,
    chatPendingDelete,
    toast,
    dismissToast: () => setToast(null),
    startNewChat,
    selectChat,
    requestDeleteChat,
    cancelDeleteChat,
    confirmDeleteChat,
    sendMessage,
    handleInputSend,
    regenerateLast,
    retryError,
    exportChat,
    handleFeedback,
    beginEditUserMessage,
    cancelEdit,
    goToChatComposer,
    canRegenerate: !isLoading && messages.some((message) => message.role === "assistant"),
    isLanding: messages.length === 0,
  };
}

function getErrorMessage(error: unknown): string {
  if (error instanceof ChatRequestError) {
    if (error.status === 429) return RATE_LIMIT_ERROR;
    if (error.status === 503) return OVERLOADED_ERROR;
  }
  return GENERIC_ERROR;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
