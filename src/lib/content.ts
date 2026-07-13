export const EXAMPLE_QUESTIONS = [
  { label: "What is LeBron James eligible for in free agency?", icon: "👑" },
  { label: "How do Bird rights work?", icon: "🦅" },
  { label: "Explain the second apron and its restrictions", icon: "📊" },
  { label: "What triggers a hard cap at the first apron?", icon: "📝" },
  { label: "What is the mid-level exception?", icon: "💰" },
  { label: "How does restricted free agency work?", icon: "🔒" },
];

export const STARTER_MODES = [
  {
    label: "Contracts",
    prompt:
      "Break down this player's contract in plain English. Player: [name]. Include years, salary by season, guarantees, options, bonuses, and extension eligibility.",
  },
  {
    label: "Trades",
    prompt:
      "Evaluate whether this trade is legal and smart under the current CBA. Team A sends: [players/picks], Team B sends: [players/picks]. Explain salary matching, apron constraints, and long-term cap impact.",
  },
  {
    label: "Free Agency",
    prompt:
      "Map this team's offseason options under the current CBA. Team: [name]. Include cap room estimate, key free agents, exceptions available, and realistic move paths.",
  },
  {
    label: "Cap Exceptions",
    prompt:
      "Identify which cap exceptions this team can use right now and rank them by usefulness. Team: [name]. Explain eligibility, spending limits, and apron-related restrictions.",
  },
];

export const FEATURE_CARDS = [
  {
    title: "NBA Salary Cap Tool",
    description:
      "Understand team flexibility, apron pressure, and realistic offseason pathways in one answer.",
    prompt:
      "Map this team's offseason options under the current CBA. Team: [name]. Include cap room estimate, key free agents, exceptions available, and realistic move paths.",
  },
  {
    title: "Trade Rules Explorer",
    description:
      "Pressure-test a deal for legality and strategic fit with salary matching and apron constraints.",
    prompt:
      "Evaluate whether this trade is legal and smart under the current CBA. Team A sends: [players/picks], Team B sends: [players/picks]. Explain salary matching, apron constraints, and long-term cap impact.",
  },
  {
    title: "Contract Examples",
    description:
      "Get a plain-English breakdown of contract structure, guarantees, options, and extension leverage.",
    prompt:
      "Break down this player's contract in plain English. Player: [name]. Include years, salary by season, guarantees, options, bonuses, and extension eligibility.",
  },
];
