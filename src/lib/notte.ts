const NOTTE_API_KEY = process.env.NOTTE_API_KEY;
const FUNCTION_ID = "4daab32b-5a71-4d4a-9f10-f52ea79445ff";
const BASE_URL = "https://api.notte.cc";

interface NotteContractDetails {
  "Contract Terms"?: string;
  "Average Salary"?: string;
  "GTD at Sign"?: string;
  "Total GTD"?: string;
  "Signed Using"?: string;
  "Free Agent"?: string;
  [key: string]: string | undefined;
}

interface NotteAnnualRow {
  Year?: string;
  Age?: string;
  "Cap HitAnnual"?: string;
  "Cash Annual"?: string;
  [key: string]: string | undefined;
}

export interface NotteContractData {
  player_name?: string;
  team?: string;
  position?: string;
  current_season?: string;
  current_cap_hit?: string;
  current_cash?: string;
  career_earnings?: string;
  current_contract?: {
    year_range?: string;
    contract_type?: string;
    summary?: string;
    details?: NotteContractDetails;
    annual_breakdown?: NotteAnnualRow[];
  };
}

export async function fetchPlayerContract(playerName: string): Promise<NotteContractData | null> {
  if (!NOTTE_API_KEY) return null;

  const headers = {
    "Authorization": `Bearer ${NOTTE_API_KEY}`,
    "x-notte-api-key": NOTTE_API_KEY,
    "Content-Type": "application/json",
  };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000);

  try {
    const res = await fetch(`${BASE_URL}/functions/${FUNCTION_ID}/runs/start`, {
      method: "POST",
      headers,
      signal: controller.signal,
      body: JSON.stringify({
        workflow_id: FUNCTION_ID,
        variables: { player_name: playerName },
        stream: false,
      }),
    });

    if (!res.ok) {
      console.error(`Notte API error: ${res.status}`);
      return null;
    }

    const data = await res.json();
    const result = data.result as NotteContractData | undefined;
    return result ?? null;
  } catch (err) {
    if ((err as Error).name !== "AbortError") {
      console.error("Notte fetch error:", err);
    }
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

export function formatNotteContract(data: NotteContractData): string {
  const lines: string[] = [];

  const header = [data.player_name, data.team, data.position].filter(Boolean).join(", ");
  if (header) lines.push(`**${header}**`);
  if (data.current_cap_hit) lines.push(`Cap hit (${data.current_season ?? "current"}): ${data.current_cap_hit}`);
  if (data.current_cash) lines.push(`Cash salary: ${data.current_cash}`);
  if (data.career_earnings) lines.push(`Career earnings: ${data.career_earnings}`);

  const contract = data.current_contract;
  if (contract) {
    if (contract.summary) lines.push(`Contract: ${contract.summary}`);
    const d = contract.details;
    if (d) {
      if (d["Contract Terms"]) lines.push(`Terms: ${d["Contract Terms"]}`);
      if (d["Average Salary"]) lines.push(`Avg/year: ${d["Average Salary"]}`);
      if (d["Total GTD"]) lines.push(`Total guaranteed: ${d["Total GTD"]}`);
      if (d["Signed Using"]) lines.push(`Signed using: ${d["Signed Using"]}`);
      if (d["Free Agent"]) lines.push(`Free agent: ${d["Free Agent"]}`);
    }
    if (contract.annual_breakdown?.length) {
      lines.push("Year-by-year:");
      for (const row of contract.annual_breakdown) {
        const year = row.Year ?? "";
        // Strip any HTML artifacts from scraped data
        const cleanYear = year.replace(/<[^>]*>/g, "").replace(/"/g, "").trim();
        const salary = row["Cap HitAnnual"] ?? row["Cash Annual"] ?? "";
        if (cleanYear && salary) lines.push(`  ${cleanYear}: ${salary}`);
      }
    }
  }

  return lines.join("\n");
}
