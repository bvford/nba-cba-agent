import { readFileSync } from "fs";
import { join } from "path";

const MIN_PLAYERS = 400;
const MIN_PLAYERS_WITH_STATS = 250;
const MIN_PLAYERS_WITH_SALARY = 250;
const MIN_TEAMS = 25;

interface PlayerData {
  games?: number;
  salaries?: Record<string, string>;
}

interface TeamsData {
  thresholds?: {
    capFloor?: number;
    salaryCap?: number;
    firstApron?: number;
    secondApron?: number;
  };
  exceptions?: {
    nonTaxpayerMLE?: number;
    taxpayerMLE?: number;
    biannual?: number;
  };
  teams?: Array<{ abbr?: string; capAllocations?: number; capSpace?: number }>;
}

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, "utf8")) as T;
}

function fail(message: string): never {
  throw new Error(message);
}

const playersPath = join(process.cwd(), "data", "players.json");
const teamsPath = join(process.cwd(), "data", "teams.json");

const players = readJson<PlayerData[]>(playersPath);
if (!Array.isArray(players)) fail("players.json is not an array");

const playersWithStats = players.filter((player) => (player.games || 0) > 0).length;
const playersWithSalary = players.filter((player) => Object.keys(player.salaries || {}).length > 0).length;

if (players.length < MIN_PLAYERS) fail(`players.json has only ${players.length} players`);
if (playersWithStats < MIN_PLAYERS_WITH_STATS) fail(`players.json has only ${playersWithStats} players with stats`);
if (playersWithSalary < MIN_PLAYERS_WITH_SALARY) fail(`players.json has only ${playersWithSalary} players with salary data`);

const teams = readJson<TeamsData>(teamsPath);
const teamRows = teams.teams || [];
const uniqueAbbrs = new Set(teamRows.map((team) => team.abbr).filter(Boolean));

if (teamRows.length < MIN_TEAMS) fail(`teams.json has only ${teamRows.length} teams`);
if (uniqueAbbrs.size !== teamRows.length) fail("teams.json has duplicate or missing team abbreviations");

for (const field of ["capFloor", "salaryCap", "firstApron", "secondApron"] as const) {
  if (!teams.thresholds?.[field]) fail(`teams.json is missing threshold ${field}`);
}

for (const field of ["nonTaxpayerMLE", "taxpayerMLE", "biannual"] as const) {
  if (!teams.exceptions?.[field]) fail(`teams.json is missing exception ${field}`);
}

for (const team of teamRows) {
  if (!team.abbr || !team.capAllocations) {
    fail(`teams.json has an incomplete row for ${team.abbr || "unknown team"}`);
  }
}

console.log("Refresh data validation passed");
console.log(`  Players: ${players.length} (${playersWithStats} with stats, ${playersWithSalary} with salaries)`);
console.log(`  Teams: ${teamRows.length}`);
