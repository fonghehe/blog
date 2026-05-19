import { createContentLoader, type SiteConfig } from "vitepress";
import { Feed } from "feed";
import { writeFileSync, mkdirSync } from "fs";
import path from "path";

const SITE_URL = "https://fonghehe.github.io/blog";
const FEED_TITLE = "前端成长记录";
const FEED_DESCRIPTION =
  "一个前端工程师从 2018 年开始的学习与成长记录。1200+ 篇深度文章，涵盖框架原理、工程化实践与前沿探索。";

export async function buildRSS(config: SiteConfig) {
  const feed = new Feed({
    title: FEED_TITLE,
    description: FEED_DESCRIPTION,
    id: SITE_URL,
    link: SITE_URL,
    language: "zh-CN",
    copyright: `MIT Licensed - ${FEED_TITLE} 2018-2026`,
    updated: new Date(),
  });

  const posts = await createContentLoader(
    ["posts/**/*.md", "archive/**/*.md"],
    { render: false },
  ).load();

  const sorted = posts
    .filter((p) => p.frontmatter?.date && !p.url.endsWith("/"))
    .sort(
      (a, b) =>
        new Date(b.frontmatter.date as string).getTime() -
        new Date(a.frontmatter.date as string).getTime(),
    )
    .slice(0, 50);

  for (const post of sorted) {
    const title = String(post.frontmatter.title || "").replace(
      /^[""\u201c]|[""\u201d]$/g,
      "",
    );
    const date = new Date(post.frontmatter.date as string);
    const url = `${SITE_URL}${post.url}`;

    feed.addItem({
      title,
      id: url,
      link: url,
      date,
      description:
        typeof post.frontmatter.description === "string"
          ? post.frontmatter.description
          : undefined,
    });
  }

  const outDir = config.outDir;
  mkdirSync(outDir, { recursive: true });
  writeFileSync(path.join(outDir, "rss.xml"), feed.rss2());
}
