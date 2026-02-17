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

// NBA team ID to abbreviation map (HoopsHype uses numeric IDs)
const TEAM_MAP: Record<string, string> = {
  "1": "ATL", "2": "BOS", "3": "BKN", "4": "CHA", "5": "CHI",
  "6": "CLE", "7": "DAL", "8": "DEN", "9": "GSW", "10": "HOU",
  "11": "IND", "12": "LAC", "13": "LAL", "14": "MEM", "15": "MIA",
  "16": "MIL", "17": "MIN", "18": "NOP", "19": "NYK", "20": "OKC",
  "21": "ORL", "22": "PHI", "23": "PHX", "24": "POR", "25": "SAC",
  "26": "SAS", "27": "TOR", "28": "UTA", "29": "WAS", "30": "DET",
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

// ---- Fetch salary data from GitHub CSV (reliable) + HoopsHype multi-year (bonus) ----
async function fetchSalaries(): Promise<PlayerSalary[]> {
  const salaryMap = new Map<string, PlayerSalary>();

  // Step 1: Get base salary data from GitHub CSV (2024-25 season)
  console.log("Fetching salary data from GitHub CSV...");
  try {
    const csvRes = await fetch(
      "https://raw.githubusercontent.com/edwinjeon/NBA-Salary-Prediction/main/data/NBA%20Player%20Salaries_2024-25_1.csv"
    );
    if (csvRes.ok) {
      const csv = await csvRes.text();
      const lines = csv.trim().split("\n").slice(1); // skip header
      for (const line of lines) {
        // CSV format: Player,Team,Salary (salary has quotes due to commas)
        const match = line.match(/^(.+?),([A-Z]{3}),"?\$?([\d,]+)/);
        if (match) {
          const name = match[1].trim();
          const team = match[2].trim();
          const salary = "$" + match[3].trim();
          salaryMap.set(normalizeName(name), {
            name,
            team,
            salaries: { "2024-25": salary },
          });
        }
      }
      console.log(`  CSV: ${salaryMap.size} players loaded`);
    }
  } catch (err) {
    console.error("  CSV fetch failed:", err);
  }

  // Step 2: Enhance with HoopsHype multi-year contract data (top players)
  console.log("Fetching multi-year contracts from HoopsHype...");
  try {
    const res = await fetch("https://hoopshype.com/salaries/players/", {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
      },
    });

    if (res.ok) {
      const html = await res.text();
      // Find embedded contracts JSON
      const contractsStart = html.indexOf('"contracts":[{"__typename":"Contracts"');
      if (contractsStart !== -1) {
        const arrayStart = html.indexOf("[", contractsStart);
        let depth = 0;
        let arrayEnd = arrayStart;
        for (let i = arrayStart; i < html.length; i++) {
          if (html[i] === "[") depth++;
          if (html[i] === "]") depth--;
          if (depth === 0) {
            arrayEnd = i + 1;
            break;
          }
        }

        const contracts = JSON.parse(html.slice(arrayStart, arrayEnd));
        let enhanced = 0;
        for (const contract of contracts) {
          const name = contract.playerName || "";
          if (!name) continue;

          const key = normalizeName(name);
          const existing = salaryMap.get(key);
          const salaries: Record<string, string> = existing?.salaries || {};
          let team = existing?.team || "";

          for (const season of contract.seasons || []) {
            if (season.salary && season.season >= 2025) {
              const seasonKey = formatSeason(season.season);
              salaries[seasonKey] = formatSalary(season.salary, {
                po: season.playerOption || false,
                to: season.teamOption || false,
                qo: season.qualifyingOffer || false,
                tw: season.twoWayContract || false,
              });
              if (season.teamID) {
                team = TEAM_MAP[season.teamID] || team;
              }
            }
          }

          salaryMap.set(key, { name, team, salaries });
          enhanced++;
        }
        console.log(`  HoopsHype: enhanced ${enhanced} players with multi-year data`);
      }
    }
  } catch (err) {
    console.error("  HoopsHype fetch failed (non-critical):", err);
  }

  const players = Array.from(salaryMap.values());
  console.log(`  Total: ${players.length} players with salary data`);
  return players;
}

// ---- Fetch player stats from nbaStats API ----
async function fetchStats(): Promise<PlayerStats[]> {
  console.log("Fetching player stats from nbaStats API...");
  const allPlayers: PlayerStats[] = [];
  let page = 1;
  const pageSize = 100;

  while (true) {
    const url = `https://api.server.nbaapi.com/api/playertotals?season=2025&isPlayoff=false&page=${page}&pageSize=${pageSize}`;
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
        minutesPerGame: Math.round((p.minutesPlayed || 0) / gp * 10) / 10,
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
    merged.push({
      ...stat,
      salaries: salary?.salaries || {},
    });
  }

  // Add salary-only players (might not have stats yet if injured, etc.)
  const statsNames = new Set(stats.map((s) => normalizeName(s.name)));
  for (const sal of salaries) {
    if (!statsNames.has(normalizeName(sal.name))) {
      merged.push({
        name: sal.name,
        team: sal.team,
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
