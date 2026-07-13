import Link from "next/link";
import { ABOUT_SOURCES } from "@/lib/sources";

export default function AboutPage() {
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

        <h1 className="text-2xl font-semibold text-(--color-text-primary) tracking-tight mb-2">
          About ChatCBA
        </h1>
        <p className="text-sm text-(--color-text-secondary) mb-8">
          This is my first ever coding project, entirely created by artificial intelligence coding assistants.
          This tool is trained on the NBA/NBPA 2023 Collective Bargaining Agreement, and if I made it correctly,
          should have up-to-date salary information as of February 2026, and live statistics from NBA.com.
          Its purpose is to explain concepts from the CBA and NBA salary cap in plain English.
          I would like to train it to be smart and to understand context, like having an AI Bobby Marks in your pocket.
          That remains a work in progress, so Bobby, if you are reading this, your job is safe for now.
        </p>

        <section className="mb-6">
          <h2 className="text-lg font-medium text-(--color-text-primary) mb-2">Method</h2>
          <p className="text-sm text-(--color-text-secondary) leading-relaxed">
            The assistant retrieves relevant CBA sections and player/team data, then generates concise answers.
            It is optimized for clarity over legal formality.
          </p>
        </section>

        <section className="mb-6">
          <h2 className="text-lg font-medium text-(--color-text-primary) mb-2">Sources</h2>
          <ul className="text-sm text-(--color-text-secondary) space-y-1">
            {ABOUT_SOURCES.map((source) => (
              <li key={source.url}>
                <a
                  className="hover:text-(--color-text-primary) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--color-accent)"
                  href={source.url}
                  target="_blank"
                  rel="noreferrer"
                >
                  {source.label}
                </a>
              </li>
            ))}
          </ul>
        </section>

        <section className="mb-6">
          <h2 className="text-lg font-medium text-(--color-text-primary) mb-2">Limitations</h2>
          <p className="text-sm text-(--color-text-secondary) leading-relaxed">
            Not legal or financial advice. If data conflicts or appears incomplete, verify with primary sources.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-medium text-(--color-text-primary) mb-2">Contact</h2>
          <p className="text-sm text-(--color-text-secondary) leading-relaxed">
            Contact the creator of this website by{" "}
            <a
              className="font-semibold hover:text-(--color-text-primary) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--color-accent)"
              href="mailto:mikehmargolis@gmail.com"
            >
              e-mail
            </a>
            , or{" "}
            <a
              className="font-semibold hover:text-(--color-text-primary) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--color-accent)"
              href="https://www.linkedin.com/in/margolismichael/"
              target="_blank"
              rel="noreferrer"
            >
              LinkedIn
            </a>
            .
          </p>
        </section>
      </div>
    </main>
  );
}
