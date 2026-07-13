"use client";

import { useEffect } from "react";
import { Chat } from "@/lib/chat-store";
import { SIDEBAR_SOURCES } from "@/lib/sources";

interface SidebarProps {
  chats: Chat[];
  activeChatId: string | null;
  isOpen: boolean;
  onClose: () => void;
  onSelectChat: (id: string) => void;
  onNewChat: () => void;
  onDeleteChat: (id: string) => void;
}

function timeAgo(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 60) return "Just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(timestamp).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

export function Sidebar({
  chats,
  activeChatId,
  isOpen,
  onClose,
  onSelectChat,
  onNewChat,
  onDeleteChat,
}: SidebarProps) {
  useEffect(() => {
    if (!isOpen) return;
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [isOpen, onClose]);

  return (
    <>
      {/* Backdrop (mobile) */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-30 lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar panel — fixed drawer on mobile, a normal flex sibling on
          desktop so the whole app shell (sidebar + content) can be centered
          as one unit instead of the sidebar pinning to the true viewport
          edge and leaving dead space on wide screens. */}
      <aside
        className={`fixed top-0 left-0 h-full w-72 bg-[linear-gradient(180deg,rgba(17,26,43,0.95),rgba(10,16,28,0.95))] backdrop-blur-xl border-r border-(--color-border)
          z-40 flex flex-col transition-transform duration-200 ease-out shadow-2xl
          ${isOpen ? "translate-x-0" : "-translate-x-full"}
          lg:static lg:z-auto lg:flex-shrink-0 lg:translate-x-0 lg:shadow-none`}
      >
        {/* Sidebar header */}
        <div className="p-3 border-b border-(--color-border) flex items-center gap-2">
          <button
            onClick={onNewChat}
            aria-label="Start a new chat"
            className="flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg
              bg-[linear-gradient(135deg,var(--color-accent),var(--color-accent-light))] text-(--color-accent-ink) text-sm font-semibold
              transition-all duration-150 shadow-[0_6px_16px_rgba(255,106,31,0.2)] hover:brightness-105
              focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--color-accent)"
            title="New chat (Cmd/Ctrl+Shift+K)"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            New Chat
          </button>
          <button
            onClick={onClose}
            aria-label="Close chat history"
            className="p-2 rounded-lg hover:bg-(--color-surface-hover) text-(--color-text-muted) lg:hidden transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--color-accent)"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Chat list */}
        <div className="flex-1 overflow-y-auto p-2">
          <p className="px-2 pb-2 text-[10px] uppercase tracking-[0.16em] text-(--color-text-muted)">
            Recent chats
          </p>
          {chats.length === 0 ? (
            <div className="rounded-xl border border-dashed border-(--color-border-light) bg-(--color-surface)/35 p-4 mt-4 mx-1">
              <p className="text-(--color-text-secondary) text-sm font-medium mb-2">
                No chats yet
              </p>
              <p className="text-[11px] text-(--color-text-muted) leading-relaxed">
                Start with the <span className="text-(--color-text-secondary)">New Chat</span> button, or click one of the example prompts in the main area.
              </p>
            </div>
          ) : (
            chats.map((chat) => (
              <div
                key={chat.id}
                className={`group relative flex items-center rounded-lg px-3 py-2.5 mb-1 cursor-pointer transition-colors duration-100 border
                  ${
                    chat.id === activeChatId
                      ? "bg-(--color-surface-hover) text-(--color-text-primary) border-(--color-border-light) shadow-[0_8px_16px_rgba(7,10,16,0.35)]"
                      : "text-(--color-text-secondary) border-transparent hover:bg-(--color-surface-hover)/60"
                  }`}
                onClick={() => onSelectChat(chat.id)}
              >
                {chat.id === activeChatId && (
                  <span className="absolute left-0 top-1.5 bottom-1.5 w-0.5 rounded-r bg-(--color-accent)" />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm truncate font-medium">{chat.title}</p>
                  <p className="text-[10px] text-(--color-text-muted) mt-0.5">
                    {timeAgo(chat.createdAt)}
                  </p>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeleteChat(chat.id);
                  }}
                  aria-label={`Delete chat: ${chat.title}`}
                  className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-(--color-surface)/50
                    [@media(pointer:coarse)]:opacity-60 text-(--color-text-muted) hover:text-(--color-danger)
                    transition-all duration-100 shrink-0 ml-1 focus-visible:opacity-100 focus-visible:outline-none
                    focus-visible:ring-2 focus-visible:ring-(--color-accent)"
                  title="Delete chat"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                  </svg>
                </button>
              </div>
            ))
          )}
        </div>

        {/* Sources */}
        <div className="p-3 border-t border-(--color-border) bg-gradient-to-b from-transparent to-[rgba(23,64,139,0.16)]">
          <p className="px-1 pb-2 text-[10px] uppercase tracking-[0.16em] text-(--color-text-muted)">
            Sources
          </p>
          <div className="space-y-1.5">
            {SIDEBAR_SOURCES.map((link) => (
              <a
                key={link.url}
                href={link.url}
                target={link.url.startsWith("http") ? "_blank" : undefined}
                rel={link.url.startsWith("http") ? "noreferrer" : undefined}
                className="block rounded-xl border border-(--color-border) hover:border-(--color-accent)/40 bg-(--color-surface)/45 hover:bg-(--color-surface-hover)/75 px-3 py-2.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--color-accent)"
              >
                <p className="text-[13px] text-(--color-text-primary) leading-tight font-medium">
                  {link.sidebarLabel ?? link.label}
                </p>
                <p className="text-xs text-(--color-text-muted) mt-1">
                  {link.note}
                </p>
              </a>
            ))}
          </div>
        </div>

        {/* Sidebar footer */}
        <div className="p-3 border-t border-(--color-border)">
          <p className="text-[11px] text-(--color-text-secondary) text-left font-medium">
            A Michael Margolis Experiment
          </p>
          <p className="hidden sm:block text-[10px] text-(--color-text-muted) text-left mt-1">
            Cmd/Ctrl + Shift + K for New Chat
          </p>
          <nav className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-(--color-text-muted)">
            {[
              ["Home", "/"],
              ["Team Cap Sheets", "/teams"],
              ["About", "/about"],
              ["Privacy", "/privacy"],
              ["Terms", "/terms"],
            ].map(([label, href]) => (
              <a
                key={href}
                href={href}
                className="hover:text-(--color-text-secondary) transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--color-accent)"
              >
                {label}
              </a>
            ))}
          </nav>
        </div>
      </aside>
    </>
  );
}
