"use client";

import { Chat } from "@/lib/chat-store";

interface SidebarProps {
  chats: Chat[];
  activeChatId: string | null;
  isOpen: boolean;
  onClose: () => void;
  onSelectChat: (id: string) => void;
  onNewChat: () => void;
  onDeleteChat: (id: string) => void;
}

const SOURCE_LINKS = [
  {
    label: "CBA Guide (Plain English)",
    href: "https://cbaguide.com/#top",
    note: "Quick rule explanations",
  },
  {
    label: "Official 2023 CBA (NBPA)",
    href: "https://nbpa.com/cba",
    note: "Primary agreement text",
  },
  {
    label: "Capsheets",
    href: "https://www.capsheets.com/",
    note: "Team cap and salary reference",
  },
  {
    label: "NBA Stats",
    href: "https://www.nba.com/stats/players/traditional",
    note: "Official player stat tables",
  },
  {
    label: "About & Method",
    href: "/about",
    note: "How this app works",
  },
];

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
  return (
    <>
      {/* Backdrop (mobile) */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-30 lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar panel */}
      <aside
        className={`fixed top-0 left-0 h-full w-72 bg-[--color-surface-raised]/88 backdrop-blur-xl border-r border-[--color-border]
          z-40 flex flex-col transition-transform duration-200 ease-out shadow-2xl lg:shadow-none
          ${isOpen ? "translate-x-0" : "-translate-x-full"}
          lg:translate-x-0 lg:static lg:z-auto`}
      >
        {/* Sidebar header */}
        <div className="p-3 border-b border-[--color-border] flex items-center gap-2">
          <button
            onClick={onNewChat}
            className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg
              bg-[linear-gradient(135deg,var(--color-nba-blue),var(--color-nba-blue-light))] text-white text-sm font-semibold
              transition-colors duration-150 shadow-[0_12px_28px_rgba(255,107,61,0.26)]"
            title="New chat (Cmd/Ctrl+Shift+K)"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            New Chat
          </button>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-[--color-surface-hover] text-[--color-text-muted] lg:hidden transition-colors"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Chat list */}
        <div className="flex-1 overflow-y-auto p-2">
          <p className="px-2 pb-2 text-[10px] uppercase tracking-[0.16em] text-[--color-text-muted]">
            Recent chats
          </p>
          {chats.length === 0 ? (
            <div className="rounded-xl border border-dashed border-[--color-border-light] bg-[--color-surface]/35 p-4 mt-4 mx-1">
              <p className="text-[--color-text-secondary] text-sm font-medium mb-2">
                No chats yet
              </p>
              <p className="text-[11px] text-[--color-text-muted] leading-relaxed">
                Start with the <span className="text-[--color-text-secondary]">New Chat</span> button, or click one of the example prompts in the main area.
              </p>
            </div>
          ) : (
            chats.map((chat) => (
              <div
                key={chat.id}
                className={`group relative flex items-center rounded-lg px-3 py-2.5 mb-1 cursor-pointer transition-colors duration-100 border
                  ${
                    chat.id === activeChatId
                      ? "bg-[--color-surface-hover] text-[--color-text-primary] border-[--color-border-light] shadow-[0_8px_20px_rgba(7,10,16,0.45)]"
                      : "text-[--color-text-secondary] border-transparent hover:bg-[--color-surface-hover]/60"
                  }`}
                onClick={() => onSelectChat(chat.id)}
              >
                {chat.id === activeChatId && (
                  <span className="absolute left-0 top-1.5 bottom-1.5 w-0.5 rounded-r bg-[--color-accent]" />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm truncate font-medium">{chat.title}</p>
                  <p className="text-[10px] text-[--color-text-muted] mt-0.5">
                    {timeAgo(chat.createdAt)}
                  </p>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeleteChat(chat.id);
                  }}
                  className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-[--color-surface]/50
                    text-[--color-text-muted] hover:text-[--color-nba-red] transition-all duration-100 shrink-0 ml-1"
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
        <div className="p-3 border-t border-[--color-border] bg-gradient-to-b from-transparent to-[rgba(79,210,184,0.08)]">
          <p className="px-1 pb-2 text-[10px] uppercase tracking-[0.16em] text-[--color-text-muted]">
            Sources
          </p>
          <div className="space-y-1">
            {SOURCE_LINKS.map((link) => (
              <a
                key={link.href}
                href={link.href}
                target={link.href.startsWith("http") ? "_blank" : undefined}
                rel={link.href.startsWith("http") ? "noreferrer" : undefined}
                className="block rounded-xl border border-[--color-border] hover:border-[--color-border-light] bg-[--color-surface]/45 hover:bg-[--color-surface-hover]/75 px-2.5 py-2 transition-colors"
              >
                <p className="text-xs text-[--color-text-primary] leading-tight font-medium">
                  {link.label}
                </p>
                <p className="text-[10px] text-[--color-text-muted] mt-0.5">
                  {link.note}
                </p>
              </a>
            ))}
          </div>
        </div>

        {/* Sidebar footer */}
        <div className="p-3 border-t border-[--color-border]">
          <p className="text-[11px] text-[--color-text-secondary] text-left font-medium">
            A Michael Margolis Experiment
          </p>
          <p className="text-[10px] text-[--color-text-muted] text-left mt-1">
            Cmd/Ctrl + Shift + K for New Chat
          </p>
        </div>
      </aside>
    </>
  );
}
