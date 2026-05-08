import DefaultTheme from "vitepress/theme";
import PostList from "./PostList.vue";
import ArchiveYear from "./ArchiveYear.vue";
import type { Theme } from "vitepress";

export default {
  extends: DefaultTheme,
  enhanceApp({ app }) {
    app.component("PostList", PostList);
    app.component("ArchiveYear", ArchiveYear);
  },
} satisfies Theme;
