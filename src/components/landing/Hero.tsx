import Image from "next/image";

interface HeroProps {
  onStartChat: () => void;
}

export function Hero({ onStartChat }: HeroProps) {
  return (
    <section className="panel-card text-center pt-8 md:pt-12 px-4 md:px-8 rounded-3xl mb-8 md:mb-10">
      <p className="text-[11px] tracking-[0.12em] uppercase text-[--color-accent] mb-3">
        Basketball Operations Assistant
      </p>
      <div className="mb-5">
        <Image
          src="/chatcba-logo.png"
          alt="ChatCBA logo"
          width={220}
          height={220}
          className="w-40 h-40 md:w-48 md:h-48 rounded-full mx-auto drop-shadow-[0_22px_42px_rgba(8,10,15,0.6)]"
          priority
        />
      </div>
      <h2
        className="text-4xl md:text-5xl font-bold tracking-tight text-[--color-text-primary] mb-3"
        style={{ fontFamily: "'Sora', system-ui, sans-serif" }}
      >
        Your AI Salary Cap Expert
      </h2>
      <p className="text-[--color-text-secondary] max-w-2xl mx-auto text-sm md:text-base leading-relaxed">
        Ask questions about cap mechanics, contract structure, and roster-building strategy. Get concise
        answers grounded in the 2023 CBA and updated salary/stat context.
      </p>
      <div className="mt-6 pb-8 flex flex-wrap items-center justify-center gap-2.5">
        <button
          onClick={onStartChat}
          className="text-sm px-5 py-2.5 rounded-full bg-[linear-gradient(135deg,#c8a24a,#d4b15e)] text-[#0d1117] font-semibold shadow-[0_8px_20px_rgba(200,162,74,0.25)] hover:-translate-y-0.5 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[--color-accent] focus-visible:ring-offset-2 focus-visible:ring-offset-[--color-surface]"
        >
          Start Chatting
        </button>
        <a
          href="/about"
          className="text-sm px-4 py-2 rounded-full border border-[--color-border-light] text-[--color-text-secondary] hover:text-[--color-text-primary] hover:bg-[--color-surface-hover] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[--color-accent]"
        >
          Learn More
        </a>
      </div>
    </section>
  );
}
