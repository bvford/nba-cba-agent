/**
 * fetch-players.ts
 * Rebuilds data/players.json from two sources:
 *   1. data/teams.json (capsheets.com — run scripts/fetch-capsheets.ts first):
 *      authoritative rosters, team assignments, and 2026-27 salaries.
 *   2. nbaapi.com: last season's per-player stats.
 *
 * Stats rows are matched to capsheets players by normalized name (diacritics
 * stripped, punctuation removed, Jr./III-style suffixes dropped). A stats row
 * that matches no roster player is kept with team: null and notOnRoster: true
 * (free agents' stats still matter for chat) — never with a stat-site team
 * code, and 2TM/3TM/4TM pseudo-teams are never used as team labels.
 *
 * Run: npx tsx scripts/fetch-players.ts  (or npm run fetch-players)
 */
import { readFileSync, writeFileSync } from "fs";
import { join } from "path";

const MIN_STATS_PLAYERS = 250;
const MIN_TOTAL_PLAYERS = 400;
const MIN_ROSTER_SIZE = 12; // active + two-way
// Offseason rosters can exceed the in-season limit (e.g. July 2026 MEM carried
// 20 active + 3 two-way while sorting out non-guaranteed deals).
const MAX_ROSTER_SIZE = 24;

const CANONICAL_ABBRS = new Set([
  "ATL", "BKN", "BOS", "CHA", "CHI", "CLE", "DAL", "DEN", "DET", "GSW",
  "HOU", "IND", "LAC", "LAL", "MEM", "MIA", "MIL", "MIN", "NOP", "NYK",
  "OKC", "ORL", "PHI", "PHX", "POR", "SAC", "SAS", "TOR", "UTA", "WAS",
]);

// NBA league year starts July 1. Example: Jul 2026-Jun 2027 is contract season 2026.
function currentNBAContractSeason(): number {
  const now = new Date();
  return now.getMonth() >= 6 ? now.getFullYear() : now.getFullYear() - 1;
}

const CURRENT_SEASON = currentNBAContractSeason();
const SEASON_KEY = `${CURRENT_SEASON}-${String((CURRENT_SEASON + 1) % 100).padStart(2, "0")}`;

// ---- Types ----

interface RosterPlayer {
  player: string;
  salary: number;
  note?: string;
}

interface TeamsJson {
  fetchedAt: string;
  season: string;
  source: string;
  teams: Array<{
    abbr: string;
    activeRoster: RosterPlayer[];
    twoWay: string[];
  }>;
}

interface PlayerStats {
  name: string;
  position: string;
  age: number;
  games: number;
  gamesStarted: number;
  points: number;
  rebounds: number;
  assists: number;
  steals: number;
  blocks: number;
  turnovers: number;
  fieldPercent: number;
  threePercent: number;
  ftPercent: number;
  minutesPerGame: number;
}

interface PlayerData extends PlayerStats {
  team: string | null;
  notOnRoster?: boolean;
  twoWay?: boolean;
  salaries: Record<string, string>;
}

// ---- Name normalization (shared matching key) ----
// NFD-decompose and strip combining marks so "Jokić" === "Jokic", lowercase,
// drop punctuation, and remove generational suffixes.
function normalizeName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[.,'’-]/g, "")
    .replace(/\s+(jr|sr|ii|iii|iv|v)$/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

const EMPTY_STATS: PlayerStats = {
  name: "",
  position: "",
  age: 0,
  games: 0,
  gamesStarted: 0,
  points: 0,
  rebounds: 0,
  assists: 0,
  steals: 0,
  blocks: 0,
  turnovers: 0,
  fieldPercent: 0,
  threePercent: 0,
  ftPercent: 0,
  minutesPerGame: 0,
};

function formatSalary(amount: number, note?: string): string {
  const formatted = "$" + amount.toLocaleString("en-US");
  if (!note) return formatted;
  const label = note
    .split(" ")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
  return `${formatted} (${label})`;
}

// ---- Stats from nbaapi.com ----

async function fetchStatsForSeason(statsSeason: number): Promise<PlayerStats[]> {
  console.log(`Fetching player stats from nbaapi.com for season ${statsSeason}...`);
  const allPlayers: PlayerStats[] = [];
  let page = 1;
  const pageSize = 100;

  while (true) {
    const url = `https://api.server.nbaapi.com/api/playertotals?season=${statsSeason}&isPlayoff=false&page=${page}&pageSize=${pageSize}`;
    const res = await fetch(url);

    if (!res.ok) {
      console.error(`  Stats API returned ${res.status} on page ${page}`);
      break;
    }

    const json: {
      data?: Array<Record<string, any>>;
      pagination?: { page?: number; pageSize?: number; pages?: number; total?: number };
    } = await res.json();
    const data = json.data || [];

    if (data.length === 0) break;

    for (const p of data) {
      const gp = p.games || 1;
      allPlayers.push({
        name: p.playerName || "",
        position: p.position || "",
        age: p.age || 0,
        games: p.games || 0,
        gamesStarted: p.gamesStarted || 0,
        points: p.points || 0,
        rebounds: p.totalRb || 0,
        assists: p.assists || 0,
        steals: p.steals || 0,
        blocks: p.blocks || 0,
        turnovers: p.turnovers || 0,
        fieldPercent: p.fieldPercent || 0,
        threePercent: p.threePercent || 0,
        ftPercent: p.ftPercent || 0,
        minutesPerGame: Math.round(((p.minutesPg || p.minutesPlayed || 0) / gp) * 10) / 10,
      });
    }

    console.log(`  Page ${page}: ${data.length} players (total: ${allPlayers.length})`);

    const totalPages = json.pagination?.pages;
    const effectivePageSize = json.pagination?.pageSize || pageSize;
    if (totalPages && page >= totalPages) break;
    if (!totalPages && data.length < effectivePageSize) break;
    page++;

    await new Promise((r) => setTimeout(r, 200));
  }

  console.log(`  Found ${allPlayers.length} stat rows for season ${statsSeason}`);
  return allPlayers;
}

async function fetchStats(): Promise<PlayerStats[]> {
  const candidateSeasons = Array.from(
    new Set([CURRENT_SEASON + 1, CURRENT_SEASON, CURRENT_SEASON - 1])
  );

  for (const statsSeason of candidateSeasons) {
    const stats = await fetchStatsForSeason(statsSeason);
    if (stats.length >= MIN_STATS_PLAYERS) {
      return stats;
    }
    console.warn(`  Season ${statsSeason} only returned ${stats.length} players — trying another season`);
  }

  throw new Error("Could not fetch a complete player stats season");
}

// One stats row per normalized name. nbaapi returns a per-team row for traded
// players PLUS a combined 2TM/3TM row; keeping the row with the most games
// naturally selects the combined season totals.
function dedupeStats(stats: PlayerStats[]): Map<string, PlayerStats> {
  const byName = new Map<string, PlayerStats>();
  for (const row of stats) {
    if (!row.name) continue;
    const key = normalizeName(row.name);
    const existing = byName.get(key);
    if (!existing || row.games > existing.games) {
      byName.set(key, row);
    }
  }
  return byName;
}

// ---- Merge ----

function buildPlayers(teamsJson: TeamsJson, statsByName: Map<string, PlayerStats>): PlayerData[] {
  const players: PlayerData[] = [];
  const rosteredKeys = new Set<string>();

  for (const team of teamsJson.teams) {
    if (!CANONICAL_ABBRS.has(team.abbr)) {
      throw new Error(`teams.json has non-canonical abbreviation: ${team.abbr}`);
    }

    for (const rosterPlayer of team.activeRoster) {
      const key = normalizeName(rosterPlayer.player);
      if (rosteredKeys.has(key)) {
        throw new Error(`Player "${rosterPlayer.player}" appears on more than one roster`);
      }
      rosteredKeys.add(key);
      const stats = statsByName.get(key);
      players.push({
        ...(stats ?? EMPTY_STATS),
        name: rosterPlayer.player, // capsheets spelling is canonical (keeps diacritics)
        team: team.abbr,
        salaries: {
          [SEASON_KEY]: formatSalary(rosterPlayer.salary, rosterPlayer.note),
        },
      });
    }

    for (const twoWayName of team.twoWay) {
      const key = normalizeName(twoWayName);
      if (rosteredKeys.has(key)) continue; // defensive: already on a roster
      rosteredKeys.add(key);
      const stats = statsByName.get(key);
      players.push({
        ...(stats ?? EMPTY_STATS),
        name: twoWayName,
        team: team.abbr,
        twoWay: true,
        salaries: {
          [SEASON_KEY]: "Two-Way",
        },
      });
    }
  }

  // Stats-only players: not on any 2026-27 roster (free agents, retired,
  // overseas). Keep their stats for chat, but never assign a team.
  for (const [key, stats] of statsByName) {
    if (rosteredKeys.has(key)) continue;
    players.push({
      ...stats,
      team: null,
      notOnRoster: true,
      salaries: {},
    });
  }

  return players;
}

// ---- Validation (loud, refuses to write bad data) ----

function validate(players: PlayerData[], teamsJson: TeamsJson): void {
  const failures: string[] = [];

  if (players.length < MIN_TOTAL_PLAYERS) {
    failures.push(`only ${players.length} total players`);
  }

  const withStats = players.filter((p) => p.games > 0).length;
  if (withStats < MIN_STATS_PLAYERS) {
    failures.push(`only ${withStats} players with stats`);
  }

  // Zero duplicate normalized names.
  const seen = new Map<string, number>();
  for (const p of players) {
    const key = normalizeName(p.name);
    seen.set(key, (seen.get(key) || 0) + 1);
  }
  const dupes = Array.from(seen.entries()).filter(([, n]) => n > 1);
  if (dupes.length > 0) {
    failures.push(`${dupes.length} duplicate normalized names (e.g. ${dupes.slice(0, 5).map(([k]) => k).join(", ")})`);
  }

  // No stat-site pseudo-teams or non-canonical codes.
  for (const p of players) {
    if (p.team !== null && !CANONICAL_ABBRS.has(p.team)) {
      failures.push(`player "${p.name}" has non-canonical team "${p.team}"`);
      break;
    }
  }

  // Every team has a plausible roster (active + two-way).
  for (const team of teamsJson.teams) {
    const size = players.filter((p) => p.team === team.abbr).length;
    if (size < MIN_ROSTER_SIZE || size > MAX_ROSTER_SIZE) {
      failures.push(`${team.abbr} roster has ${size} players (expected ${MIN_ROSTER_SIZE}-${MAX_ROSTER_SIZE})`);
    }
  }

  if (failures.length > 0) {
    throw new Error(`Refusing to write degraded players.json: ${failures.join("; ")}`);
  }
}

async function main() {
  try {
    // Rosters/salaries come from data/teams.json (capsheets). Require the v2
    // shape so this can't silently run against stale Spotrac data.
    const teamsPath = join(process.cwd(), "data", "teams.json");
    const teamsJson = JSON.parse(readFileSync(teamsPath, "utf8")) as TeamsJson;
    if (teamsJson.source !== "capsheets.com" || !Array.isArray(teamsJson.teams)) {
      throw new Error("data/teams.json is not the capsheets v2 shape — run scripts/fetch-capsheets.ts first");
    }
    if (teamsJson.teams.length !== 30) {
      throw new Error(`data/teams.json has ${teamsJson.teams.length} teams — run scripts/fetch-capsheets.ts first`);
    }

    const stats = await fetchStats();
    const statsByName = dedupeStats(stats);

    const players = buildPlayers(teamsJson, statsByName);
    validate(players, teamsJson);

    players.sort((a, b) => b.points - a.points);

    const output = {
      fetchedAt: new Date().toISOString().slice(0, 10),
      players,
    };

    const outPath = join(process.cwd(), "data", "players.json");
    writeFileSync(outPath, JSON.stringify(output, null, 2));

    const rostered = players.filter((p) => p.team !== null);
    const twoWay = players.filter((p) => p.twoWay).length;
    const freeAgents = players.filter((p) => p.notOnRoster).length;
    const rosteredWithStats = rostered.filter((p) => p.games > 0).length;
    console.log(`\nDone!`);
    console.log(`  Total players: ${players.length}`);
    console.log(`  On 2026-27 rosters: ${rostered.length} (${twoWay} two-way; ${rosteredWithStats} with stats)`);
    console.log(`  Stats-only (no current roster): ${freeAgents}`);
    console.log(`  Output: ${outPath}`);
  } catch (err) {
    console.error("Error:", err);
    process.exit(1);
  }
}

main();
