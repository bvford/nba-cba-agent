/**
 * validate-refresh-data.ts
 * Sanity-checks data/teams.json (capsheets v2) and data/players.json (v2)
 * after a refresh. Throws (non-zero exit) on any failure, so it's safe as a
 * CI/workflow gate.
 */
import { readFileSync } from "fs";
import { join } from "path";

const MIN_PLAYERS = 400;
const MIN_PLAYERS_WITH_STATS = 250;
const TEAM_COUNT = 30;
const MIN_ROSTER_SIZE = 12; // active + two-way, per team
const MAX_ROSTER_SIZE = 24; // offseason rosters can exceed the in-season limit
const MIN_PLAUSIBLE_PAYROLL = 100_000_000;
const MAX_PLAUSIBLE_PAYROLL = 300_000_000;
// The refresh workflow keeps the last good data when a scrape fails, which is
// silent by design for a one-off blip. This makes two consecutive misses loud.
const MAX_DATA_AGE_DAYS = 70;

const CANONICAL_ABBRS = new Set([
  "ATL", "BKN", "BOS", "CHA", "CHI", "CLE", "DAL", "DEN", "DET", "GSW",
  "HOU", "IND", "LAC", "LAL", "MEM", "MIA", "MIL", "MIN", "NOP", "NYK",
  "OKC", "ORL", "PHI", "PHX", "POR", "SAC", "SAS", "TOR", "UTA", "WAS",
]);
const PSEUDO_TEAM_CODES = new Set(["2TM", "3TM", "4TM"]);

interface PlayerData {
  name?: string;
  team?: string | null;
  games?: number;
  salaries?: Record<string, string>;
}

interface PlayersJson {
  fetchedAt?: string;
  players?: PlayerData[];
}

interface TeamsJson {
  fetchedAt?: string;
  season?: string;
  source?: string;
  thresholds?: {
    capFloor?: number;
    salaryCap?: number;
    firstApron?: number;
    secondApron?: number;
    luxuryTax?: number;
  };
  exceptions?: {
    nonTaxpayerMLE?: number;
    taxpayerMLE?: number;
    biannual?: number;
  };
  teams?: Array<{
    abbr?: string;
    activeRoster?: Array<{ player?: string; salary?: number }>;
    twoWay?: string[];
    totalPayroll?: number;
    totalSalaries?: number;
    firstApronSpace?: number;
    secondApronSpace?: number;
    luxuryTaxSpace?: number;
  }>;
}

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, "utf8")) as T;
}

function fail(message: string): never {
  throw new Error(message);
}

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

const playersPath = join(process.cwd(), "data", "players.json");
const teamsPath = join(process.cwd(), "data", "teams.json");

// ---- players.json (v2: { fetchedAt, players }) ----

const playersJson = readJson<PlayersJson>(playersPath);
if (!playersJson.fetchedAt) fail("players.json is missing fetchedAt (old shape?)");
const players = playersJson.players;
if (!Array.isArray(players)) fail("players.json .players is not an array");

if (players.length < MIN_PLAYERS) fail(`players.json has only ${players.length} players`);

const playersWithStats = players.filter((player) => (player.games || 0) > 0).length;
if (playersWithStats < MIN_PLAYERS_WITH_STATS) {
  fail(`players.json has only ${playersWithStats} players with stats`);
}

// Zero duplicate normalized names.
const nameCounts = new Map<string, number>();
for (const player of players) {
  if (!player.name) fail("players.json has a row with no name");
  const key = normalizeName(player.name);
  nameCounts.set(key, (nameCounts.get(key) || 0) + 1);
}
const duplicates = Array.from(nameCounts.entries()).filter(([, count]) => count > 1);
if (duplicates.length > 0) {
  fail(`players.json has ${duplicates.length} duplicate normalized names (e.g. ${duplicates.slice(0, 5).map(([name]) => name).join(", ")})`);
}

// Team codes: canonical or null — never 2TM-style pseudo-teams.
for (const player of players) {
  const team = player.team;
  if (team === null || team === undefined) continue;
  if (PSEUDO_TEAM_CODES.has(team)) fail(`players.json has pseudo-team code "${team}" for ${player.name}`);
  if (!CANONICAL_ABBRS.has(team)) fail(`players.json has non-canonical team "${team}" for ${player.name}`);
}

// ---- teams.json (capsheets v2) ----

const teams = readJson<TeamsJson>(teamsPath);
if (teams.source !== "capsheets.com") fail(`teams.json source is "${teams.source}" (expected capsheets.com)`);

const fetchedAt = teams.fetchedAt ? Date.parse(teams.fetchedAt) : NaN;
if (Number.isNaN(fetchedAt)) {
  fail(`teams.json has an unreadable fetchedAt ("${teams.fetchedAt}")`);
} else {
  const ageDays = Math.floor((Date.now() - fetchedAt) / 86_400_000);
  if (ageDays > MAX_DATA_AGE_DAYS) {
    fail(`teams.json was last refreshed ${ageDays} days ago (max ${MAX_DATA_AGE_DAYS}) — the capsheets scrape has been failing`);
  }
}

const teamRows = teams.teams || [];
if (teamRows.length !== TEAM_COUNT) fail(`teams.json has ${teamRows.length} teams (expected exactly ${TEAM_COUNT})`);

const uniqueAbbrs = new Set(teamRows.map((team) => team.abbr).filter(Boolean));
if (uniqueAbbrs.size !== teamRows.length) fail("teams.json has duplicate or missing team abbreviations");
for (const abbr of uniqueAbbrs) {
  if (!CANONICAL_ABBRS.has(abbr!)) fail(`teams.json has non-canonical abbreviation "${abbr}"`);
}

for (const field of ["capFloor", "salaryCap", "firstApron", "secondApron", "luxuryTax"] as const) {
  if (!teams.thresholds?.[field]) fail(`teams.json is missing threshold ${field}`);
}

for (const field of ["nonTaxpayerMLE", "taxpayerMLE", "biannual"] as const) {
  if (!teams.exceptions?.[field]) fail(`teams.json is missing exception ${field}`);
}

for (const team of teamRows) {
  const abbr = team.abbr || "unknown team";
  const totalSalaries = team.totalSalaries || 0;
  if (totalSalaries < MIN_PLAUSIBLE_PAYROLL || totalSalaries > MAX_PLAUSIBLE_PAYROLL) {
    fail(`teams.json ${abbr} has implausible totalSalaries ${totalSalaries}`);
  }
  if (team.firstApronSpace === undefined || team.secondApronSpace === undefined || team.luxuryTaxSpace === undefined) {
    fail(`teams.json ${abbr} is missing apron/tax space fields`);
  }
  const rosterSize = (team.activeRoster?.length || 0) + (team.twoWay?.length || 0);
  if (rosterSize < MIN_ROSTER_SIZE || rosterSize > MAX_ROSTER_SIZE) {
    fail(`teams.json ${abbr} roster has ${rosterSize} players (expected ${MIN_ROSTER_SIZE}-${MAX_ROSTER_SIZE})`);
  }
  // Every team must be represented in players.json with a plausible roster.
  const rosterInPlayers = players.filter((p) => p.team === team.abbr).length;
  if (rosterInPlayers < MIN_ROSTER_SIZE) {
    fail(`players.json has only ${rosterInPlayers} players for ${abbr}`);
  }
}

const rosteredPlayers = players.filter((p) => p.team).length;
console.log("Refresh data validation passed");
console.log(`  Players: ${players.length} (${playersWithStats} with stats, ${rosteredPlayers} on rosters)`);
console.log(`  Teams: ${teamRows.length} (source: ${teams.source}, fetched ${teams.fetchedAt})`);
