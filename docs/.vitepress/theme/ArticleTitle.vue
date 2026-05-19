<script setup lang="ts">
import { computed } from "vue";
import { useData } from "vitepress";

const { frontmatter } = useData();

const shouldShow = computed(
  () =>
    frontmatter.value.title &&
    frontmatter.value.layout !== "home" &&
    !frontmatter.value.hideTitle,
);

// Use pre-computed value from frontmatter (set by scripts/precompute-meta.js)
// so it matches PostList.vue's post.readingTime
const readingTime = computed(() => Number(frontmatter.value.readingTime) || 1);

const isOutdated = computed(() => {
  const dateStr = frontmatter.value.date;
  if (!dateStr) return false;
  const year = new Date(dateStr).getFullYear();
  return year <= 2022;
});

const articleYear = computed(() => {
  const dateStr = frontmatter.value.date;
  if (!dateStr) return "";
  return new Date(dateStr).getFullYear();
});
</script>

<template>
  <div v-if="shouldShow" class="article-header">
    <div v-if="isOutdated" class="outdated-banner">
      ⚠️ This article was written in {{ articleYear }}. Some content may be
      outdated.
    </div>
    <h1 class="article-h1">{{ frontmatter.title }}</h1>
    <div class="article-meta-bar" v-if="frontmatter.date">
      <time class="meta-date">{{
        frontmatter.date.toString().slice(0, 10)
      }}</time>
      <span class="meta-separator">·</span>
      <span class="meta-reading-time">{{ readingTime }} min read</span>
      <span v-if="frontmatter.tags?.length" class="meta-separator">·</span>
      <span
        v-for="(tag, i) in (frontmatter.tags || []).slice(0, 3)"
        :key="i"
        class="meta-tag"
        >{{ tag }}</span
      >
    </div>
  </div>
</template>

<style scoped>
.article-header {
  margin-bottom: 1.5rem;
}

.outdated-banner {
  padding: 0.6rem 1rem;
  margin-bottom: 1rem;
  border-radius: 8px;
  background: var(--vp-c-warning-soft);
  color: var(--vp-c-warning-1);
  font-size: 0.85rem;
  line-height: 1.5;
  border: 1px solid var(--vp-c-warning-2);
}

.article-h1 {
  font-size: 1.9rem;
  font-weight: 700;
  line-height: 1.35;
  margin-bottom: 0.5rem;
  color: var(--vp-c-text-1);
  letter-spacing: -0.01em;
}

.article-meta-bar {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.4rem;
  font-size: 0.82rem;
  color: var(--vp-c-text-3);
}

.meta-separator {
  color: var(--vp-c-divider);
}

.meta-date {
  font-family: "SFMono-Regular", Consolas, monospace;
}

.meta-reading-time {
  color: var(--vp-c-text-3);
}

.meta-tag {
  padding: 0.1rem 0.45rem;
  background: var(--vp-c-default-soft);
  border-radius: 4px;
  font-size: 0.75rem;
  color: var(--vp-c-text-2);
}
</style>
