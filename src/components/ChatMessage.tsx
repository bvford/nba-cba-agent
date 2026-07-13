"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { FeedbackValue } from "@/lib/chat-types";
import { normalizeSource } from "@/lib/sources";
import { TEAM_FULL_NAMES, findTeamAbbrsInText } from "@/lib/teams-meta";

interface ChatMessageProps {
  role: "user" | "assistant";
  content: string;
  sources?: string[];
  feedback?: FeedbackValue;
  isError?: boolean;
  isStreaming?: boolean;
  onFeedback?: (value: FeedbackValue) => void;
  onEditResend?: () => void;
  onRetry?: () => void;
}

const actionFocus =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--color-accent)";

export function ChatMessage({
  role,
  content,
  sources,
  feedback,
  isError = false,
  isStreaming = false,
  onFeedback,
  onEditResend,
  onRetry,
}: ChatMessageProps) {
  const isUser = role === "user";
  const [copied, setCopied] = useState(false);
  const copyTimeoutRef = useRef<number | null>(null);

  // Only scan for team mentions once the reply has finished streaming, and
  // cap at 2 chips — 3+ teams mentioned means the answer is too broad for a
  // "view this team's cap sheet" shortcut to be useful.
  const teamMentions = useMemo(() => {
    if (isUser || isError || isStreaming || !content) return [];
    const abbrs = findTeamAbbrsInText(content);
    return abbrs.length === 1 || abbrs.length === 2 ? abbrs : [];
  }, [isUser, isError, isStreaming, content]);

  useEffect(
    () => () => {
      if (copyTimeoutRef.current !== null) window.clearTimeout(copyTimeoutRef.current);
    },
    []
  );

  const handleCopy = async () => {
    await navigator.clipboard.writeText(content);
    setCopied(true);
    if (copyTimeoutRef.current !== null) window.clearTimeout(copyTimeoutRef.current);
    copyTimeoutRef.current = window.setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className={`group flex ${isUser ? "justify-end" : "justify-start"} mb-5`}>
      {!isUser && (
        <div className="w-7 h-7 rounded-lg bg-(--color-accent) flex items-center justify-center text-(--color-accent-ink) text-xs font-bold mr-2.5 mt-0.5 shrink-0 shadow-[0_4px_14px_rgba(255,106,31,0.22)]">
          AI
        </div>
      )}
      <div className="flex flex-col max-w-[85%] md:max-w-[75%]">
        <div
          className={`rounded-2xl px-4 py-3 ${
            isUser
              ? "bg-[linear-gradient(145deg,var(--color-ember),var(--color-ember-light))] text-white rounded-br-md"
              : isError
                ? "bg-[rgba(127,29,29,0.12)] text-(--color-text-primary) border border-red-500/35 rounded-bl-md shadow-sm"
                : "bg-(--color-surface-raised) text-(--color-text-primary) border border-(--color-border) rounded-bl-md shadow-sm"
          }`}
        >
          {isUser ? (
            <p className="whitespace-pre-wrap text-sm">{content}</p>
          ) : content === "" ? (
            <span className="flex items-center gap-1.5 text-sm text-(--color-text-muted)">
              Thinking
              <span className="flex gap-0.5" aria-hidden="true">
                <span className="thinking-dot h-1 w-1 rounded-full bg-(--color-accent)" style={{ animationDelay: "0ms" }} />
                <span className="thinking-dot h-1 w-1 rounded-full bg-(--color-accent)" style={{ animationDelay: "150ms" }} />
                <span className="thinking-dot h-1 w-1 rounded-full bg-(--color-accent)" style={{ animationDelay: "300ms" }} />
              </span>
            </span>
          ) : (
            <div className="text-sm leading-relaxed">
              <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
                {content}
              </ReactMarkdown>
              {isError && onRetry && (
                <button
                  onClick={onRetry}
                  className={`mt-3 rounded-lg border border-red-400/30 px-3 py-1.5 text-xs font-medium text-(--color-text-primary) hover:bg-red-500/10 ${actionFocus}`}
                >
                  Retry
                </button>
              )}
            </div>
          )}
        </div>

        {!isUser && sources && sources.length > 0 && (
          <div className="mt-2 ml-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[10px] text-(--color-text-secondary)">Sources:</span>
              {sources.map((rawSource, index) => {
                const source = normalizeSource(rawSource);
                const key = `${source.label}-${index}`;
                if (source.href) {
                  return (
                    <a
                      key={key}
                      href={source.href}
                      target={source.href.startsWith("http") ? "_blank" : undefined}
                      rel={source.href.startsWith("http") ? "noreferrer" : undefined}
                      className="text-[10px] px-2 py-0.5 rounded-full border border-(--color-border) bg-(--color-surface)/65 text-(--color-text-secondary) hover:text-(--color-text-primary) hover:border-(--color-border-light) hover:bg-(--color-surface-hover) transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--color-accent)"
                      title={rawSource}
                    >
                      {source.label}
                    </a>
                  );
                }

                return (
                  <span
                    key={key}
                    className="text-[10px] px-2 py-0.5 rounded-full border border-(--color-border) bg-(--color-surface)/65 text-(--color-text-muted)"
                    title={rawSource}
                  >
                    {source.label}
                  </span>
                );
              })}
            </div>
          </div>
        )}

        {teamMentions.length > 0 && (
          <div className="mt-2 ml-1 flex flex-wrap items-center gap-1.5">
            {teamMentions.map((abbr) => (
              <Link
                key={abbr}
                href={`/teams/${abbr}`}
                className="text-[10px] px-2 py-0.5 rounded-full border border-(--color-accent)/40 bg-(--color-accent)/10 text-(--color-accent) hover:bg-(--color-accent)/20 hover:border-(--color-accent)/60 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--color-accent)"
              >
                View {TEAM_FULL_NAMES[abbr]} cap sheet →
              </Link>
            ))}
          </div>
        )}

        <div className="flex mt-1 ml-1 opacity-30 group-hover:opacity-100 [@media(pointer:coarse)]:opacity-60 transition-opacity duration-150 gap-1.5">
          {!isUser && content && !isError && (
            <>
              <button
                onClick={handleCopy}
                aria-label="Copy assistant response"
                className={`flex items-center gap-1 text-[10px] text-(--color-text-muted) hover:text-(--color-text-secondary) transition-colors px-1.5 py-0.5 rounded hover:bg-(--color-surface-hover) ${actionFocus}`}
              >
                {copied ? "Copied" : "Copy"}
              </button>
              {onFeedback && (
                <>
                  <button
                    onClick={() => onFeedback("up")}
                    aria-label="Mark response as helpful"
                    className={`text-[10px] px-1.5 py-0.5 rounded hover:bg-(--color-surface-hover) ${actionFocus} ${feedback === "up" ? "text-(--color-accent)" : "text-(--color-text-muted)"}`}
                  >
                    Helpful
                  </button>
                  <button
                    onClick={() => onFeedback("down")}
                    aria-label="Mark response as not helpful"
                    className={`text-[10px] px-1.5 py-0.5 rounded hover:bg-(--color-surface-hover) ${actionFocus} ${feedback === "down" ? "text-(--color-danger)" : "text-(--color-text-muted)"}`}
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
              aria-label="Edit and resend this message"
              className={`text-[10px] px-1.5 py-0.5 rounded hover:bg-(--color-surface-hover) text-(--color-text-muted) hover:text-(--color-text-secondary) ${actionFocus}`}
            >
              Edit &amp; resend
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

const markdownComponents = {
  h1: ({ children }: React.ComponentPropsWithoutRef<"h1">) => (
    <h1 className="text-[1.1rem] font-bold text-(--color-text-primary) mt-5 mb-1 first:mt-0">{children}</h1>
  ),
  h2: ({ children }: React.ComponentPropsWithoutRef<"h2">) => (
    <h2 className="text-base font-semibold text-(--color-text-primary) mt-5 mb-1 first:mt-0">{children}</h2>
  ),
  h3: ({ children }: React.ComponentPropsWithoutRef<"h3">) => (
    <h3 className="text-[0.9rem] font-semibold text-(--color-text-primary) mt-4 mb-1 first:mt-0">{children}</h3>
  ),
  p: ({ children }: React.ComponentPropsWithoutRef<"p">) => (
    <p className="my-2 first:mt-0 last:mb-0">{children}</p>
  ),
  strong: ({ children }: React.ComponentPropsWithoutRef<"strong">) => (
    <strong className="font-bold text-(--color-accent)">{children}</strong>
  ),
  em: ({ children }: React.ComponentPropsWithoutRef<"em">) => <em>{children}</em>,
  code: ({ children }: React.ComponentPropsWithoutRef<"code">) => (
    <code className="rounded bg-[rgba(255,106,31,0.1)] px-[0.35rem] py-[0.1rem] text-[0.85em] text-(--color-accent)">
      {children}
    </code>
  ),
  pre: ({ children }: React.ComponentPropsWithoutRef<"pre">) => (
    <pre className="my-2 overflow-x-auto rounded-lg border border-(--color-border) bg-(--color-surface) p-3">
      {children}
    </pre>
  ),
  blockquote: ({ children }: React.ComponentPropsWithoutRef<"blockquote">) => (
    <blockquote className="my-2 border-l-[3px] border-(--color-ember) pl-3 text-(--color-text-secondary)">
      {children}
    </blockquote>
  ),
  ul: ({ children }: React.ComponentPropsWithoutRef<"ul">) => (
    <ul className="my-1.5 ml-5 list-disc text-(--color-text-secondary)">{children}</ul>
  ),
  ol: ({ children }: React.ComponentPropsWithoutRef<"ol">) => (
    <ol className="my-1.5 ml-5 list-decimal text-(--color-text-secondary)">{children}</ol>
  ),
  li: ({ children }: React.ComponentPropsWithoutRef<"li">) => <li className="mb-0.5">{children}</li>,
  a: ({ children, href }: React.ComponentPropsWithoutRef<"a">) => (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="text-(--color-accent) underline decoration-(--color-accent)/50 underline-offset-2 hover:decoration-(--color-accent) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--color-accent)"
    >
      {children}
    </a>
  ),
  table: ({ children }: React.ComponentPropsWithoutRef<"table">) => (
    <div className="my-3 max-w-full overflow-x-auto rounded-lg border border-(--color-border)">
      <table className="w-full min-w-max border-collapse text-left text-xs">{children}</table>
    </div>
  ),
  thead: ({ children }: React.ComponentPropsWithoutRef<"thead">) => (
    <thead className="bg-(--color-surface) text-(--color-text-primary) border-b-2 border-(--color-accent)">
      {children}
    </thead>
  ),
  tbody: ({ children }: React.ComponentPropsWithoutRef<"tbody">) => <tbody>{children}</tbody>,
  tr: ({ children }: React.ComponentPropsWithoutRef<"tr">) => (
    <tr className="border-b border-(--color-border) last:border-b-0">{children}</tr>
  ),
  th: ({ children }: React.ComponentPropsWithoutRef<"th">) => (
    <th className="font-condensed border-r border-(--color-border) px-3 py-2 text-[0.7rem] font-semibold uppercase tracking-[0.06em] text-(--color-text-secondary) last:border-r-0">
      {children}
    </th>
  ),
  td: ({ children }: React.ComponentPropsWithoutRef<"td">) => (
    <td className="border-r border-(--color-border) px-3 py-2 tabular-nums text-(--color-text-secondary) last:border-r-0">
      {children}
    </td>
  ),
};
