import { defineConfig } from "vitepress";
import { buildRSS } from "./rss";
import { zh } from "./locales/zh";
import { en } from "./locales/en";
import { ja } from "./locales/ja";
import { zhTw } from "./locales/zh-tw";
import { zhHk } from "./locales/zh-hk";

// BUILD_MODE splits the build into two lighter passes to avoid OOM:
//   'main'        → zh + en + ja
//   'zh-variants' → zh + zh-tw + zh-hk
//   undefined     → all 5 (dev mode only, needs lots of RAM)
const BUILD_MODE = process.env.BUILD_MODE as "main" | "zh-variants" | undefined;

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
  title: "前端成长记录",
  description: "一个前端工程师从 2018 年开始的学习与成长记录",
  ignoreDeadLinks: true,
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
    ["meta", { property: "og:type", content: "website" }],
    ["meta", { property: "og:title", content: "前端成长记录" }],
    [
      "meta",
      {
        property: "og:description",
        content:
          "一个前端工程师从 2018 年开始的学习与成长记录。1200+ 篇深度文章，涵盖框架原理、工程化实践与前沿探索。",
      },
    ],
    [
      "meta",
      { property: "og:url", content: "https://fonghehe.github.io/blog/" },
    ],
    ["meta", { property: "og:locale", content: "zh_CN" }],
    ["meta", { name: "twitter:card", content: "summary_large_image" }],
    ["meta", { name: "twitter:title", content: "前端成长记录" }],
    [
      "meta",
      {
        name: "twitter:description",
        content:
          "一个前端工程师从 2018 年开始的学习与成长记录。1200+ 篇深度文章，涵盖框架原理、工程化实践与前沿探索。",
      },
    ],
  ],
  sitemap: {
    hostname: "https://fonghehe.github.io/blog/",
  },
  locales: allLocales,
  themeConfig: {
    search: {
      provider: "local",
    },
    footer: {
      message: "MIT Licensed",
      copyright: "前端成长记录 2018 - 2026",
    },
  },
  markdown: {
    // 完全替换 shiki — 用轻量 highlighter 直接输出 <pre><code>
    // shiki 是构建最大瓶颈：加载语法文件 + token 化 7000 篇文章的代码块
    highlight(code, lang) {
      const escaped = code
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/\{\{/g, "&#123;&#123;")
        .replace(/\}\}/g, "&#125;&#125;");
      return `<pre class="language-${lang}"><code>${escaped}</code></pre>`;
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
