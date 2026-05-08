import { defineConfig } from "vitepress";

function escapeMustache(content: string): string {
  return content
    .replace(/\{\{/g, "&#123;&#123;")
    .replace(/\}\}/g, "&#125;&#125;");
}

export default defineConfig({
  base: "/blog/",
  title: "前端成长记录",
  description: "一个前端工程师从 2018 年开始的学习与成长记录",
  lang: "zh-CN",
  themeConfig: {
    nav: [
      { text: "首页", link: "/" },
      { text: "最新文章", link: "/posts/" },
      { text: "📚 归档 (2018-2025)", link: "/archive/" },
    ],
    outline: {
      label: "本文目录",
    },
    docFooter: {
      prev: "上一篇",
      next: "下一篇",
    },
    darkModeSwitchLabel: "深色模式",
    sidebarMenuLabel: "菜单",
    returnToTopLabel: "返回顶部",
    footer: {
      message: "MIT Licensed",
      copyright: "前端成长记录 2018 - 2026",
    },
  },
  markdown: {
    theme: {
      light: "github-light",
      dark: "github-dark",
    },
    config(md) {
      // 只在普通文本 token 上转义 {{ }}，代码块由渲染器后置处理
      md.core.ruler.push("escape-mustache-in-markdown", (state) => {
        for (const token of state.tokens) {
          // fence/code_block 由渲染器 override 处理，跳过
          if (token.type === "fence" || token.type === "code_block") continue;

          if (
            typeof token.content === "string" &&
            token.content.includes("{{")
          ) {
            token.content = escapeMustache(token.content);
          }

          if (token.type === "inline" && token.children) {
            for (const child of token.children) {
              // code_inline 由渲染器 override 处理，跳过
              if (child.type === "code_inline") continue;

              if (
                typeof child.content === "string" &&
                child.content.includes("{{")
              ) {
                child.content = escapeMustache(child.content);
              }
            }
          }
        }
      });

      // 在 shiki 高亮后的 HTML 输出中替换 {{ }}
      // 不能在原始 content 上改，否则 escapeHtml 会把 & 二次转义成 &amp; 导致显示乱码
      const origFence = md.renderer.rules.fence;
      md.renderer.rules.fence = (...args) => {
        const html = origFence ? origFence(...args) : "";
        return html
          .replace(/\{\{/g, "&#123;&#123;")
          .replace(/\}\}/g, "&#125;&#125;");
      };

      const origCodeInline = md.renderer.rules.code_inline;
      md.renderer.rules.code_inline = (...args) => {
        const html = origCodeInline ? origCodeInline(...args) : "";
        return html
          .replace(/\{\{/g, "&#123;&#123;")
          .replace(/\}\}/g, "&#125;&#125;");
      };
    },
  },
});
