import { ExampleQuestions } from "./ExampleQuestions";
import { FeatureCards } from "./FeatureCards";
import { Hero } from "./Hero";
import { StarterModes } from "./StarterModes";

interface LandingContentProps {
  onSelectPrompt: (prompt: string) => void;
  onStartChat: () => void;
}

export function LandingContent({ onSelectPrompt, onStartChat }: LandingContentProps) {
  return (
    <div className="flex flex-col min-h-[calc(100vh-12rem)] w-full">
      <Hero onStartChat={onStartChat} />
      <FeatureCards onSelect={onSelectPrompt} />
      <StarterModes onSelect={onSelectPrompt} />
      <ExampleQuestions onSelect={onSelectPrompt} />

      <div className="hidden sm:block mt-7 text-center text-xs text-[--color-text-muted]">
        Tip: press <span className="text-[--color-text-secondary] font-medium">Cmd/Ctrl + Shift + K</span>{" "}
        to start a new chat
      </div>

      <footer className="mt-10 md:mt-12 pt-10 pb-2 border-t border-[--color-border]/80">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-2 text-[11px] text-[--color-text-muted]">
          <p>© {new Date().getFullYear()} ChatCBA. All rights reserved.</p>
          <div className="flex items-center gap-3">
            <a
              href="/privacy"
              className="hover:text-[--color-text-secondary] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[--color-accent]"
            >
              Privacy
            </a>
            <a
              href="/terms"
              className="hover:text-[--color-text-secondary] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[--color-accent]"
            >
              Terms
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
