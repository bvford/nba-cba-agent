interface SourceMetadata {
  id: string;
  label: string;
  url: string;
  matcher: (source: string) => boolean;
  note?: string;
  sidebarLabel?: string;
  showInSidebar?: boolean;
  showOnAbout?: boolean;
}

export const SOURCE_METADATA: SourceMetadata[] = [
  {
    id: "cba-guide",
    label: "CBA Guide",
    sidebarLabel: "CBA Guide (Plain English)",
    url: "https://cbaguide.com/#top",
    matcher: (source) => source.includes("cbaguide.com") || source.startsWith("cba guide"),
    note: "Quick rule explanations",
    showInSidebar: true,
    showOnAbout: true,
  },
  {
    id: "official-cba",
    label: "Official 2023 CBA (NBPA)",
    url: "https://nbpa.com/cba",
    matcher: (source) => source.includes("nbpa.com/cba") || source.startsWith("2023 cba"),
    note: "Primary agreement text",
    showInSidebar: true,
    showOnAbout: true,
  },
  {
    id: "cba-101",
    label: "CBA 101 FAQ",
    url: "/about",
    matcher: (source) => source.startsWith("cba 101 faq:"),
  },
  {
    id: "capsheets",
    label: "Capsheets",
    url: "https://www.capsheets.com/",
    matcher: (source) => source.includes("capsheets"),
    note: "Team cap and salary reference",
    showInSidebar: true,
    showOnAbout: true,
  },
  {
    id: "hoopshype",
    label: "HoopsHype Salaries",
    url: "https://hoopshype.com/salaries/players/",
    matcher: (source) => source.includes("hoopshype"),
  },
  {
    id: "nba-stats",
    label: "NBA Stats",
    url: "https://www.nba.com/stats/players/traditional",
    matcher: (source) =>
      source.includes("nba stats") || source.includes("nba.com/stats") || source.includes("stats feed"),
    note: "Official player stat tables",
    showInSidebar: true,
    showOnAbout: true,
  },
  {
    id: "about",
    label: "About & Method",
    url: "/about",
    matcher: () => false,
    note: "How this app works",
    showInSidebar: true,
  },
];

export const SIDEBAR_SOURCES = SOURCE_METADATA.filter((source) => source.showInSidebar);
const ABOUT_SOURCE_ORDER = ["official-cba", "cba-guide", "capsheets", "nba-stats"];
export const ABOUT_SOURCES = ABOUT_SOURCE_ORDER.flatMap((id) => {
  const source = SOURCE_METADATA.find((candidate) => candidate.id === id && candidate.showOnAbout);
  return source ? [source] : [];
});

export function normalizeSource(source: string): { label: string; href?: string } {
  const lower = source.toLowerCase();
  const metadata = SOURCE_METADATA.find((candidate) => candidate.matcher(lower));

  if (metadata?.id === "official-cba") {
    const section = source.replace(/^2023 CBA:\s*/i, "").trim();
    return {
      label: section ? `CBA: ${truncate(section, 26)}` : "2023 CBA",
      href: metadata.url,
    };
  }

  if (metadata?.id === "cba-101") {
    const section = source.replace(/^CBA 101 FAQ:\s*/i, "").trim();
    return {
      label: section ? `CBA 101: ${truncate(section, 22)}` : metadata.label,
      href: metadata.url,
    };
  }

  if (metadata) return { label: metadata.label, href: metadata.url };

  const directUrl = source.match(/https?:\/\/[^\s)]+/i)?.[0];
  if (directUrl) {
    const clean = source.replace(/\s*\(https?:\/\/[^\s)]+\)\s*/i, "").trim();
    return {
      label: truncate(clean || directUrl.replace(/^https?:\/\//, ""), 28),
      href: directUrl,
    };
  }

  return { label: truncate(source, 28) };
}

function truncate(value: string, max: number): string {
  if (value.length <= max) return value;
  return `${value.slice(0, max - 1)}…`;
}
