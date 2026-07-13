interface MarkProps {
  className?: string;
}

// Clean vector mark: a basketball line-icon in a rounded badge. Replaces the
// old AI-clipart PNG — no image asset, no gradient glow, just ink + accent.
export function Mark({ className = "w-9 h-9" }: MarkProps) {
  return (
    <svg
      viewBox="0 0 32 32"
      className={className}
      role="img"
      aria-label="ChatCBA"
    >
      <rect
        x="0.75"
        y="0.75"
        width="30.5"
        height="30.5"
        rx="8"
        fill="var(--color-surface-hover)"
        stroke="var(--color-border-light)"
        strokeWidth="1"
      />
      <circle
        cx="16"
        cy="16"
        r="8.5"
        fill="none"
        stroke="var(--color-accent)"
        strokeWidth="1.75"
      />
      <path
        d="M16 7.5 V24.5 M7.5 16 H24.5 M9.9 9.9 Q16 16 9.9 22.1 M22.1 9.9 Q16 16 22.1 22.1"
        stroke="var(--color-accent)"
        strokeWidth="1.1"
        fill="none"
        opacity="0.75"
      />
    </svg>
  );
}

interface WordmarkProps {
  className?: string;
}

export function Wordmark({ className = "text-lg" }: WordmarkProps) {
  return (
    <span className={`font-condensed font-semibold tracking-[0.02em] text-(--color-text-primary) ${className}`}>
      Chat<span className="text-(--color-accent)">CBA</span>
    </span>
  );
}
