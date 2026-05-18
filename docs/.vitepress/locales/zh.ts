import type { DefaultTheme, LocaleSpecificConfig } from "vitepress";

type LocaleConfig = LocaleSpecificConfig<DefaultTheme.Config> & {
  label: string;
  link?: string;
};

export const zh: LocaleConfig = {
  label: "中文",
  lang: "zh-CN",
  themeConfig: {
    nav: [
      { text: "首页", link: "/" },
      { text: "最新文章", link: "/posts/" },
      { text: "📚 归档 (2018-2025)", link: "/archive/" },
    ],
    outline: { label: "本文目录" },
    docFooter: { prev: "上一篇", next: "下一篇" },
    darkModeSwitchLabel: "深色模式",
    sidebarMenuLabel: "菜单",
    returnToTopLabel: "返回顶部",
  },
};
