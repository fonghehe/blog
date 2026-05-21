import type { DefaultTheme, LocaleSpecificConfig } from "vitepress";

type LocaleConfig = LocaleSpecificConfig<DefaultTheme.Config> & {
  label: string;
  link?: string;
};

export const zhHk: LocaleConfig = {
  label: "繁體中文（港）",
  lang: "zh-HK",
  themeConfig: {
    nav: [
      { text: "首頁", link: "/zh-hk/" },
      { text: "最新文章", link: "/zh-hk/posts/" },
      { text: "📚 文章歸檔 (2018-2025)", link: "/zh-hk/archive/" },
    ],
    outline: { label: "本文目錄" },
    docFooter: { prev: "上一篇", next: "下一篇" },
    darkModeSwitchLabel: "深色模式",
    sidebarMenuLabel: "選單",
    returnToTopLabel: "返回頂部",
  },
};
