// Shape of data/teams.json (v2 — sourced from capsheets.com). Shared by the
// /teams pages and any other consumer so the structure is declared once.

export interface RosterPlayer {
  player: string;
  salary: number;
  note?: "player option" | "team option" | "non-guaranteed" | "estimate";
}

export interface NamedAmount {
  player: string;
  amount: number;
}

export interface TeamException {
  type: string;
  amount: number;
  expiry?: string;
}

export interface TeamEntry {
  abbr: string;
  name: string;
  slug: string;
  rosterHeader: string;
  activeRoster: RosterPlayer[];
  deadMoney: NamedAmount[];
  deadMoneyTotal: number;
  totalPayroll: number;
  totalSalaries: number;
  luxuryTaxThreshold: number;
  luxuryTaxSpace: number;
  repeater: boolean;
  firstApronSpace: number;
  secondApronSpace: number;
  capHolds: NamedAmount[];
  capHoldsTotal: number;
  twoWay: string[];
  exceptions: TeamException[];
}

export interface TeamsThresholds {
  capFloor: number;
  salaryCap: number;
  firstApron: number;
  secondApron: number;
  luxuryTax: number;
}

export interface TeamsJson {
  fetchedAt: string;
  season: string;
  source: string;
  thresholds: TeamsThresholds;
  exceptions: { nonTaxpayerMLE: number; taxpayerMLE: number; biannual: number };
  teams: TeamEntry[];
}
