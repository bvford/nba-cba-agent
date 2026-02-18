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
        <div className="w-7 h-7 rounded-lg bg-[--color-accent] flex items-center justify-center text-[#1a2234] text-xs font-bold mr-2.5 mt-0.5 shrink-0 shadow-[0_4px_14px_rgba(227,189,108,0.22)]">
          AI
        </div>
      )}
      <div className="flex flex-col max-w-[85%] md:max-w-[75%]">
        <div
          className={`rounded-2xl px-4 py-3 ${
            isUser
              ? "bg-[linear-gradient(145deg,var(--color-nba-blue),var(--color-nba-blue-light))] text-white rounded-br-md"
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
          <div className="mt-2 ml-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[10px] text-[--color-text-secondary]">Sources:</span>
              {sources.map((rawSource, idx) => {
                const source = normalizeSource(rawSource);
                const key = `${source.label}-${idx}`;
                if (source.href) {
                  return (
                    <a
                      key={key}
                      href={source.href}
                      target="_blank"
                      rel="noreferrer"
                      className="text-[10px] px-2 py-0.5 rounded-full border border-[--color-border] bg-[--color-surface]/65 text-[--color-text-secondary] hover:text-[--color-text-primary] hover:border-[--color-border-light] hover:bg-[--color-surface-hover] transition-colors"
                      title={rawSource}
                    >
                      {source.label}
                    </a>
                  );
                }

                return (
                  <span
                    key={key}
                    className="text-[10px] px-2 py-0.5 rounded-full border border-[--color-border] bg-[--color-surface]/65 text-[--color-text-muted]"
                    title={rawSource}
                  >
                    {source.label}
                  </span>
                );
              })}
            </div>
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
      '<li data-list="ul" style="margin-bottom:0.2rem;color:var(--color-text-secondary);">$1</li>'
    )
    // Numbered lists
    .replace(
      /^\d+\. (.+)$/gm,
      '<li data-list="ol" style="margin-bottom:0.2rem;color:var(--color-text-secondary);">$1</li>'
    )
    // Wrap adjacent list items so numbering/bullets render correctly per message
    .replace(
      /((?:<li data-list="ol"[^>]*>[\s\S]*?<\/li>\s*)+)/g,
      '<ol style="margin:0.35rem 0 0.45rem 1.25rem;list-style-type:decimal;">$1</ol>'
    )
    .replace(
      /((?:<li data-list="ul"[^>]*>[\s\S]*?<\/li>\s*)+)/g,
      '<ul style="margin:0.35rem 0 0.45rem 1.25rem;list-style-type:disc;">$1</ul>'
    )
    .replace(/\sdata-list="(?:ol|ul)"/g, "")
    // Paragraphs
    .replace(/\n\n/g, '</p><p style="margin:0.5rem 0;">')
    .replace(/\n/g, "<br>");

  return `<p style="margin:0;">${html}</p>`;
}

function normalizeSource(source: string): { label: string; href?: string } {
  const lower = source.toLowerCase();

  if (lower.includes("cbaguide.com") || lower.startsWith("cba guide")) {
    return {
      label: "CBA Guide",
      href: "https://cbaguide.com/#top",
    };
  }

  if (lower.includes("nbpa.com/cba") || lower.startsWith("2023 cba")) {
    const section = source.replace(/^2023 CBA:\s*/i, "").trim();
    return {
      label: section ? `CBA: ${truncate(section, 26)}` : "2023 CBA",
      href: "https://nbpa.com/cba",
    };
  }

  if (lower.startsWith("cba 101 faq:")) {
    const section = source.replace(/^CBA 101 FAQ:\s*/i, "").trim();
    return {
      label: section ? `CBA 101: ${truncate(section, 22)}` : "CBA 101 FAQ",
      href: "/about",
    };
  }

  if (lower.includes("capsheets")) {
    return {
      label: "Capsheets",
      href: "https://www.capsheets.com/",
    };
  }

  if (lower.includes("hoopshype")) {
    return {
      label: "HoopsHype Salaries",
      href: "https://hoopshype.com/salaries/players/",
    };
  }

  if (lower.includes("nba stats") || lower.includes("nba.com/stats") || lower.includes("stats feed")) {
    return {
      label: "NBA Stats",
      href: "https://www.nba.com/stats/players/traditional",
    };
  }

  const directUrl = source.match(/https?:\/\/[^\s)]+/i)?.[0];
  if (directUrl) {
    const clean = source.replace(/\s*\(https?:\/\/[^\s)]+\)\s*/i, "").trim();
    return {
      label: truncate(clean || directUrl.replace(/^https?:\/\//, ""), 28),
      href: directUrl,
    };
  }

  return { label: truncate(source, 28) };
}

function truncate(value: string, max: number): string {
  if (value.length <= max) return value;
  return `${value.slice(0, max - 1)}…`;
}
