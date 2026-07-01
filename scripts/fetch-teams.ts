/**
 * fetch-teams.ts
 * Scrapes team-level cap data from Spotrac and writes data/teams.json.
 * Run: tsx scripts/fetch-teams.ts
 */
import { writeFileSync } from "fs";
import { join } from "path";
import * as cheerio from "cheerio";

// NBA league year starts July 1. The Spotrac URL uses the season's start year:
// Jan–Jun 2026 → year=2025 (2025-26 season); Jul–Dec 2026 → year=2026 (2026-27 season)
function currentNBAYear(): { year: number; season: string } {
  const now = new Date();
  const year = now.getMonth() >= 6 ? now.getFullYear() : now.getFullYear() - 1;
  return { year, season: `${year}-${String(year + 1).slice(2)}` };
}

const { year: NBA_YEAR, season: NBA_SEASON } = currentNBAYear();
const SPOTRAC_URL = `https://www.spotrac.com/nba/cap/_/year/${NBA_YEAR}`;
const MIN_TEAMS = 25;

const NBA_TEAM_ABBRS = new Set([
  "ATL", "BOS", "BKN", "CHA", "CHI", "CLE", "DAL", "DEN", "DET", "GSW",
  "HOU", "IND", "LAC", "LAL", "MEM", "MIA", "MIL", "MIN", "NOP", "NYK",
  "OKC", "ORL", "PHI", "PHX", "POR", "SAC", "SAS", "TOR", "UTA", "WAS",
]);

interface TeamCapEntry {
  abbr: string;
  capAllocations: number;
  capSpace: number; // positive = room under cap; negative = over cap
}

interface CapThresholds {
  capFloor: number;
  salaryCap: number;
  firstApron: number;
  secondApron: number;
}

interface CapExceptions {
  nonTaxpayerMLE: number;
  taxpayerMLE: number;
  biannual: number;
}

interface TeamsData {
  fetchedAt: string;
  season: string;
  thresholds: CapThresholds;
  exceptions: CapExceptions;
  teams: TeamCapEntry[];
}

function parseDollar(raw: string): number {
  const match = raw.replace("−", "-").replace(/[,\s]/g, "").match(/(?:-?\$|\$-?)\d+/);
  if (!match) return 0;
  return parseInt(match[0].replace("$", ""), 10) || 0;
}

function normalizeText(raw: string): string {
  return raw.replace(/\s+/g, " ").trim();
}

function findColumn(headers: string[], candidates: string[]): number {
  const normalizedHeaders = headers.map((header) => header.toLowerCase());
  for (const candidate of candidates) {
    const index = normalizedHeaders.findIndex((header) => header === candidate);
    if (index >= 0) return index;
  }
  for (const candidate of candidates) {
    const index = normalizedHeaders.findIndex((header) => header.includes(candidate));
    if (index >= 0) return index;
  }
  return -1;
}

function parseTeamAbbr(teamCell: cheerio.Cheerio<any>): string {
  const candidates: string[] = [];

  candidates.push(teamCell.find("span.d-none").first().text());
  candidates.push(teamCell.find("a.link").first().text());
  candidates.push(teamCell.text());

  const logoSrc = teamCell.find("img").first().attr("src") || "";
  const logoMatch = logoSrc.match(/nba_([a-z]{2,3})/i);
  if (logoMatch) candidates.push(logoMatch[1]);

  for (const candidate of candidates) {
    const tokens = normalizeText(candidate).toUpperCase().match(/[A-Z]{2,3}/g) || [];
    const abbr = tokens.find((token) => NBA_TEAM_ABBRS.has(token));
    if (abbr) return abbr;
  }

  return "";
}

function parseThresholdCard(
  $: cheerio.CheerioAPI,
  card: any,
  label: RegExp
): number {
  const values = $(card)
    .find(".fw-bold")
    .map((_, el) => normalizeText($(el).text()))
    .get();
  const labeled = values.find((value) => label.test(value));
  return parseDollar(labeled || values[0] || "");
}

async function fetchTeams(): Promise<void> {
  console.log("Fetching Spotrac cap data...");

  const res = await fetch(SPOTRAC_URL, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    },
  });

  if (!res.ok) {
    throw new Error(`HTTP ${res.status} fetching ${SPOTRAC_URL}`);
  }

  const html = await res.text();
  const $ = cheerio.load(html);

  // Parse cap/apron threshold cards first. The compact Spotrac table only exposes cap space,
  // so salary cap is needed to derive total cap allocations.
  const thresholds: CapThresholds = {
    capFloor: 0,
    salaryCap: 0,
    firstApron: 0,
    secondApron: 0,
  };

  $(".card.widget").each((_, card) => {
    const title = $(card).find("h2.h5").text().trim().toUpperCase();
    const value = parseThresholdCard($, card, /Floor|Maximum|Threshold/i);
    if (!value) return;
    if (title.includes("UNDER THE CAP") || title.includes("FLOOR")) {
      thresholds.capFloor = value;
    } else if (title.includes("OVER THE CAP") && !title.includes("APRON")) {
      thresholds.salaryCap = value;
    } else if (title.includes("FIRST APRON")) {
      thresholds.firstApron = value;
    } else if (title.includes("SECOND APRON")) {
      thresholds.secondApron = value;
    }
  });

  // Parse exception amounts — look for labeled lines like "Non-Taxpayer MLE: $15,044,000"
  const exceptions: CapExceptions = {
    nonTaxpayerMLE: 0,
    taxpayerMLE: 0,
    biannual: 0,
  };

  $(".card.widget .fw-bold").each((_, el) => {
    const text = normalizeText($(el).text());
    const match = text.match(/\$[\d,]+/);
    if (!match) return;
    const value = parseDollar(match[0]);
    if (/Non[- ]?Taxpayer\s+MLE/i.test(text)) {
      exceptions.nonTaxpayerMLE = value;
    } else if (/Taxpayer\s+MLE/i.test(text)) {
      exceptions.taxpayerMLE = value;
    } else if (/Bi[- ]?Annual/i.test(text)) {
      exceptions.biannual = value;
    }
  });

  // Parse team rows from the main cap table
  const teams: TeamCapEntry[] = [];
  let capTable: cheerio.Cheerio<any> | undefined;
  let headers: string[] = [];
  let teamColumn = -1;
  let capAllocationsColumn = -1;
  let capSpaceColumn = -1;

  for (const table of $("table").toArray()) {
    const tableHeaders = $(table)
      .find("thead th")
      .map((_, th) => normalizeText($(th).text()))
      .get();
    const tableTeamColumn = findColumn(tableHeaders, ["team"]);
    const tableCapAllocationsColumn = findColumn(tableHeaders, ["total cap allocations", "total cap"]);
    const tableCapSpaceColumn = findColumn(tableHeaders, ["cap space all", "cap space"]);

    if (tableTeamColumn >= 0 && tableCapAllocationsColumn >= 0 && tableCapSpaceColumn >= 0) {
      capTable = $(table);
      headers = tableHeaders;
      teamColumn = tableTeamColumn;
      capAllocationsColumn = tableCapAllocationsColumn;
      capSpaceColumn = tableCapSpaceColumn;
      break;
    }
  }

  if (!capTable || teamColumn < 0 || capAllocationsColumn < 0 || capSpaceColumn < 0) {
    throw new Error(`Could not identify Spotrac table columns: ${headers.join(" | ")}`);
  }

  capTable.find("tbody tr").each((_, row) => {
    const cells = $(row).find("td");
    if (cells.length <= Math.max(teamColumn, capAllocationsColumn, capSpaceColumn)) return;

    const teamCell = cells.eq(teamColumn);
    const abbr = parseTeamAbbr(teamCell);

    if (!abbr || abbr.length < 2 || abbr.length > 3) return;

    const capSpace = parseDollar(cells.eq(capSpaceColumn).text());
    const capAllocations = capAllocationsColumn === capSpaceColumn
      ? thresholds.salaryCap - capSpace
      : parseDollar(cells.eq(capAllocationsColumn).text());

    if (capAllocations > 0) {
      teams.push({ abbr, capAllocations, capSpace });
    }
  });

  if (teams.length < MIN_TEAMS) {
    throw new Error(`Only found ${teams.length} teams — something went wrong with parsing`);
  }
  if (!thresholds.capFloor || !thresholds.salaryCap || !thresholds.firstApron || !thresholds.secondApron) {
    throw new Error(`Missing cap thresholds from Spotrac — parsed ${JSON.stringify(thresholds)}`);
  }
  if (!exceptions.nonTaxpayerMLE || !exceptions.taxpayerMLE || !exceptions.biannual) {
    throw new Error(`Missing exception amounts from Spotrac — parsed ${JSON.stringify(exceptions)}`);
  }

  const output: TeamsData = {
    fetchedAt: new Date().toISOString().slice(0, 10),
    season: NBA_SEASON,
    thresholds,
    exceptions,
    teams: teams.sort((a, b) => a.abbr.localeCompare(b.abbr)),
  };

  const outPath = join(process.cwd(), "data", "teams.json");
  writeFileSync(outPath, JSON.stringify(output, null, 2));
  console.log(`✓ Wrote ${teams.length} teams to data/teams.json`);
  console.log("  Cap floor:", thresholds.capFloor.toLocaleString());
  console.log("  Salary cap:", thresholds.salaryCap.toLocaleString());
  console.log("  First apron:", thresholds.firstApron.toLocaleString());
  console.log("  Second apron:", thresholds.secondApron.toLocaleString());
}

fetchTeams().catch((err) => {
  console.error("fetch-teams failed:", err);
  process.exit(1);
});
