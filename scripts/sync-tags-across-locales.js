#!/usr/bin/env node
/**
 * Sync article tags across all 5 locales using the union approach:
 * If any locale categorizes an article under a category, all locales should too.
 * Missing tags are added with the locale-appropriate tag value.
 *
 * Usage:
 *   node scripts/sync-tags-across-locales.js          (apply fixes)
 *   node scripts/sync-tags-across-locales.js --check  (dry run)
 */

import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";

const DOCS = "docs";
const DRY_RUN = process.argv.includes("--check");

const LOCALE_DIRS = {
  zh: { archive: "archive", posts: "posts" },
  en: { archive: "en/archive", posts: "en/posts" },
  ja: { archive: "ja/archive", posts: "ja/posts" },
  "zh-tw": { archive: "zh-tw/archive", posts: "zh-tw/posts" },
  "zh-hk": { archive: "zh-hk/archive", posts: "zh-hk/posts" },
};

const CATEGORIES = [
  { id: "Vue", tags: ["Vue", "Vuex", "Pinia", "Nuxt.js"] },
  { id: "React", tags: ["React", "Next.js"] },
  { id: "Angular", tags: ["Angular", "RxJS", "NgRx"] },
  { id: "JavaScript", tags: ["JavaScript", "ES6", "设计模式", "設計模式"] },
  { id: "TypeScript", tags: ["TypeScript"] },
  {
    id: "Engineering",
    tags: [
      "工程化",
      "前端工程化",
      "Engineering",
      "Frontend Engineering",
      "Build Tools",
      "エンジニアリング",
      "フロントエンドエンジニアリング",
      "Vite",
      "Webpack",
      "Rollup",
      "ESBuild",
      "Babel",
    ],
  },
  { id: "CSS", tags: ["CSS", "TailwindCSS", "Sass", "Less"] },
  {
    id: "Performance",
    tags: [
      "性能优化",
      "性能",
      "性能優化",
      "效能最佳化",
      "效能",
      "Performance",
      "Performance Optimization",
      "パフォーマンス最適化",
      "パフォーマンス",
    ],
  },
  { id: "Node.js", tags: ["Node.js", "Express", "Koa"] },
  {
    id: "Testing",
    tags: ["测试", "測試", "テスト", "Testing", "Vitest", "Playwright", "Jest"],
  },
  {
    id: "Security",
    tags: ["安全", "Security", "セキュリティ", "XSS", "CSP", "CSRF"],
  },
];

// The canonical tag to ADD per locale when a category is missing
const CANONICAL_TAG = {
  Vue: () => "Vue",
  React: () => "React",
  Angular: () => "Angular",
  JavaScript: () => "JavaScript",
  TypeScript: () => "TypeScript",
  Engineering: (locale) =>
    ({
      zh: "工程化",
      en: "Engineering",
      ja: "エンジニアリング",
      "zh-tw": "工程化",
      "zh-hk": "工程化",
    })[locale],
  CSS: () => "CSS",
  Performance: (locale) =>
    ({
      zh: "性能优化",
      en: "Performance",
      ja: "パフォーマンス最適化",
      "zh-tw": "性能優化",
      "zh-hk": "性能優化",
    })[locale],
  "Node.js": () => "Node.js",
  Testing: (locale) =>
    ({
      zh: "测试",
      en: "Testing",
      ja: "テスト",
      "zh-tw": "測試",
      "zh-hk": "測試",
    })[locale],
  Security: (locale) =>
    ({
      zh: "安全",
      en: "Security",
      ja: "セキュリティ",
      "zh-tw": "安全",
      "zh-hk": "安全",
    })[locale],
};

function getTags(content) {
  const m = content.match(/^---\n([\s\S]*?)\n---/);
  if (!m) return [];
  const body = m[1];
  const inlineM = body.match(/^tags:\s*\[([^\]]*)\]/m);
  if (inlineM)
    return inlineM[1]
      .split(",")
      .map((t) => t.trim().replace(/['"]/g, ""))
      .filter(Boolean);
  const blockM = body.match(/^tags:\s*\n((?:[ \t]+-[^\n]*\n?)*)/m);
  if (blockM)
    return blockM[1]
      .split("\n")
      .map((l) =>
        l
          .replace(/^\s*-\s*/, "")
          .replace(/['"]/g, "")
          .trim(),
      )
      .filter(Boolean);
  return [];
}

function matchesCategory(tags, cat) {
  return cat.tags.some((t) =>
    tags.some((at) => at.toLowerCase() === t.toLowerCase()),
  );
}

function addTagToFile(filePath, newTag) {
  const content = readFileSync(filePath, "utf-8");
  const fm = content.match(/^---\n([\s\S]*?)\n---/);
  if (!fm) return false;

  const fmBody = fm[0]; // full frontmatter block including ---
  const afterFm = content.slice(fmBody.length);

  // Check if it's inline or block tags
  const inlineM = fm[1].match(/^(tags:\s*\[)([^\]]*)\]/m);
  if (inlineM) {
    // Inline format: tags: [A, B] → tags: [A, B, newTag]
    const newFmBody = fm[1].replace(
      /^(tags:\s*\[)([^\]]*)\]/m,
      (_, prefix, inner) => {
        const existing = inner
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean);
        return `${prefix}${[...existing, newTag].join(", ")}]`;
      },
    );
    writeFileSync(filePath, `---\n${newFmBody}\n---${afterFm}`, "utf-8");
    return true;
  }

  // Block format: tags:\n  - A\n  - B
  const blockM = fm[1].match(/^(tags:\s*\n(?:[ \t]+-[^\n]*\n?)*)/m);
  if (blockM) {
    const tagBlock = blockM[1];
    const newTagBlock = tagBlock.trimEnd() + `\n  - ${newTag}\n`;
    const newFmBody = fm[1].replace(blockM[1], newTagBlock);
    writeFileSync(filePath, `---\n${newFmBody}\n---${afterFm}`, "utf-8");
    return true;
  }

  return false;
}

// Collect all article relative paths (using zh as canonical)
function getArticleRels(subDir) {
  const fullDir = join(DOCS, LOCALE_DIRS.zh[subDir]);
  let entries;
  try {
    entries = readdirSync(fullDir, { recursive: true, withFileTypes: true });
  } catch {
    return [];
  }
  return entries
    .filter(
      (e) => e.isFile() && e.name.endsWith(".md") && e.name !== "index.md",
    )
    .map((e) => relative(fullDir, join(e.parentPath || e.path, e.name)));
}

let totalFixed = 0;
let totalFiles = 0;
const fixLog = [];

// Pre-compute counts per category per locale to skip already-balanced categories
function countCats(subDir) {
  const counts = {};
  for (const locale of Object.keys(LOCALE_DIRS)) counts[locale] = {};
  for (const cat of CATEGORIES) {
    for (const locale of Object.keys(LOCALE_DIRS)) counts[locale][cat.id] = 0;
  }

  const rels = getArticleRels(subDir);
  for (const rel of rels) {
    for (const [locale, dirs] of Object.entries(LOCALE_DIRS)) {
      const fp = join(DOCS, dirs[subDir], rel);
      try {
        const tags = getTags(readFileSync(fp, "utf-8"));
        for (const cat of CATEGORIES) {
          if (matchesCategory(tags, cat)) counts[locale][cat.id]++;
        }
      } catch {}
    }
  }
  return counts;
}

// Determine which categories are already balanced (skip those)
const archiveCounts = countCats("archive");
const postCounts = countCats("posts");
const combinedCounts = {};
for (const locale of Object.keys(LOCALE_DIRS)) {
  combinedCounts[locale] = {};
  for (const cat of CATEGORIES) {
    combinedCounts[locale][cat.id] =
      (archiveCounts[locale]?.[cat.id] || 0) +
      (postCounts[locale]?.[cat.id] || 0);
  }
}

const SKIP_CATS = new Set();
for (const cat of CATEGORIES) {
  const vals = Object.values(combinedCounts).map((c) => c[cat.id]);
  if (Math.max(...vals) === Math.min(...vals)) {
    SKIP_CATS.add(cat.id);
  }
}
if (SKIP_CATS.size > 0) {
  console.log(
    `Skipping already-balanced categories: ${[...SKIP_CATS].join(", ")}`,
  );
}

for (const subDir of ["archive", "posts"]) {
  const rels = getArticleRels(subDir);

  for (const rel of rels) {
    // Read content for each locale
    const localeData = {};
    for (const [locale, dirs] of Object.entries(LOCALE_DIRS)) {
      const fp = join(DOCS, dirs[subDir], rel);
      try {
        const content = readFileSync(fp, "utf-8");
        const tags = getTags(content);
        const cats = new Set(
          CATEGORIES.filter((c) => matchesCategory(tags, c)).map((c) => c.id),
        );
        localeData[locale] = { fp, tags, cats };
      } catch {
        localeData[locale] = null;
      }
    }

    // Compute union of categories across present locales
    const unionCats = new Set();
    for (const data of Object.values(localeData)) {
      if (data) for (const c of data.cats) unionCats.add(c);
    }

    // Fix missing categories per locale
    for (const [locale, data] of Object.entries(localeData)) {
      if (!data) continue;
      for (const catId of unionCats) {
        if (SKIP_CATS.has(catId)) continue; // already balanced globally
        if (data.cats.has(catId)) continue;

        const tagToAdd = CANONICAL_TAG[catId]?.(locale);
        if (!tagToAdd) continue;

        // Double-check not already present (case-insensitive)
        if (data.tags.some((t) => t.toLowerCase() === tagToAdd.toLowerCase()))
          continue;

        totalFixed++;
        totalFiles++;
        fixLog.push(`  ${locale} +${tagToAdd} (${catId}) → ${subDir}/${rel}`);

        if (!DRY_RUN) {
          addTagToFile(data.fp, tagToAdd);
          // Re-read tags so subsequent category checks use updated data
          try {
            const updated = readFileSync(data.fp, "utf-8");
            data.tags = getTags(updated);
            data.cats = new Set(
              CATEGORIES.filter((c) => matchesCategory(data.tags, c)).map(
                (c) => c.id,
              ),
            );
          } catch {}
        }
      }
    }
  }
}

// Print fix log (first 40 lines)
for (const line of fixLog.slice(0, 40)) console.log(line);
if (fixLog.length > 40)
  console.log(`  ... and ${fixLog.length - 40} more changes`);

console.log(
  `\n${DRY_RUN ? "[DRY RUN] " : ""}Tag sync complete: ${totalFixed} tags added across ${new Set(fixLog.map((l) => l.split("→")[1]?.trim())).size} articles`,
);
