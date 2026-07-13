import { EXAMPLE_QUESTIONS } from "@/lib/content";

interface ExampleQuestionsProps {
  onSelect: (prompt: string) => void;
}

export function ExampleQuestions({ onSelect }: ExampleQuestionsProps) {
  return (
    <div className="w-full max-w-2xl mx-auto">
      <p className="text-xs font-semibold text-[--color-text-muted] uppercase tracking-[0.18em] mb-3 text-center">
        Try asking
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        {EXAMPLE_QUESTIONS.map((question) => (
          <button
            key={question.label}
            onClick={() => onSelect(question.label)}
            className="group text-left text-sm px-3.5 py-2.5 rounded-xl bg-[--color-surface-raised]/92 border border-[--color-border] hover:bg-[--color-surface-hover] hover:border-[--color-border-light] hover:-translate-y-0.5 transition-all duration-150 shadow-sm text-[--color-text-secondary] hover:text-[--color-text-primary] hover:shadow-[0_14px_30px_rgba(8,11,18,0.5)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[--color-accent]"
          >
            <span className="mr-2">{question.icon}</span>
            {question.label}
          </button>
        ))}
      </div>
    </div>
  );
}
