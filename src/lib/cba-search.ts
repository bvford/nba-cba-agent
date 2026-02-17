import cbaArticles from "../../data/cba-articles.json";
import playerData from "../../data/players.json";

export interface CBAArticle {
  id: string;
  title: string;
  content: string;
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

const players: PlayerData[] = playerData as PlayerData[];

interface ScoredArticle extends CBAArticle {
  score: number;
  relevantSections: string[];
}

const articles: CBAArticle[] = cbaArticles as CBAArticle[];

// Break each article into sections (split on ## headings)
function getSections(article: CBAArticle): { heading: string; text: string }[] {
  const parts = article.content.split(/^(#{1,3}\s+.+)$/m);
  const sections: { heading: string; text: string }[] = [];
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

export function searchCBA(query: string, maxChars: number = 80000): string {
  const queryTokens = tokenize(query).filter((t) => !STOP_WORDS.has(t));
  const queryLower = query.toLowerCase();

  // Check topic map for boosted terms
  const boostedTerms: string[] = [];
  for (const [topic, terms] of Object.entries(TOPIC_MAP)) {
    if (queryLower.includes(topic)) {
      boostedTerms.push(...terms);
    }
  }
  // Also check individual query words against topic keys
  for (const token of queryTokens) {
    for (const [topic, terms] of Object.entries(TOPIC_MAP)) {
      if (topic.includes(token)) {
        boostedTerms.push(...terms);
      }
    }
  }

  const scored: ScoredArticle[] = articles.map((article) => {
    let score = 0;
    const sections = getSections(article);
    const relevantSections: string[] = [];

    // Score the article title
    const titleLower = article.title.toLowerCase();
    for (const token of queryTokens) {
      if (titleLower.includes(token)) score += 10;
    }
    for (const term of boostedTerms) {
      if (titleLower.includes(term)) score += 15;
    }

    // Score each section
    for (const section of sections) {
      const sectionLower = (section.heading + " " + section.text).toLowerCase();
      let sectionScore = 0;

      for (const token of queryTokens) {
        const regex = new RegExp(token, "gi");
        const matches = sectionLower.match(regex);
        if (matches) sectionScore += matches.length;
      }
      for (const term of boostedTerms) {
        if (sectionLower.includes(term)) sectionScore += 5;
      }

      // Bonus for exact phrase matches
      if (sectionLower.includes(queryLower)) sectionScore += 20;

      if (sectionScore > 0) {
        score += sectionScore;
        relevantSections.push(
          `### ${section.heading}\n${section.text}`
        );
      }
    }

    return { ...article, score, relevantSections };
  });

  // Sort by score, take the best matches
  scored.sort((a, b) => b.score - a.score);

  // Build context from top-scoring articles, respecting char limit
  let context = "";
  let articlesIncluded = 0;

  for (const article of scored) {
    if (article.score === 0) break;

    // If article is small enough, include the whole thing
    let articleText: string;
    if (article.content.length < 15000) {
      articleText = `\n\n--- ARTICLE: ${article.title} ---\n\n${article.content}`;
    } else {
      // Include only the relevant sections
      articleText = `\n\n--- ARTICLE: ${article.title} (relevant sections) ---\n\n${article.relevantSections.join("\n\n")}`;
    }

    if (context.length + articleText.length > maxChars && articlesIncluded > 0) {
      break;
    }

    context += articleText;
    articlesIncluded++;
  }

  return context || "No relevant CBA sections found for this query.";
}

// ---- Player search ----

// NBA team full names for matching
const TEAM_NAMES: Record<string, string[]> = {
  ATL: ["hawks", "atlanta"], BOS: ["celtics", "boston"], BKN: ["nets", "brooklyn"],
  CHA: ["hornets", "charlotte"], CHI: ["bulls", "chicago"], CLE: ["cavaliers", "cavs", "cleveland"],
  DAL: ["mavericks", "mavs", "dallas"], DEN: ["nuggets", "denver"], DET: ["pistons", "detroit"],
  GSW: ["warriors", "golden state"], HOU: ["rockets", "houston"], IND: ["pacers", "indiana"],
  LAC: ["clippers", "la clippers"], LAL: ["lakers", "la lakers", "los angeles lakers"],
  MEM: ["grizzlies", "memphis"], MIA: ["heat", "miami"], MIL: ["bucks", "milwaukee"],
  MIN: ["timberwolves", "wolves", "minnesota"], NOP: ["pelicans", "new orleans"],
  NYK: ["knicks", "new york"], OKC: ["thunder", "oklahoma city"],
  ORL: ["magic", "orlando"], PHI: ["76ers", "sixers", "philadelphia"],
  PHX: ["suns", "phoenix"], PHO: ["suns", "phoenix"], POR: ["trail blazers", "blazers", "portland"],
  SAC: ["kings", "sacramento"], SAS: ["spurs", "san antonio"], TOR: ["raptors", "toronto"],
  UTA: ["jazz", "utah"], WAS: ["wizards", "washington"],
};

function formatPlayerInfo(p: PlayerData): string {
  const gp = p.games || 1;
  const ppg = (p.points / gp).toFixed(1);
  const rpg = (p.rebounds / gp).toFixed(1);
  const apg = (p.assists / gp).toFixed(1);
  const spg = (p.steals / gp).toFixed(1);
  const bpg = (p.blocks / gp).toFixed(1);

  let info = `**${p.name}** (${p.team}, ${p.position || "N/A"})`;
  if (p.age) info += `, Age: ${p.age}`;
  info += "\n";

  if (p.games > 0) {
    info += `Stats (2024-25): ${p.games} GP, ${ppg} PPG, ${rpg} RPG, ${apg} APG, ${spg} SPG, ${bpg} BPG`;
    info += `, ${(p.fieldPercent * 100).toFixed(1)}% FG, ${(p.threePercent * 100).toFixed(1)}% 3PT, ${(p.ftPercent * 100).toFixed(1)}% FT`;
    info += `, ${p.minutesPerGame} MPG\n`;
  }

  const salaryEntries = Object.entries(p.salaries).sort();
  if (salaryEntries.length > 0) {
    info += "Contract: " + salaryEntries.map(([yr, sal]) => `${yr}: ${sal}`).join(", ") + "\n";
  }

  return info;
}

export function searchPlayers(query: string): string {
  const queryLower = query.toLowerCase();
  const matched: PlayerData[] = [];

  // Check for specific player names
  for (const p of players) {
    const nameLower = p.name.toLowerCase();
    // Check if the query contains the player's full name or last name
    const nameParts = nameLower.split(" ");
    const lastName = nameParts[nameParts.length - 1];

    if (queryLower.includes(nameLower) || (lastName.length > 3 && queryLower.includes(lastName))) {
      matched.push(p);
    }
  }

  // Check for team mentions (e.g., "Lakers roster", "what can the Celtics do")
  const teamMatches: PlayerData[] = [];
  for (const [abbr, names] of Object.entries(TEAM_NAMES)) {
    for (const name of names) {
      if (queryLower.includes(name)) {
        const teamPlayers = players
          .filter((p) => p.team === abbr || p.team === abbr.replace("PHX", "PHO"))
          .sort((a, b) => b.points - a.points)
          .slice(0, 8); // Top 8 by points
        teamMatches.push(...teamPlayers);
        break;
      }
    }
  }

  // Combine and deduplicate
  const seen = new Set<string>();
  const results: PlayerData[] = [];
  for (const p of [...matched, ...teamMatches]) {
    if (!seen.has(p.name)) {
      seen.add(p.name);
      results.push(p);
    }
  }

  if (results.length === 0) return "";

  let context = "\n\n--- PLAYER DATA ---\n\n";
  for (const p of results.slice(0, 15)) {
    context += formatPlayerInfo(p) + "\n";
  }
  return context;
}

// Get a table of contents for the system prompt
export function getCBAToc(): string {
  return articles
    .map((a) => `- ${a.id}: ${a.title}`)
    .join("\n");
}
