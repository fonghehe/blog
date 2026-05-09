import { createContentLoader } from "vitepress";

export interface Post {
  title: string;
  url: string;
  date: string;
  tags: string[];
}

declare const data: Post[];
export { data };

export default createContentLoader(["posts/**/*.md", "archive/**/*.md"], {
  transform(raw): Post[] {
    return raw
      .filter((p) => {
        if (!p.frontmatter?.date) return false;
        if (p.url.endsWith("/")) return false;
        return true;
      })
      .map((p) => ({
        title: String(p.frontmatter.title || "").replace(/^[""]|[""]$/g, ""),
        url: p.url,
        date: String(p.frontmatter.date),
        tags: Array.isArray(p.frontmatter.tags)
          ? (p.frontmatter.tags as string[]).map((t) => String(t).trim())
          : [],
      }))
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  },
});
