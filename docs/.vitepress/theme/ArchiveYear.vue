<script setup lang="ts">
import { data as allPosts } from "../../posts.data";
import { computed } from "vue";
import { useRoute, withBase } from "vitepress";

const route = useRoute();

// 从路由 /archive/2018/ 中提取年份
const yearMatch = route.path.match(/\/archive\/(\d{4})\//);
const year = yearMatch ? parseInt(yearMatch[1]) : null;

const yearPosts = computed(() => {
  if (!year) return [];
  return (allPosts as typeof allPosts).filter(
    (p) => new Date(p.date).getFullYear() === year,
  );
});

const postsGroupedByMonth = computed(() => {
  const groups: Record<string, typeof yearPosts.value> = {};

  yearPosts.value.forEach((post) => {
    const date = new Date(post.date);
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const key = month;

    if (!groups[key]) {
      groups[key] = [];
    }
    groups[key].push(post);
  });

  return Object.entries(groups)
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([month, posts]) => ({ month, posts }));
});

function formatDate(d: string) {
  if (!d) return "";
  const dt = new Date(d.length === 10 ? d + "T00:00:00" : d);
  if (isNaN(dt.getTime())) return "";
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
}
</script>

<template>
  <div class="archive-year-wrap" v-if="year && yearPosts.length > 0">
    <p class="year-summary">{{ year }} 年共 {{ yearPosts.length }} 篇文章</p>

    <div class="months-list">
      <div
        v-for="group in postsGroupedByMonth"
        :key="group.month"
        class="month-group"
      >
        <h3 class="month-title">
          {{ group.month }} 月 ({{ group.posts.length }} 篇)
        </h3>
        <ul class="posts-in-month">
          <li v-for="post in group.posts" :key="post.url" class="post-item">
            <time class="post-date">{{ formatDate(post.date) }}</time>
            <a :href="withBase(post.url)" class="post-title">{{
              post.title
            }}</a>
          </li>
        </ul>
      </div>
    </div>

    <div class="archive-nav">
      <a :href="withBase('/archive/')" class="nav-link">← 返回归档</a>
      <a :href="withBase('/posts/')" class="nav-link">查看所有文章 →</a>
    </div>
  </div>
  <div v-else class="no-posts">
    <p>{{ year ? `${year} 年没有文章` : "获取年份失败" }}</p>
    <a :href="withBase('/archive/')">返回归档 →</a>
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
