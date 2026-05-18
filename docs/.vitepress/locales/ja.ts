import type { DefaultTheme, LocaleSpecificConfig } from "vitepress";

type LocaleConfig = LocaleSpecificConfig<DefaultTheme.Config> & {
  label: string;
  link?: string;
};

export const ja: LocaleConfig = {
  label: "日本語",
  lang: "ja-JP",
  themeConfig: {
    nav: [
      { text: "ホーム", link: "/ja/" },
      { text: "最新記事", link: "/ja/posts/" },
      { text: "📚 アーカイブ (2018-2025)", link: "/ja/archive/" },
    ],
    outline: { label: "目次" },
    docFooter: { prev: "前の記事", next: "次の記事" },
    darkModeSwitchLabel: "ダークモード",
    sidebarMenuLabel: "メニュー",
    returnToTopLabel: "トップに戻る",
  },
};
