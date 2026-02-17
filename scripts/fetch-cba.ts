import { writeFileSync, mkdirSync } from "fs";
import { join } from "path";

const BASE_URL =
  "https://raw.githubusercontent.com/atlhawksfanatic/NBA-CBA/master/";

const FILES = [
  "01-DEFINITIONS.Rmd",
  "02-UNIFORM-PLAYER-CONTRACT.Rmd",
  "03-PLAYER-EXPENSES.Rmd",
  "04-BENEFITS.Rmd",
  "05-COMPENSATION-AND-EXPENSES-IN-CONNECTION-WITH-MILITARY-DUTY.Rmd",
  "06-PLAYER-CONDUCT.Rmd",
  "07-BASKETBALL-RELATED-INCOME-SALARY-CAP-MINIMUM-TEAM-SALARY-TAX-LEVEL-APRON-LEVELS-AND-DESIGNATED-SHARE-ARRANGEMENT.Rmd",
  "08-ROOKIE-SCALE.Rmd",
  "09-LENGTH-OF-PLAYER-CONTRACTS.Rmd",
  "10-PLAYER-ELIGIBILITY-AND-NBA-DRAFT.Rmd",
  "11-FREE-AGENCY.Rmd",
  "12-OPTION-CLAUSES.Rmd",
  "13-CIRCUMVENTION.Rmd",
  "14-ANTI-COLLUSION-PROVISIONS.Rmd",
  "15-CERTIFICATIONS.Rmd",
  "16-MUTUAL-RESERVATION-OF-RIGHTS.Rmd",
  "17-PROCEDURE-WITH-RESPECT-TO-PLAYING-CONDITIONS-AT-VARIOUS-FACILITIES.Rmd",
  "18-TRAVEL-ACCOMMODATIONS-LOCKER-ROOM-FACILITIES-AND-PARKING.Rmd",
  "19-UNION-SECURITY-DUES-AND-CHECK-OFF.Rmd",
  "20-SCHEDULING.Rmd",
  "21-NBA-ALL-STAR-GAME.Rmd",
  "22-PLAYER-HEALTH-AND-WELLNESS.Rmd",
  "23-EXHIBITION-GAMES-AND-OFF-SEASON-GAMES-AND-EVENTS.Rmd",
  "24-PROHIBITION-OF-NO-TRADE-CONTRACTS.Rmd",
  "25-LIMITATION-ON-DEFERRED-COMPENSATION.Rmd",
  "26-TEAM-RULES.Rmd",
  "27-RIGHT-OF-SET-OFF.Rmd",
  "28-MEDIA-RIGHTS.Rmd",
  "29-MISCELLANEOUS.Rmd",
  "30-NO-STRIKE-AND-NO-LOCKOUT-PROVISIONS-AND-OTHER-UNDERTAKINGS.Rmd",
  "31-GRIEVANCE-AND-ARBITRATION-PROCEDURE-AND-SPECIAL-PROCEDURES-WITH-RESPECT-TO-DISPUTES-INVOLVING-PLAYER-DISCIPLINE.Rmd",
  "32-SYSTEM-ARBITRATION.Rmd",
  "33-ANTI-DRUG-PROGRAM-AND-SUBSTANCE-ABUSE-TREATMENT.Rmd",
  "34-RECOGNITION-CLAUSE.Rmd",
  "35-SAVINGS-CLAUSE.Rmd",
  "36-PLAYER-AGENTS.Rmd",
  "37-APPEARANCES-AND-ADDITIONAL-CONTENT-ACTIVITIES-UNIFORM.Rmd",
  "38-INTEGRATION-ENTIRE-AGREEMENT-INTERPRETATION-AND-CHOICE-OF-LAW.Rmd",
  "39-TERM-OF-AGREEMENT.Rmd",
  "40-EXPANSION-AND-CONTRACTION.Rmd",
  "41-NBA-G-LEAGUE.Rmd",
  "42-OTHER.Rmd",
  "43-NATIONAL-BASKETBALL-ASSOCIATION-UNIFORM-PLAYER-CONTRACT.Rmd",
  "44-BASELINE-ROOKIE-SALARY-SCALE.Rmd",
  "45-BASELINE-MINIMUM-ANNUAL-SALARY-SCALE.Rmd",
  "46-BRI-EXPENSE-RATIOS.Rmd",
  "47-NOTICE-TO-VETERAN-PLAYERS-CONCERNING-SUMMER-LEAGUES.Rmd",
  "48-JOINT-NBA-NBPA-POLICY-ON-DOMESTIC-VIOLENCE-SEXUAL-ASSAULT-AND-CHILD-ABUSE.Rmd",
  "49-OFFER-SHEET.Rmd",
  "50-FIRST-REFUSAL-EXERCISE-NOTICE.Rmd",
  "51-AUTHORIZATION-FOR-TESTING.Rmd",
  "52-FORM-OF-CONFIDENTIALITY-AGREEMENT.Rmd",
];

interface CBAArticle {
  id: string;
  title: string;
  content: string;
}

function cleanRmd(raw: string): string {
  // Remove R markdown header (YAML front matter)
  let text = raw.replace(/^---[\s\S]*?---\n*/m, "");
  // Remove R code chunks
  text = text.replace(/```\{r[\s\S]*?```\n*/g, "");
  // Clean up bookdown cross-references
  text = text.replace(/\{#[^}]+\}/g, "");
  // Clean up remaining markdown formatting artifacts
  text = text.replace(/\\\(/g, "(").replace(/\\\)/g, ")");
  return text.trim();
}

function extractTitle(content: string, filename: string): string {
  const match = content.match(/^#\s+(.+)/m);
  if (match) return match[1].trim();
  // Fallback: derive from filename
  return filename
    .replace(/^\d+-/, "")
    .replace(".Rmd", "")
    .replace(/-/g, " ");
}

async function main() {
  const dataDir = join(__dirname, "..", "data");
  mkdirSync(dataDir, { recursive: true });

  const articles: CBAArticle[] = [];
  let totalChars = 0;

  console.log("Fetching NBA CBA articles...\n");

  for (const file of FILES) {
    const url = BASE_URL + file;
    try {
      const res = await fetch(url);
      if (!res.ok) {
        console.error(`  FAILED: ${file} (${res.status})`);
        continue;
      }
      const raw = await res.text();
      const content = cleanRmd(raw);
      const title = extractTitle(content, file);
      const id = file.replace(".Rmd", "");

      articles.push({ id, title, content });
      totalChars += content.length;
      console.log(`  OK: ${title} (${content.length.toLocaleString()} chars)`);
    } catch (err) {
      console.error(`  ERROR: ${file}`, err);
    }
  }

  // Write the full dataset
  const outPath = join(dataDir, "cba-articles.json");
  writeFileSync(outPath, JSON.stringify(articles, null, 2));

  console.log(`\nDone! ${articles.length} articles saved.`);
  console.log(`Total: ${totalChars.toLocaleString()} characters`);
  console.log(`Output: ${outPath}`);
}

main();
