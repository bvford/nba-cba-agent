/**
 * fetch-capsheets.ts
 * Scrapes per-team cap sheets from capsheets.com and writes data/teams.json.
 *
 * capsheets.com is the authoritative cap/roster/salary source for ChatCBA
 * (accurate, fast-updating, server-rendered HTML tables). Each team page lives
 * at https://capsheets.com/{slug}-cap-sheet-2026-2027-season/ and exposes:
 *   - active roster table (rank, player, salary; option/non-guaranteed encoded
 *     via cell colors — see LEGEND below)
 *   - dead money (per player + total)
 *   - Total Payroll (active) and Total Salaries (incl. dead money)
 *   - luxury tax threshold + repeater payment status
 *   - First/Second Apron Space lines (negative = over)
 *   - cap holds (per player + total) — kept SEPARATE from payroll
 *   - Two-Way players, exceptions (MLE + TPEs w/ expiry)
 *
 * Run: npx tsx scripts/fetch-capsheets.ts  (or npm run fetch-capsheets)
 */
import { writeFileSync } from "fs";
import { join } from "path";
import * as cheerio from "cheerio";

const SEASON = "2026-27";
const SEASON_SLUG = "2026-2027";
const SOURCE = "capsheets.com";
const REQUEST_DELAY_MS = 500;
const MIN_TEAMS_OK = 28; // fail loudly if fewer teams parse
const MIN_PLAUSIBLE_PAYROLL = 100_000_000;
const MAX_PLAUSIBLE_PAYROLL = 300_000_000;

const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

// Cap floor is not printed on capsheets team pages. This is the verified
// 2026-27 minimum team salary (90% of the salary cap). Source: NBA 2026-27
// cap projections. The other three thresholds (salary cap, first/second apron)
// ARE parsed from the site and cross-checked below.
const CAP_FLOOR_2026_27 = 148_465_000;

// League-wide exception amounts (2026-27). Used as the fallback ladder amounts
// in teams-meta; capsheets also lists each team's actually-available exceptions
// per-team, which we store in team.exceptions.
const LEAGUE_EXCEPTIONS = {
  nonTaxpayerMLE: 15_044_000,
  taxpayerMLE: 6_064_000,
  biannual: 5_477_000,
};

// One canonical abbreviation set. slug -> abbr.
const TEAM_SLUGS: Array<{ slug: string; abbr: string; name: string }> = [
  { slug: "atlanta-hawks", abbr: "ATL", name: "Atlanta Hawks" },
  { slug: "boston-celtics", abbr: "BOS", name: "Boston Celtics" },
  { slug: "brooklyn-nets", abbr: "BKN", name: "Brooklyn Nets" },
  { slug: "charlotte-hornets", abbr: "CHA", name: "Charlotte Hornets" },
  { slug: "chicago-bulls", abbr: "CHI", name: "Chicago Bulls" },
  { slug: "cleveland-cavaliers", abbr: "CLE", name: "Cleveland Cavaliers" },
  { slug: "dallas-mavericks", abbr: "DAL", name: "Dallas Mavericks" },
  { slug: "denver-nuggets", abbr: "DEN", name: "Denver Nuggets" },
  { slug: "detroit-pistons", abbr: "DET", name: "Detroit Pistons" },
  { slug: "golden-state-warriors", abbr: "GSW", name: "Golden State Warriors" },
  { slug: "houston-rockets", abbr: "HOU", name: "Houston Rockets" },
  { slug: "indiana-pacers", abbr: "IND", name: "Indiana Pacers" },
  { slug: "los-angeles-clippers", abbr: "LAC", name: "LA Clippers" },
  { slug: "los-angeles-lakers", abbr: "LAL", name: "Los Angeles Lakers" },
  { slug: "memphis-grizzlies", abbr: "MEM", name: "Memphis Grizzlies" },
  { slug: "miami-heat", abbr: "MIA", name: "Miami Heat" },
  { slug: "milwaukee-bucks", abbr: "MIL", name: "Milwaukee Bucks" },
  { slug: "minnesota-timberwolves", abbr: "MIN", name: "Minnesota Timberwolves" },
  { slug: "new-orleans-pelicans", abbr: "NOP", name: "New Orleans Pelicans" },
  { slug: "new-york-knicks", abbr: "NYK", name: "New York Knicks" },
  { slug: "oklahoma-city-thunder", abbr: "OKC", name: "Oklahoma City Thunder" },
  { slug: "orlando-magic", abbr: "ORL", name: "Orlando Magic" },
  { slug: "philadelphia-76ers", abbr: "PHI", name: "Philadelphia 76ers" },
  { slug: "phoenix-suns", abbr: "PHX", name: "Phoenix Suns" },
  { slug: "portland-trail-blazers", abbr: "POR", name: "Portland Trail Blazers" },
  { slug: "sacramento-kings", abbr: "SAC", name: "Sacramento Kings" },
  { slug: "san-antonio-spurs", abbr: "SAS", name: "San Antonio Spurs" },
  { slug: "toronto-raptors", abbr: "TOR", name: "Toronto Raptors" },
  { slug: "utah-jazz", abbr: "UTA", name: "Utah Jazz" },
  { slug: "washington-wizards", abbr: "WAS", name: "Washington Wizards" },
];

export type RosterNote = "player option" | "team option" | "non-guaranteed" | "estimate";

interface RosterPlayer {
  player: string;
  salary: number;
  note?: RosterNote;
}
interface NamedAmount {
  player: string;
  amount: number;
}
interface TeamException {
  type: string;
  amount: number;
  expiry?: string;
}
interface TeamCapSheet {
  abbr: string;
  name: string;
  slug: string;
  rosterHeader: string; // raw "(11/15 + 1/3)" style descriptor
  activeRoster: RosterPlayer[];
  deadMoney: NamedAmount[];
  deadMoneyTotal: number;
  totalPayroll: number;
  totalSalaries: number;
  luxuryTaxThreshold: number;
  luxuryTaxSpace: number; // negative = over the tax
  repeater: boolean;
  firstApronSpace: number; // negative = over the first apron
  secondApronSpace: number; // negative = over the second apron
  capHolds: NamedAmount[];
  capHoldsTotal: number;
  twoWay: string[];
  exceptions: TeamException[];
}

interface Thresholds {
  capFloor: number;
  salaryCap: number;
  firstApron: number;
  secondApron: number;
  luxuryTax: number;
}

interface TeamsData {
  fetchedAt: string;
  season: string;
  source: string;
  thresholds: Thresholds;
  exceptions: typeof LEAGUE_EXCEPTIONS;
  teams: TeamCapSheet[];
}

function clean(raw: string): string {
  return raw.replace(/\s+/g, " ").trim();
}

// "$ 207,653,328" -> 207653328 ; "$ (9,225,328)" -> -9225328 ; "$ -" -> 0
function parseDollar(raw: string | undefined): number {
  if (!raw) return 0;
  const negative = /\(/.test(raw);
  const digits = raw.replace(/[^0-9]/g, "");
  if (!digits) return 0;
  const value = parseInt(digits, 10);
  return Number.isFinite(value) ? (negative ? -value : value) : 0;
}

function lastBackgroundRgb(style: string): string {
  const matches = style.match(/background-color:\s*(rgb\([^)]+\))/gi);
  if (!matches || matches.length === 0) return "";
  const last = matches[matches.length - 1];
  return (last.match(/rgb\([^)]+\)/i)?.[0] || "").replace(/\s+/g, "");
}

function hasRedText(style: string): boolean {
  // A text color (not the background-color) set to red / rgb(255,0,0).
  const m = style.match(/(?<!background-)color:\s*([^;]+)/i);
  if (!m) return false;
  const c = m[1].replace(/\s+/g, "").toLowerCase();
  return c === "red" || c === "rgb(255,0,0)" || c === "#ff0000";
}

// Per the capsheets "View Legend": salary cell background encodes options,
// red salary text encodes a non-guaranteed deal.
//   yellow  rgb(255,255,0)   -> Estimate Salary
//   #a8d08d rgb(168,208,141) -> Player Option
//   #8daadb rgb(141,170,219) -> Team Option
//   red text                 -> Non-Guaranteed Salary
function noteForRow(styles: string[]): RosterNote | undefined {
  for (const style of styles) {
    const bg = lastBackgroundRgb(style);
    if (bg === "rgb(168,208,141)") return "player option";
    if (bg === "rgb(141,170,219)") return "team option";
    if (bg === "rgb(255,255,0)") return "estimate";
  }
  for (const style of styles) {
    if (hasRedText(style)) return "non-guaranteed";
  }
  return undefined;
}

type ParsedRow = { text: string[]; styles: string[] };

function parseTeamPage(html: string, meta: { slug: string; abbr: string; name: string }): {
  team: TeamCapSheet;
  thresholds: Partial<Thresholds>;
} {
  const $ = cheerio.load(html);

  // Concatenate every table row in document order. capsheets splits a single
  // logical cap sheet across two side-by-side <table>s, and the split point
  // varies between teams, so a single ordered pass over all rows is robust.
  const rows: ParsedRow[] = [];
  $("table tr").each((_, tr) => {
    const cells = $(tr).find("td, th").toArray();
    if (cells.length === 0) return;
    rows.push({
      text: cells.map((c) => clean($(c).text())),
      styles: cells.map((c) => $(c).attr("style") || ""),
    });
  });

  const team: TeamCapSheet = {
    abbr: meta.abbr,
    name: meta.name,
    slug: meta.slug,
    rosterHeader: "",
    activeRoster: [],
    deadMoney: [],
    deadMoneyTotal: 0,
    totalPayroll: 0,
    totalSalaries: 0,
    luxuryTaxThreshold: 0,
    luxuryTaxSpace: 0,
    repeater: false,
    firstApronSpace: 0,
    secondApronSpace: 0,
    capHolds: [],
    capHoldsTotal: 0,
    twoWay: [],
    exceptions: [],
  };
  const thresholds: Partial<Thresholds> = {};

  type Section = "roster" | "deadMoney" | "capHolds" | "twoWay" | "exceptions" | "other";
  let section: Section = "roster";

  for (const row of rows) {
    const t = row.text;
    const first = t[0] || "";
    const label = (t.find(Boolean) || "").toLowerCase();
    const amount = t[t.length - 1];

    // Roster header row, e.g. "Denver Nuggets (11/15 + 1/3)"
    if (!team.rosterHeader && /\(\d+\/\d+/.test(first)) {
      const m = first.match(/\(([^)]+)\)/);
      team.rosterHeader = m ? m[1] : "";
    }

    // Active roster rows: first cell is a bare 1-2 digit rank number, and we
    // are still in the roster section (before "Total Payroll"). Both guards
    // matter: draft-pick rows later on the page start with a 4-digit year
    // ("2028" | "Own" | "No") and must not be mistaken for players.
    if (section === "roster" && /^\d{1,2}$/.test(first)) {
      const name = t[1];
      if (name) {
        team.activeRoster.push({
          player: name,
          salary: parseDollar(t[2]),
          note: noteForRow([row.styles[1] || "", row.styles[2] || ""]),
        });
      }
      continue;
    }

    // Section-changing / total marker rows (2-cell "Label | $Amount").
    if (label === "total payroll") {
      team.totalPayroll = parseDollar(amount);
      section = "deadMoney";
      continue;
    }
    if (label === "dead money") {
      team.deadMoneyTotal = parseDollar(amount);
      section = "other";
      continue;
    }
    if (label === "total salaries") {
      team.totalSalaries = parseDollar(amount);
      continue;
    }
    // Labels vary slightly between teams — e.g. "Luxury Tax Room" vs
    // "Luxury Tax Room (Repeater Tax)", "Second Apron" vs "Second Apron
    // (Hard Capped)" — so match by prefix, with the more specific "…space"/
    // "…room" labels checked before their bare threshold labels.
    if (label.startsWith("luxury tax room")) {
      team.luxuryTaxSpace = parseDollar(amount);
      if (/repeater/i.test(label)) team.repeater = true;
      continue;
    }
    if (label.startsWith("luxury tax payment")) {
      if (/repeater/i.test(label)) team.repeater = true;
      continue;
    }
    if (label.startsWith("total salaries + luxury tax")) {
      section = "other"; // unlikely-incentive name rows follow; skip them
      continue;
    }
    if (label.startsWith("total for luxury tax")) {
      continue;
    }
    if (label.startsWith("luxury tax")) {
      thresholds.luxuryTax = parseDollar(amount);
      team.luxuryTaxThreshold = parseDollar(amount);
      continue;
    }
    if (label.startsWith("first apron space")) {
      team.firstApronSpace = parseDollar(amount);
      continue;
    }
    if (label.startsWith("first apron")) {
      thresholds.firstApron = parseDollar(amount);
      continue;
    }
    if (label.startsWith("second apron space")) {
      team.secondApronSpace = parseDollar(amount);
      section = "capHolds";
      continue;
    }
    if (label.startsWith("second apron")) {
      thresholds.secondApron = parseDollar(amount);
      continue;
    }
    if (label === "cap holds") {
      team.capHoldsTotal = parseDollar(amount);
      section = "other";
      continue;
    }
    if (label === "salary cap") {
      thresholds.salaryCap = parseDollar(amount);
      continue;
    }

    // Two-Way section: starts at a "Two-Way" labeled row; continues with
    // blank-first-cell rows [_, name, "Year N"]. Some pages repeat a name
    // (seen live: GSW listed the same player twice), so dedupe.
    if (first.toLowerCase() === "two-way") {
      section = "twoWay";
      if (t[1] && !team.twoWay.includes(t[1])) team.twoWay.push(t[1]);
      continue;
    }

    // Exceptions section header.
    if (first.toLowerCase() === "expiration" && (t[1] || "").toLowerCase() === "exceptions") {
      section = "exceptions";
      continue;
    }
    // Other section headers we don't need — stop the active section.
    if (
      (first.toLowerCase() === "player" && (t[1] || "").toLowerCase().includes("waivable")) ||
      (first.toLowerCase() === "year" && (t[1] || "").toLowerCase().includes("pick"))
    ) {
      section = "other";
      continue;
    }

    // Blank row ends list sections but does not otherwise reset.
    const isBlank = t.every((c) => c === "");
    if (isBlank) {
      if (section === "twoWay" || section === "exceptions") section = "other";
      continue;
    }

    // Name/amount rows: [_, name, $amount] (dead money / cap holds), or
    // [_, name, "Year N"] (two-way continuation), or [expiry, type, $value]
    // (exceptions).
    if (section === "twoWay") {
      if (t[1] && !team.twoWay.includes(t[1])) team.twoWay.push(t[1]);
      continue;
    }
    if (section === "exceptions") {
      const type = t[1];
      if (type) {
        team.exceptions.push({
          type,
          amount: parseDollar(t[2]),
          ...(t[0] ? { expiry: t[0] } : {}),
        });
      }
      continue;
    }
    if (first === "" && t[1] && t[2]) {
      const entry = { player: t[1], amount: parseDollar(t[2]) };
      if (section === "deadMoney") team.deadMoney.push(entry);
      else if (section === "capHolds") team.capHolds.push(entry);
      // else: unlikely-incentive rows etc. — ignored
    }
  }

  return { team, thresholds };
}

async function fetchTeamPage(slug: string): Promise<string> {
  const url = `https://capsheets.com/${slug}-cap-sheet-${SEASON_SLUG}-season/`;
  const res = await fetch(url, {
    headers: {
      "User-Agent": USER_AGENT,
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    },
    redirect: "follow",
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} fetching ${url}`);
  return res.text();
}

async function main() {
  console.log(`Fetching ${TEAM_SLUGS.length} team cap sheets from ${SOURCE}...`);
  const teams: TeamCapSheet[] = [];
  const thresholdSamples: Array<Partial<Thresholds>> = [];
  const failures: string[] = [];

  for (const meta of TEAM_SLUGS) {
    try {
      const html = await fetchTeamPage(meta.slug);
      const { team, thresholds } = parseTeamPage(html, meta);

      // Per-team sanity checks.
      if (team.activeRoster.length === 0) throw new Error("no active roster parsed");
      if (team.totalSalaries < MIN_PLAUSIBLE_PAYROLL || team.totalSalaries > MAX_PLAUSIBLE_PAYROLL) {
        throw new Error(`implausible totalSalaries ${team.totalSalaries}`);
      }
      // Structural row checks — these catch actual parser bugs (draft-pick
      // year rows or dollar-less rows leaking into the roster) and stay fatal.
      const NBA_MIN_PLAUSIBLE_SALARY = 500_000; // well below any real minimum
      for (const p of team.activeRoster) {
        if (/^(19|20)\d{2}$/.test(p.player) || p.player.toLowerCase() === "own") {
          throw new Error(`non-player row leaked into roster: "${p.player}"`);
        }
        if (p.salary < NBA_MIN_PLAUSIBLE_SALARY) {
          throw new Error(`implausible salary for ${p.player}: ${p.salary}`);
        }
      }
      // Cross-check the parsed roster against the page's own header counts,
      // e.g. "(11/15 + 1/3)" -> 11 active players signed, 1 two-way signed.
      // The header sometimes lags the table when the maintainer is mid-update
      // (seen live 2026-07-13: Denver showed 12 salary rows — Alpha Diallo
      // signed that day — while the header still said 11/15). The table is
      // the source of truth, so mismatches WARN rather than fail; the
      // structural checks above are what guard against parser bugs.
      const headerMatch = team.rosterHeader.match(/^(\d+)\/\d+\s*\+\s*(\d+)\/\d+/);
      if (headerMatch) {
        const expectedActive = parseInt(headerMatch[1], 10);
        const expectedTwoWay = parseInt(headerMatch[2], 10);
        if (team.activeRoster.length !== expectedActive) {
          console.warn(
            `  ! ${meta.abbr}: parsed ${team.activeRoster.length} active players but page header says ${expectedActive} ("${team.rosterHeader}") — keeping the table`
          );
        }
        // The header's two-way count sometimes lags the two-way list itself
        // (seen live on LAL and MIA), so mismatches are a warning, not fatal.
        if (team.twoWay.length !== expectedTwoWay) {
          console.warn(
            `  ! ${meta.abbr}: two-way list has ${team.twoWay.length} names but page header says ${expectedTwoWay} ("${team.rosterHeader}") — keeping the list`
          );
        }
      } else {
        throw new Error(`could not parse roster header counts from "${team.rosterHeader}"`);
      }
      // A cap-hold player must never leak into the active roster (that was
      // the original Spotrac bug class this rewrite exists to eliminate).
      const activeNames = new Set(team.activeRoster.map((p) => p.player));
      const leaked = team.capHolds.filter((h) => activeNames.has(h.player));
      if (leaked.length > 0) {
        throw new Error(`cap-hold players leaked into active roster: ${leaked.map((l) => l.player).join(", ")}`);
      }
      teams.push(team);
      thresholdSamples.push(thresholds);
      const rosterN = team.activeRoster.length + team.twoWay.length;
      console.log(
        `  ✓ ${meta.abbr}: ${rosterN} players (${team.activeRoster.length}+${team.twoWay.length}TW), ` +
          `payroll ${(team.totalSalaries / 1e6).toFixed(1)}M, ` +
          `1stApronSpace ${(team.firstApronSpace / 1e6).toFixed(1)}M, ` +
          `2ndApronSpace ${(team.secondApronSpace / 1e6).toFixed(1)}M`
      );
    } catch (err) {
      failures.push(`${meta.abbr} (${meta.slug}): ${(err as Error).message}`);
      console.error(`  ✗ ${meta.abbr}: ${(err as Error).message}`);
    }
    await new Promise((r) => setTimeout(r, REQUEST_DELAY_MS));
  }

  if (teams.length < MIN_TEAMS_OK) {
    throw new Error(
      `Only ${teams.length}/${TEAM_SLUGS.length} teams parsed (need >= ${MIN_TEAMS_OK}). Failures:\n  ${failures.join("\n  ")}`
    );
  }

  // Derive league thresholds from the parsed pages (they are identical across
  // teams). Use the most common non-zero value for each.
  function consensus(key: keyof Thresholds): number {
    const counts = new Map<number, number>();
    for (const s of thresholdSamples) {
      const v = s[key];
      if (v && v > 0) counts.set(v, (counts.get(v) || 0) + 1);
    }
    let best = 0;
    let bestCount = 0;
    for (const [v, c] of counts) {
      if (c > bestCount) {
        best = v;
        bestCount = c;
      }
    }
    return best;
  }

  const thresholds: Thresholds = {
    capFloor: CAP_FLOOR_2026_27,
    salaryCap: consensus("salaryCap"),
    firstApron: consensus("firstApron"),
    secondApron: consensus("secondApron"),
    luxuryTax: consensus("luxuryTax"),
  };

  for (const key of ["salaryCap", "firstApron", "secondApron", "luxuryTax"] as const) {
    if (!thresholds[key]) throw new Error(`Failed to parse league threshold: ${key}`);
  }
  if (!(thresholds.salaryCap < thresholds.firstApron && thresholds.firstApron < thresholds.secondApron)) {
    throw new Error(`Implausible threshold ordering: ${JSON.stringify(thresholds)}`);
  }

  const overTax = teams.filter((t) => t.luxuryTaxSpace < 0).length;
  const overFirst = teams.filter((t) => t.firstApronSpace < 0).length;
  const overSecond = teams.filter((t) => t.secondApronSpace < 0).length;

  // League-wide plausibility: a handful of teams are always over the tax.
  // Zero means a label changed on the site and every luxuryTaxSpace parsed
  // as 0 — fail loudly rather than shipping "nobody pays tax".
  if (overTax === 0 || overTax === teams.length) {
    throw new Error(`Implausible over-tax count (${overTax}/${teams.length}) — check the "Luxury Tax Room" label parsing`);
  }
  if (overSecond > 15) {
    throw new Error(`Implausible over-second-apron count (${overSecond}/${teams.length}) — parsing likely broken`);
  }

  const output: TeamsData = {
    fetchedAt: new Date().toISOString().slice(0, 10),
    season: SEASON,
    source: SOURCE,
    thresholds,
    exceptions: LEAGUE_EXCEPTIONS,
    teams: teams.sort((a, b) => a.abbr.localeCompare(b.abbr)),
  };

  const outPath = join(process.cwd(), "data", "teams.json");
  writeFileSync(outPath, JSON.stringify(output, null, 2));

  console.log(`\n✓ Wrote ${teams.length} teams to data/teams.json`);
  console.log(`  Salary cap: ${thresholds.salaryCap.toLocaleString()}`);
  console.log(`  Luxury tax: ${thresholds.luxuryTax.toLocaleString()}`);
  console.log(`  First apron: ${thresholds.firstApron.toLocaleString()}`);
  console.log(`  Second apron: ${thresholds.secondApron.toLocaleString()}`);
  console.log(`  Over tax: ${overTax} | Over 1st apron: ${overFirst} | Over 2nd apron: ${overSecond}`);
  if (failures.length) console.log(`  (${failures.length} team(s) failed and were skipped: ${failures.map((f) => f.split(" ")[0]).join(", ")})`);
}

main().catch((err) => {
  console.error("fetch-capsheets failed:", err);
  process.exit(1);
});
