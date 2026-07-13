import cbaArticles from "../../data/cba-articles.json";
import cbaGuide from "../../data/cba-guide.json";
import cba101Data from "../../data/cba101.json";
import playerData from "../../data/players.json";
import teamsData from "../../data/teams.json";
import {
  CBA101_SECTION_CAP,
  PLAYER_NAME_MATCH_CAP,
  PLAYER_SEARCH_RESULT_CAP,
  TEAM_ROSTER_PLAYER_CAP,
} from "@/lib/config";
import {
  CAP_STATUS_CHAT_LABELS,
  TEAM_NAMES,
  computeAvailableExceptions,
  computeCapStatus,
  normalizeTeamAbbr,
} from "@/lib/teams-meta";

export interface CBAArticle {
  id: string;
  title: string;
  content: string;
}

export interface SearchResultMeta {
  context: string;
  sources: string[];
}

interface SearchOptions {
  maxChars?: number;
  maxGuideSections?: number;
  maxCbaArticles?: number;
  maxSectionsPerArticle?: number;
}

interface PlayerData {
  name: string;
  team: string | null;
  notOnRoster?: boolean;
  twoWay?: boolean;
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

interface PlayersJson {
  fetchedAt: string;
  players: PlayerData[];
}

const players: PlayerData[] = (playerData as PlayersJson).players;

interface SectionEntry {
  heading: string;
  text: string;
}

interface IndexedDoc extends CBAArticle {
  sections: SectionEntry[];
}

interface ScoredArticle extends CBAArticle {
  score: number;
  relevantSections: string[];
}

// Break each article into sections (split on ## headings)
function computeSections(article: CBAArticle): SectionEntry[] {
  const parts = article.content.split(/^(#{1,3}\s+.+)$/m);
  const sections: SectionEntry[] = [];
  let currentHeading = article.title;
  let currentText = "";

  for (const part of parts) {
    if (/^#{1,3}\s+/.test(part)) {
      if (currentText.trim()) {
        sections.push({ heading: currentHeading, text: currentText.trim() });
      }
      currentHeading = part.replace(/^#{1,3}\s+/, "").trim();
      currentText = "";
    } else {
      currentText += part;
    }
  }
  if (currentText.trim()) {
    sections.push({ heading: currentHeading, text: currentText.trim() });
  }
  return sections;
}

// Sections are split once at module load rather than on every query — the
// underlying JSON is static for the lifetime of the process.
function indexDocs(docs: CBAArticle[]): IndexedDoc[] {
  return docs.map((doc) => ({ ...doc, sections: computeSections(doc) }));
}

const articles: IndexedDoc[] = indexDocs(cbaArticles as CBAArticle[]);
const guideSections: IndexedDoc[] = indexDocs(cbaGuide as CBAArticle[]);
const cba101Sections: IndexedDoc[] = indexDocs(cba101Data as CBAArticle[]);

// Simple keyword-based search scoring
function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s'-]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2);
}

// Common words to ignore
const STOP_WORDS = new Set([
  "the", "and", "for", "are", "but", "not", "you", "all", "can",
  "had", "her", "was", "one", "our", "out", "has", "have", "been",
  "will", "with", "this", "that", "from", "they", "were", "which",
  "their", "said", "each", "than", "its", "also", "into", "any",
  "such", "shall", "may", "upon", "other", "would", "under",
  "what", "how", "does", "about", "more",
]);

// Map of common NBA terms to CBA article keywords
const TOPIC_MAP: Record<string, string[]> = {
  "salary cap": ["basketball related income", "salary cap", "tax level", "apron"],
  "free agent": ["free agency", "restricted", "unrestricted", "qualifying"],
  "trade": ["trade", "assignment", "prohibition of no-trade"],
  "rookie": ["rookie scale", "draft", "eligibility"],
  "contract": ["uniform player contract", "length of player contracts", "option"],
  "sign and trade": ["free agency", "sign-and-trade"],
  "bird rights": ["free agency", "qualifying veteran", "early qualifying"],
  "exception": ["salary cap", "exception", "mid-level", "bi-annual", "traded player"],
  "max contract": ["salary cap", "maximum", "individual", "free agency"],
  "two-way": ["two-way", "g league", "nba g league"],
  "super max": ["designated veteran", "designated player", "supermax"],
  "luxury tax": ["tax level", "apron", "basketball related income"],
  "minimum salary": ["minimum", "salary scale", "baseline"],
  "draft": ["draft", "eligibility", "lottery", "rookie"],
  "extension": ["extension", "free agency", "contract"],
  "option": ["option clauses", "player option", "team option", "early termination"],
  "waive": ["right of set-off", "waiver"],
  "buyout": ["right of set-off", "buyout"],
  "cap hold": ["free agency", "salary cap", "cap hold"],
  "disabled player": ["salary cap", "disabled player exception"],
  "hardship": ["salary cap", "hardship exception"],
  "second apron": ["apron", "second apron", "salary cap"],
};

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

interface TokenRegex {
  token: string;
  regex: RegExp;
}

// Compile each query token into a regex once per query, rather than once per
// (token, section) pair — searchCBAWithMeta scans every section of every
// scored document with the same token set.
function buildTokenRegexes(tokens: string[]): TokenRegex[] {
  return tokens.map((token) => ({ token, regex: new RegExp(escapeRegExp(token), "gi") }));
}

// Score a single document (article or guide section) against the query
function scoreDocument(
  doc: IndexedDoc,
  tokenRegexes: TokenRegex[],
  queryLower: string,
  boostedTerms: string[]
): ScoredArticle {
  let score = 0;
  const relevantSections: string[] = [];

  const titleLower = doc.title.toLowerCase();
  for (const { token } of tokenRegexes) {
    if (titleLower.includes(token)) score += 10;
  }
  for (const term of boostedTerms) {
    if (titleLower.includes(term)) score += 15;
  }

  for (const section of doc.sections) {
    const sectionLower = (section.heading + " " + section.text).toLowerCase();
    let sectionScore = 0;

    for (const { regex } of tokenRegexes) {
      const matches = sectionLower.match(regex);
      if (matches) sectionScore += matches.length;
    }
    for (const term of boostedTerms) {
      if (sectionLower.includes(term)) sectionScore += 5;
    }

    if (sectionLower.includes(queryLower)) sectionScore += 20;

    if (sectionScore > 0) {
      score += sectionScore;
      relevantSections.push(`### ${section.heading}\n${section.text}`);
    }
  }

  return { id: doc.id, title: doc.title, content: doc.content, score, relevantSections };
}

export function searchCBAWithMeta(
  query: string,
  options: SearchOptions = {}
): SearchResultMeta {
  const maxChars = options.maxChars ?? 12000;
  const maxGuideSections = options.maxGuideSections ?? 4;
  const maxCbaArticles = options.maxCbaArticles ?? 4;
  const maxSectionsPerArticle = options.maxSectionsPerArticle ?? 3;
  const queryTokens = tokenize(query).filter((t) => !STOP_WORDS.has(t));
  const queryLower = query.toLowerCase();
  const tokenRegexes = buildTokenRegexes(queryTokens);

  // Check topic map for boosted terms
  const boostedTerms: string[] = [];
  for (const [topic, terms] of Object.entries(TOPIC_MAP)) {
    if (queryLower.includes(topic)) {
      boostedTerms.push(...terms);
    }
  }
  for (const token of queryTokens) {
    for (const [topic, terms] of Object.entries(TOPIC_MAP)) {
      if (topic.includes(token)) {
        boostedTerms.push(...terms);
      }
    }
  }

  // Score the plain-English guide sections (prioritized - these explain things clearly)
  const scoredGuide = guideSections
    .map((s) => ({ ...scoreDocument(s, tokenRegexes, queryLower, boostedTerms), source: "guide" as const }))
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score);

  // Score the CBA 101 sections (practical examples with real transactions)
  const scored101 = cba101Sections
    .map((s) => ({ ...scoreDocument(s, tokenRegexes, queryLower, boostedTerms), source: "cba101" as const }))
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score);

  // Score the raw CBA articles
  const scoredCBA = articles
    .map((a) => ({ ...scoreDocument(a, tokenRegexes, queryLower, boostedTerms), source: "cba" as const }))
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score);

  // Build context: guide first (plain English), then CBA 101 (practical examples), then CBA (official text)
  let context = "";
  let charsUsed = 0;
  const sources: string[] = [];

  // Add top guide sections first (up to 30% of budget)
  const guideBudget = maxChars * 0.3;
  for (const section of scoredGuide.slice(0, maxGuideSections)) {
    const text = `\n\n--- CBA GUIDE: ${section.title} ---\n\n${section.content}`;
    if (charsUsed + text.length > guideBudget) break;
    context += text;
    charsUsed += text.length;
    sources.push(`CBA Guide: ${section.title}`);
  }

  // Add CBA 101 sections (up to 30% of budget — practical examples with real deals)
  const cba101Budget = maxChars * 0.3;
  let cba101Used = 0;
  for (const section of scored101.slice(0, CBA101_SECTION_CAP)) {
    const trimmedContent = section.content.length > 3500
      ? `${section.content.slice(0, 3500)}\n\n[truncated for efficiency]`
      : section.content;
    const text = `\n\n--- CBA 101 FAQ: ${section.title} ---\n\n${trimmedContent}`;
    if (cba101Used + text.length > cba101Budget) break;
    if (charsUsed + text.length > maxChars) break;
    context += text;
    charsUsed += text.length;
    cba101Used += text.length;
    sources.push(`CBA 101 FAQ: ${section.title}`);
  }

  // Fill the rest with raw CBA articles
  for (const article of scoredCBA.slice(0, maxCbaArticles)) {
    const chosenSections = article.relevantSections.slice(0, maxSectionsPerArticle);
    const articleBody = chosenSections.length > 0
      ? chosenSections.join("\n\n")
      : article.content.slice(0, 2000);
    const articleText = `\n\n--- CBA ARTICLE: ${article.title} (targeted sections) ---\n\n${articleBody}`;

    if (charsUsed + articleText.length > maxChars) break;
    context += articleText;
    charsUsed += articleText.length;
    sources.push(`2023 CBA: ${article.title}`);
  }

  // Note: sources are not truncated here — the caller (route.ts) combines
  // these with additional non-CBA sources (player/team data, static links)
  // and applies the final MAX_SOURCES cap once, on the combined list.
  return {
    context: context || "No relevant CBA sections found for this query.",
    sources: Array.from(new Set(sources)),
  };
}

// ---- Player search ----

function formatPlayerInfo(p: PlayerData): string {
  const team = p.team ?? (p.notOnRoster ? "Free agent / not on a 2026-27 roster" : "N/A");
  const gp = p.games || 1;
  const ppg = (p.points / gp).toFixed(1);
  const rpg = (p.rebounds / gp).toFixed(1);
  const apg = (p.assists / gp).toFixed(1);
  const spg = (p.steals / gp).toFixed(1);
  const bpg = (p.blocks / gp).toFixed(1);

  let info = `**${p.name}** (${team}${p.twoWay ? ", Two-Way" : ""}, ${p.position || "N/A"})`;
  if (p.age) info += `, Age: ${p.age}`;
  info += "\n";

  if (p.games > 0) {
    info += `Stats (2025-26): ${p.games} GP, ${ppg} PPG, ${rpg} RPG, ${apg} APG, ${spg} SPG, ${bpg} BPG`;
    info += `, ${(p.fieldPercent * 100).toFixed(1)}% FG, ${(p.threePercent * 100).toFixed(1)}% 3PT, ${(p.ftPercent * 100).toFixed(1)}% FT`;
    info += `, ${p.minutesPerGame} MPG\n`;
  }

  const salaryEntries = Object.entries(p.salaries).sort();
  if (salaryEntries.length > 0) {
    info += "Contract: " + salaryEntries.map(([yr, sal]) => `${yr}: ${sal}`).join(", ") + "\n";
  }

  return info;
}

interface PlayerMatch {
  player: PlayerData;
  score: number;
}

// Shared player-name scoring algorithm used by both searchPlayers() (which
// needs the full ranked list to build a context block) and
// findPlayerNamesInQuery() (which just needs the top few names for Notte
// lookups). Full-name matches are strongly preferred; single-word queries
// only match on last name to avoid "Williams" matching every Williams.
function scorePlayerNameMatches(query: string): PlayerMatch[] {
  const queryLower = query.toLowerCase();
  const queryWords = queryLower
    .replace(/[^a-z0-9\s'-]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
  const matched: PlayerMatch[] = [];

  for (const p of players) {
    const nameLower = p.name.toLowerCase();
    const nameParts = nameLower.split(" ");
    const firstName = nameParts[0];
    const lastName = nameParts[nameParts.length - 1];

    let score = 0;
    if (queryLower.includes(nameLower)) {
      score += 100;
    }

    // If the query includes both first + last, treat as near-exact.
    if (
      queryWords.length >= 2 &&
      queryWords.includes(firstName) &&
      queryWords.includes(lastName)
    ) {
      score += 70;
    }

    // Only allow single-name last-name matching when user typed one word.
    // This avoids "Mark Williams" matching every player named Williams.
    if (
      queryWords.length === 1 &&
      lastName.length > 3 &&
      queryWords[0] === lastName
    ) {
      score += 30;
    }

    if (score > 0) {
      matched.push({ player: p, score });
    }
  }

  return matched;
}

export function searchPlayers(query: string): string {
  const queryLower = query.toLowerCase();
  const matched = scorePlayerNameMatches(query);
  matched.sort((a, b) => b.score - a.score || b.player.points - a.player.points);

  // Check for team mentions (e.g., "Lakers roster", "what can the Celtics do")
  const teamMatches: PlayerData[] = [];
  for (const [abbr, names] of Object.entries(TEAM_NAMES)) {
    for (const name of names) {
      if (queryLower.includes(name)) {
        const teamPlayers = players
          .filter((p) => p.team && normalizeTeamAbbr(p.team) === normalizeTeamAbbr(abbr))
          .sort((a, b) => b.points - a.points)
          .slice(0, TEAM_ROSTER_PLAYER_CAP);
        teamMatches.push(...teamPlayers);
        break;
      }
    }
  }

  // Combine and deduplicate
  const seen = new Set<string>();
  const results: PlayerData[] = [];
  for (const p of [...matched.map((m) => m.player), ...teamMatches]) {
    if (!seen.has(p.name)) {
      seen.add(p.name);
      results.push(p);
    }
  }

  if (results.length === 0) return "";

  let context = "\n\n--- PLAYER DATA (2026-27 rosters & salaries from Capsheets; 2025-26 stats from NBA stats feed) ---\n\n";
  for (const p of results.slice(0, PLAYER_SEARCH_RESULT_CAP)) {
    context += formatPlayerInfo(p) + "\n";
  }
  return context;
}

// Return the full names of players mentioned in a query (for Notte salary lookups)
export function findPlayerNamesInQuery(query: string): string[] {
  return scorePlayerNameMatches(query)
    .sort((a, b) => b.score - a.score || b.player.points - a.player.points)
    .slice(0, PLAYER_NAME_MATCH_CAP)
    .map((m) => m.player.name);
}

interface NamedAmount {
  player: string;
  amount: number;
}

interface TeamEntry {
  abbr: string;
  name: string;
  totalPayroll: number;
  totalSalaries: number;
  deadMoney: NamedAmount[];
  deadMoneyTotal: number;
  capHolds: NamedAmount[];
  capHoldsTotal: number;
  luxuryTaxThreshold: number;
  luxuryTaxSpace: number;
  repeater: boolean;
  firstApronSpace: number;
  secondApronSpace: number;
  twoWay: string[];
  exceptions: Array<{ type: string; amount: number; expiry?: string }>;
}

interface TeamsJson {
  fetchedAt: string;
  season: string;
  source: string;
  thresholds: { capFloor: number; salaryCap: number; firstApron: number; secondApron: number; luxuryTax: number };
  exceptions: { nonTaxpayerMLE: number; taxpayerMLE: number; biannual: number };
  teams: TeamEntry[];
}

const teams = teamsData as TeamsJson;

function fmt(n: number): string {
  const sign = n < 0 ? "-" : "";
  return sign + "$" + (Math.abs(n) / 1e6).toFixed(1) + "M";
}

export function searchTeams(query: string): string {
  const queryLower = query.toLowerCase();
  const matchedAbbrs = new Set<string>();

  for (const [abbr, names] of Object.entries(TEAM_NAMES)) {
    for (const name of names) {
      if (queryLower.includes(name)) {
        matchedAbbrs.add(abbr);
        break;
      }
    }
  }

  if (matchedAbbrs.size === 0) return "";

  const { thresholds, exceptions } = teams;
  const lines: string[] = [
    `\n\n--- TEAM CAP DATA (${teams.season} — ${teams.source}, fetched ${teams.fetchedAt}) ---`,
    `Thresholds: Salary cap ${fmt(thresholds.salaryCap)} | Luxury tax ${fmt(thresholds.luxuryTax)} | First apron ${fmt(thresholds.firstApron)} | Second apron ${fmt(thresholds.secondApron)}\n`,
  ];

  for (const abbr of matchedAbbrs) {
    const t = teams.teams.find((x) => normalizeTeamAbbr(x.abbr) === normalizeTeamAbbr(abbr));
    if (!t) continue;

    const capStatus = computeCapStatus(t, thresholds);
    // Rough cap-room figure for teams under the cap (holds not renounced).
    const capSpace = thresholds.salaryCap - t.totalSalaries;
    const availability = computeAvailableExceptions(capStatus, capSpace, exceptions);

    let availableExceptions: string;
    switch (availability.kind) {
      case "none-over-second-apron":
        availableExceptions = "No MLE or bi-annual exception (over second apron)";
        break;
      case "taxpayer-mle":
        availableExceptions = `Taxpayer MLE: ${fmt(availability.taxpayerMLE)} (using it hard-caps team at second apron)`;
        break;
      case "non-taxpayer-mle-and-biannual":
        availableExceptions = `Non-Taxpayer MLE: ${fmt(availability.nonTaxpayerMLE)}, Bi-Annual: ${fmt(availability.biannual)}`;
        break;
      case "cap-room":
        availableExceptions = `Cap room: ~${fmt(availability.capSpace)} under the cap (before renouncing holds)`;
        break;
    }

    lines.push(`**${t.name} (${t.abbr})**`);
    lines.push(`  Total payroll (active roster): ${fmt(t.totalPayroll)}`);
    if (t.deadMoneyTotal > 0) lines.push(`  Dead money: ${fmt(t.deadMoneyTotal)}`);
    lines.push(`  Total salaries (incl. dead money): ${fmt(t.totalSalaries)}`);
    lines.push(`  Status: ${CAP_STATUS_CHAT_LABELS[capStatus.tier]}`);
    lines.push(`  Luxury tax: ${t.luxuryTaxSpace < 0 ? fmt(-t.luxuryTaxSpace) + " over the tax line" : fmt(t.luxuryTaxSpace) + " under the tax line"}${t.repeater ? " (repeater rate)" : ""}`);
    lines.push(`  First apron: ${t.firstApronSpace < 0 ? fmt(-t.firstApronSpace) + " OVER" : fmt(t.firstApronSpace) + " under"}`);
    lines.push(`  Second apron: ${t.secondApronSpace < 0 ? fmt(-t.secondApronSpace) + " OVER" : fmt(t.secondApronSpace) + " under"}`);
    if (t.capHoldsTotal > 0) lines.push(`  Cap holds (separate from payroll, can be renounced): ${fmt(t.capHoldsTotal)} across ${t.capHolds.length} holds`);
    if (t.twoWay.length > 0) lines.push(`  Two-way players: ${t.twoWay.join(", ")}`);
    lines.push(`  Available exception(s): ${availableExceptions}`);
    if (t.exceptions.length > 0) {
      lines.push(`  Trade/exception ledger (per Capsheets):`);
      for (const ex of t.exceptions) {
        lines.push(`    - ${ex.type}: ${fmt(ex.amount)}${ex.expiry ? ` (expires ${ex.expiry})` : ""}`);
      }
    }
    lines.push("");
  }

  // Cap accounting notes — with capsheets, payroll and holds are kept separate.
  lines.push(`**How to read these Capsheets numbers:**`);
  lines.push(`- "Total payroll" is the active roster's guaranteed + non-guaranteed salaries. "Total salaries" adds dead money (waived players still owed).`);
  lines.push(`- Cap holds are listed SEPARATELY and are NOT part of payroll. They are placeholders (unsigned picks, free agents with Bird rights, empty roster spots) that a team can renounce to open cap room.`);
  lines.push(`- First/second apron "space" is the authoritative over/under figure (negative = over). Apron status is what governs which tools a team can use.`);
  lines.push(`- Option years (player/team options) count at full value until exercised or declined; two-way contracts are not counted in the apron total.`);

  return lines.join("\n");
}
