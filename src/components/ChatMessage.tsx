"use client";

import { useState } from "react";

type FeedbackValue = "up" | "down";

interface ChatMessageProps {
  role: "user" | "assistant";
  content: string;
  sources?: string[];
  feedback?: FeedbackValue;
  onFeedback?: (value: FeedbackValue) => void;
  onEditResend?: () => void;
}

export function ChatMessage({
  role,
  content,
  sources,
  feedback,
  onFeedback,
  onEditResend,
}: ChatMessageProps) {
  const isUser = role === "user";
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className={`group flex ${isUser ? "justify-end" : "justify-start"} mb-5`}>
      {!isUser && (
        <div className="w-7 h-7 rounded-lg bg-[--color-nba-blue] flex items-center justify-center text-white text-xs font-bold mr-2.5 mt-0.5 shrink-0 shadow-[0_4px_16px_rgba(29,66,138,0.35)]">
          AI
        </div>
      )}
      <div className="flex flex-col max-w-[85%] md:max-w-[75%]">
        <div
          className={`rounded-2xl px-4 py-3 ${
            isUser
              ? "bg-[--color-nba-blue] text-white rounded-br-md"
              : "bg-[--color-surface-raised] text-[--color-text-primary] border border-[--color-border] rounded-bl-md shadow-sm"
          }`}
        >
          {isUser ? (
            <p className="whitespace-pre-wrap text-sm">{content}</p>
          ) : content === "" ? (
            <span className="cursor-blink text-sm text-[--color-text-muted]">
              Thinking
            </span>
          ) : (
            <div
              className="text-sm leading-relaxed"
              dangerouslySetInnerHTML={{ __html: formatMarkdown(content) }}
            />
          )}
        </div>

        {!isUser && sources && sources.length > 0 && (
          <div className="mt-1.5 ml-1 text-[10px] text-[--color-text-muted]">
            <span className="text-[--color-text-secondary]">Sources:</span> {sources.join(" · ")}
          </div>
        )}

        <div className="flex mt-1 ml-1 opacity-30 group-hover:opacity-100 transition-opacity duration-150 gap-1.5">
          {!isUser && content && (
            <>
              <button
                onClick={handleCopy}
                className="flex items-center gap-1 text-[10px] text-[--color-text-muted] hover:text-[--color-text-secondary] transition-colors px-1.5 py-0.5 rounded hover:bg-[--color-surface-hover]"
              >
                {copied ? "Copied" : "Copy"}
              </button>
              {onFeedback && (
                <>
                  <button
                    onClick={() => onFeedback("up")}
                    className={`text-[10px] px-1.5 py-0.5 rounded hover:bg-[--color-surface-hover] ${feedback === "up" ? "text-[--color-accent]" : "text-[--color-text-muted]"}`}
                  >
                    Helpful
                  </button>
                  <button
                    onClick={() => onFeedback("down")}
                    className={`text-[10px] px-1.5 py-0.5 rounded hover:bg-[--color-surface-hover] ${feedback === "down" ? "text-[--color-nba-red]" : "text-[--color-text-muted]"}`}
                  >
                    Not helpful
                  </button>
                </>
              )}
            </>
          )}

          {isUser && onEditResend && (
            <button
              onClick={onEditResend}
              className="text-[10px] px-1.5 py-0.5 rounded hover:bg-[--color-surface-hover] text-[--color-text-muted] hover:text-[--color-text-secondary]"
            >
              Edit & resend
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function formatMarkdown(text: string): string {
  let html = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    // Headers
    .replace(
      /^### (.+)$/gm,
      '<h3 style="font-size:0.9rem;font-weight:600;color:var(--color-text-primary);margin:1rem 0 0.25rem;">$1</h3>'
    )
    .replace(
      /^## (.+)$/gm,
      '<h2 style="font-size:1rem;font-weight:600;color:var(--color-text-primary);margin:1.25rem 0 0.25rem;">$1</h2>'
    )
    .replace(
      /^# (.+)$/gm,
      '<h1 style="font-size:1.1rem;font-weight:700;color:var(--color-text-primary);margin:1.25rem 0 0.25rem;">$1</h1>'
    )
    // Bold and italic
    .replace(/\*\*\*(.+?)\*\*\*/g, "<strong><em>$1</em></strong>")
    .replace(/\*\*(.+?)\*\*/g, '<strong style="color:var(--color-accent)">$1</strong>')
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    // Inline code
    .replace(
      /`([^`]+)`/g,
      '<code style="background:rgba(74,142,255,0.1);color:var(--color-accent);padding:0.1rem 0.35rem;border-radius:4px;font-size:0.85em;">$1</code>'
    )
    // Blockquotes
    .replace(
      /^&gt; (.+)$/gm,
      '<blockquote style="border-left:3px solid var(--color-nba-blue);padding-left:0.75rem;color:var(--color-text-secondary);margin:0.5rem 0;">$1</blockquote>'
    )
    // Bullet lists
    .replace(
      /^[-•] (.+)$/gm,
      '<li style="margin-left:1.25rem;list-style-type:disc;margin-bottom:0.2rem;color:var(--color-text-secondary);">$1</li>'
    )
    // Numbered lists
    .replace(
      /^\d+\. (.+)$/gm,
      '<li style="margin-left:1.25rem;list-style-type:decimal;margin-bottom:0.2rem;color:var(--color-text-secondary);">$1</li>'
    )
    // Paragraphs
    .replace(/\n\n/g, '</p><p style="margin:0.5rem 0;">')
    .replace(/\n/g, "<br>");

  return `<p style="margin:0;">${html}</p>`;
}
