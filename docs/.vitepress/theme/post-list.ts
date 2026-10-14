export interface Filters {
  query: string;
  category: string | null;
  page: number;
}

interface SearchablePost {
  title: string;
  description: string;
  tags: string[];
}

interface CategoryMatch {
  id: string;
  matchTags: string[];
}

export function readFilters(search: string, categories: string[]): Filters {
  const params = new URLSearchParams(search);
  const category = params.get("category");
  const value = params.get("page") || "1";
  const page = /^\d+$/.test(value) ? Number(value) : 1;
  return {
    query: (params.get("q") || "").slice(0, 200),
    category: category && categories.includes(category) ? category : null,
    page: Number.isSafeInteger(page) && page > 0 ? page : 1,
  };
}

export function writeFilters(href: string, filters: Filters): string {
  const url = new URL(href, "https://blog.invalid");
  for (const [key, value] of [
    ["q", filters.query.trim()],
    ["category", filters.category || ""],
    ["page", filters.page > 1 ? String(filters.page) : ""],
  ]) {
    if (value) url.searchParams.set(key, value);
    else url.searchParams.delete(key);
  }
  return url.pathname + url.search + url.hash;
}

export function clampPage(page: number, totalPages: number): number {
  return Math.max(1, Math.min(page, totalPages || 1));
}

export function filterPosts<T extends SearchablePost>(
  posts: T[],
  filters: Pick<Filters, "query" | "category">,
  categories: CategoryMatch[],
): T[] {
  const category = categories.find((c) => c.id === filters.category);
  const terms = filters.query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  return posts.filter((post) => {
    if (category && !post.tags.some((tag) =>
      category.matchTags.some((match) => match.toLowerCase() === tag.toLowerCase()),
    )) return false;
    const text = [post.title, post.description, ...post.tags].join(" ").toLowerCase();
    return terms.every((term) => text.includes(term));
  });
}

export function localePrefix(url: string): string {
  return url.match(/^\/(en|ja|zh-tw|zh-hk)(?:\/|$)/)?.[0].replace(/\/$/, "") || "";
}

export function relatedPosts<T extends { url: string; tags: string[]; date: string }>(
  posts: T[], url: string, tags: string[], limit = 3,
): T[] {
  const currentTags = new Set(tags.map((tag) => tag.toLowerCase()));
  return posts
    .filter((p) => p.url !== url && localePrefix(p.url) === localePrefix(url))
    .map((post) => ({ post, score: post.tags.filter((tag) => currentTags.has(tag.toLowerCase())).length }))
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score || b.post.date.localeCompare(a.post.date))
    .slice(0, limit)
    .map(({ post }) => post);
}
