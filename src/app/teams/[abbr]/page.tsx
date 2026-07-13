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
  type ExceptionAvailability,
} from "@/lib/teams-meta";
import type { TeamEntry, TeamsJson } from "@/lib/teams-data";

interface PlayerEntry {
  name: string;
  team: string | null;
  position: string;
}

interface PlayersJson {
  fetchedAt: string;
  players: PlayerEntry[];
}

const teams = teamsData as TeamsJson;
const players = (playerData as PlayersJson).players;

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

// Apron "space" from capsheets: negative = over the line.
function fmtSpace(space: number): string {
  return space < 0 ? `${fmtCompact(-space)} over` : `${fmtCompact(space)} under`;
}

const NOTE_LABELS: Record<string, string> = {
  "player option": "Player Option",
  "team option": "Team Option",
  "non-guaranteed": "Non-Guaranteed",
  estimate: "Estimated",
};

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
    description: `${fullName} ${teams.season} payroll, luxury-tax and apron status, dead money, cap holds, and available exceptions.`,
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

function NamedAmountList({ entries }: { entries: Array<{ player: string; amount: number }> }) {
  return (
    <ul className="divide-y divide-(--color-border) rounded-xl border border-(--color-border)">
      {entries.map((entry, index) => (
        <li key={`${entry.player}-${index}`} className="flex items-center justify-between px-4 py-2.5 text-sm">
          <span className="text-(--color-text-primary)">{entry.player}</span>
          <span className="tabular-nums text-(--color-text-secondary)">{fmtExact(entry.amount)}</span>
        </li>
      ))}
    </ul>
  );
}

export default async function TeamDetailPage({ params }: { params: Promise<{ abbr: string }> }) {
  const { abbr: abbrParam } = await params;
  const team = findTeam(abbrParam);
  if (!team) notFound();

  const abbr = normalizeTeamAbbr(team.abbr);
  const fullName = TEAM_FULL_NAMES[abbr] ?? team.name;
  const { thresholds, exceptions } = teams;
  const capStatus = computeCapStatus(team, thresholds);
  const capSpace = thresholds.salaryCap - team.totalSalaries;
  const availability = computeAvailableExceptions(capStatus, capSpace, exceptions);

  // Position lookup from players.json (roster + salary come from teams.json).
  const positionByName = new Map<string, string>();
  for (const p of players) {
    if (p.team === abbr && p.position) positionByName.set(p.name, p.position);
  }

  const roster: PayrollRow[] = team.activeRoster.map((p) => ({
    name: p.player,
    position: positionByName.get(p.player) ?? "",
    salary: fmtExact(p.salary) + (p.note ? ` (${NOTE_LABELS[p.note] ?? p.note})` : ""),
  }));

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
          {teams.season} season &middot; cap data fetched {formattedTeamsFetchedAt} (Capsheets)
        </p>

        <section className="panel-card rounded-2xl p-5 md:p-6 mb-6">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
            <h2 className="text-lg font-semibold text-(--color-text-primary)">Cap Position</h2>
            <CapStatusBadge tier={capStatus.tier} />
          </div>

          <CapThresholdMeter
            teamAbbr={abbr}
            totalSalaries={team.totalSalaries}
            thresholds={thresholds}
            tier={capStatus.tier}
          />

          <dl className="mt-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <dt className="font-condensed text-(--color-text-muted) text-xs uppercase tracking-[0.08em] mb-1">
                Total Salaries
              </dt>
              <dd className="font-scoreboard text-2xl tracking-wide tabular-nums text-(--color-text-primary)">
                {fmtExact(team.totalSalaries)}
              </dd>
            </div>
            <div>
              <dt className="font-condensed text-(--color-text-muted) text-xs uppercase tracking-[0.08em] mb-1">
                Luxury Tax
              </dt>
              <dd className="font-scoreboard text-2xl tracking-wide tabular-nums text-(--color-text-primary)">
                {fmtSpace(team.luxuryTaxSpace)}
                {team.repeater && <span className="block text-xs font-sans text-(--color-text-muted) mt-0.5">Repeater rate</span>}
              </dd>
            </div>
            <div>
              <dt className="font-condensed text-(--color-text-muted) text-xs uppercase tracking-[0.08em] mb-1">
                First Apron
              </dt>
              <dd className="font-scoreboard text-2xl tracking-wide tabular-nums text-(--color-text-primary)">
                {fmtSpace(team.firstApronSpace)}
              </dd>
            </div>
            <div>
              <dt className="font-condensed text-(--color-text-muted) text-xs uppercase tracking-[0.08em] mb-1">
                Second Apron
              </dt>
              <dd className="font-scoreboard text-2xl tracking-wide tabular-nums text-(--color-text-primary)">
                {fmtSpace(team.secondApronSpace)}
              </dd>
            </div>
          </dl>
        </section>

        <section className="panel-card rounded-2xl p-5 md:p-6 mb-6">
          <h2 className="text-lg font-semibold text-(--color-text-primary) mb-3">Available Exceptions</h2>
          <ExceptionsSummary availability={availability} />
          {team.exceptions.length > 0 && (
            <ul className="mt-4 space-y-1.5 text-sm text-(--color-text-secondary)">
              {team.exceptions.map((ex, index) => (
                <li key={`${ex.type}-${index}`} className="flex flex-wrap items-baseline justify-between gap-x-4">
                  <span>{ex.type}</span>
                  <span className="tabular-nums">
                    {ex.amount > 0 ? fmtExact(ex.amount) : "—"}
                    {ex.expiry && <span className="text-(--color-text-muted)"> · expires {ex.expiry}</span>}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold text-(--color-text-primary)">Payroll</h2>
            <span className="text-xs text-(--color-text-muted)">
              {roster.length} players &middot; {fmtExact(team.totalPayroll)}
            </span>
          </div>
          <PayrollTable teamName={fullName} season={teams.season} players={roster} />
        </section>

        {team.twoWay.length > 0 && (
          <section className="panel-card rounded-2xl p-5 md:p-6 mb-6">
            <h2 className="text-lg font-semibold text-(--color-text-primary) mb-2">Two-Way Contracts</h2>
            <p className="text-sm text-(--color-text-secondary) leading-relaxed">{team.twoWay.join(" · ")}</p>
          </section>
        )}

        {team.deadMoney.length > 0 && (
          <section className="mb-6">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-semibold text-(--color-text-primary)">Dead Money</h2>
              <span className="text-xs text-(--color-text-muted)">{fmtExact(team.deadMoneyTotal)} total</span>
            </div>
            <p className="text-xs text-(--color-text-muted) mb-3">
              Waived or stretched players still counting against the cap. Included in total salaries.
            </p>
            <NamedAmountList entries={team.deadMoney} />
          </section>
        )}

        {team.capHolds.length > 0 && (
          <section className="mb-8">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-semibold text-(--color-text-primary)">Cap Holds</h2>
              <span className="text-xs text-(--color-text-muted)">{fmtExact(team.capHoldsTotal)} total</span>
            </div>
            <p className="text-xs text-(--color-text-muted) mb-3">
              Placeholder charges for free agents and unfilled roster spots. Not part of payroll — the team can
              renounce them to open cap room.
            </p>
            <NamedAmountList entries={team.capHolds} />
          </section>
        )}

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
