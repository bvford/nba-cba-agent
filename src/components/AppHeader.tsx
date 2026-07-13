import Link from "next/link";
import { Mark, Wordmark } from "@/components/Logo";

interface AppHeaderProps {
  sidebarOpen: boolean;
  hasMessages: boolean;
  onToggleSidebar: () => void;
  onNewChat: () => void;
  onGoToComposer: () => void;
  onExportChat: () => void;
}

const focusRing =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--color-accent) focus-visible:ring-offset-2 focus-visible:ring-offset-(--color-surface)";

export function AppHeader({
  sidebarOpen,
  hasMessages,
  onToggleSidebar,
  onNewChat,
  onGoToComposer,
  onExportChat,
}: AppHeaderProps) {
  return (
    <header className="border-b border-(--color-border) bg-(--color-surface-raised)/88 backdrop-blur-xl sticky top-0 z-10">
      <div className="header-accent-line w-full" />
      <div className="max-w-5xl mx-auto px-4 py-3 flex items-center gap-3">
        <button
          onClick={onToggleSidebar}
          aria-label={sidebarOpen ? "Close chat history" : "Open chat history"}
          aria-expanded={sidebarOpen}
          className={`p-1.5 rounded-lg hover:bg-(--color-surface-hover) text-(--color-text-muted) hover:text-(--color-text-secondary) transition-colors lg:hidden ${focusRing}`}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <line x1="3" y1="12" x2="21" y2="12" />
            <line x1="3" y1="6" x2="21" y2="6" />
            <line x1="3" y1="18" x2="21" y2="18" />
          </svg>
        </button>

        <button
          onClick={onNewChat}
          className={`flex items-center gap-2.5 hover:opacity-85 transition-opacity ${focusRing}`}
          title="Home (new chat)"
        >
          <Mark className="w-9 h-9" />
          <div className="text-left">
            <h1 className="leading-tight">
              <Wordmark className="text-lg sm:text-xl" />
            </h1>
          </div>
        </button>

        <nav className="ml-auto hidden md:flex items-center gap-1 rounded-full border border-(--color-border) bg-(--color-surface)/55 px-1.5 py-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
          <button
            onClick={onNewChat}
            className={`text-xs px-3 py-1.5 rounded-full text-(--color-text-secondary) hover:text-(--color-text-primary) hover:bg-(--color-surface-hover) transition-colors ${focusRing}`}
          >
            Home
          </button>
          <button
            onClick={onGoToComposer}
            className={`text-xs px-3 py-1.5 rounded-full text-(--color-text-secondary) hover:text-(--color-text-primary) hover:bg-(--color-surface-hover) transition-colors ${focusRing}`}
          >
            Chat
          </button>
          <Link
            href="/teams"
            className={`text-xs px-3 py-1.5 rounded-full text-(--color-text-secondary) hover:text-(--color-text-primary) hover:bg-(--color-surface-hover) transition-colors ${focusRing}`}
          >
            Team Cap Sheets
          </Link>
          <a
            href="/about"
            className={`text-xs px-3 py-1.5 rounded-full text-(--color-text-secondary) hover:text-(--color-text-primary) hover:bg-(--color-surface-hover) transition-colors ${focusRing}`}
          >
            About
          </a>
        </nav>

        {hasMessages && (
          <button
            onClick={onExportChat}
            className={`text-xs px-3 py-1.5 rounded-full border border-(--color-border) text-(--color-text-secondary) hover:text-(--color-text-primary) hover:bg-(--color-surface-hover) hover:border-(--color-border-light) transition-colors ${focusRing}`}
            title="Copy chat as markdown"
          >
            Export Chat
          </button>
        )}
      </div>
    </header>
  );
}
