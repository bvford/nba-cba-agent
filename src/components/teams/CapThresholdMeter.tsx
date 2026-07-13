import type { CapStatusTier, CapThresholds } from "@/lib/teams-meta";

const FILL_COLORS: Record<CapStatusTier, string> = {
  "under-cap": "bg-emerald-500",
  "over-cap": "bg-(--color-accent)",
  "over-first-apron": "bg-orange-500",
  "over-second-apron": "bg-(--color-danger)",
};

const TICK_DOT_COLORS: Record<string, string> = {
  "Cap Floor": "bg-(--color-text-muted)",
  "Salary Cap": "bg-(--color-text-secondary)",
  "1st Apron": "bg-orange-400",
  "2nd Apron": "bg-(--color-danger)",
};

function fmtCompact(n: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(n);
}

interface CapThresholdMeterProps {
  teamAbbr: string;
  capAllocations: number;
  thresholds: CapThresholds;
  tier: CapStatusTier;
}

export function CapThresholdMeter({ teamAbbr, capAllocations, thresholds, tier }: CapThresholdMeterProps) {
  // Domain starts a touch below the cap floor (rather than $0) so the four
  // thresholds aren't all bunched in the last few pixels of the bar, and
  // extends past whichever is larger — the team's own spend or the second
  // apron — so a badly over-apron team's marker never clips off the edge.
  const domainMin = thresholds.capFloor * 0.95;
  const domainMax = Math.max(capAllocations, thresholds.secondApron) * 1.06;
  const span = domainMax - domainMin;

  const pct = (value: number) => {
    const clamped = Math.min(Math.max(value, domainMin), domainMax);
    return ((clamped - domainMin) / span) * 100;
  };

  const fillPct = pct(capAllocations);
  const ticks: Array<{ label: string; value: number }> = [
    { label: "Cap Floor", value: thresholds.capFloor },
    { label: "Salary Cap", value: thresholds.salaryCap },
    { label: "1st Apron", value: thresholds.firstApron },
    { label: "2nd Apron", value: thresholds.secondApron },
  ];

  return (
    <div>
      <div className="relative pt-6">
        <div
          className="font-scoreboard absolute top-0 -translate-x-1/2 whitespace-nowrap text-base tracking-wide text-(--color-text-primary)"
          style={{ left: `${fillPct}%` }}
        >
          {teamAbbr} · {fmtCompact(capAllocations)}
        </div>

        <div className="relative h-4 rounded-full border border-(--color-border) bg-(--color-surface) overflow-hidden">
          <div
            className={`absolute inset-y-0 left-0 ${FILL_COLORS[tier]} transition-[width]`}
            style={{ width: `${fillPct}%` }}
          />
          {ticks.map((tick) => (
            <div
              key={tick.label}
              className="absolute inset-y-0 w-px bg-(--color-border-light)"
              style={{ left: `${pct(tick.value)}%` }}
            />
          ))}
        </div>
      </div>

      {/* A legend below the bar, not text positioned under each tick — the
          four thresholds can sit close together (e.g. first/second apron),
          and position-anchored labels collide on narrow viewports. A
          wrapping legend never collides regardless of viewport width or how
          close two threshold values are. */}
      <dl className="mt-4 flex flex-wrap gap-x-5 gap-y-2">
        {ticks.map((tick) => (
          <div key={tick.label} className="flex items-center gap-1.5 text-xs">
            <span aria-hidden="true" className={`inline-block h-1.5 w-1.5 rounded-full ${TICK_DOT_COLORS[tick.label]}`} />
            <dt className="text-(--color-text-muted)">{tick.label}</dt>
            <dd className="font-medium text-(--color-text-secondary)">{fmtCompact(tick.value)}</dd>
          </div>
        ))}
      </dl>

      <p className="sr-only">
        {`${teamAbbr} total cap allocations are ${fmtCompact(capAllocations)}, plotted against a cap floor of ${fmtCompact(thresholds.capFloor)}, salary cap of ${fmtCompact(thresholds.salaryCap)}, first apron of ${fmtCompact(thresholds.firstApron)}, and second apron of ${fmtCompact(thresholds.secondApron)}.`}
      </p>
    </div>
  );
}
