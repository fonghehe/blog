import { h } from "vue";
import DefaultTheme from "vitepress/theme";
import PostList from "./PostList.vue";
import ArchiveYear from "./ArchiveYear.vue";
import ArticleTitle from "./ArticleTitle.vue";
import Giscus from "./Giscus.vue";
import type { Theme } from "vitepress";

export default {
  extends: DefaultTheme,
  Layout() {
    return h(DefaultTheme.Layout, null, {
      "doc-before": () => h(ArticleTitle),
      "doc-after": () => h(Giscus),
    });
  },
  enhanceApp({ app }) {
    app.component("PostList", PostList);
    app.component("ArchiveYear", ArchiveYear);
  },
} satisfies Theme;
