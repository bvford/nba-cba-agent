import { leagueSeason, leagueThresholds } from "@/lib/data-meta";

function fmt(value: number): string {
  return `$${(value / 1_000_000).toFixed(1)}M`;
}

const ROWS = [
  { label: "Cap Floor", value: leagueThresholds.capFloor },
  { label: "Salary Cap", value: leagueThresholds.salaryCap },
  { label: "1st Apron", value: leagueThresholds.firstApron },
  { label: "2nd Apron", value: leagueThresholds.secondApron },
];

// The landing page's "real hook": live league-wide cap thresholds, styled
// like a broadcast scoreboard strip. Replaces generic marketing copy with
// something only this product actually has.
export function ThresholdsTicker() {
  return (
    <div className="rounded-2xl border border-(--color-border) bg-(--color-surface)/60 overflow-hidden">
      <div className="flex items-center gap-1.5 px-4 pt-3 pb-1.5">
        <span className="relative flex h-1.5 w-1.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-(--color-accent) opacity-60" />
          <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-(--color-accent)" />
        </span>
        <p className="text-[10px] tracking-[0.14em] uppercase text-(--color-text-muted)">
          {leagueSeason} League Thresholds — Live
        </p>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-y sm:divide-y-0 divide-(--color-border)">
        {ROWS.map((row) => (
          <div key={row.label} className="px-4 py-3 text-center sm:text-left">
            <p className="text-[10px] tracking-[0.1em] uppercase text-(--color-text-muted) mb-0.5">
              {row.label}
            </p>
            <p className="font-scoreboard text-2xl sm:text-3xl text-(--color-text-primary) tabular-nums">
              {fmt(row.value)}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
