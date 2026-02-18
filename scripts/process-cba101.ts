import { writeFileSync, readFileSync } from "fs";
import { join } from "path";

interface CBA101Section {
  id: string;
  title: string;
  content: string;
}

function processCBA101() {
  const raw = readFileSync(
    join(__dirname, "..", "data", "cba101-raw.txt"),
    "utf-8"
  );

  const normalized = raw
    .replace(/\f/g, "\n")
    .replace(/​/g, "")
    .replace(/WWW\.SPORTSBUSINESSCLASSROOM\.COM/g, "")
    .replace(/\n{3,}/g, "\n\n");

  const startMatches = [...normalized.matchAll(/\n1\.\s+What is the length of the CBA\?/g)].map(
    (m) => m.index ?? -1
  );
  const detailedStart = startMatches.length >= 2 ? startMatches[1] : startMatches[0];
  if (detailedStart === undefined || detailedStart === -1) {
    throw new Error("Could not find start of detailed Q&A section in CBA101 text");
  }

  const qaText = normalized.slice(detailedStart).trim();
  const questionStart =
    "(What|How|Can|Do|Does|Are|Is|If|When|Who|Where|Why|Besides|What happens|How did|Who qualifies)";
  const chunks = qaText
    .split(new RegExp(`(?=\\n\\s*\\d{1,3}\\.\\s*${questionStart})`, "g"))
    .map((c) => c.trim())
    .filter(Boolean);

  const byQuestion = new Map<number, CBA101Section>();
  for (const chunk of chunks) {
    const match = chunk.match(/^\s*(\d{1,3})\.\s*([\s\S]+)$/);
    if (!match) continue;
    const qNum = Number(match[1]);
    if (qNum < 1 || qNum > 133) continue;

    const rest = match[2].trim();
    const lines = rest.split("\n").map((l) => l.trim()).filter(Boolean);
    if (lines.length === 0) continue;

    const titleLines: string[] = [];
    let idx = 0;
    while (idx < lines.length && titleLines.join(" ").length < 220) {
      titleLines.push(lines[idx]);
      const joined = titleLines.join(" ");
      idx++;
      if (joined.includes("?")) break;
      if (idx >= 3) break;
    }

    const title = `Q${qNum}: ${titleLines.join(" ").replace(/\s+/g, " ").trim()}`;
    const content = lines.slice(idx).join("\n").replace(/\n{3,}/g, "\n\n").trim();
    if (content.length < 30) continue;

    const section = {
      id: `cba101-${qNum.toString().padStart(3, "0")}`,
      title,
      content,
    };

    // If we parsed multiple variants for the same question, keep the richer one.
    const existing = byQuestion.get(qNum);
    if (!existing || section.content.length > existing.content.length) {
      byQuestion.set(qNum, section);
    }
  }

  const finalSections: CBA101Section[] = Array.from(byQuestion.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([, section]) => section);

  const outPath = join(__dirname, "..", "data", "cba101.json");
  writeFileSync(outPath, JSON.stringify(finalSections, null, 2));

  let totalChars = 0;
  for (const s of finalSections) totalChars += s.content.length;

  console.log(`Processed CBA 101 FAQ dataset:`);
  console.log(`  Sections: ${finalSections.length}`);
  console.log(`  Total: ${totalChars.toLocaleString()} characters`);
  console.log(`  Output: ${outPath}`);
  console.log(`\nSections:`);
  for (const s of finalSections) {
    console.log(
      `  ${s.id}: ${s.title.substring(0, 80)}${s.title.length > 80 ? "..." : ""} (${s.content.length.toLocaleString()} chars)`
    );
  }
}

processCBA101();
