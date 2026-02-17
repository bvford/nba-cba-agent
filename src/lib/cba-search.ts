import cbaArticles from "../../data/cba-articles.json";

export interface CBAArticle {
  id: string;
  title: string;
  content: string;
}

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

// Get a table of contents for the system prompt
export function getCBAToc(): string {
  return articles
    .map((a) => `- ${a.id}: ${a.title}`)
    .join("\n");
}
