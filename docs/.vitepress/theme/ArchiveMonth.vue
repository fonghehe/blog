<script setup lang="ts">
import { data as allPosts, type Post } from "../../posts/meta.data";
import { computed } from "vue";
import { useRoute, withBase, useData } from "vitepress";

const route = useRoute();
const { lang, localeIndex } = useData();

// 从路由中提取年份和月份，兼容 /archive/2018/01/
// route.path = location.pathname（含 base，如 /blog/ja/archive/2025/01/），正则匹配仍可定位
const match = route.path.match(/\/archive\/(\d{4})\/(\d{2})\//);
const year = match ? parseInt(match[1]) : null;
const month = match ? parseInt(match[2]) : null;

// 使用 VitePress localeIndex 检测当前语言（route.path 含 base，不可直接 startsWith 判断）
const localePrefix = computed(() => {
  const idx = localeIndex.value; // "root" | "en" | "ja" | "zh-tw" | "zh-hk"
  if (idx === "root") return "";
  return `/${idx}`; // "/en", "/ja", "/zh-tw", "/zh-hk"
});

// All locales (including zh-tw/zh-hk) now have their own URL prefixes,
// so no prefix prepending is needed.
const articleLinkPrefix = computed(() => "");

const monthPosts = computed(() => {
  if (!year || !month) return [];
  const prefix = localePrefix.value;
  return allPosts.filter((p) => {
    // Extract date part directly to avoid timezone shifts from new Date()
    const [y, m] = p.date.slice(0, 10).split("-").map(Number);
    const matchDate = y === year && m === month;
    if (prefix) return p.url.startsWith(prefix + "/") && matchDate;
    // zh root: exclude all locale-prefixed variants
    return (
      !p.url.startsWith("/en/") &&
      !p.url.startsWith("/ja/") &&
      !p.url.startsWith("/zh-tw/") &&
      !p.url.startsWith("/zh-hk/") &&
      matchDate
    );
  });
});

// i18n helpers
const t = computed(() => {
  const l = lang.value;
  if (l.startsWith("en")) {
    const monthNames = [
      "January",
      "February",
      "March",
      "April",
      "May",
      "June",
      "July",
      "August",
      "September",
      "October",
      "November",
      "December",
    ];
    return {
      summary: (n: number) =>
        `${monthNames[(month ?? 1) - 1]} ${year} — ${n} article${n !== 1 ? "s" : ""}`,
      backToYear: `← Back to ${year}`,
      backToArchive: "Archive Home →",
      noArticles: `No articles for ${monthNames[(month ?? 1) - 1]} ${year}`,
      fetchFailed: "Failed to get date",
      yearPath: `/en/archive/${year}/`,
      archivePath: "/en/archive/",
    };
  }
  if (l.startsWith("ja")) {
    return {
      summary: (n: number) => `${year}年${month}月 全${n}本`,
      backToYear: `← ${year}年アーカイブへ`,
      backToArchive: "アーカイブトップ →",
      noArticles: `${year}年${month}月の記事はありません`,
      fetchFailed: "日付の取得に失敗しました",
      yearPath: `/ja/archive/${year}/`,
      archivePath: "/ja/archive/",
    };
  }
  if (l === "zh-TW") {
    return {
      summary: (n: number) => `${year} 年 ${month} 月共 ${n} 篇文章`,
      backToYear: `← 返回 ${year} 年歸檔`,
      backToArchive: "返回歸檔首頁 →",
      noArticles: `${year} 年 ${month} 月沒有文章`,
      fetchFailed: "獲取日期失敗",
      yearPath: `/zh-tw/archive/${year}/`,
      archivePath: "/zh-tw/archive/",
    };
  }
  if (l === "zh-HK") {
    return {
      summary: (n: number) => `${year} 年 ${month} 月共 ${n} 篇文章`,
      backToYear: `← 返回 ${year} 年歸檔`,
      backToArchive: "返回歸檔首頁 →",
      noArticles: `${year} 年 ${month} 月冇文章`,
      fetchFailed: "攞唔到日期",
      yearPath: `/zh-hk/archive/${year}/`,
      archivePath: "/zh-hk/archive/",
    };
  }
  return {
    summary: (n: number) => `${year} 年 ${month} 月共 ${n} 篇文章`,
    backToYear: `← 返回 ${year} 年归档`,
    backToArchive: "返回归档首页 →",
    noArticles: `${year} 年 ${month} 月没有文章`,
    fetchFailed: "获取日期失败",
    yearPath: `/archive/${year}/`,
    archivePath: "/archive/",
  };
});

function normalizeDateString(d: string) {
  const trimmed = d.trim();
  if (!trimmed) return "";
  return trimmed.replace(/^([0-9]{4}-[0-9]{2}-[0-9]{2})[ ]+/, "$1T");
}

function formatDate(d: string) {
  if (!d) return "";
  // The date string from meta.data.ts always starts with YYYY-MM-DD —
  // extract it directly to avoid timezone shifts from new Date() parsing.
  const normalized = normalizeDateString(d);
  const datePart = normalized.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(datePart)) return "";
  return datePart;
}
</script>

<template>
  <div class="archive-month-wrap" v-if="year && month && monthPosts.length > 0">
    <p class="month-summary">{{ t.summary(monthPosts.length) }}</p>

    <ul class="posts-list">
      <li v-for="post in monthPosts" :key="post.url" class="post-item">
        <time class="post-date">{{ formatDate(post.date) }}</time>
        <a :href="withBase(articleLinkPrefix + post.url)" class="post-title">{{
          post.title
        }}</a>
      </li>
    </ul>

    <div class="archive-nav">
      <a :href="withBase(t.yearPath)" class="nav-link">{{ t.backToYear }}</a>
      <a :href="withBase(t.archivePath)" class="nav-link">{{
        t.backToArchive
      }}</a>
    </div>
  </div>
  <div v-else class="no-posts">
    <p>{{ year && month ? t.noArticles : t.fetchFailed }}</p>
    <a :href="withBase(t.archivePath)">{{ t.backToArchive }}</a>
  </div>
</template>

<style scoped>
.archive-month-wrap {
  max-width: 740px;
}

.month-summary {
  font-size: 0.9rem;
  color: var(--vp-c-text-3);
  margin-bottom: 1.5rem;
}

.posts-list {
  list-style: none;
  margin: 0;
  padding: 0;
}

.post-item {
  display: flex;
  align-items: baseline;
  gap: 1rem;
  padding: 0.55rem 0;
  border-bottom: 1px solid var(--vp-c-divider);
}

.post-item:last-child {
  border-bottom: none;
}

.post-date {
  flex-shrink: 0;
  width: 6.2rem;
  font-size: 0.8rem;
  color: var(--vp-c-text-3);
  font-family: "SFMono-Regular", Consolas, monospace;
}

.post-title {
  font-size: 0.95rem;
  color: var(--vp-c-text-1);
  text-decoration: none;
  line-height: 1.55;
  transition: color 0.15s;
}

.post-title:hover {
  color: var(--vp-c-brand-1);
}

.archive-nav {
  display: flex;
  justify-content: space-between;
  margin-top: 2rem;
  padding-top: 1rem;
  border-top: 1px solid var(--vp-c-divider);
}

.nav-link {
  font-size: 0.88rem;
  color: var(--vp-c-brand-1);
  text-decoration: none;
}

.nav-link:hover {
  text-decoration: underline;
}

.no-posts {
  text-align: center;
  padding: 2rem 0;
  color: var(--vp-c-text-3);
}
</style>
