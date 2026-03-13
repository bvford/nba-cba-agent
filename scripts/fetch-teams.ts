/**
 * fetch-teams.ts
 * Scrapes team-level cap data from Spotrac and writes data/teams.json.
 * Run: tsx scripts/fetch-teams.ts
 */
import { writeFileSync } from "fs";
import { join } from "path";
import * as cheerio from "cheerio";

const SPOTRAC_URL = "https://www.spotrac.com/nba/cap/_/year/2025";

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
  const match = raw.replace("−", "-").match(/-?\$[\d,]+/);
  if (!match) return 0;
  return parseInt(match[0].replace(/[$,]/g, ""), 10) || 0;
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

  // Parse team rows from the main cap table
  const teams: TeamCapEntry[] = [];
  $("table.dataTable tbody tr").each((_, row) => {
    const cells = $(row).find("td");
    if (cells.length < 7) return;

    // Team abbreviation: span.d-none inside td.text-left, fallback to link text
    const teamCell = cells.eq(1);
    const abbr = teamCell.find("span.d-none").text().trim() ||
      teamCell.find("a.link").text().trim().split(/\s+/).pop() ||
      "";

    if (!abbr || abbr.length < 2 || abbr.length > 3) return;

    // Column 6 (index 5) = Total Cap Allocations; Column 7 (index 6) = Cap Space
    const capAllocations = parseDollar(cells.eq(5).text().trim());
    const capSpace = parseDollar(cells.eq(6).text().trim());

    if (capAllocations > 0) {
      teams.push({ abbr, capAllocations, capSpace });
    }
  });

  // Parse cap/apron threshold cards
  const thresholds: CapThresholds = {
    capFloor: 0,
    salaryCap: 0,
    firstApron: 0,
    secondApron: 0,
  };

  $(".card.widget").each((_, card) => {
    const title = $(card).find("h2.h5").text().trim().toUpperCase();
    const valueText = $(card).find(".fw-bold").first().text();
    const value = parseDollar(valueText);
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

  // Parse exception amounts — look for labeled lines like "Non-Taxpayer MLE: $14,104,000"
  const exceptions: CapExceptions = {
    nonTaxpayerMLE: 0,
    taxpayerMLE: 0,
    biannual: 0,
  };

  $(".card.widget .fw-bold").each((_, el) => {
    const text = $(el).text();
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

  // If exception data wasn't on Spotrac, use known 2025-26 values as fallback
  if (!exceptions.nonTaxpayerMLE) exceptions.nonTaxpayerMLE = 14104000;
  if (!exceptions.taxpayerMLE) exceptions.taxpayerMLE = 5685000;
  if (!exceptions.biannual) exceptions.biannual = 5134000;

  if (teams.length < 25) {
    throw new Error(`Only found ${teams.length} teams — something went wrong with parsing`);
  }

  const output: TeamsData = {
    fetchedAt: new Date().toISOString().slice(0, 10),
    season: "2025-26",
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
