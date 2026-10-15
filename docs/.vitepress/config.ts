import { defineConfig } from "vitepress";
import { createPageHead, renderSearchMarkdown } from "./seo";
import { finalizePwa, LOCALES } from "../../scripts/lib/publishing.mjs";
import { buildRSS } from "./rss";
import { zh } from "./locales/zh";
import { en } from "./locales/en";
import { ja } from "./locales/ja";
import { zhTw } from "./locales/zh-tw";
import { zhHk } from "./locales/zh-hk";
import { readFileSync } from "node:fs";

// Review labels come from the checked-in corpus report, without rewriting every
// historical article's frontmatter or implying that unflagged content is verified.
const reviewPaths = new Set<string>(
  JSON.parse(readFileSync(new URL("../../maintenance/content-baseline.json", import.meta.url), "utf8"))
    .issues.map((issue: string) => issue.split(":")[0]),
);

// BUILD_MODE splits the build into two lighter passes to avoid OOM:
//   'main'        → zh + en + ja
//   'zh-variants' → zh + zh-tw + zh-hk
//   undefined     → all 5 (dev mode only, needs lots of RAM)
const BUILD_MODE = process.env.BUILD_MODE as "main" | "zh-variants" | undefined;

// ── Analytics (Umami) ────────────────────────────────────────────────────────
// Only injected in production builds to avoid polluting analytics with dev traffic.
const IS_PRODUCTION = process.env.NODE_ENV === "production";

const allLocales = {
  root: { ...zh },
  en: { ...en },
  ja: { ...ja },
  "zh-tw": { ...zhTw },
  "zh-hk": { ...zhHk },
};

function escapeMustache(content: string): string {
  return content
    .replace(/\{\{/g, "&#123;&#123;")
    .replace(/\}\}/g, "&#125;&#125;");
}

export default defineConfig({
  base: "/blog/",
  // Share the large page hash map instead of repeating it in every article HTML.
  metaChunk: true,
  title: "前端成长记录",
  description: "一个前端工程师从 2018 年开始的学习与成长记录。1,523 篇深度文章，涵盖框架原理、工程化实践与前沿探索。",
  // The separate content check validates every locale. During a split build,
  // only links into the other build group are absent from VitePress's page set.
  ignoreDeadLinks: BUILD_MODE === "main"
    ? [/^(?:\/blog)?\/(?:zh-tw|zh-hk)\//]
    : BUILD_MODE === "zh-variants"
      ? [/^(?:\/blog)?\/(?:en|ja)\//]
      : false,
  cacheDir:
    BUILD_MODE === "zh-variants"
      ? ".vitepress/cache-zh-variants"
      : ".vitepress/cache",
  outDir:
    BUILD_MODE === "zh-variants"
      ? ".vitepress/dist-zh-variants"
      : ".vitepress/dist",
  srcExclude:
    BUILD_MODE === "main"
      ? ["zh-tw/**/*.md", "zh-hk/**/*.md"]
      : BUILD_MODE === "zh-variants"
        ? ["en/**/*.md", "ja/**/*.md"]
        : [],
  head: [
    ["link", { rel: "icon", href: "/blog/favicon.ico" }],
    ["meta", { name: "theme-color", content: "#3c8772" }],
    ...(IS_PRODUCTION ? [
      ["link", { rel: "manifest", href: "/blog/manifest.webmanifest" }],
      ["script", { src: "/blog/registerSW.js", defer: "" }],
    ] as [string, Record<string, string>][] : []),
    // Umami analytics — only injected in production builds
    ...(IS_PRODUCTION
      ? ([
          [
            "script",
            {
              defer: "",
              src: "https://cloud.umami.is/script.js",
              "data-website-id": "4d310e6b-2d69-42aa-aaa2-c788a664d3c5",
            },
          ],
        ] as [string, Record<string, string>][])
      : []),
  ],
  sitemap: {
    hostname: "https://fonghehe.github.io/blog/",
  },
  transformHead({ pageData, siteConfig }) {
    return createPageHead(pageData, siteConfig.srcDir);
  },
  transformPageData(pageData) {
    if (reviewPaths.has(pageData.relativePath)) pageData.frontmatter.reviewStatus = "needs-review";
  },
  locales: Object.fromEntries(Object.entries(allLocales).map(([key, locale]) => {
    const metadata = LOCALES.find((item) => item.prefix === (key === "root" ? "" : key));
    return [key, { ...locale, title: metadata.title, description: metadata.description }];
  })),
  themeConfig: {
    logo: "/logo.png",
    search: {
      provider: "local",
      options: { _render: renderSearchMarkdown },
    },
    footer: {
      message: "MIT Licensed",
      copyright: "前端成长记录 2018 - 2026",
    },
  },
  markdown: {
    // 完全替换 shiki — 用轻量 highlighter 直接输出 <pre><code>
    // shiki 是构建最大瓶颈：加载语法文件 + token 化 7000 篇文章的代码块
    // 语法高亮由客户端 highlight.js 接管（见 theme/index.ts）
    highlight(code, lang) {
      const escaped = code
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/\{\{/g, "&#123;&#123;")
        .replace(/\}\}/g, "&#125;&#125;");
      const cls = lang ? ` class="language-${lang}"` : "";
      return `<pre class="language-${lang}"><code${cls}>${escaped}</code></pre>`;
    },
    config(md) {
      // 转义非代码区域的 {{ }} 防止 Vue 模板编译报错
      md.core.ruler.push("escape-mustache", (state) => {
        for (const token of state.tokens) {
          if (token.type === "fence" || token.type === "code_block") continue;
          if (token.content?.includes("{{")) {
            token.content = escapeMustache(token.content);
          }
          if (token.type === "inline" && token.children) {
            for (const child of token.children) {
              if (child.type === "code_inline") continue;
              if (child.content?.includes("{{")) {
                child.content = escapeMustache(child.content);
              }
            }
          }
        }
      });
      // code_inline 渲染后也要转义
      const origCodeInline = md.renderer.rules.code_inline;
      md.renderer.rules.code_inline = (...args) => {
        const html = origCodeInline ? origCodeInline(...args) : "";
        return html
          .replace(/\{\{/g, "&#123;&#123;")
          .replace(/\}\}/g, "&#125;&#125;");
      };
    },
  },
  async buildEnd(config) {
    // RSS 只在 main 构建生成
    if (BUILD_MODE !== "zh-variants") {
      await buildRSS(config);
    }
    // Each group has working registration artifacts. Re-run after the merge so
    // the final version includes both apps and all locale shell fallbacks.
    finalizePwa(config.outDir);
  },
  vite: {
    build: {
      reportCompressedSize: false,
      chunkSizeWarningLimit: 4000,
      rollupOptions: {
        output: {
          manualChunks(id: string) {
            if (id.includes("node_modules")) {
              if (id.includes("minisearch")) return "search";
              if (
                id.includes("/vue/") ||
                id.includes("@vue/") ||
                id.includes("vue-demi")
              )
                return "vue";
              return "vendor";
            }
          },
        },
      },
    },
    // 限制并发 worker，降低峰值内存
    worker: {
      rollupOptions: {
        output: {
          inlineDynamicImports: true,
        },
      },
    },
  },
});
