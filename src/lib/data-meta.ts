import teams from "../../data/teams.json";

export const teamsFetchedAt = teams.fetchedAt;
export const teamsSource = teams.source; // "capsheets.com"
export const leagueThresholds = teams.thresholds;
export const leagueSeason = teams.season;

export const formattedTeamsFetchedAt = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
  timeZone: "UTC",
}).format(new Date(`${teamsFetchedAt}T00:00:00Z`));
