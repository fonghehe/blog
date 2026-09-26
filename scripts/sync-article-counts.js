#!/usr/bin/env node
/** Keep the hard-coded site copy aligned with real article files. */
import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const check = process.argv.includes("--check");
if (process.argv.some((arg) => arg.startsWith("--") && arg !== "--check")) {
  throw new Error("Usage: node scripts/sync-article-counts.js [--check]");
}

const locales = [
  { dir: "docs", readme: "README.md", kind: "zh" },
  { dir: "docs/en", readme: "README.en.md", kind: "en" },
  { dir: "docs/ja", readme: "README.ja.md", kind: "ja" },
  { dir: "docs/zh-tw", readme: "README.zh-tw.md", kind: "zh" },
  { dir: "docs/zh-hk", readme: "README.zh-hk.md", kind: "zh" },
];

function countMarkdown(dir) {
  let count = 0;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) count += countMarkdown(path);
    else if (entry.isFile() && entry.name.endsWith(".md") && entry.name !== "index.md") count++;
  }
  return count;
}

function countArchiveByPublishedYear(dir) {
  const counts = new Map();
  function visit(current) {
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const file = join(current, entry.name);
      if (entry.isDirectory()) visit(file);
      else if (entry.isFile() && entry.name.endsWith(".md") && entry.name !== "index.md") {
        const source = readFileSync(file, "utf8");
        const frontmatter = source.match(/^---\n([\s\S]*?)\n---/);
        const published = frontmatter?.[1].match(/^date:\s*(\d{4})-/m);
        if (!published) throw new Error(`Missing publication date: ${file}`);
        const year = published[1];
        counts.set(year, (counts.get(year) ?? 0) + 1);
      }
    }
  }
  visit(dir);
  return counts;
}

const changed = [];
const pendingWrites = new Map();
function update(file, transform) {
  const before = readFileSync(file, "utf8");
  const after = transform(before);
  if (after === before) return;
  changed.push(file);
  if (!check) pendingWrites.set(file, after);
}
function replaceRequired(source, pattern, replacement, file) {
  if (!pattern.test(source)) throw new Error(`Missing count marker in ${file}: ${pattern}`);
  pattern.lastIndex = 0;
  return source.replace(pattern, replacement);
}
const format = (number) => number.toLocaleString("en-US");
let referenceCounts;
let siteTotal;

for (const locale of locales) {
  const archiveCount = countMarkdown(join(locale.dir, "archive"));
  const archiveYears = countArchiveByPublishedYear(join(locale.dir, "archive"));
  if ([...archiveYears.values()].reduce((a, b) => a + b, 0) !== archiveCount) {
    throw new Error(`Archive date count mismatch: ${locale.dir}`);
  }
  const postCount = countMarkdown(join(locale.dir, "posts"));
  const countSignature = JSON.stringify([archiveCount, postCount, [...archiveYears].sort()]);
  if (referenceCounts && countSignature !== referenceCounts) {
    throw new Error(`Article counts differ across locales: ${locale.dir}`);
  }
  referenceCounts ??= countSignature;
  siteTotal ??= archiveCount + postCount;
  const total = format(archiveCount + postCount);
  const archive = format(archiveCount);
  const posts = format(postCount);
  const readme = locale.readme;
  update(readme, (source) => {
    const labels = locale.kind === "ja"
      ? [/^(- 2018[–-]2025年: )\d[\d,]*/m, /^(- 2026年: )\d[\d,]*/m, /^(- 合計: )\d[\d,]*/m]
      : locale.kind === "en"
        ? [/^(- 2018[–-]2025: )\d[\d,]*/m, /^(- 2026: )\d[\d,]*/m, /^(- Total: )\d[\d,]*/m]
        : [/^(- 2018[–-]2025 年: )\d[\d,]*/m, /^(- 2026 年: )\d[\d,]*/m, /^(- (?:总计|總計): )\d[\d,]*/m];
    for (const [i, value] of [archive, posts, total].entries()) {
      source = replaceRequired(source, labels[i], (_, prefix) => prefix + value, readme);
    }
    return source;
  });
  const home = join(locale.dir, "index.md");
  update(home, (source) => {
    const marker = locale.kind === "ja"
      ? /(?:1200|[\d,]+)本(?:以上)?/g
      : locale.kind === "en"
        ? /(?:1200\+|[\d,]+)(?= in-depth articles)/g
        : /[\d,]+\+?(?= 篇深度文章)/g;
    return replaceRequired(source, marker, locale.kind === "ja" ? `${total}本` : total, home);
  });
  const archiveHome = join(locale.dir, "archive/index.md");
  update(archiveHome, (source) => {
    const lines = source.split("\n");
    let totalSeen = false;
    const years = new Set();
    const updated = lines.map((line) => {
      if (line.startsWith("> ") && /\d[\d,]*(?:\s*篇|本|\s*in-depth)/.test(line)) {
        totalSeen = true;
        return line.replace(/\d[\d,]*(?!.*\d)/, archive);
      }
      const match = line.match(/^### (20(?:18|19|20|21|22|23|24|25))\b/);
      if (!match) return line;
      const year = match[1];
      const count = format(archiveYears.get(year) ?? 0);
      const next = line.replace(/\([\d,]+(\s*)(篇|本|articles)\)/, (_, space, unit) => `(${count}${space}${unit})`);
      if (next === line && !line.includes(`(${count}`)) throw new Error(`Missing year count: ${archiveHome} ${year}`);
      years.add(year);
      return next;
    });
    if (!totalSeen || years.size !== 8) throw new Error(`Incomplete archive counters in ${archiveHome}`);
    return updated.join("\n");
  });
  console.log(`${locale.dir}: archive ${archive}, posts ${posts}, total ${total}`);
}

for (const file of ["docs/.vitepress/config.ts", "docs/.vitepress/rss.ts"]) {
  update(file, (source) => {
    const count = format(siteTotal);
    source = replaceRequired(source, /[\d,]+\+?(?= 篇深度文章)/g, count, file);
    if (file.endsWith("rss.ts")) {
      source = replaceRequired(source, /(?:1200\+|[\d,]+)(?= in-depth articles)/g, count, file);
      source = replaceRequired(source, /(?:1200\+|[\d,]+)(?=記事)/g, count, file);
    }
    return source;
  });
}
for (const [file, source] of pendingWrites) writeFileSync(file, source);
console.log(`${check ? "Outdated" : "Updated"}: ${changed.length} files`);
if (check && changed.length) {
  for (const file of changed) console.error(`Outdated: ${file}`);
  process.exitCode = 1;
}
