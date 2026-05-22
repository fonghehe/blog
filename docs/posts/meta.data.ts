import { createContentLoader, type ContentData } from "vitepress";
import { type Post, normalizeTag } from "./meta";

// Re-export for convenience
export type { Post };

function normalizeDateValue(raw: unknown): string {
  if (raw instanceof Date) {
    return raw.toISOString();
  }
  if (typeof raw !== "string") {
    return "";
  }
  const trimmed = raw.trim();
  if (!trimmed) {
    return "";
  }
  const normalized = trimmed.replace(
    /^([0-9]{4}-[0-9]{2}-[0-9]{2})[ ]+/,
    "$1T",
  );
  return /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(normalized)
    ? `${normalized}T00:00:00`
    : normalized;
}

// ─── Data loader (.data.ts suffix required by VitePress) ─────────────────────

declare const data: Post[];
export { data };

// Only load content patterns relevant to current build mode to save memory
const BUILD_MODE = process.env.BUILD_MODE as "main" | "zh-variants" | undefined;

const basePatterns = ["posts/**/*.md", "archive/**/*.md"];
const enJaPatterns = [
  "en/posts/**/*.md",
  "en/archive/**/*.md",
  "ja/posts/**/*.md",
  "ja/archive/**/*.md",
];
const zhVariantPatterns = [
  "zh-tw/posts/**/*.md",
  "zh-tw/archive/**/*.md",
  "zh-hk/posts/**/*.md",
  "zh-hk/archive/**/*.md",
];

const contentPatterns =
  BUILD_MODE === "main"
    ? [...basePatterns, ...enJaPatterns]
    : BUILD_MODE === "zh-variants"
      ? [...basePatterns, ...zhVariantPatterns]
      : [...basePatterns, ...enJaPatterns, ...zhVariantPatterns];

export default createContentLoader(contentPatterns, {
  // No longer need includeSrc — readingTime and description are pre-computed
  // into frontmatter by scripts/precompute-meta.js
  // This saves ~200-400MB memory (no longer loading 7000+ full article texts)
  transform(raw: ContentData[]): Post[] {
    return raw
      .filter((p) => {
        if (!p.frontmatter?.date) return false;
        if (p.url.endsWith("/")) return false;
        return true;
      })
      .map((p) => {
        const rawTitle = String(p.frontmatter.title || "").replace(
          /^[""\u201c]|[""\u201d]$/g,
          "",
        );
        return {
          title: rawTitle,
          url: p.url,
          date: normalizeDateValue(p.frontmatter.date),
          tags: Array.isArray(p.frontmatter.tags)
            ? (p.frontmatter.tags as string[]).map((t) => normalizeTag(t))
            : [],
          description: String(p.frontmatter.description || ""),
          readingTime: Number(p.frontmatter.readingTime) || 1,
        };
      })
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  },
});
