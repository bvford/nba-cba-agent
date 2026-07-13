import { CAP_STATUS_BADGE_LABELS, type CapStatusTier } from "@/lib/teams-meta";

// Escalating severity, not a rainbow: green (room) -> gold (over cap) ->
// amber (over tax) -> orange (first apron) -> red (second apron, hard-capped).
const STATUS_STYLES: Record<CapStatusTier, string> = {
  "under-cap": "border-emerald-500/40 bg-emerald-500/10 text-emerald-400",
  "over-cap": "border-(--color-accent)/50 bg-(--color-accent)/10 text-(--color-accent)",
  "over-tax": "border-amber-500/45 bg-amber-500/10 text-amber-400",
  "over-first-apron": "border-orange-500/45 bg-orange-500/10 text-orange-400",
  "over-second-apron": "border-(--color-danger)/50 bg-(--color-danger)/15 text-(--color-danger)",
};

interface CapStatusBadgeProps {
  tier: CapStatusTier;
  className?: string;
}

export function CapStatusBadge({ tier, className = "" }: CapStatusBadgeProps) {
  return (
    <span
      className={`inline-flex items-center whitespace-nowrap rounded-full border px-2.5 py-1 text-[11px] font-semibold tracking-wide ${STATUS_STYLES[tier]} ${className}`}
    >
      {CAP_STATUS_BADGE_LABELS[tier]}
    </span>
  );
}
