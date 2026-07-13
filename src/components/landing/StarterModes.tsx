import { STARTER_MODES } from "@/lib/content";

interface StarterModesProps {
  onSelect: (prompt: string) => void;
}

export function StarterModes({ onSelect }: StarterModesProps) {
  return (
    <div className="w-full max-w-2xl mx-auto mb-4">
      <p className="text-xs font-semibold text-[--color-text-muted] uppercase tracking-[0.18em] mb-2 text-center">
        Starter modes
      </p>
      <div className="flex flex-wrap justify-center gap-2">
        {STARTER_MODES.map((mode) => (
          <button
            key={mode.label}
            onClick={() => onSelect(mode.prompt)}
            className="text-xs px-3 py-1.5 rounded-full border border-[--color-border] bg-[--color-surface-raised]/85 text-[--color-text-secondary] hover:text-[--color-text-primary] hover:border-[--color-border-light] hover:bg-[--color-surface-hover] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[--color-accent]"
          >
            {mode.label}
          </button>
        ))}
      </div>
    </div>
  );
}
