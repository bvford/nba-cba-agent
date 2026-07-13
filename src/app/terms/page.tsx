import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Terms",
};

export default function TermsPage() {
  return (
    <main className="min-h-screen bg-gradient-page">
      <div className="max-w-3xl mx-auto px-4 py-10">
        <nav className="mb-5 inline-flex items-center gap-1 rounded-full border border-(--color-border) bg-(--color-surface)/45 px-1.5 py-1">
          <Link
            href="/"
            className="text-xs px-3 py-1.5 rounded-full text-(--color-text-secondary) hover:text-(--color-text-primary) hover:bg-(--color-surface-hover) transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--color-accent)"
          >
            Home
          </Link>
          <Link
            href="/#chat"
            className="text-xs px-3 py-1.5 rounded-full text-(--color-text-secondary) hover:text-(--color-text-primary) hover:bg-(--color-surface-hover) transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--color-accent)"
          >
            Chat
          </Link>
        </nav>

        <h1 className="text-2xl font-semibold text-(--color-text-primary) tracking-tight mb-3">
          Terms
        </h1>
        <p className="text-sm text-(--color-text-secondary) leading-relaxed">
          ChatCBA is provided for informational purposes only and is not legal or financial advice. While data
          is regularly refreshed, responses can be incomplete or outdated; verify important decisions with
          primary sources and professional guidance.
        </p>
      </div>
    </main>
  );
}
