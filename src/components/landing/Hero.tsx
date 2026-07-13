import { Mark } from "@/components/Logo";
import { ThresholdsTicker } from "./ThresholdsTicker";

interface HeroProps {
  onStartChat: () => void;
}

export function Hero({ onStartChat }: HeroProps) {
  return (
    <section className="panel-card text-center pt-8 md:pt-12 px-4 md:px-8 rounded-3xl mb-8 md:mb-10">
      <p className="text-[11px] tracking-[0.12em] uppercase text-(--color-accent) mb-3">
        Basketball Operations Assistant
      </p>
      <div className="mb-5">
        <Mark className="w-16 h-16 md:w-20 md:h-20 mx-auto" />
      </div>
      <h2 className="font-scoreboard text-5xl md:text-6xl tracking-wide text-(--color-text-primary) mb-3">
        Your AI Salary Cap Expert
      </h2>
      <p className="text-(--color-text-secondary) max-w-2xl mx-auto text-sm md:text-base leading-relaxed">
        Ask questions about cap mechanics, contract structure, and roster-building strategy. Get concise
        answers grounded in the 2023 CBA and updated salary/stat context.
      </p>
      <div className="mt-6 flex flex-wrap items-center justify-center gap-2.5">
        <button
          onClick={onStartChat}
          className="text-sm px-5 py-2.5 rounded-full bg-[linear-gradient(135deg,var(--color-accent),var(--color-accent-light))] text-(--color-accent-ink) font-semibold shadow-[0_8px_20px_rgba(255,106,31,0.25)] hover:-translate-y-0.5 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--color-accent) focus-visible:ring-offset-2 focus-visible:ring-offset-(--color-surface)"
        >
          Start Chatting
        </button>
        <a
          href="/about"
          className="text-sm px-4 py-2 rounded-full border border-(--color-border-light) text-(--color-text-secondary) hover:text-(--color-text-primary) hover:bg-(--color-surface-hover) transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--color-accent)"
        >
          Learn More
        </a>
      </div>
      <div className="mt-7 pb-8 text-left">
        <ThresholdsTicker />
      </div>
    </section>
  );
}
