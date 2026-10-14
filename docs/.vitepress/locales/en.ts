import type { DefaultTheme, LocaleSpecificConfig } from "vitepress";

type LocaleConfig = LocaleSpecificConfig<DefaultTheme.Config> & {
  label: string;
  link?: string;
};

export const en: LocaleConfig = {
  label: "English",
  lang: "en-US",
  themeConfig: {
    nav: [
      { text: "Home", link: "/en/" },
      { text: "Latest Posts", link: "/en/posts/" },
      { text: "📚 Archive (2018-2025)", link: "/en/archive/" },
      { text: "Reading paths", link: "/en/guides" },
      { text: "About & editorial policy", link: "/en/about" },
      { text: "RSS", link: "/blog/en/rss.xml" },
    ],
    outline: { label: "On this page" },
    docFooter: { prev: "Previous", next: "Next" },
    darkModeSwitchLabel: "Dark Mode",
    sidebarMenuLabel: "Menu",
    returnToTopLabel: "Back to top",
  },
};
