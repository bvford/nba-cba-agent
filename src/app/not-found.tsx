import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Page Not Found",
};

export default function NotFound() {
  return (
    <main className="min-h-screen bg-gradient-page flex items-center justify-center px-4">
      <div className="max-w-md w-full text-center py-10">
        <p className="font-scoreboard text-7xl sm:text-8xl text-(--color-accent) tracking-wide mb-2">
          404
        </p>
        <h1 className="text-xl font-semibold text-(--color-text-primary) tracking-tight mb-2">
          Out of bounds
        </h1>
        <p className="text-sm text-(--color-text-secondary) mb-8">
          That page doesn&apos;t exist — turnover. Let&apos;s get you back in the game.
        </p>
        <div className="flex items-center justify-center gap-2">
          <Link
            href="/"
            className="text-sm px-4 py-2 rounded-full bg-(--color-accent) text-(--color-accent-ink) font-medium hover:bg-(--color-accent-light) transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--color-accent)"
          >
            Home
          </Link>
          <Link
            href="/teams"
            className="text-sm px-4 py-2 rounded-full border border-(--color-border) text-(--color-text-secondary) hover:text-(--color-text-primary) hover:bg-(--color-surface-hover) transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--color-accent)"
          >
            Team Cap Sheets
          </Link>
        </div>
      </div>
    </main>
  );
}
