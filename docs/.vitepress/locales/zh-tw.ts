import type { DefaultTheme, LocaleSpecificConfig } from "vitepress";

type LocaleConfig = LocaleSpecificConfig<DefaultTheme.Config> & {
  label: string;
  link?: string;
};

export const zhTw: LocaleConfig = {
  label: "繁體中文（台）",
  lang: "zh-TW",
  themeConfig: {
    nav: [
      { text: "首頁", link: "/zh-tw/" },
      { text: "最新文章", link: "/zh-tw/posts/" },
      { text: "📚 文章歸檔 (2018-2025)", link: "/zh-tw/archive/" },
      { text: "閱讀路線", link: "/zh-tw/guides" },
      { text: "關於與內容說明", link: "/zh-tw/about" },
      { text: "RSS", link: "/blog/zh-tw/rss.xml" },
    ],
    outline: { label: "本文目錄" },
    docFooter: { prev: "上一篇", next: "下一篇" },
    darkModeSwitchLabel: "深色模式",
    sidebarMenuLabel: "選單",
    returnToTopLabel: "回到頂部",
  },
};
