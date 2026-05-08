<script setup lang="ts">
import { data as allPosts } from "../../posts.data";
import { ref, computed, watch } from "vue";
import { withBase } from "vitepress";

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
    desc: "ES6+ / 设计模式 / 异步",
    matchTags: ["JavaScript", "ES6", "设计模式"],
  },
  {
    id: "TypeScript",
    label: "TypeScript",
    icon: "🔷",
    desc: "类型系统 / 泛型 / 实战",
    matchTags: ["TypeScript"],
  },
  {
    id: "工程化",
    label: "工程化",
    icon: "📦",
    desc: "Webpack / Vite / Rollup",
    matchTags: [
      "工程化",
      "前端工程化",
      "Vite",
      "Webpack",
      "Rollup",
      "Esbuild",
      "Babel",
    ],
  },
  {
    id: "CSS",
    label: "CSS",
    icon: "🎨",
    desc: "Grid / Flex / 动画",
    matchTags: ["CSS", "TailwindCSS", "Sass", "Less"],
  },
  {
    id: "性能优化",
    label: "性能优化",
    icon: "⚡",
    desc: "Web Vitals / 渲染 / 缓存",
    matchTags: ["性能优化", "性能"],
  },
  {
    id: "Node.js",
    label: "Node.js",
    icon: "🟩",
    desc: "Stream / 中间件 / 部署",
    matchTags: ["Node.js", "Node", "Express", "Koa"],
  },
  {
    id: "测试",
    label: "测试",
    icon: "🧪",
    desc: "Jest / Vitest / Playwright",
    matchTags: ["测试", "Vitest", "Playwright", "Jest"],
  },
  {
    id: "安全",
    label: "安全",
    icon: "🔐",
    desc: "XSS / CSP / CSRF",
    matchTags: ["安全", "XSS", "CSP", "CSRF"],
  },
];

const PER_PAGE = 20;
const page = ref(1);
const selectedCategory = ref<string | null>(null);
const searchQuery = ref("");

function postMatchesCategory(post: { tags: string[] }, cat: Category): boolean {
  return post.tags.some((t) =>
    cat.matchTags.some((m) => t.toLowerCase() === m.toLowerCase()),
  );
}

const isFiltering = computed(
  () => selectedCategory.value !== null || searchQuery.value.trim() !== "",
);

// 全量文章（已按日期降序排列）
const displayPosts = computed(() => {
  let posts = allPosts as typeof allPosts;

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
  return allPosts.filter((p) => postMatchesCategory(p, cat)).length;
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

// 历史归档：2018-01 ~ 2025-12
const archiveLinks = (() => {
  const result: { year: string; months: { label: string; path: string }[] }[] =
    [];
  for (let y = 2018; y <= 2025; y++) {
    const maxMonth = y === 2025 ? 12 : 12;
    const months = Array.from({ length: maxMonth }, (_, i) => ({
      label: `${i + 1}月`,
      path: withBase(`/archive/${y}/${String(i + 1).padStart(2, "0")}/`),
    }));
    result.push({ year: String(y), months });
  }
  return result;
})();
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
        <div class="cat-count">{{ getCategoryCount(cat) }} 篇</div>
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
        placeholder="搜索文章标题..."
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
      <span class="result-count">共 {{ displayPosts.length }} 篇</span>
    </div>

    <!-- 文章列表 -->
    <ul class="article-list">
      <li v-for="post in pagedPosts" :key="post.url" class="article-item">
        <time class="article-date">{{ formatDate(post.date) }}</time>
        <a :href="withBase(post.url)" class="article-title">{{ post.title }}</a>
      </li>
      <li v-if="pagedPosts.length === 0" class="no-results">
        没有找到匹配的文章
      </li>
    </ul>

    <!-- 分页 -->
    <div class="pagination" v-if="totalPages > 1">
      <button class="page-btn" @click="prevPage" :disabled="page === 1">
        ← 上一页
      </button>
      <span class="page-info">第 {{ page }} / {{ totalPages }} 页</span>
      <button
        class="page-btn"
        @click="nextPage"
        :disabled="page === totalPages"
      >
        下一页 →
      </button>
    </div>

    <!-- 历史归档 -->
    <div class="archive-section" v-if="!isFiltering">
      <div class="archive-divider">
        <span>历史归档（2018 — 2025年12月）</span>
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
  align-items: baseline;
  gap: 1rem;
  padding: 0.55rem 0;
  border-bottom: 1px solid var(--vp-c-divider);
}

.article-item:last-child {
  border-bottom: none;
}

.article-date {
  flex-shrink: 0;
  width: 6.2rem;
  font-size: 0.8rem;
  color: var(--vp-c-text-3);
  font-family: "SFMono-Regular", Consolas, monospace;
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
