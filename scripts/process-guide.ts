import { readFileSync, writeFileSync } from "fs";
import { join } from "path";

interface GuideSection {
  id: string;
  title: string;
  content: string;
}

function processGuide() {
  const inputPath = process.argv[2];
  if (!inputPath) {
    console.error(
      "Usage: npx tsx scripts/process-guide.ts <path-to-cbaguide-markdown-file>\n" +
        "  Provide the path to the downloaded cbaguide.com markdown export as the first argument."
    );
    process.exit(1);
  }

  const raw = readFileSync(inputPath, "utf-8");

  // Remove YAML front matter
  const text = raw.replace(/^---[\s\S]*?---\n*/m, "");

  // Split on top-level and second-level headings (# and ##)
  const sections: GuideSection[] = [];
  const lines = text.split("\n");
  let currentTitle = "Introduction";
  let currentContent: string[] = [];
  let sectionIndex = 0;

  for (const line of lines) {
    const h1Match = line.match(/^# (.+)/);
    const h2Match = line.match(/^## (.+)/);

    if (h1Match || h2Match) {
      // Save previous section if it has content
      if (currentContent.length > 0) {
        const content = currentContent.join("\n").trim();
        if (content.length > 50) {
          sections.push({
            id: `guide-${sectionIndex++}`,
            title: currentTitle,
            content,
          });
        }
      }
      currentTitle = (h1Match || h2Match)![1].trim();
      currentContent = [];
    } else {
      currentContent.push(line);
    }
  }

  // Don't forget the last section
  if (currentContent.length > 0) {
    const content = currentContent.join("\n").trim();
    if (content.length > 50) {
      sections.push({
        id: `guide-${sectionIndex++}`,
        title: currentTitle,
        content,
      });
    }
  }

  const outPath = join(__dirname, "..", "data", "cba-guide.json");
  writeFileSync(outPath, JSON.stringify(sections, null, 2));

  let totalChars = 0;
  for (const s of sections) totalChars += s.content.length;

  console.log(`Processed CBA Guide:`);
  console.log(`  Sections: ${sections.length}`);
  console.log(`  Total: ${totalChars.toLocaleString()} characters`);
  console.log(`  Output: ${outPath}`);
  console.log(`\nSections:`);
  for (const s of sections) {
    console.log(`  ${s.id}: ${s.title} (${s.content.length.toLocaleString()} chars)`);
  }
}

processGuide();
