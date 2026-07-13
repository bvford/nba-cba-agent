"use client";

import { useEffect } from "react";

interface ToastProps {
  message: string;
  onDismiss: () => void;
}

export function Toast({ message, onDismiss }: ToastProps) {
  useEffect(() => {
    const timeoutId = window.setTimeout(onDismiss, 4500);
    return () => window.clearTimeout(timeoutId);
  }, [onDismiss]);

  return (
    <div
      role="status"
      className="fixed bottom-5 right-5 z-50 flex max-w-[calc(100vw-2.5rem)] items-center gap-3 rounded-xl border border-[--color-border-light] bg-[--color-surface-raised] px-4 py-3 text-sm text-[--color-text-primary] shadow-2xl"
    >
      <span className="h-2 w-2 shrink-0 rounded-full bg-[--color-accent]" aria-hidden="true" />
      <span>{message}</span>
      <button
        onClick={onDismiss}
        aria-label="Dismiss notification"
        className="rounded p-1 text-[--color-text-muted] hover:bg-[--color-surface-hover] hover:text-[--color-text-primary] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[--color-accent]"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>
    </div>
  );
}
