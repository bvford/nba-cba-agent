// Team name/abbreviation matching and cap-status math shared by the chat
// retrieval pipeline (cba-search.ts) and the /teams pages. Deliberately has
// no dependency on the large CBA/player JSON files so client components can
// import it cheaply.

export const TEAM_NAMES: Record<string, string[]> = {
  ATL: ["hawks", "atlanta"], BOS: ["celtics", "boston"], BKN: ["nets", "brooklyn"],
  CHA: ["hornets", "charlotte"], CHI: ["bulls", "chicago"], CLE: ["cavaliers", "cavs", "cleveland"],
  DAL: ["mavericks", "mavs", "dallas"], DEN: ["nuggets", "denver"], DET: ["pistons", "detroit"],
  GSW: ["warriors", "golden state"], HOU: ["rockets", "houston"], IND: ["pacers", "indiana"],
  LAC: ["clippers", "la clippers"], LAL: ["lakers", "la lakers", "los angeles lakers"],
  MEM: ["grizzlies", "memphis"], MIA: ["heat", "miami"], MIL: ["bucks", "milwaukee"],
  MIN: ["timberwolves", "wolves", "minnesota"], NOP: ["pelicans", "new orleans"],
  NYK: ["knicks", "new york"], OKC: ["thunder", "oklahoma city"],
  ORL: ["magic", "orlando"], PHI: ["76ers", "sixers", "philadelphia"],
  PHX: ["suns", "phoenix"], POR: ["trail blazers", "blazers", "portland"],
  SAC: ["kings", "sacramento"], SAS: ["spurs", "san antonio"], TOR: ["raptors", "toronto"],
  UTA: ["jazz", "utah"], WAS: ["wizards", "washington"],
};

export const TEAM_FULL_NAMES: Record<string, string> = {
  ATL: "Atlanta Hawks", BOS: "Boston Celtics", BKN: "Brooklyn Nets",
  CHA: "Charlotte Hornets", CHI: "Chicago Bulls", CLE: "Cleveland Cavaliers",
  DAL: "Dallas Mavericks", DEN: "Denver Nuggets", DET: "Detroit Pistons",
  GSW: "Golden State Warriors", HOU: "Houston Rockets", IND: "Indiana Pacers",
  LAC: "LA Clippers", LAL: "Los Angeles Lakers",
  MEM: "Memphis Grizzlies", MIA: "Miami Heat", MIL: "Milwaukee Bucks",
  MIN: "Minnesota Timberwolves", NOP: "New Orleans Pelicans",
  NYK: "New York Knicks", OKC: "Oklahoma City Thunder",
  ORL: "Orlando Magic", PHI: "Philadelphia 76ers",
  PHX: "Phoenix Suns", POR: "Portland Trail Blazers",
  SAC: "Sacramento Kings", SAS: "San Antonio Spurs", TOR: "Toronto Raptors",
  UTA: "Utah Jazz", WAS: "Washington Wizards",
};

// Aliases for team abbreviations that appear inconsistently across data
// sources. Both sides of a comparison should be run through
// normalizeTeamAbbr() so it doesn't matter which variant either side uses.
// Since teams.json and players.json now both come from capsheets.com and use a
// single canonical abbreviation set (ATL BKN … WAS), there are no real aliases
// to map anymore; a few historical stat-site variants are kept here defensively
// so any stray code still resolves to the canonical abbreviation.
const TEAM_ABBR_ALIASES: Record<string, string> = {
  PHO: "PHX",
  BRK: "BKN",
  CHO: "CHA",
  SA: "SAS",
  NO: "NOP",
  NY: "NYK",
  GS: "GSW",
};

export function normalizeTeamAbbr(abbr: string): string {
  return TEAM_ABBR_ALIASES[abbr] ?? abbr;
}

export interface CapThresholds {
  capFloor: number;
  salaryCap: number;
  firstApron: number;
  secondApron: number;
}

export interface CapExceptions {
  nonTaxpayerMLE: number;
  taxpayerMLE: number;
  biannual: number;
}

export type CapStatusTier =
  | "under-cap"
  | "over-cap"
  | "over-tax"
  | "over-first-apron"
  | "over-second-apron";

export interface CapStatus {
  tier: CapStatusTier;
  overCap: boolean;
  overTax: boolean;
  overFirstApron: boolean;
  overSecondApron: boolean;
  /** Distance to the first apron. Positive = over, negative = under. */
  firstApronDistance: number;
  /** Distance to the second apron. Positive = over, negative = under. */
  secondApronDistance: number;
}

// The capsheets fields that determine a team's cap standing. `firstApronSpace`
// and `secondApronSpace` come straight from capsheets and are the authoritative
// over/under numbers (they are computed on "Apron Total" = salaries + unlikely
// incentives, which is more precise than comparing raw payroll to a threshold).
// Negative space = over that line.
export interface TeamCapFigures {
  totalSalaries: number;
  luxuryTaxSpace: number; // negative = over the tax
  firstApronSpace: number; // negative = over the first apron
  secondApronSpace: number; // negative = over the second apron
}

// Single source of truth for apron classification — used by both the chat
// retrieval context (searchTeams()) and the /teams UI so they can never
// disagree about a team's status.
export function computeCapStatus(figures: TeamCapFigures, thresholds: CapThresholds): CapStatus {
  const overSecondApron = figures.secondApronSpace < 0;
  const overFirstApron = figures.firstApronSpace < 0;
  const overTax = figures.luxuryTaxSpace < 0;
  const overCap = figures.totalSalaries > thresholds.salaryCap;

  const tier: CapStatusTier = overSecondApron
    ? "over-second-apron"
    : overFirstApron
      ? "over-first-apron"
      : overTax
        ? "over-tax"
        : overCap
          ? "over-cap"
          : "under-cap";

  return {
    tier,
    overCap,
    overTax,
    overFirstApron,
    overSecondApron,
    // Space is negative when over, so distance-over = -space.
    firstApronDistance: -figures.firstApronSpace,
    secondApronDistance: -figures.secondApronSpace,
  };
}

// Short, UI-facing badge label.
export const CAP_STATUS_BADGE_LABELS: Record<CapStatusTier, string> = {
  "under-cap": "Under Cap",
  "over-cap": "Over Cap",
  "over-tax": "Over Tax",
  "over-first-apron": "Over First Apron",
  "over-second-apron": "Over Second Apron",
};

// Longer-form label matching searchTeams()'s existing chat-context wording.
export const CAP_STATUS_CHAT_LABELS: Record<CapStatusTier, string> = {
  "under-cap": "Under cap",
  "over-cap": "Over cap, under the luxury tax",
  "over-tax": "Over the luxury tax, under the first apron",
  "over-first-apron": "Over first apron (hard-capped at second apron)",
  "over-second-apron": "Over second apron",
};

export type ExceptionAvailability =
  | { kind: "none-over-second-apron" }
  | { kind: "taxpayer-mle"; taxpayerMLE: number }
  | { kind: "non-taxpayer-mle-and-biannual"; nonTaxpayerMLE: number; biannual: number }
  | { kind: "cap-room"; capSpace: number };

// Same eligibility ladder as the apron status above — kept as one function
// so chat answers and the /teams/[abbr] "available exceptions" section can't
// drift apart.
export function computeAvailableExceptions(
  capStatus: CapStatus,
  capSpace: number,
  exceptions: CapExceptions
): ExceptionAvailability {
  if (capStatus.overSecondApron) return { kind: "none-over-second-apron" };
  if (capStatus.overFirstApron) return { kind: "taxpayer-mle", taxpayerMLE: exceptions.taxpayerMLE };
  if (capStatus.overCap) {
    return {
      kind: "non-taxpayer-mle-and-biannual",
      nonTaxpayerMLE: exceptions.nonTaxpayerMLE,
      biannual: exceptions.biannual,
    };
  }
  return { kind: "cap-room", capSpace };
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Scans arbitrary prose (assistant chat replies) for team mentions, unlike
// searchTeams()/searchPlayers() which scan short user queries with a plain
// .includes() check. Word-boundary regex avoids false positives like
// "kings" matching inside "makings".
export function findTeamAbbrsInText(text: string): string[] {
  const lower = text.toLowerCase();
  const found: string[] = [];
  for (const [abbr, names] of Object.entries(TEAM_NAMES)) {
    for (const name of names) {
      const pattern = new RegExp(`\\b${escapeRegExp(name)}\\b`, "i");
      if (pattern.test(lower)) {
        found.push(abbr);
        break;
      }
    }
  }
  return found;
}
