"use client";

interface ChatMessageProps {
  role: "user" | "assistant";
  content: string;
}

export function ChatMessage({ role, content }: ChatMessageProps) {
  const isUser = role === "user";

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"} mb-4`}>
      <div
        className={`max-w-[85%] md:max-w-[75%] rounded-2xl px-4 py-3 ${
          isUser
            ? "bg-blue-600 text-white"
            : "bg-gray-800 text-gray-100 border border-gray-700"
        }`}
      >
        {isUser ? (
          <p className="whitespace-pre-wrap">{content}</p>
        ) : (
          <div
            className="prose prose-invert prose-sm max-w-none
              prose-headings:text-gray-100 prose-headings:mt-3 prose-headings:mb-1
              prose-p:my-1.5 prose-li:my-0.5
              prose-strong:text-blue-300
              prose-code:text-yellow-300 prose-code:bg-gray-900 prose-code:px-1 prose-code:rounded"
            dangerouslySetInnerHTML={{ __html: formatMarkdown(content) }}
          />
        )}
      </div>
    </div>
  );
}

// Simple markdown formatting (no external library needed)
function formatMarkdown(text: string): string {
  let html = text
    // Escape HTML
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    // Headers
    .replace(/^### (.+)$/gm, '<h3 class="text-base font-semibold">$1</h3>')
    .replace(/^## (.+)$/gm, '<h2 class="text-lg font-semibold">$1</h2>')
    .replace(/^# (.+)$/gm, '<h1 class="text-xl font-bold">$1</h1>')
    // Bold and italic
    .replace(/\*\*\*(.+?)\*\*\*/g, "<strong><em>$1</em></strong>")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    // Inline code
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    // Blockquotes
    .replace(/^&gt; (.+)$/gm, '<blockquote class="border-l-2 border-blue-500 pl-3 text-gray-400 my-2">$1</blockquote>')
    // Bullet lists
    .replace(/^- (.+)$/gm, '<li class="ml-4 list-disc">$1</li>')
    .replace(/^• (.+)$/gm, '<li class="ml-4 list-disc">$1</li>')
    // Numbered lists
    .replace(/^\d+\. (.+)$/gm, '<li class="ml-4 list-decimal">$1</li>')
    // Paragraphs (double newlines)
    .replace(/\n\n/g, "</p><p>")
    // Single newlines within paragraphs
    .replace(/\n/g, "<br>");

  return `<p>${html}</p>`;
}
