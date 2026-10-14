export function languageKey(lang: string): "zh" | "en" | "ja" | "tw" | "hk" {
  if (lang.startsWith("en")) return "en";
  if (lang.startsWith("ja")) return "ja";
  if (lang === "zh-TW") return "tw";
  if (lang === "zh-HK") return "hk";
  return "zh";
}

const copy = {
  zh: {
    title: "全部文章", clear: "清除筛选", search: "搜索标题、摘要或标签", all: "全部分类",
    engineering: "工程化", performance: "性能优化", testing: "测试", security: "安全", mobile: "移动端",
    pagination: "文章分页", page: "页码", go: "跳转", related: "继续阅读", updated: "更新于", verified: "验证于",
    version: "适用版本", review: "历史文章：请结合文中的适用版本与官方文档阅读。", reviewNeeded: "本文仍在内容复核中，请结合官方资料检查示例与适用条件。", policy: "内容维护说明",
    read: "分钟阅读", words: "字／词", progress: "阅读进度", notFound: "页面不见了",
    notFoundDesc: "页面可能已迁移，或链接有误。你可以从下面的入口重新出发。", home: "返回首页",
    posts: "全部文章", archive: "文章归档", rss: "订阅 RSS", about: "关于与内容说明", guides: "阅读路线",
    latest: "近期文章", start: "从这里开始", selected: "精选阅读", series: "同系列文章",
  },
  en: {
    title: "All articles", clear: "Clear filters", search: "Search titles, summaries or tags", all: "All categories",
    engineering: "Engineering", performance: "Performance", testing: "Testing", security: "Security", mobile: "Mobile",
    pagination: "Article pages", page: "Page number", go: "Go", related: "Keep reading", updated: "Updated", verified: "Verified",
    version: "Applies to", review: "Historical article: check the versions discussed and the official documentation.", reviewNeeded: "This article is under editorial review. Check examples and assumptions against official sources.", policy: "Editorial policy",
    read: "min read", words: "words / characters", progress: "Reading progress", notFound: "Page not found",
    notFoundDesc: "The page may have moved, or the link may be incorrect. Continue with one of these links.", home: "Back home",
    posts: "All articles", archive: "Archive", rss: "Subscribe via RSS", about: "About & editorial policy", guides: "Reading paths",
    latest: "Recent articles", start: "Start here", selected: "Selected reading", series: "In this series",
  },
  ja: {
    title: "すべての記事", clear: "絞り込みを解除", search: "タイトル・概要・タグで検索", all: "すべてのカテゴリ",
    engineering: "開発ツール", performance: "パフォーマンス", testing: "テスト", security: "セキュリティ", mobile: "モバイル",
    pagination: "記事のページ", page: "ページ番号", go: "移動", related: "あわせて読む", updated: "更新日", verified: "検証日",
    version: "対象バージョン", review: "過去の記事です。対象バージョンと公式ドキュメントを確認してください。", reviewNeeded: "この記事は内容確認中です。公式資料で例と前提条件を確認してください。", policy: "編集方針",
    read: "分で読めます", words: "文字／語", progress: "読書の進捗", notFound: "ページが見つかりません",
    notFoundDesc: "ページが移動したか、リンクが間違っている可能性があります。以下からお進みください。", home: "ホームへ",
    posts: "すべての記事", archive: "アーカイブ", rss: "RSS を購読", about: "このブログ・編集方針", guides: "学習ルート",
    latest: "最近の記事", start: "はじめに", selected: "おすすめの記事", series: "同じシリーズ",
  },
  tw: {
    title: "全部文章", clear: "清除篩選", search: "搜尋標題、摘要或標籤", all: "全部分類",
    engineering: "工程化", performance: "效能最佳化", testing: "測試", security: "安全", mobile: "行動開發",
    pagination: "文章分頁", page: "頁碼", go: "跳轉", related: "繼續閱讀", updated: "更新於", verified: "驗證於",
    version: "適用版本", review: "歷史文章：請搭配文中的適用版本與官方文件閱讀。", reviewNeeded: "本文仍在內容複核中，請搭配官方資料檢查範例與適用條件。", policy: "內容維護說明",
    read: "分鐘閱讀", words: "字／詞", progress: "閱讀進度", notFound: "找不到頁面",
    notFoundDesc: "頁面可能已移動，或連結有誤。你可以從下列入口繼續閱讀。", home: "返回首頁",
    posts: "全部文章", archive: "文章歸檔", rss: "訂閱 RSS", about: "關於與內容說明", guides: "閱讀路線",
    latest: "近期文章", start: "從這裡開始", selected: "精選閱讀", series: "同系列文章",
  },
  hk: {
    title: "全部文章", clear: "清除篩選", search: "搜尋標題、摘要或標籤", all: "全部分類",
    engineering: "工程化", performance: "效能優化", testing: "測試", security: "安全", mobile: "流動開發",
    pagination: "文章分頁", page: "頁碼", go: "跳轉", related: "繼續閱讀", updated: "更新於", verified: "驗證於",
    version: "適用版本", review: "歷史文章：請配合文中的適用版本及官方文件閱讀。", reviewNeeded: "本文仍在內容覆核中，請配合官方資料檢查範例及適用條件。", policy: "內容維護說明",
    read: "分鐘閱讀", words: "字／詞", progress: "閱讀進度", notFound: "搵唔到頁面",
    notFoundDesc: "頁面可能已搬移，或連結有誤。你可以從以下入口繼續閱讀。", home: "返回首頁",
    posts: "全部文章", archive: "文章歸檔", rss: "訂閱 RSS", about: "關於與內容說明", guides: "閱讀路線",
    latest: "近期文章", start: "由這裡開始", selected: "精選閱讀", series: "同系列文章",
  },
};

export function uiCopy(lang: string) { return copy[languageKey(lang)]; }

export function formatArticleDate(value: unknown, lang: string): string {
  const date = (value instanceof Date ? value.toISOString() : String(value ?? "")).slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return "";
  return new Intl.DateTimeFormat(lang, {
    year: "numeric", month: "short", day: "numeric", timeZone: "UTC",
  }).format(new Date(date + "T00:00:00Z"));
}
