export default function AboutPage() {
  return (
    <main className="min-h-screen bg-gradient-page">
      <div className="max-w-3xl mx-auto px-4 py-10">
        <nav className="mb-5 inline-flex items-center gap-1 rounded-full border border-[--color-border] bg-[--color-surface]/45 px-1.5 py-1">
          <a
            href="/"
            className="text-xs px-3 py-1.5 rounded-full text-[--color-text-secondary] hover:text-[--color-text-primary] hover:bg-[--color-surface-hover] transition-colors"
          >
            Home
          </a>
          <a
            href="/#chat"
            className="text-xs px-3 py-1.5 rounded-full text-[--color-text-secondary] hover:text-[--color-text-primary] hover:bg-[--color-surface-hover] transition-colors"
          >
            Chat
          </a>
        </nav>

        <h1 className="text-2xl font-semibold text-[--color-text-primary] tracking-tight mb-2">
          About ChatCBA
        </h1>
        <p className="text-sm text-[--color-text-secondary] mb-8">
          This is my first ever coding project, entirely created by artificial intelligence coding assistants.
          This tool is trained on the NBA/NBPA 2023 Collective Bargaining Agreement, and if I made it correctly,
          should have up-to-date salary information as of February 2026, and live statistics from NBA.com.
          Its purpose is to explain concepts from the CBA and NBA salary cap in plain English.
          I would like to train it to be smart and to understand context, like having an AI Bobby Marks in your pocket.
          That remains a work in progress, so Bobby, if you are reading this, your job is safe for now.
        </p>

        <section className="mb-6">
          <h2 className="text-lg font-medium text-[--color-text-primary] mb-2">Method</h2>
          <p className="text-sm text-[--color-text-secondary] leading-relaxed">
            The assistant retrieves relevant CBA sections and player/team data, then generates concise answers.
            It is optimized for clarity over legal formality.
          </p>
        </section>

        <section className="mb-6">
          <h2 className="text-lg font-medium text-[--color-text-primary] mb-2">Sources</h2>
          <ul className="text-sm text-[--color-text-secondary] space-y-1">
            <li><a className="hover:text-[--color-text-primary]" href="https://nbpa.com/cba" target="_blank" rel="noreferrer">Official 2023 CBA (NBPA)</a></li>
            <li><a className="hover:text-[--color-text-primary]" href="https://cbaguide.com/#top" target="_blank" rel="noreferrer">CBA Guide</a></li>
            <li><a className="hover:text-[--color-text-primary]" href="https://www.capsheets.com/" target="_blank" rel="noreferrer">Capsheets</a></li>
            <li><a className="hover:text-[--color-text-primary]" href="https://www.nba.com/stats/players/traditional" target="_blank" rel="noreferrer">NBA Stats</a></li>
          </ul>
        </section>

        <section className="mb-6">
          <h2 className="text-lg font-medium text-[--color-text-primary] mb-2">Limitations</h2>
          <p className="text-sm text-[--color-text-secondary] leading-relaxed">
            Not legal or financial advice. If data conflicts or appears incomplete, verify with primary sources.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-medium text-[--color-text-primary] mb-2">Contact</h2>
          <p className="text-sm text-[--color-text-secondary] leading-relaxed">
            Contact the creator of this website by{" "}
            <a
              className="font-semibold hover:text-[--color-text-primary]"
              href="mailto:mikehmargolis@gmail.com"
            >
              e-mail
            </a>
            , or{" "}
            <a
              className="font-semibold hover:text-[--color-text-primary]"
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
