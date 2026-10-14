<script setup lang="ts">
import { computed } from "vue";
import { useData, withBase } from "vitepress";
import { data as posts } from "../../posts/meta.data";
import { relatedPosts } from "./post-list";
import { uiCopy } from "./locale";

const { page, frontmatter, lang, localeIndex } = useData();
const t = computed(() => uiCopy(lang.value));
const url = computed(() => "/" + page.value.relativePath.replace(/\.md$/, ".html"));
const related = computed(() => frontmatter.value.date
  ? relatedPosts(posts, url.value, frontmatter.value.tags || []) : []);
const seriesPosts = computed(() => frontmatter.value.series
  ? posts.filter((post) => post.series === frontmatter.value.series && post.url !== url.value
    && post.url.startsWith(localeIndex.value === "root" ? "/posts/" : `/${localeIndex.value}/posts/`)).slice(0, 5)
  : []);
const prefix = computed(() => localeIndex.value === "root" ? "" : `/${localeIndex.value}`);
</script>

<template>
  <aside v-if="frontmatter.date" class="reading-next" :aria-label="t.related">
    <template v-if="seriesPosts.length">
      <h2>{{ t.series }} · {{ frontmatter.series }}</h2>
      <ul><li v-for="post in seriesPosts" :key="post.url"><a :href="withBase(post.url)">{{ post.title }}</a></li></ul>
    </template>
    <template v-if="related.length">
      <h2>{{ t.related }}</h2>
      <ul><li v-for="post in related" :key="post.url"><a :href="withBase(post.url)">{{ post.title }}</a></li></ul>
    </template>
    <div class="reading-links">
      <a :href="withBase(prefix + '/posts/')">{{ t.posts }} →</a>
      <a :href="withBase(prefix + '/rss.xml')">{{ t.rss }}</a>
      <a :href="withBase(prefix + '/about.html#content-policy')">{{ t.policy }}</a>
    </div>
  </aside>
</template>

<style scoped>
.reading-next { margin-top: 3rem; padding-top: 1.5rem; border-top: 1px solid var(--vp-c-divider); }
.reading-next h2 { margin: 0 0 0.75rem; font-size: 1.1rem; border: 0; }
.reading-next li { margin: 0.5rem 0; }
.reading-links { display: flex; flex-wrap: wrap; gap: 0.75rem 1.25rem; margin-top: 1rem; font-size: 0.9rem; }
</style>
