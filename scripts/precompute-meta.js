#!/usr/bin/env node
/**
 * Pre-compute readingTime and description into article frontmatter.
 *
 * This allows meta.data.ts to use `includeSrc: false`, which means VitePress
 * no longer needs to load 7600+ full article texts into memory simultaneously.
 *
 * Memory savings: ~200-400MB during build
 * Speed improvement: significant (content loading is the main bottleneck)
 *
 * Usage:
 *   node scripts/precompute-meta.js
 *   node scripts/precompute-meta.js --check  (dry run, report what would change)
 */

import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";

const DOCS_DIR = join(process.cwd(), "docs");
const DRY_RUN = process.argv.includes("--check");

// Directories containing articles
const SCAN_DIRS = [
  "posts",
  "archive",
  "en/posts",
  "en/archive",
  "ja/posts",
  "ja/archive",
  "zh-tw/posts",
  "zh-tw/archive",
  "zh-hk/posts",
  "zh-hk/archive",
];

function estimateReadingTime(content) {
  // Extract code block content (strip language tag and fences)
  const codeBlocks = content.match(/```[\s\S]*?```/g) || [];
  const codeChars = codeBlocks.join("").replace(/```\w*\n?/g, "").length;

  const stripped = content
    .replace(/```[\s\S]*?```/g, "")
    .replace(/^---[\s\S]*?---/m, "")
    .replace(/[#*`>\-|[\]()!]/g, "")
    .trim();
  const cjk = (
    stripped.match(/[\u4e00-\u9fff\u3040-\u309f\u30a0-\u30ff]/g) || []
  ).length;
  const words = stripped
    .replace(/[\u4e00-\u9fff\u3040-\u309f\u30a0-\u30ff]/g, "")
    .split(/\s+/)
    .filter(Boolean).length;
  // CJK prose: 300 chars/min, Latin prose: 200 words/min, code: 3000 chars/min
  return Math.max(1, Math.round(cjk / 300 + words / 200 + codeChars / 3000));
}

function extractDescription(content) {
  const withoutFrontmatter = content.replace(/^---[\s\S]*?---/m, "");
  const lines = withoutFrontmatter
    .split("\n")
    .map((l) => l.trim())
    .filter(
      (l) =>
        l &&
        !l.startsWith("#") &&
        !l.startsWith("```") &&
        !l.startsWith("|") &&
        !l.startsWith("-") &&
        !l.startsWith("!") &&
        !l.startsWith("[") &&
        !l.startsWith("<!--"),
    );
  return (lines[0] || "").slice(0, 160);
}

function parseFrontmatter(content) {
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return null;
  return { raw: match[0], body: match[1], afterIndex: match[0].length };
}

function hasFrontmatterField(fmBody, field) {
  // Check if the field exists at root level (not indented)
  return new RegExp(`^${field}:`, "m").test(fmBody);
}

let totalFiles = 0;
let updatedFiles = 0;
let skippedFiles = 0;

for (const dir of SCAN_DIRS) {
  const fullDir = join(DOCS_DIR, dir);
  let entries;
  try {
    entries = readdirSync(fullDir, { recursive: true, withFileTypes: true });
  } catch {
    continue; // Directory might not exist
  }

  for (const entry of entries) {
    if (!entry.isFile()) continue;
    if (!entry.name.endsWith(".md")) continue;
    if (entry.name === "index.md") continue;

    const parentPath =
      typeof entry.parentPath === "string" ? entry.parentPath : entry.path;
    const filePath = join(parentPath, entry.name);
    const content = readFileSync(filePath, "utf-8");

    const fm = parseFrontmatter(content);
    if (!fm) {
      skippedFiles++;
      continue;
    }

    totalFiles++;

    // Always recompute readingTime so stale values (e.g. all-1s) get fixed
    const newReadingTime = estimateReadingTime(content);
    const currentMatch = fm.body.match(/^readingTime:\s*(\d+)/m);
    const currentRT = currentMatch ? parseInt(currentMatch[1], 10) : null;
    const rtNeedsUpdate = currentRT !== newReadingTime; // covers missing (null) too

    const descMissing = !hasFrontmatterField(fm.body, "description");

    if (!rtNeedsUpdate && !descMissing) {
      skippedFiles++;
      continue;
    }

    // Build updated frontmatter body
    let newFmBody = fm.body;

    if (rtNeedsUpdate) {
      if (currentRT !== null) {
        // Replace existing value in-place
        newFmBody = newFmBody.replace(
          /^(readingTime:\s*)\d+/m,
          `$1${newReadingTime}`,
        );
      } else {
        // Field missing — append before closing ---
        newFmBody += `\nreadingTime: ${newReadingTime}`;
      }
    }

    if (descMissing) {
      const desc = extractDescription(content);
      if (desc) {
        const escaped = desc.replace(/"/g, '\\"');
        newFmBody += `\ndescription: "${escaped}"`;
      }
    }

    updatedFiles++;
    const newContent = `---\n${newFmBody}\n---` + content.slice(fm.afterIndex);

    if (DRY_RUN) {
      const rel = relative(DOCS_DIR, filePath);
      if (updatedFiles <= 20) {
        const rtInfo = rtNeedsUpdate
          ? ` readingTime: ${currentRT ?? "?"} → ${newReadingTime}`
          : "";
        const descInfo = descMissing ? " +description" : "";
        console.log(`  ${rel}:${rtInfo}${descInfo}`);
      }
      continue;
    }

    writeFileSync(filePath, newContent, "utf-8");
  }
}

console.log(`\n${DRY_RUN ? "[DRY RUN] " : ""}Pre-compute complete:`);
console.log(`  Total articles scanned: ${totalFiles}`);
console.log(`  ${DRY_RUN ? "Would update" : "Updated"}: ${updatedFiles}`);
console.log(`  Already up-to-date: ${skippedFiles}`);

if (DRY_RUN && updatedFiles > 10) {
  console.log(`  (showing first 10 of ${updatedFiles})`);
}
