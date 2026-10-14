<script setup lang="ts">
import { computed } from "vue";
import { useData, withBase } from "vitepress";
import { data as posts } from "../../posts/meta.data";
import { selectedSlugs } from "./reading-paths";
import { localePrefix } from "./post-list";
import { uiCopy, formatArticleDate } from "./locale";

const { lang, localeIndex } = useData();
const t = computed(() => uiCopy(lang.value));
const prefix = computed(() => localeIndex.value === "root" ? "" : `/${localeIndex.value}`);
const localPosts = computed(() => posts.filter((post) => localePrefix(post.url) === prefix.value));
const selected = computed(() => selectedSlugs.map((slug) => localPosts.value.find((post) => post.url.endsWith(`/${slug}.html`))).filter((post) => !!post));
const latest = computed(() => localPosts.value.slice(0, 4));
</script>

<template>
  <div class="home-discovery">
    <section class="discovery-start" :aria-label="t.start">
      <h2>{{ t.start }}</h2>
      <div class="discovery-links">
        <a :href="withBase(prefix + '/guides.html')">{{ t.guides }} →</a>
        <a :href="withBase(prefix + '/about.html')">{{ t.about }}</a>
        <a :href="withBase(prefix + '/rss.xml')">{{ t.rss }}</a>
      </div>
    </section>
    <section :aria-labelledby="'selected-reading'">
      <h2 id="selected-reading">{{ t.selected }}</h2>
      <div class="discovery-grid">
        <article v-for="post in selected" :key="post.url" class="discovery-card">
          <h3><a :href="withBase(post.url)">{{ post.title }}</a></h3>
          <p>{{ post.description }}</p>
        </article>
      </div>
    </section>
    <section class="discovery-latest" :aria-labelledby="'recent-reading'">
      <h2 id="recent-reading">{{ t.latest }}</h2>
      <ul><li v-for="post in latest" :key="post.url"><time :datetime="post.date.slice(0, 10)">{{ formatArticleDate(post.date, lang) }}</time><a :href="withBase(post.url)">{{ post.title }}</a></li></ul>
      <a class="all-posts-link" :href="withBase(prefix + '/posts/')">{{ t.posts }} →</a>
    </section>
  </div>
</template>

<style scoped>
.home-discovery { max-width: 1152px; margin: 3rem auto 4rem; padding: 0 24px; }
.home-discovery section + section { margin-top: 2.5rem; }
.home-discovery h2 { font-size: 1.35rem; font-weight: 650; margin-bottom: 1rem; }
.discovery-links { display: flex; flex-wrap: wrap; gap: 0.5rem 1.5rem; }
.home-discovery a { color: var(--vp-c-brand-1); }
.home-discovery a:hover { text-decoration: underline; }
.discovery-links a, .all-posts-link { display: inline-flex; align-items: center; min-height: 44px; }
.discovery-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 1rem; }
.discovery-card { padding: 1.25rem; background: var(--vp-c-bg-soft); border: 1px solid var(--vp-c-divider); border-radius: 12px; }
.discovery-card h3 { font-size: 1rem; line-height: 1.6; font-weight: 600; text-wrap: balance; }
.discovery-card p { color: var(--vp-c-text-2); font-size: 0.9rem; line-height: 1.75; margin-top: 0.75rem; }
.discovery-latest li { display: flex; gap: 1.5rem; padding: 0.75rem 0; border-bottom: 1px solid var(--vp-c-divider); }
.discovery-latest time { flex: 0 0 8rem; color: var(--vp-c-text-2); font-size: 0.85rem; }
@media (min-width: 960px) { .home-discovery { padding: 0 32px; } }
@media (max-width: 640px) { .discovery-grid { grid-template-columns: 1fr; } .discovery-latest li { flex-direction: column; gap: 0.35rem; } .discovery-latest time { flex-basis: auto; } }
</style>
