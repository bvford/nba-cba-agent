export default function AboutPage() {
  return (
    <main className="min-h-screen bg-gradient-page">
      <div className="max-w-3xl mx-auto px-4 py-10">
        <h1 className="text-2xl font-semibold text-[--color-text-primary] tracking-tight mb-2">
          About ChatCBA
        </h1>
        <p className="text-sm text-[--color-text-secondary] mb-8">
          A Michael Margolis Experiment. This tool explains NBA CBA rules in plain English
          using the 2023 agreement plus player/team context.
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

        <section>
          <h2 className="text-lg font-medium text-[--color-text-primary] mb-2">Limitations</h2>
          <p className="text-sm text-[--color-text-secondary] leading-relaxed">
            Not legal or financial advice. If data conflicts or appears incomplete, verify with primary sources.
          </p>
        </section>
      </div>
    </main>
  );
}
