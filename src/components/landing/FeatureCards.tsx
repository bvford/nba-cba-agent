import { FEATURE_CARDS } from "@/lib/content";

interface FeatureCardsProps {
  onSelect: (prompt: string) => void;
}

export function FeatureCards({ onSelect }: FeatureCardsProps) {
  return (
    <section className="mb-8 w-full">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4">
        {FEATURE_CARDS.map((card) => (
          <button
            key={card.title}
            onClick={() => onSelect(card.prompt)}
            className="text-left p-4 rounded-2xl border border-(--color-border) bg-[linear-gradient(165deg,rgba(20,23,29,0.95),rgba(10,12,16,0.95))] hover:bg-(--color-surface-hover)/85 hover:border-(--color-border-light) hover:-translate-y-1 transition-all duration-200 shadow-[0_8px_18px_rgba(4,8,14,0.28)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--color-accent)"
          >
            <h3 className="text-base font-semibold text-(--color-text-primary) mb-1.5">{card.title}</h3>
            <p className="text-xs leading-relaxed text-(--color-text-secondary) break-words">
              {card.description}
            </p>
          </button>
        ))}
      </div>
    </section>
  );
}
