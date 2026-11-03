import { createContentLoader, type SiteConfig } from "vitepress";
import { Feed } from "feed";
import { writeFileSync, mkdirSync } from "fs";
import path from "path";

import { articleUrl, publicationDate, selectFeedPosts, LOCALES } from "../../scripts/lib/publishing.mjs";

interface FeedConfig {
  globs: string[];
  title: string;
  description: string;
  language: string;
  outFile: string;
}

export const FEEDS: FeedConfig[] = [
  {
    globs: ["posts/**/*.md", "archive/**/*.md"],
    title: "前端成长记录",
    description:
      "一个前端工程师从 2018 年开始的学习与成长记录。1,528 篇深度文章，涵盖框架原理、工程化实践与前沿探索。",
    language: "zh-CN",
    outFile: "rss.xml",
  },
  {
    globs: ["en/posts/**/*.md", "en/archive/**/*.md"],
    title: "Frontend Growth Blog",
    description:
      "A frontend engineer's learning journey since 2018. 1,528 in-depth articles on framework internals, engineering practices and cutting-edge exploration.",
    language: "en",
    outFile: "en/rss.xml",
  },
  {
    globs: ["ja/posts/**/*.md", "ja/archive/**/*.md"],
    title: "フロントエンド成長記録",
    description:
      "2018年から始まるフロントエンドエンジニアの学習・成長記録。フレームワーク原理、エンジニアリング実践、最新技術探索などの1,528記事。",
    language: "ja",
    outFile: "ja/rss.xml",
  },
  ...LOCALES.filter((locale) => ["zh-tw", "zh-hk"].includes(locale.prefix)).map((locale) => ({
    globs: [`${locale.prefix}/posts/**/*.md`, `${locale.prefix}/archive/**/*.md`],
    title: locale.title,
    description: locale.description,
    language: locale.lang,
    outFile: `${locale.prefix}/rss.xml`,
  })),
];

export function createRssFeed(cfg: FeedConfig, posts: { url: string; frontmatter: Record<string, any> }[], now = new Date()) {
  const sorted = selectFeedPosts(posts, now);
  const prefix = cfg.outFile.replace(/rss\.xml$/, "");
  const channelUrl = articleUrl(prefix);
  const feed = new Feed({
    title: cfg.title,
    description: cfg.description,
    id: channelUrl,
    link: channelUrl,
    language: cfg.language,
    copyright: `MIT Licensed - ${cfg.title} 2018-2026`,
    updated: sorted.length ? publicationDate(sorted[0].frontmatter.date) : now,
    feedLinks: { rss2: articleUrl(cfg.outFile) },
    image: articleUrl("social-card.png"),
  });
  for (const post of sorted) {
    const title = String(post.frontmatter.title || "").replace(/^["\u201c]|["\u201d]$/g, "");
    const url = articleUrl(post.url);
    feed.addItem({
      title, id: url, link: url,
      date: publicationDate(post.frontmatter.date),
      description: typeof post.frontmatter.description === "string" ? post.frontmatter.description : undefined,
    });
  }
  return feed;
}

async function buildFeed(cfg: FeedConfig, siteConfig: SiteConfig) {
  const posts = await createContentLoader(cfg.globs, { render: false }).load();
  const outPath = path.join(siteConfig.outDir, cfg.outFile);
  mkdirSync(path.dirname(outPath), { recursive: true });
  writeFileSync(outPath, createRssFeed(cfg, posts).rss2());
}

export async function buildRSS(config: SiteConfig) {
  await Promise.all(FEEDS.map((cfg) => buildFeed(cfg, config)));
}
