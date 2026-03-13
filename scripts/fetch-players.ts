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

const BALLDONTLIE_API_KEY = process.env.BALLDONTLIE_API_KEY;

// NBA team ID to abbreviation map (HoopsHype IDs)
const TEAM_MAP: Record<string, string> = {
  "1": "ATL", "2": "BOS", "3": "BKN", "4": "CHA", "5": "CHI",
  "6": "CLE", "7": "DAL", "8": "DEN", "9": "GSW", "10": "HOU",
  "11": "IND", "12": "LAC", "13": "LAL", "14": "MEM", "15": "MIA",
  "16": "MIL", "17": "MIN", "18": "NYK", "19": "ORL", "20": "PHI",
  "21": "PHX", "22": "POR", "23": "SAC", "24": "SAS", "25": "OKC",
  "26": "UTA", "27": "WAS", "28": "TOR", "29": "MEM", "30": "DET",
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

function formatSeason(season: number): string {
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

// ---- Fetch current rosters from BallDontLie (authoritative team source) ----
async function fetchRosterFromBallDontLie(): Promise<Map<string, string>> {
  const rosterMap = new Map<string, string>(); // normalizedName → team abbreviation

  if (!BALLDONTLIE_API_KEY) {
    console.warn("  BALLDONTLIE_API_KEY not set — skipping roster fetch");
    return rosterMap;
  }

  console.log("Fetching current rosters from BallDontLie...");

  let cursor: number | null = null;
  let page = 0;
  let totalFetched = 0;
  let consecutiveRateLimits = 0;

  while (true) {
    const url: string = cursor
      ? `https://api.balldontlie.io/v1/players?per_page=100&cursor=${cursor}`
      : `https://api.balldontlie.io/v1/players?per_page=100`;

    const res: Response = await fetch(url, {
      headers: { Authorization: BALLDONTLIE_API_KEY },
    });

    if (!res.ok) {
      if (res.status === 429) {
        consecutiveRateLimits++;
        if (consecutiveRateLimits >= 4) {
          console.warn(`  BallDontLie rate limit hit ${consecutiveRateLimits} times — stopping early. Collected ${rosterMap.size} teams so far.`);
          console.warn(`  Tip: the free tier quota may be exhausted. Try running again in a few hours.`);
          break;
        }
        console.log(`  Rate limited (${consecutiveRateLimits}/4) — waiting 15s...`);
        await new Promise((r) => setTimeout(r, 15000));
        continue;
      }
      console.error(`  BallDontLie returned ${res.status} on page ${page}`);
      break;
    }
    consecutiveRateLimits = 0;

    const json: { data?: Array<{ first_name: string; last_name: string; team: { abbreviation: string } | null }>; meta?: { next_cursor?: number } } = await res.json();
    const data = json.data || [];

    if (data.length === 0) break;

    for (const player of data) {
      if (!player.team) continue; // skip players with no current team (retired, etc.)
      const fullName = `${player.first_name} ${player.last_name}`;
      const key = normalizeName(fullName);
      rosterMap.set(key, player.team.abbreviation);
    }

    totalFetched += data.length;
    page++;

    const nextCursor: number | undefined = json.meta?.next_cursor;
    if (!nextCursor) break;
    cursor = nextCursor;

    // Respect rate limits: 60 req/min on free tier → 2 req/sec to be safe
    await new Promise((r) => setTimeout(r, 2000));
  }

  console.log(`  BallDontLie: ${totalFetched} players fetched, ${rosterMap.size} with active teams`);
  return rosterMap;
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

    await new Promise((r) => setTimeout(r, 200));
  }

  console.log(`  Found ${allPlayers.length} players with stats`);
  return allPlayers;
}

function mergePlayers(
  stats: PlayerStats[],
  salaries: PlayerSalary[],
  bdlRoster: Map<string, string>
): PlayerData[] {
  const salaryMap = new Map<string, PlayerSalary>();
  for (const s of salaries) {
    salaryMap.set(normalizeName(s.name), s);
  }

  const merged: PlayerData[] = [];

  for (const stat of stats) {
    const key = normalizeName(stat.name);
    const salary = salaryMap.get(key);

    // Team priority: BallDontLie (most accurate, live rosters) > HoopsHype salary source > stats source
    const team = bdlRoster.get(key) || salary?.team || stat.team;

    merged.push({
      ...stat,
      team,
      salaries: salary?.salaries || {},
    });
  }

  // Add salary-only players (injured, not yet playing, etc.)
  const statsNames = new Set(stats.map((s) => normalizeName(s.name)));
  for (const sal of salaries) {
    const key = normalizeName(sal.name);
    if (!statsNames.has(key)) {
      const team = bdlRoster.get(key) || sal.team;
      merged.push({
        name: sal.name,
        team,
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
    // Run stats and salary fetches in parallel; BallDontLie is sequential (rate limits)
    const [stats, salaries, bdlRoster] = await Promise.all([
      fetchStats(),
      fetchSalaries(),
      fetchRosterFromBallDontLie(),
    ]);

    const players = mergePlayers(stats, salaries, bdlRoster);

    players.sort((a, b) => b.points - a.points);

    const outPath = join(__dirname, "..", "data", "players.json");
    writeFileSync(outPath, JSON.stringify(players, null, 2));

    const withSalary = players.filter((p) => Object.keys(p.salaries).length > 0);
    const withStats = players.filter((p) => p.games > 0);
    const withBdlTeam = players.filter((p) => bdlRoster.has(normalizeName(p.name)));

    console.log(`\nDone!`);
    console.log(`  Total players: ${players.length}`);
    console.log(`  With stats: ${withStats.length}`);
    console.log(`  With salary data: ${withSalary.length}`);
    console.log(`  Team confirmed by BallDontLie: ${withBdlTeam.length}`);
    console.log(`  Output: ${outPath}`);
  } catch (err) {
    console.error("Error:", err);
    process.exit(1);
  }
}

main();
