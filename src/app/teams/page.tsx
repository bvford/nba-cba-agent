import Link from "next/link";
import type { Metadata } from "next";
import teamsData from "../../../data/teams.json";
import { CapStatusBadge } from "@/components/teams/CapStatusBadge";
import { formattedTeamsFetchedAt } from "@/lib/data-meta";
import { TEAM_FULL_NAMES, computeCapStatus, normalizeTeamAbbr, type CapThresholds } from "@/lib/teams-meta";

export const metadata: Metadata = {
  title: "Team Cap Sheets — ChatCBA",
  description:
    "Every NBA team's total cap allocations, luxury-tax apron status, and available exceptions for the 2026-27 season.",
};

interface TeamEntry {
  abbr: string;
  capAllocations: number;
  capSpace: number;
}

interface TeamsJson {
  fetchedAt: string;
  season: string;
  thresholds: CapThresholds;
  exceptions: { nonTaxpayerMLE: number; taxpayerMLE: number; biannual: number };
  teams: TeamEntry[];
}

const teams = teamsData as TeamsJson;

function fmtCompact(n: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(n);
}

export default function TeamsIndexPage() {
  const sortedTeams = [...teams.teams].sort((a, b) => {
    const nameA = TEAM_FULL_NAMES[normalizeTeamAbbr(a.abbr)] ?? a.abbr;
    const nameB = TEAM_FULL_NAMES[normalizeTeamAbbr(b.abbr)] ?? b.abbr;
    return nameA.localeCompare(nameB);
  });

  return (
    <main className="min-h-screen bg-gradient-page">
      <div className="max-w-5xl mx-auto px-4 py-10">
        <nav className="mb-6 inline-flex items-center gap-1 rounded-full border border-(--color-border) bg-(--color-surface)/45 px-1.5 py-1">
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

        <h1 className="text-2xl md:text-3xl font-semibold text-(--color-text-primary) tracking-tight mb-2">
          Team Cap Sheets
        </h1>
        <p className="text-sm text-(--color-text-secondary) max-w-2xl mb-2 leading-relaxed">
          Every team&apos;s total cap allocations, apron status, and available exceptions for the {teams.season}{" "}
          season. Tap a team for its full payroll and a visual breakdown of where it sits against the salary cap
          and luxury-tax aprons.
        </p>
        <p className="text-xs text-(--color-text-muted) mb-8">
          Cap data fetched {formattedTeamsFetchedAt} (Spotrac)
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
          {sortedTeams.map((team) => {
            const abbr = normalizeTeamAbbr(team.abbr);
            const fullName = TEAM_FULL_NAMES[abbr] ?? abbr;
            const capStatus = computeCapStatus(team.capAllocations, teams.thresholds);

            return (
              <Link
                key={team.abbr}
                href={`/teams/${abbr}`}
                className="group flex flex-col p-4 rounded-2xl border border-(--color-border) bg-[linear-gradient(165deg,rgba(18,27,43,0.95),rgba(11,17,30,0.95))] hover:bg-(--color-surface-hover)/85 hover:border-(--color-border-light) hover:-translate-y-1 transition-all duration-200 shadow-[0_8px_18px_rgba(4,8,14,0.28)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--color-accent)"
              >
                <div className="flex items-start justify-between gap-2 mb-3">
                  <span className="inline-flex items-center justify-center rounded-lg border border-(--color-border-light) bg-(--color-surface) px-2.5 py-1 text-xs font-bold tracking-wide text-(--color-text-primary)">
                    {abbr}
                  </span>
                  <CapStatusBadge tier={capStatus.tier} />
                </div>
                <h2 className="text-sm font-semibold text-(--color-text-primary) mb-1 group-hover:text-(--color-accent) transition-colors">
                  {fullName}
                </h2>
                <p className="text-xs text-(--color-text-secondary) mt-auto pt-2">
                  {fmtCompact(team.capAllocations)} total cap allocations
                </p>
              </Link>
            );
          })}
        </div>
      </div>
    </main>
  );
}
