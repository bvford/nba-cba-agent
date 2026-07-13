"use client";

import { useEffect, useId, useRef } from "react";

interface ConfirmDialogProps {
  title: string;
  description: string;
  onCancel: () => void;
  onConfirm: () => void;
}

export function ConfirmDialog({ title, description, onCancel, onConfirm }: ConfirmDialogProps) {
  const titleId = useId();
  const descriptionId = useId();
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const previouslyFocused = document.activeElement;
    cancelRef.current?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onCancel();
        return;
      }

      if (event.key !== "Tab") return;
      const dialog = cancelRef.current?.closest("[role='dialog']");
      const buttons = dialog?.querySelectorAll<HTMLButtonElement>("button") ?? [];
      if (buttons.length === 0) return;
      const first = buttons[0];
      const last = buttons[buttons.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      if (previouslyFocused instanceof HTMLElement) previouslyFocused.focus();
    };
  }, [onCancel]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 px-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onCancel();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        className="w-full max-w-sm rounded-2xl border border-(--color-border-light) bg-(--color-surface-raised) p-5 shadow-2xl"
      >
        <h2 id={titleId} className="text-base font-semibold text-(--color-text-primary)">
          {title}
        </h2>
        <p id={descriptionId} className="mt-2 text-sm leading-relaxed text-(--color-text-secondary)">
          {description}
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <button
            ref={cancelRef}
            onClick={onCancel}
            className="rounded-lg border border-(--color-border) px-3 py-2 text-sm text-(--color-text-secondary) hover:bg-(--color-surface-hover) hover:text-(--color-text-primary) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--color-accent)"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="rounded-lg bg-[linear-gradient(135deg,#c8a24a,#d4b15e)] px-3 py-2 text-sm font-semibold text-[#0d1117] hover:brightness-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--color-accent) focus-visible:ring-offset-2 focus-visible:ring-offset-(--color-surface-raised)"
          >
            Delete Chat
          </button>
        </div>
      </div>
    </div>
  );
}
