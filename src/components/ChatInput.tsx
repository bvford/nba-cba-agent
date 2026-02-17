"use client";

import { useState, useRef, useEffect } from "react";

interface ChatInputProps {
  onSend: (message: string) => void;
  disabled: boolean;
}

export function ChatInput({ onSend, disabled }: ChatInputProps) {
  const [input, setInput] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = "auto";
      textarea.style.height = Math.min(textarea.scrollHeight, 200) + "px";
    }
  }, [input]);

  const handleSubmit = () => {
    const trimmed = input.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setInput("");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="border-t border-[--color-border] bg-[--color-surface-raised]/80 backdrop-blur-md p-3 sm:p-4">
      <div className="max-w-3xl mx-auto flex gap-2.5 items-end">
        <textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask about the NBA CBA, a player, or a trade..."
          disabled={disabled}
          rows={1}
          className="flex-1 resize-none rounded-xl bg-[--color-surface] border border-[--color-border] px-4 py-2.5
            text-sm text-[--color-text-primary] placeholder-[--color-text-muted]
            focus:outline-none focus:border-[--color-accent] focus:ring-1 focus:ring-[--color-accent]/50
            disabled:opacity-50 disabled:cursor-not-allowed
            transition-colors duration-150"
        />
        <button
          onClick={handleSubmit}
          disabled={disabled || !input.trim()}
          className="rounded-xl bg-[linear-gradient(135deg,var(--color-nba-blue),var(--color-nba-blue-light))] px-4 py-2.5 font-medium text-white text-sm
            transition-all duration-150 shadow-[0_8px_20px_rgba(255,107,61,0.35)] hover:brightness-110
            disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-[--color-nba-blue]"
        >
          {disabled ? (
            <span className="inline-block w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
          ) : (
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="22" y1="2" x2="11" y2="13" />
              <polygon points="22 2 15 22 11 13 2 9 22 2" />
            </svg>
          )}
        </button>
      </div>
      <p className="text-center text-[10px] text-[--color-text-muted] mt-2">
        Enter to send &middot; Shift+Enter for new line &middot; Cmd/Ctrl+Shift+K for new chat
      </p>
      <p className="text-center text-[10px] text-[--color-text-muted] mt-1">
        2023 NBA CBA &middot; Not legal or financial advice &middot; Player data last updated Feb 17, 2026
      </p>
    </div>
  );
}
