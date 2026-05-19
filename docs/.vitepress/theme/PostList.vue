<script setup lang="ts">
import { data as allPosts } from "../../posts/meta.data";
import { ref, computed, watch } from "vue";
import { withBase, useData } from "vitepress";

const { lang } = useData();

interface Category {
  id: string;
  label: string;
  icon: string;
  desc: string;
  matchTags: string[];
}

const CATEGORIES: Category[] = [
  {
    id: "Vue",
    label: "Vue",
    icon: "🟢",
    desc: "Vue / Vuex / Pinia",
    matchTags: ["Vue", "Vuex", "Pinia", "Nuxt.js"],
  },
  {
    id: "React",
    label: "React",
    icon: "⚛️",
    desc: "Fiber / SSR / Next",
    matchTags: ["React", "Next.js"],
  },
  {
    id: "Angular",
    label: "Angular",
    icon: "🔴",
    desc: "RxJS / NgRx / CDK",
    matchTags: ["Angular", "RxJS", "NgRx"],
  },
  {
    id: "JavaScript",
    label: "JavaScript",
    icon: "💛",
    desc: "ES6+ / Patterns",
    matchTags: ["JavaScript", "ES6", "设计模式", "設計模式"],
  },
  {
    id: "TypeScript",
    label: "TypeScript",
    icon: "🔷",
    desc: "Types / Generics",
    matchTags: ["TypeScript"],
  },
  {
    id: "工程化",
    label: "Engineering",
    icon: "📦",
    desc: "Webpack / Vite / Rollup",
    matchTags: [
      "工程化",
      "前端工程化",
      "Engineering",
      "Frontend Engineering",
      "Build Tools",
      "エンジニアリング",
      "フロントエンドエンジニアリング",
      "Vite",
      "Webpack",
      "Rollup",
      "ESBuild",
      "Babel",
    ],
  },
  {
    id: "CSS",
    label: "CSS",
    icon: "🎨",
    desc: "Grid / Flex / Anim",
    matchTags: ["CSS", "TailwindCSS", "Sass", "Less"],
  },
  {
    id: "性能优化",
    label: "Performance",
    icon: "⚡",
    desc: "Web Vitals / Render",
    matchTags: [
      "性能优化",
      "性能",
      "性能優化",
      "效能最佳化",
      "效能",
      "Performance",
      "Performance Optimization",
      "パフォーマンス最適化",
      "パフォーマンス",
    ],
  },
  {
    id: "Node.js",
    label: "Node.js",
    icon: "🟩",
    desc: "Stream / Deploy",
    matchTags: ["Node.js", "Express", "Koa"],
  },
  {
    id: "测试",
    label: "Testing",
    icon: "🧪",
    desc: "Jest / Vitest",
    matchTags: [
      "测试",
      "測試",
      "テスト",
      "Testing",
      "Vitest",
      "Playwright",
      "Jest",
    ],
  },
  {
    id: "安全",
    label: "Security",
    icon: "🔐",
    desc: "XSS / CSP / CSRF",
    matchTags: ["安全", "Security", "セキュリティ", "XSS", "CSP", "CSRF"],
  },
];

// ── i18n strings ──────────────────────────────────────────────────────────────
const i18n = computed(() => {
  const l = lang.value;
  if (l.startsWith("en")) {
    return {
      searchPlaceholder: "Search articles...",
      results: "results",
      prevPage: "← Prev",
      nextPage: "Next →",
      noResults: "No matching articles found",
      archiveDivider: "Archive (2018 — Dec 2025)",
      monthLabel: (m: number) =>
        [
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
        ][m - 1],
    };
  }
  if (l.startsWith("ja")) {
    return {
      searchPlaceholder: "記事を検索...",
      results: "件",
      prevPage: "← 前へ",
      nextPage: "次へ →",
      noResults: "該当する記事が見つかりません",
      archiveDivider: "アーカイブ (2018 — 2025年12月)",
      monthLabel: (m: number) => `${m}月`,
    };
  }
  if (l === "zh-TW") {
    return {
      searchPlaceholder: "搜尋文章...",
      results: "篇",
      prevPage: "← 上一頁",
      nextPage: "下一頁 →",
      noResults: "找不到符合的文章",
      archiveDivider: "往年歸檔 (2018 — 2025年12月)",
      monthLabel: (m: number) => `${m}月`,
    };
  }
  if (l === "zh-HK") {
    return {
      searchPlaceholder: "搜尋文章...",
      results: "篇",
      prevPage: "← 上一頁",
      nextPage: "下一頁 →",
      noResults: "搵唔到符合嘅文章",
      archiveDivider: "往年歸檔 (2018 — 2025年12月)",
      monthLabel: (m: number) => `${m}月`,
    };
  }
  // zh (default) and zh-TW / zh-HK
  return {
    searchPlaceholder: "搜索文章...",
    results: "篇",
    prevPage: "← 上一页",
    nextPage: "下一页 →",
    noResults: "没有找到匹配的文章",
    archiveDivider: "往年归档 (2018 — 2025年12月)",
    monthLabel: (m: number) => `${m}月`,
  };
});

const PER_PAGE = 20;
const page = ref(1);
const selectedCategory = ref<string | null>(null);
const searchQuery = ref("");

/** Get the URL prefix for current locale. Root (zh) has no prefix. */
function getLocalePrefix(): string {
  const l = lang.value;
  if (l === "zh-CN" || l === "zh") return "";
  if (l.startsWith("en")) return "/en";
  if (l.startsWith("ja")) return "/ja";
  if (l === "zh-TW") return "/zh-tw";
  if (l === "zh-HK") return "/zh-hk";
  return "";
}

function postMatchesCategory(post: { tags: string[] }, cat: Category): boolean {
  return post.tags.some((t) =>
    cat.matchTags.some((m) => t.toLowerCase() === m.toLowerCase()),
  );
}

/** Filter posts belonging to current locale by URL prefix */
const localePosts = computed(() => {
  const prefix = getLocalePrefix();
  if (!prefix) {
    // Root locale (zh): exclude all other locale paths
    return allPosts.filter(
      (p) =>
        !p.url.startsWith("/en/") &&
        !p.url.startsWith("/ja/") &&
        !p.url.startsWith("/zh-tw/") &&
        !p.url.startsWith("/zh-hk/"),
    );
  }
  return allPosts.filter((p) => p.url.startsWith(prefix + "/"));
});

const isFiltering = computed(
  () => selectedCategory.value !== null || searchQuery.value.trim() !== "",
);

const displayPosts = computed(() => {
  let posts = localePosts.value;

  if (selectedCategory.value) {
    const cat = CATEGORIES.find((c) => c.id === selectedCategory.value);
    if (cat) {
      posts = posts.filter((p) => postMatchesCategory(p, cat));
    }
  }

  if (searchQuery.value.trim()) {
    const q = searchQuery.value.trim().toLowerCase();
    posts = posts.filter((p) => p.title.toLowerCase().includes(q));
  }

  return posts;
});

const totalPages = computed(() =>
  Math.ceil(displayPosts.value.length / PER_PAGE),
);

const pagedPosts = computed(() => {
  const start = (page.value - 1) * PER_PAGE;
  return displayPosts.value.slice(start, start + PER_PAGE);
});

watch([selectedCategory, searchQuery], () => {
  page.value = 1;
});

function getCategoryCount(cat: Category): number {
  return localePosts.value.filter((p) => postMatchesCategory(p, cat)).length;
}

function selectCategory(id: string) {
  if (selectedCategory.value === id) {
    selectedCategory.value = null;
  } else {
    selectedCategory.value = id;
    searchQuery.value = "";
  }
}

function clearFilters() {
  selectedCategory.value = null;
  searchQuery.value = "";
}

function formatDate(d: string) {
  if (!d) return "";
  const dt = new Date(d.length === 10 ? d + "T00:00:00" : d);
  if (isNaN(dt.getTime())) return "";
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
}

function prevPage() {
  if (page.value > 1) {
    page.value--;
    scrollToTop();
  }
}
function nextPage() {
  if (page.value < totalPages.value) {
    page.value++;
    scrollToTop();
  }
}
function scrollToTop() {
  if (typeof window !== "undefined")
    window.scrollTo({ top: 0, behavior: "smooth" });
}

const archiveLinks = computed(() => {
  const prefix = getLocalePrefix();
  const result: { year: string; months: { label: string; path: string }[] }[] =
    [];
  for (let y = 2018; y <= 2025; y++) {
    const months = Array.from({ length: 12 }, (_, i) => ({
      label: i18n.value.monthLabel(i + 1),
      path: withBase(
        `${prefix}/archive/${y}/${String(i + 1).padStart(2, "0")}/`,
      ),
    }));
    result.push({ year: String(y), months });
  }
  return result;
});
</script>

<template>
  <div class="pl-wrap">
    <!-- 分类过滤 -->
    <div class="categories-grid">
      <button
        v-for="cat in CATEGORIES"
        :key="cat.id"
        class="cat-card"
        :class="{ active: selectedCategory === cat.id }"
        @click="selectCategory(cat.id)"
      >
        <span class="cat-icon">{{ cat.icon }}</span>
        <div class="cat-name">{{ cat.label }}</div>
        <div class="cat-desc">{{ cat.desc }}</div>
        <div class="cat-count">{{ getCategoryCount(cat) }}</div>
      </button>
    </div>

    <!-- 搜索栏 -->
    <div class="search-bar">
      <svg class="search-icon" viewBox="0 0 20 20" fill="none">
        <circle
          cx="8.5"
          cy="8.5"
          r="5.5"
          stroke="currentColor"
          stroke-width="1.5"
        />
        <path
          d="M13 13l3.5 3.5"
          stroke="currentColor"
          stroke-width="1.5"
          stroke-linecap="round"
        />
      </svg>
      <input
        v-model="searchQuery"
        type="text"
        :placeholder="i18n.searchPlaceholder"
        class="search-input"
        @keyup.escape="clearFilters"
      />
      <button v-if="isFiltering" class="clear-btn" @click="clearFilters">
        ✕
      </button>
    </div>

    <!-- 筛选状态 -->
    <div class="filter-status" v-if="isFiltering">
      <span v-if="selectedCategory" class="filter-tag"
        >📂 {{ selectedCategory }}</span
      >
      <span v-if="searchQuery.trim()" class="filter-tag"
        >🔍 {{ searchQuery.trim() }}</span
      >
      <span class="result-count"
        >{{ displayPosts.length }} {{ i18n.results }}</span
      >
    </div>

    <!-- 文章列表 -->
    <ul class="article-list">
      <li v-for="post in pagedPosts" :key="post.url" class="article-item">
        <div class="article-meta">
          <time class="article-date">{{ formatDate(post.date) }}</time>
          <span class="article-reading-time">{{ post.readingTime }} min</span>
        </div>
        <div class="article-content">
          <a :href="withBase(post.url)" class="article-title">{{
            post.title
          }}</a>
          <p v-if="post.description" class="article-desc">
            {{ post.description }}
          </p>
        </div>
      </li>
      <li v-if="pagedPosts.length === 0" class="no-results">
        {{ i18n.noResults }}
      </li>
    </ul>

    <!-- 分页 -->
    <div class="pagination" v-if="totalPages > 1">
      <button class="page-btn" @click="prevPage" :disabled="page === 1">
        {{ i18n.prevPage }}
      </button>
      <span class="page-info">{{ page }} / {{ totalPages }}</span>
      <button
        class="page-btn"
        @click="nextPage"
        :disabled="page === totalPages"
      >
        {{ i18n.nextPage }}
      </button>
    </div>

    <!-- 历史归档 -->
    <div class="archive-section" v-if="!isFiltering">
      <div class="archive-divider">
        <span>{{ i18n.archiveDivider }}</span>
      </div>
      <div class="archive-links">
        <div class="archive-row" v-for="item in archiveLinks" :key="item.year">
          <span class="archive-year-label">{{ item.year }}</span>
          <span class="archive-months">
            <a
              v-for="m in item.months"
              :key="m.path"
              :href="m.path"
              class="archive-month-link"
              >{{ m.label }}</a
            >
          </span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.pl-wrap {
  max-width: 740px;
  padding: 0.5rem 0 4rem;
}

/* ── 分类卡片 ── */
.categories-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(110px, 1fr));
  gap: 0.6rem;
  margin-bottom: 1.5rem;
}

.cat-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.2rem;
  padding: 0.7rem 0.4rem 0.6rem;
  border: 1px solid var(--vp-c-divider);
  border-radius: 8px;
  background: var(--vp-c-bg);
  cursor: pointer;
  transition: all 0.15s;
  text-align: center;
}

.cat-card:hover {
  border-color: var(--vp-c-brand-1);
  background: var(--vp-c-brand-soft);
}

.cat-card.active {
  border-color: var(--vp-c-brand-1);
  background: var(--vp-c-brand-soft);
  box-shadow: 0 0 0 2px var(--vp-c-brand-1);
}

.cat-icon {
  font-size: 1.4rem;
  line-height: 1;
}

.cat-name {
  font-size: 0.82rem;
  font-weight: 600;
  color: var(--vp-c-text-1);
}

.cat-desc {
  font-size: 0.68rem;
  color: var(--vp-c-text-3);
  line-height: 1.3;
}

.cat-count {
  font-size: 0.7rem;
  color: var(--vp-c-brand-1);
  font-weight: 500;
  margin-top: 0.1rem;
}

/* ── 搜索栏 ── */
.search-bar {
  position: relative;
  display: flex;
  align-items: center;
  margin-bottom: 0.8rem;
}

.search-icon {
  position: absolute;
  left: 0.75rem;
  width: 1rem;
  height: 1rem;
  color: var(--vp-c-text-3);
  pointer-events: none;
}

.search-input {
  width: 100%;
  padding: 0.55rem 2.5rem 0.55rem 2.4rem;
  border: 1px solid var(--vp-c-divider);
  border-radius: 8px;
  background: var(--vp-c-bg);
  color: var(--vp-c-text-1);
  font-size: 0.9rem;
  outline: none;
  transition: border-color 0.15s;
}

.search-input:focus {
  border-color: var(--vp-c-brand-1);
}

.search-input::placeholder {
  color: var(--vp-c-text-3);
}

.clear-btn {
  position: absolute;
  right: 0.6rem;
  padding: 0.2rem 0.45rem;
  border: none;
  background: var(--vp-c-default-soft);
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.78rem;
  color: var(--vp-c-text-2);
  line-height: 1;
  transition: background 0.15s;
}

.clear-btn:hover {
  background: var(--vp-c-divider);
}

/* ── 筛选状态 ── */
.filter-status {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.8rem;
  flex-wrap: wrap;
}

.filter-tag {
  display: inline-flex;
  align-items: center;
  padding: 0.15rem 0.6rem;
  background: var(--vp-c-brand-soft);
  border-radius: 12px;
  font-size: 0.8rem;
  color: var(--vp-c-brand-1);
}

.result-count {
  font-size: 0.8rem;
  color: var(--vp-c-text-3);
  margin-left: auto;
}

/* ── 文章列表 ── */
.article-list {
  list-style: none;
  margin: 0;
  padding: 0;
}

.article-item {
  display: flex;
  gap: 1rem;
  padding: 0.75rem 0;
  border-bottom: 1px solid var(--vp-c-divider);
}

.article-item:last-child {
  border-bottom: none;
}

.article-meta {
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
  width: 6.2rem;
  padding-top: 0.15rem;
}

.article-date {
  font-size: 0.8rem;
  color: var(--vp-c-text-3);
  font-family: "SFMono-Regular", Consolas, monospace;
}

.article-reading-time {
  font-size: 0.7rem;
  color: var(--vp-c-text-3);
}

.article-content {
  flex: 1;
  min-width: 0;
}

.article-title {
  font-size: 0.95rem;
  color: var(--vp-c-text-1);
  text-decoration: none;
  line-height: 1.55;
  transition: color 0.15s;
}

.article-title:hover {
  color: var(--vp-c-brand-1);
}

.article-desc {
  margin: 0.25rem 0 0;
  font-size: 0.82rem;
  color: var(--vp-c-text-3);
  line-height: 1.5;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.no-results {
  padding: 2rem 0;
  text-align: center;
  color: var(--vp-c-text-3);
  font-size: 0.9rem;
}

/* ── 分页 ── */
.pagination {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 1.5rem;
  margin: 2rem 0;
  padding: 1.5rem 0;
  border-top: 1px solid var(--vp-c-divider);
  border-bottom: 1px solid var(--vp-c-divider);
}

.page-btn {
  padding: 0.4rem 1.1rem;
  border: 1px solid var(--vp-c-divider);
  border-radius: 6px;
  background: var(--vp-c-bg);
  cursor: pointer;
  font-size: 0.88rem;
  color: var(--vp-c-brand-1);
  transition: all 0.15s;
}

.page-btn:hover:not(:disabled) {
  background: var(--vp-c-brand-1);
  color: white;
  border-color: var(--vp-c-brand-1);
}

.page-btn:disabled {
  color: var(--vp-c-text-3);
  cursor: not-allowed;
}

.page-info {
  font-size: 0.88rem;
  color: var(--vp-c-text-2);
}

/* ── 历史归档 ── */
.archive-section {
  margin-top: 2.5rem;
}

.archive-divider {
  display: flex;
  align-items: center;
  gap: 0.8rem;
  margin-bottom: 1rem;
}

.archive-divider::before,
.archive-divider::after {
  content: "";
  flex: 1;
  height: 1px;
  background: var(--vp-c-divider);
}

.archive-divider span {
  font-size: 0.8rem;
  color: var(--vp-c-text-3);
  letter-spacing: 0.04em;
  white-space: nowrap;
}

.archive-links {
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
}

.archive-row {
  display: flex;
  align-items: center;
  gap: 0.8rem;
}

.archive-year-label {
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--vp-c-text-2);
  width: 2.4rem;
  flex-shrink: 0;
}

.archive-months {
  display: flex;
  flex-wrap: wrap;
  gap: 0.25rem 0.4rem;
}

.archive-month-link {
  font-size: 0.78rem;
  color: var(--vp-c-text-3);
  text-decoration: none;
  padding: 0.08rem 0.4rem;
  border-radius: 3px;
  transition: all 0.15s;
}

.archive-month-link:hover {
  color: var(--vp-c-brand-1);
  background: var(--vp-c-brand-soft);
}
</style>
