import { createContentLoader, type SiteConfig } from "vitepress";
import { Feed } from "feed";
import { writeFileSync, mkdirSync } from "fs";
import path from "path";

const SITE_URL = "https://fonghehe.github.io/blog";

interface FeedConfig {
  globs: string[];
  title: string;
  description: string;
  language: string;
  outFile: string;
}

const FEEDS: FeedConfig[] = [
  {
    globs: ["posts/**/*.md", "archive/**/*.md"],
    title: "前端成长记录",
    description:
      "一个前端工程师从 2018 年开始的学习与成长记录。1200+ 篇深度文章，涵盖框架原理、工程化实践与前沿探索。",
    language: "zh-CN",
    outFile: "rss.xml",
  },
  {
    globs: ["en/posts/**/*.md", "en/archive/**/*.md"],
    title: "Frontend Growth Blog",
    description:
      "A frontend engineer's learning journey since 2018. 1200+ in-depth articles on framework internals, engineering practices and cutting-edge exploration.",
    language: "en",
    outFile: "en/rss.xml",
  },
  {
    globs: ["ja/posts/**/*.md", "ja/archive/**/*.md"],
    title: "フロントエンド成長記録",
    description:
      "2018年から始まるフロントエンドエンジニアの学習・成長記録。フレームワーク原理、エンジニアリング実践、最新技術探索などの1200+記事。",
    language: "ja",
    outFile: "ja/rss.xml",
  },
];

async function buildFeed(cfg: FeedConfig, siteConfig: SiteConfig) {
  const feed = new Feed({
    title: cfg.title,
    description: cfg.description,
    id: SITE_URL,
    link: SITE_URL,
    language: cfg.language,
    copyright: `MIT Licensed - 前端成长记录 2018-2026`,
    updated: new Date(),
  });

  const posts = await createContentLoader(cfg.globs, { render: false }).load();

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

  const outPath = path.join(siteConfig.outDir, cfg.outFile);
  mkdirSync(path.dirname(outPath), { recursive: true });
  writeFileSync(outPath, feed.rss2());
}

export async function buildRSS(config: SiteConfig) {
  await Promise.all(FEEDS.map((cfg) => buildFeed(cfg, config)));
}
