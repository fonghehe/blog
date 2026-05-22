<script setup lang="ts">
import { data as allPosts, type Post } from "../../posts/meta.data";
import { computed } from "vue";
import { useRoute, withBase, useData } from "vitepress";

const route = useRoute();
const { lang, localeIndex } = useData();

// 从路由中提取年份，兴 /blog/ja/archive/2025/ 中的 /archive/2025/ 匹配即可
const yearMatch = route.path.match(/\/archive\/(\d{4})\//);
const year = yearMatch ? parseInt(yearMatch[1]) : null;

// 使用 VitePress localeIndex 检测当前语言（route.path 含 base，不可直接 startsWith 判断）
const localePrefix = computed(() => {
  const idx = localeIndex.value; // "root" | "en" | "ja" | "zh-tw" | "zh-hk"
  if (idx === "root") return "";
  return `/${idx}`; // "/en", "/ja", "/zh-tw", "/zh-hk"
});

// All locales (including zh-tw/zh-hk) now have their own URL prefixes,
// so no prefix prepending is needed.
const articleLinkPrefix = computed(() => "");

const yearPosts = computed(() => {
  if (!year) return [];
  const prefix = localePrefix.value;
  return allPosts.filter((p) => {
    // Extract year directly to avoid timezone shifts from new Date()
    const matchYear = parseInt(p.date.slice(0, 4)) === year;
    if (prefix) return p.url.startsWith(prefix + "/") && matchYear;
    // zh root: exclude all locale-prefixed variants
    return (
      !p.url.startsWith("/en/") &&
      !p.url.startsWith("/ja/") &&
      !p.url.startsWith("/zh-tw/") &&
      !p.url.startsWith("/zh-hk/") &&
      matchYear
    );
  });
});

const postsGroupedByMonth = computed(() => {
  const groups: Record<string, typeof yearPosts.value> = {};

  yearPosts.value.forEach((post: Post) => {
    // Extract month directly to avoid timezone shifts from new Date()
    const month = post.date.slice(5, 7);
    if (!groups[month]) groups[month] = [];
    groups[month].push(post);
  });

  return Object.entries(groups)
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([month, posts]) => ({ month: parseInt(month), posts }));
});

// i18n helpers
const t = computed(() => {
  const l = lang.value;
  if (l.startsWith("en")) {
    const monthNames = [
      "Jan",
      "Feb",
      "Mar",
      "Apr",
      "May",
      "Jun",
      "Jul",
      "Aug",
      "Sep",
      "Oct",
      "Nov",
      "Dec",
    ];
    return {
      summary: (n: number) => `${year} — ${n} article${n !== 1 ? "s" : ""}`,
      monthTitle: (m: number, n: number) => `${monthNames[m - 1]} (${n})`,
      backToArchive: "← Back to Archive",
      allPosts: "All Posts →",
      noArticles: `No articles in ${year}`,
      fetchFailed: "Failed to get year",
      archivePath: "/en/archive/",
      postsPath: "/en/posts/",
    };
  }
  if (l.startsWith("ja")) {
    return {
      summary: (n: number) => `${year}年 全${n}本`,
      monthTitle: (m: number, n: number) => `${m}月 (${n}本)`,
      backToArchive: "← アーカイブへ戻る",
      allPosts: "すべての記事 →",
      noArticles: `${year}年の記事はありません`,
      fetchFailed: "年の取得に失敗しました",
      archivePath: "/ja/archive/",
      postsPath: "/ja/posts/",
    };
  }
  if (l === "zh-TW") {
    return {
      summary: (n: number) => `${year} 年共 ${n} 篇文章`,
      monthTitle: (m: number, n: number) => `${m} 月 (${n} 篇)`,
      backToArchive: "← 返回歸檔",
      allPosts: "查看所有文章 →",
      noArticles: `${year} 年沒有文章`,
      fetchFailed: "獲取年份失敗",
      archivePath: "/zh-tw/archive/",
      postsPath: "/zh-tw/posts/",
    };
  }
  if (l === "zh-HK") {
    return {
      summary: (n: number) => `${year} 年共 ${n} 篇文章`,
      monthTitle: (m: number, n: number) => `${m} 月 (${n} 篇)`,
      backToArchive: "← 返回歸檔",
      allPosts: "睇晒所有文章 →",
      noArticles: `${year} 年冇文章`,
      fetchFailed: "攞唔到年份",
      archivePath: "/zh-hk/archive/",
      postsPath: "/zh-hk/posts/",
    };
  }
  return {
    summary: (n: number) => `${year} 年共 ${n} 篇文章`,
    monthTitle: (m: number, n: number) => `${m} 月 (${n} 篇)`,
    backToArchive: "← 返回归档",
    allPosts: "查看所有文章 →",
    noArticles: `${year} 年没有文章`,
    fetchFailed: "获取年份失败",
    archivePath: "/archive/",
    postsPath: "/posts/",
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
  <div class="archive-year-wrap" v-if="year && yearPosts.length > 0">
    <p class="year-summary">{{ t.summary(yearPosts.length) }}</p>

    <div class="months-list">
      <div
        v-for="(group, index) in postsGroupedByMonth"
        :key="group.month"
        class="month-group"
        :id="index === postsGroupedByMonth.length - 1 ? 'latest' : undefined"
      >
        <h3 class="month-title">
          {{ t.monthTitle(group.month, group.posts.length) }}
        </h3>
        <ul class="posts-in-month">
          <li v-for="post in group.posts" :key="post.url" class="post-item">
            <time class="post-date">{{ formatDate(post.date) }}</time>
            <a
              :href="withBase(articleLinkPrefix + post.url)"
              class="post-title"
              >{{ post.title }}</a
            >
          </li>
        </ul>
      </div>
    </div>

    <div class="archive-nav">
      <a :href="withBase(t.archivePath)" class="nav-link">{{
        t.backToArchive
      }}</a>
      <a :href="withBase(t.postsPath)" class="nav-link">{{ t.allPosts }}</a>
    </div>
  </div>
  <div v-else class="no-posts">
    <p>{{ year ? t.noArticles : t.fetchFailed }}</p>
    <a :href="withBase(t.archivePath)">{{ t.backToArchive }}</a>
  </div>
</template>

<style scoped>
.archive-year-wrap {
  max-width: 740px;
  padding: 1rem 0 4rem;
}

.year-summary {
  font-size: 1.1rem;
  color: var(--vp-c-text-1);
  margin-bottom: 1.5rem;
  font-weight: 600;
}

.months-list {
  display: flex;
  flex-direction: column;
  gap: 2rem;
  margin-bottom: 2rem;
}

.month-group {
  border-left: 3px solid var(--vp-c-brand-1);
  padding-left: 1rem;
}

.month-title {
  font-size: 1rem;
  color: var(--vp-c-brand-1);
  margin: 0 0 0.8rem 0;
  font-weight: 600;
}

.posts-in-month {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
}

.post-item {
  display: flex;
  gap: 1rem;
  align-items: center;
}

.post-date {
  font-size: 0.9rem;
  color: var(--vp-c-text-3);
  min-width: 110px;
  flex-shrink: 0;
}

.post-title {
  color: var(--vp-c-brand-1);
  text-decoration: none;
  flex: 1;
  transition: opacity 0.2s;
}

.post-title:hover {
  opacity: 0.7;
}

.archive-nav {
  display: flex;
  gap: 1rem;
  justify-content: center;
  padding-top: 1rem;
  border-top: 1px solid var(--vp-c-divider);
}

.nav-link {
  color: var(--vp-c-brand-1);
  text-decoration: none;
  transition: opacity 0.2s;
}

.nav-link:hover {
  opacity: 0.7;
}

.no-posts {
  text-align: center;
  padding: 2rem;
  color: var(--vp-c-text-2);
}

.no-posts a {
  color: var(--vp-c-brand-1);
}
</style>
