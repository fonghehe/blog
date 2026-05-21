import { h, defineAsyncComponent, nextTick } from "vue";
import DefaultTheme from "vitepress/theme";
import PostList from "./PostList.vue";
import ArchiveYear from "./ArchiveYear.vue";
import ArchiveMonth from "./ArchiveMonth.vue";
import ArticleTitle from "./ArticleTitle.vue";
import ReadingProgress from "./ReadingProgress.vue";
import NotFound from "./NotFound.vue";
// Code highlighting CSS (atom-one-dark theme) — loads once, works for all pages
import "./code-highlight.css";
import type { Theme } from "vitepress";

// Lazy-load Giscus — it's only visible at page bottom and loads external script
const Giscus = defineAsyncComponent(() => import("./Giscus.vue"));

// ── Client-side code syntax highlighting (lazy-loaded, only common langs) ──
let hljsInstance: typeof import("highlight.js").default | null = null;

async function applyHighlighting() {
  if (typeof window === "undefined") return;
  try {
    if (!hljsInstance) {
      const { default: hljs } = await import("highlight.js/lib/core");
      const [js, ts, css, xml, bash, json, py, md, yaml, diff, sql, rust, go] =
        await Promise.all([
          import("highlight.js/lib/languages/javascript"),
          import("highlight.js/lib/languages/typescript"),
          import("highlight.js/lib/languages/css"),
          import("highlight.js/lib/languages/xml"), // html
          import("highlight.js/lib/languages/bash"),
          import("highlight.js/lib/languages/json"),
          import("highlight.js/lib/languages/python"),
          import("highlight.js/lib/languages/markdown"),
          import("highlight.js/lib/languages/yaml"),
          import("highlight.js/lib/languages/diff"),
          import("highlight.js/lib/languages/sql"),
          import("highlight.js/lib/languages/rust"),
          import("highlight.js/lib/languages/go"),
        ]);
      hljs.registerLanguage("javascript", js.default);
      hljs.registerLanguage("js", js.default);
      hljs.registerLanguage("jsx", js.default);
      hljs.registerLanguage("typescript", ts.default);
      hljs.registerLanguage("ts", ts.default);
      hljs.registerLanguage("tsx", ts.default);
      hljs.registerLanguage("css", css.default);
      hljs.registerLanguage("html", xml.default);
      hljs.registerLanguage("xml", xml.default);
      hljs.registerLanguage("bash", bash.default);
      hljs.registerLanguage("sh", bash.default);
      hljs.registerLanguage("shell", bash.default);
      hljs.registerLanguage("json", json.default);
      hljs.registerLanguage("python", py.default);
      hljs.registerLanguage("py", py.default);
      hljs.registerLanguage("markdown", md.default);
      hljs.registerLanguage("yaml", yaml.default);
      hljs.registerLanguage("yml", yaml.default);
      hljs.registerLanguage("diff", diff.default);
      hljs.registerLanguage("sql", sql.default);
      hljs.registerLanguage("rust", rust.default);
      hljs.registerLanguage("rs", rust.default);
      hljs.registerLanguage("go", go.default);
      hljsInstance = hljs;
    }
    document.querySelectorAll("pre code").forEach((block) => {
      hljsInstance!.highlightElement(block as HTMLElement);
    });
  } catch {
    // highlight.js unavailable — graceful degradation
  }
}

export default {
  extends: DefaultTheme,
  Layout() {
    return h(DefaultTheme.Layout, null, {
      "layout-top": () => h(ReadingProgress),
      "doc-before": () => h(ArticleTitle),
      "doc-after": () => h(Giscus),
    });
  },
  NotFound: () => h(NotFound),
  enhanceApp({ app, router }) {
    app.component("PostList", PostList);
    app.component("ArchiveYear", ArchiveYear);
    app.component("ArchiveMonth", ArchiveMonth);

    // Two separate builds (main: zh/en/ja; zh-variants: zh-tw/zh-hk) produce
    // incompatible app.js bundles. SPA navigation across the boundary causes
    // hydration mismatches and Vue internal crashes. Force a full page reload
    // whenever the user navigates between the two build groups.
    if (typeof window !== "undefined") {
      const isZhVariant = (path: string) => /\/(zh-tw|zh-hk)(\/|$)/.test(path);
      router.onBeforeRouteChange = (to: string) => {
        if (isZhVariant(to) !== isZhVariant(window.location.pathname)) {
          window.location.href = to;
          return false;
        }
      };

      // Apply code highlighting after each route change
      router.onAfterRouteChanged = () => {
        nextTick(() => applyHighlighting());
      };
      // Apply on initial page load
      nextTick(() => applyHighlighting());
    }
  },
} satisfies Theme;
