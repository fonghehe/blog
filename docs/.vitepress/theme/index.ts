import { h, defineAsyncComponent } from "vue";
import DefaultTheme from "vitepress/theme";
import PostList from "./PostList.vue";
import ArchiveYear from "./ArchiveYear.vue";
import ArchiveMonth from "./ArchiveMonth.vue";
import ArticleTitle from "./ArticleTitle.vue";
import type { Theme } from "vitepress";

// Lazy-load Giscus — it's only visible at page bottom and loads external script
const Giscus = defineAsyncComponent(() => import("./Giscus.vue"));

export default {
  extends: DefaultTheme,
  Layout() {
    return h(DefaultTheme.Layout, null, {
      "doc-before": () => h(ArticleTitle),
      "doc-after": () => h(Giscus),
    });
  },
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
    }
  },
} satisfies Theme;
