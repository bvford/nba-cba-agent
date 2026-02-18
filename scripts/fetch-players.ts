import { writeFileSync } from "fs";
import { join } from "path";

interface PlayerSalary {
  name: string;
  team: string;
  salaries: Record<string, string>; // e.g. { "2025-26": "$55,000,000 (P)" }
}

interface PlayerStats {
  name: string;
  team: string;
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

interface PlayerData {
  name: string;
  team: string;
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
  salaries: Record<string, string>;
}

const CURRENT_SEASON = 2025; // 2025-26 snapshot

// NBA team ID to abbreviation map (HoopsHype IDs)
const TEAM_MAP: Record<string, string> = {
  "1": "ATL", "2": "BOS", "3": "BKN", "4": "CHA", "5": "CHI",
  "6": "CLE", "7": "DAL", "8": "DEN", "9": "GSW", "10": "HOU",
  "11": "IND", "12": "LAC", "13": "LAL", "14": "MEM", "15": "MIA",
  "16": "MIL", "17": "MIN", "18": "NYK", "19": "ORL", "20": "PHI",
  "21": "PHX", "22": "POR", "23": "SAC", "24": "SAS", "25": "OKC",
  "26": "UTA", "27": "WAS", "28": "TOR", "29": "MEM", "30": "DET",
  // HoopsHype non-canonical IDs seen on team pages
  "5312": "CHA",
};

const TEAM_SLUG_TO_ABBR: Record<string, string> = {
  "atlanta-hawks": "ATL",
  "boston-celtics": "BOS",
  "brooklyn-nets": "BKN",
  "charlotte-hornets": "CHA",
  "chicago-bulls": "CHI",
  "cleveland-cavaliers": "CLE",
  "dallas-mavericks": "DAL",
  "denver-nuggets": "DEN",
  "detroit-pistons": "DET",
  "golden-state-warriors": "GSW",
  "houston-rockets": "HOU",
  "indiana-pacers": "IND",
  "los-angeles-clippers": "LAC",
  "los-angeles-lakers": "LAL",
  "memphis-grizzlies": "MEM",
  "miami-heat": "MIA",
  "milwaukee-bucks": "MIL",
  "minnesota-timberwolves": "MIN",
  "new-orleans-pelicans": "NOP",
  "new-york-knicks": "NYK",
  "oklahoma-city-thunder": "OKC",
  "orlando-magic": "ORL",
  "philadelphia-76ers": "PHI",
  "phoenix-suns": "PHX",
  "portland-trail-blazers": "POR",
  "sacramento-kings": "SAC",
  "san-antonio-spurs": "SAS",
  "toronto-raptors": "TOR",
  "utah-jazz": "UTA",
  "washington-wizards": "WAS",
};

// Data-quality overrides for known high-signal roster moves when public feeds conflict.
const PLAYER_TEAM_OVERRIDES: Record<string, string> = {
  "james harden": "CLE",
  "anthony davis": "WAS",
  "mark williams": "PHX",
};

function formatSeason(season: number): string {
  // season=2025 means the 2025-26 season
  const nextYear = (season + 1) % 100;
  return `${season}-${nextYear.toString().padStart(2, "0")}`;
}

function formatSalary(amount: number, options: { po: boolean; to: boolean; qo: boolean; tw: boolean }): string {
  const formatted = "$" + amount.toLocaleString();
  const tags: string[] = [];
  if (options.po) tags.push("Player Option");
  if (options.to) tags.push("Team Option");
  if (options.qo) tags.push("Qualifying Offer");
  if (options.tw) tags.push("Two-Way");
  return tags.length > 0 ? `${formatted} (${tags.join(", ")})` : formatted;
}

function extractContractsFromNextData(
  html: string,
  season: number,
  teamId: string
): Array<{
  playerName?: string;
  seasons?: Array<{
    season?: number;
    salary?: number;
    playerOption?: boolean;
    teamOption?: boolean;
    qualifyingOffer?: boolean;
    twoWayContract?: boolean;
    teamID?: string | number;
  }>;
}> {
  const m = html.match(
    /<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/
  );
  if (!m) return [];

  try {
    const data = JSON.parse(m[1]);
    const queries = data?.props?.pageProps?.dehydratedState?.queries || [];
    const query = queries.find(
      (q: { queryKey?: unknown[] }) =>
        Array.isArray(q.queryKey) &&
        q.queryKey[0] === season &&
        q.queryKey[1] === 500 &&
        String(q.queryKey[2]) === teamId
    );
    const contracts = query?.state?.data?.contracts?.contracts;
    return Array.isArray(contracts) ? contracts : [];
  } catch {
    return [];
  }
}

async function fetchTeamSalaryUrls(): Promise<string[]> {
  const res = await fetch("https://hoopshype.com/salaries/teams/", {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
    },
  });

  if (!res.ok) return [];

  const html = await res.text();
  const matches = html.match(/\/salaries\/teams\/[a-z0-9-]+\/\d+\//g) || [];
  return Array.from(new Set(matches)).slice(0, 30);
}

// ---- Fetch salary data from HoopsHype team pages (current + future seasons) ----
async function fetchSalaries(): Promise<PlayerSalary[]> {
  const salaryMap = new Map<string, PlayerSalary>();

  console.log("Fetching salary data from HoopsHype team pages...");

  try {
    const teamUrls = await fetchTeamSalaryUrls();
    console.log(`  Team pages found: ${teamUrls.length}`);

    for (const urlPath of teamUrls) {
      const slugMatch = urlPath.match(/\/salaries\/teams\/([a-z0-9-]+)\/(\d+)\//);
      const teamSlug = slugMatch?.[1] || "";
      const teamId = slugMatch?.[2] || "";
      const fallbackTeam = TEAM_SLUG_TO_ABBR[teamSlug] || "";

      const res = await fetch(`https://hoopshype.com${urlPath}`, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
        },
      });
      if (!res.ok) continue;

      const html = await res.text();
      const contracts = extractContractsFromNextData(html, 2025, teamId);

      for (const contract of contracts) {
        const name = contract.playerName || "";
        if (!name) continue;

        const key = normalizeName(name);
        const existing = salaryMap.get(key);
        const salaries: Record<string, string> = existing?.salaries || {};
        let team = existing?.team || fallbackTeam;

        let currentSeasonTeam: string | undefined;
        let fallbackSeasonTeam: string | undefined;

        for (const season of contract.seasons || []) {
          if (!season.salary || !season.season || season.season < CURRENT_SEASON) continue;

          const seasonKey = formatSeason(season.season);
          salaries[seasonKey] = formatSalary(season.salary, {
            po: season.playerOption || false,
            to: season.teamOption || false,
            qo: season.qualifyingOffer || false,
            tw: season.twoWayContract || false,
          });

          if (season.teamID) {
            const mapped = TEAM_MAP[String(season.teamID)];
            if (mapped) {
              if (!fallbackSeasonTeam) fallbackSeasonTeam = mapped;
              if (season.season === CURRENT_SEASON) currentSeasonTeam = mapped;
            }
          }
        }

        // Prefer the current-season team. If missing, use first known team from available seasons.
        team = currentSeasonTeam || fallbackSeasonTeam || team;

        salaryMap.set(key, { name, team: team || fallbackTeam, salaries });
      }

      await new Promise((r) => setTimeout(r, 120));
    }
  } catch (err) {
    console.error("  Team salary fetch failed:", err);
  }

  const players = Array.from(salaryMap.values());
  console.log(`  Total players with salary data: ${players.length}`);
  return players;
}

// ---- Fetch player stats from nbaStats API ----
async function fetchStats(): Promise<PlayerStats[]> {
  console.log("Fetching player stats from nbaStats API...");
  const allPlayers: PlayerStats[] = [];
  let page = 1;
  const pageSize = 100;

  while (true) {
    const url = `https://api.server.nbaapi.com/api/playertotals?season=2026&isPlayoff=false&page=${page}&pageSize=${pageSize}`;
    const res = await fetch(url);

    if (!res.ok) {
      console.error(`  Stats API returned ${res.status} on page ${page}`);
      break;
    }

    const json = await res.json();
    const data = json.data || [];

    if (data.length === 0) break;

    for (const p of data) {
      const gp = p.games || 1;
      allPlayers.push({
        name: p.playerName || "",
        team: p.team || "",
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
        minutesPerGame: Math.round((p.minutesPg || p.minutesPlayed || 0) / gp * 10) / 10,
      });
    }

    console.log(`  Page ${page}: ${data.length} players (total: ${allPlayers.length})`);

    if (data.length < pageSize) break;
    page++;

    // Small delay to be polite
    await new Promise((r) => setTimeout(r, 200));
  }

  console.log(`  Found ${allPlayers.length} players with stats`);
  return allPlayers;
}

// ---- Normalize names for matching ----
function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[.']/g, "")
    .replace(/\s+jr$/i, "")
    .replace(/\s+sr$/i, "")
    .replace(/\s+iii$/i, "")
    .replace(/\s+ii$/i, "")
    .replace(/\s+iv$/i, "")
    .trim();
}

// ---- Merge stats and salary data ----
function mergePlayers(
  stats: PlayerStats[],
  salaries: PlayerSalary[]
): PlayerData[] {
  // Build a lookup from normalized name to salary
  const salaryMap = new Map<string, PlayerSalary>();
  for (const s of salaries) {
    salaryMap.set(normalizeName(s.name), s);
  }

  const merged: PlayerData[] = [];

  for (const stat of stats) {
      const salary = salaryMap.get(normalizeName(stat.name));
      const overrideTeam = PLAYER_TEAM_OVERRIDES[normalizeName(stat.name)];
      merged.push({
        ...stat,
        // Prefer salary-source team when available; stats feeds can lag post-trade.
        team: overrideTeam || salary?.team || stat.team,
        salaries: salary?.salaries || {},
      });
  }

  // Add salary-only players (might not have stats yet if injured, etc.)
  const statsNames = new Set(stats.map((s) => normalizeName(s.name)));
  for (const sal of salaries) {
    if (!statsNames.has(normalizeName(sal.name))) {
      const overrideTeam = PLAYER_TEAM_OVERRIDES[normalizeName(sal.name)];
      merged.push({
        name: sal.name,
        team: overrideTeam || sal.team,
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
        salaries: sal.salaries,
      });
    }
  }

  return merged;
}

async function main() {
  try {
    const [stats, salaries] = await Promise.all([
      fetchStats(),
      fetchSalaries(),
    ]);

    const players = mergePlayers(stats, salaries);

    // Sort by total points descending
    players.sort((a, b) => b.points - a.points);

    const outPath = join(__dirname, "..", "data", "players.json");
    writeFileSync(outPath, JSON.stringify(players, null, 2));

    const withSalary = players.filter(
      (p) => Object.keys(p.salaries).length > 0
    );
    const withStats = players.filter((p) => p.games > 0);

    console.log(`\nDone!`);
    console.log(`  Total players: ${players.length}`);
    console.log(`  With stats: ${withStats.length}`);
    console.log(`  With salary data: ${withSalary.length}`);
    console.log(`  Output: ${outPath}`);
  } catch (err) {
    console.error("Error:", err);
    process.exit(1);
  }
}

main();
