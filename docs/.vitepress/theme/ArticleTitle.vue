<script setup lang="ts">
import { computed } from "vue";
import { useData, withBase } from "vitepress";
import { uiCopy, formatArticleDate } from "./locale";

const { frontmatter, lang, page, localeIndex } = useData();
const t = computed(() => uiCopy(lang.value));
const prefix = computed(() => localeIndex.value === "root" ? "" : `/${localeIndex.value}`);
const shouldShow = computed(() => frontmatter.value.title && frontmatter.value.layout !== "home" && !frontmatter.value.hideTitle);
const readingTime = computed(() => Number(frontmatter.value.readingTime) || 1);
const wordCount = computed(() => Number(frontmatter.value.wordCount) || 0);
const historical = computed(() => /^(?:(?:en|ja|zh-tw|zh-hk)\/)?archive\/\d/.test(page.value.relativePath));
const showNotice = computed(() => historical.value || frontmatter.value.reviewStatus === "needs-review" || frontmatter.value.outdated === true);
</script>

<template>
  <header v-if="shouldShow" class="article-header">
    <aside v-if="showNotice" class="outdated-banner">
      {{ frontmatter.reviewStatus === 'needs-review' ? t.reviewNeeded : t.review }} <a :href="withBase(prefix + '/about.html#content-policy')">{{ t.policy }}</a>
    </aside>
    <h1 class="article-h1">{{ frontmatter.title }}</h1>
    <div class="article-meta-bar" v-if="frontmatter.date">
      <time class="meta-date" :datetime="String(frontmatter.date).slice(0, 10)">{{ formatArticleDate(frontmatter.date, lang) }}</time>
      <span aria-hidden="true">·</span>
      <span>{{ readingTime }} {{ t.read }}</span>
      <template v-if="wordCount">
        <span aria-hidden="true">·</span>
        <span>{{ new Intl.NumberFormat(lang).format(wordCount) }} {{ t.words }}</span>
      </template>
    </div>
    <div v-if="frontmatter.updated || frontmatter.lastVerified || frontmatter.version" class="article-maintenance">
      <span v-if="frontmatter.updated">{{ t.updated }} <time :datetime="String(frontmatter.updated).slice(0, 10)">{{ formatArticleDate(frontmatter.updated, lang) }}</time></span>
      <span v-if="frontmatter.lastVerified">{{ t.verified }} <time :datetime="String(frontmatter.lastVerified).slice(0, 10)">{{ formatArticleDate(frontmatter.lastVerified, lang) }}</time></span>
      <span v-if="frontmatter.version">{{ t.version }}: {{ frontmatter.version }}</span>
    </div>
    <div v-if="frontmatter.tags?.length" class="article-tags">
      <a v-for="tag in frontmatter.tags" :key="tag" class="meta-tag" :href="withBase(prefix + '/posts/?q=' + encodeURIComponent(tag))">{{ tag }}</a>
    </div>
  </header>
</template>

<style scoped>
.article-tags { display: flex; flex-wrap: wrap; gap: 0.5rem; margin-top: 0.75rem; }
.article-maintenance { display: flex; flex-wrap: wrap; gap: 0.5rem 1rem; margin-top: 0.5rem; font-size: 0.85rem; color: var(--vp-c-text-2); }
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

.meta-word-count {
  color: var(--vp-c-text-3);
}

.meta-tag {
  display: inline-flex; align-items: center; min-height: 32px; padding: 0.2rem 0.6rem;
  background: var(--vp-c-default-soft);
  border-radius: 4px;
  font-size: 0.75rem;
  color: var(--vp-c-text-2);
}
</style>
