import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import teamsData from "../../../../data/teams.json";
import playerData from "../../../../data/players.json";
import { CapStatusBadge } from "@/components/teams/CapStatusBadge";
import { CapThresholdMeter } from "@/components/teams/CapThresholdMeter";
import { PayrollTable, type PayrollRow } from "@/components/teams/PayrollTable";
import { formattedTeamsFetchedAt } from "@/lib/data-meta";
import {
  TEAM_FULL_NAMES,
  computeAvailableExceptions,
  computeCapStatus,
  normalizeTeamAbbr,
  type CapThresholds,
  type ExceptionAvailability,
} from "@/lib/teams-meta";

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

interface PlayerEntry {
  name: string;
  team: string;
  position: string;
  salaries: Record<string, string>;
}

const teams = teamsData as TeamsJson;
const players = playerData as PlayerEntry[];
const CURRENT_SEASON_KEY = "2026-27";
// Multi-team rows represent a player who changed teams mid-season — they
// can't be attributed to a single roster.
const MULTI_TEAM_CODES = new Set(["2TM", "3TM", "4TM"]);

function findTeam(abbrParam: string): TeamEntry | undefined {
  const abbr = normalizeTeamAbbr(abbrParam.toUpperCase());
  return teams.teams.find((t) => normalizeTeamAbbr(t.abbr) === abbr);
}

function fmtExact(n: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);
}

function fmtCompact(n: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(n);
}

function fmtSignedDistance(n: number): string {
  return n > 0 ? `${fmtCompact(n)} over` : `${fmtCompact(-n)} under`;
}

// Salary strings sometimes carry an annotation — "$679,042 (Two-Way)",
// "$8,966,189 (Qualifying Offer)" — so pulling out the leading digit run is
// safer than stripping non-numeric characters: "Two-Way"'s hyphen would
// otherwise survive a naive strip and produce NaN.
function parseSalary(value: string | undefined): number {
  if (!value) return -1;
  const match = value.match(/[\d,]+/);
  if (!match) return -1;
  const parsed = Number(match[0].replace(/,/g, ""));
  return Number.isFinite(parsed) ? parsed : -1;
}

export function generateStaticParams() {
  return teams.teams.map((t) => ({ abbr: t.abbr.toLowerCase() }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ abbr: string }>;
}): Promise<Metadata> {
  const { abbr: abbrParam } = await params;
  const team = findTeam(abbrParam);
  if (!team) return { title: "Team Not Found" };

  const fullName = TEAM_FULL_NAMES[normalizeTeamAbbr(team.abbr)];
  return {
    title: `${fullName} Cap Sheet`,
    description: `${fullName} ${teams.season} salary cap allocations, apron status, available exceptions, and full player payroll.`,
  };
}

function ExceptionsSummary({ availability }: { availability: ExceptionAvailability }) {
  switch (availability.kind) {
    case "none-over-second-apron":
      return (
        <p className="text-sm text-(--color-text-secondary) leading-relaxed">
          No mid-level or bi-annual exception is available — this team is over the second apron.
        </p>
      );
    case "taxpayer-mle":
      return (
        <p className="text-sm text-(--color-text-secondary) leading-relaxed">
          <span className="font-semibold text-(--color-text-primary)">Taxpayer Mid-Level Exception:</span>{" "}
          {fmtExact(availability.taxpayerMLE)}. Using it hard-caps the team at the second apron.
        </p>
      );
    case "non-taxpayer-mle-and-biannual":
      return (
        <ul className="text-sm text-(--color-text-secondary) leading-relaxed space-y-1.5">
          <li>
            <span className="font-semibold text-(--color-text-primary)">Non-Taxpayer Mid-Level Exception:</span>{" "}
            {fmtExact(availability.nonTaxpayerMLE)}
          </li>
          <li>
            <span className="font-semibold text-(--color-text-primary)">Bi-Annual Exception:</span>{" "}
            {fmtExact(availability.biannual)}
          </li>
        </ul>
      );
    case "cap-room":
      return (
        <p className="text-sm text-(--color-text-secondary) leading-relaxed">
          <span className="font-semibold text-(--color-text-primary)">Cap Room:</span>{" "}
          {fmtExact(availability.capSpace)} available to sign free agents outright.
        </p>
      );
  }
}

export default async function TeamDetailPage({ params }: { params: Promise<{ abbr: string }> }) {
  const { abbr: abbrParam } = await params;
  const team = findTeam(abbrParam);
  if (!team) notFound();

  const abbr = normalizeTeamAbbr(team.abbr);
  const fullName = TEAM_FULL_NAMES[abbr] ?? abbr;
  const { thresholds, exceptions } = teams;
  const capStatus = computeCapStatus(team.capAllocations, thresholds);
  const availability = computeAvailableExceptions(capStatus, team.capSpace, exceptions);

  const roster: PayrollRow[] = players
    .filter((p) => !MULTI_TEAM_CODES.has(p.team))
    .filter((p) => normalizeTeamAbbr(p.team) === abbr)
    .map((p) => {
      const raw = p.salaries[CURRENT_SEASON_KEY];
      return {
        name: p.name,
        position: p.position,
        salary: raw ?? null,
        sortValue: parseSalary(raw),
      };
    })
    .sort((a, b) => b.sortValue - a.sortValue)
    .map(({ name, position, salary }) => ({ name, position, salary }));

  return (
    <main className="min-h-screen bg-gradient-page">
      <div className="max-w-4xl mx-auto px-4 py-10">
        <nav className="mb-6 flex items-center gap-2 text-xs text-(--color-text-secondary)">
          <Link
            href="/"
            className="hover:text-(--color-text-primary) transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--color-accent)"
          >
            Home
          </Link>
          <span aria-hidden="true">/</span>
          <Link
            href="/teams"
            className="hover:text-(--color-text-primary) transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--color-accent)"
          >
            Team Cap Sheets
          </Link>
          <span aria-hidden="true">/</span>
          <span className="text-(--color-text-primary)">{fullName}</span>
        </nav>

        <div className="flex flex-wrap items-center gap-3 mb-1">
          <h1 className="font-scoreboard text-4xl md:text-5xl tracking-wide text-(--color-text-primary)">
            {fullName}
          </h1>
          <span className="rounded-md border border-(--color-border-light) bg-(--color-surface-raised) px-2 py-0.5 text-xs font-bold tracking-wide text-(--color-text-secondary)">
            {abbr}
          </span>
        </div>
        <p className="text-xs text-(--color-text-muted) mb-6">
          {teams.season} season &middot; cap data fetched {formattedTeamsFetchedAt} (Spotrac)
        </p>

        <section className="panel-card rounded-2xl p-5 md:p-6 mb-6">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
            <h2 className="text-lg font-semibold text-(--color-text-primary)">Cap Position</h2>
            <CapStatusBadge tier={capStatus.tier} />
          </div>

          <CapThresholdMeter
            teamAbbr={abbr}
            capAllocations={team.capAllocations}
            thresholds={thresholds}
            tier={capStatus.tier}
          />

          <dl className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <dt className="font-condensed text-(--color-text-muted) text-xs uppercase tracking-[0.08em] mb-1">
                Total Cap Allocations
              </dt>
              <dd className="font-scoreboard text-2xl tracking-wide tabular-nums text-(--color-text-primary)">
                {fmtExact(team.capAllocations)}
              </dd>
            </div>
            <div>
              <dt className="font-condensed text-(--color-text-muted) text-xs uppercase tracking-[0.08em] mb-1">
                Distance to First Apron
              </dt>
              <dd className="font-scoreboard text-2xl tracking-wide tabular-nums text-(--color-text-primary)">
                {fmtSignedDistance(capStatus.firstApronDistance)}
              </dd>
            </div>
            <div>
              <dt className="font-condensed text-(--color-text-muted) text-xs uppercase tracking-[0.08em] mb-1">
                Distance to Second Apron
              </dt>
              <dd className="font-scoreboard text-2xl tracking-wide tabular-nums text-(--color-text-primary)">
                {fmtSignedDistance(capStatus.secondApronDistance)}
              </dd>
            </div>
          </dl>
        </section>

        <section className="panel-card rounded-2xl p-5 md:p-6 mb-6">
          <h2 className="text-lg font-semibold text-(--color-text-primary) mb-3">Available Exceptions</h2>
          <ExceptionsSummary availability={availability} />
        </section>

        <section className="mb-8">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold text-(--color-text-primary)">Payroll</h2>
            <span className="text-xs text-(--color-text-muted)">{roster.length} players</span>
          </div>
          <PayrollTable teamName={fullName} season={CURRENT_SEASON_KEY} players={roster} />
        </section>

        <a
          href={`/?ask=${abbr}`}
          className="inline-flex items-center gap-2 rounded-full bg-[linear-gradient(135deg,var(--color-accent),var(--color-accent-light))] px-5 py-2.5 text-sm font-semibold text-(--color-accent-ink) shadow-[0_6px_16px_rgba(255,106,31,0.2)] hover:brightness-105 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--color-accent)"
        >
          Ask about the {fullName}
        </a>
      </div>
    </main>
  );
}
