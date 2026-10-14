<script setup lang="ts">
import { computed } from "vue";
import { useData, withBase } from "vitepress";
import { data as posts } from "../../posts/meta.data";
import { readingPaths } from "./reading-paths";
import { languageKey } from "./locale";

const { lang, localeIndex } = useData();
const key = computed(() => languageKey(lang.value));
const prefix = computed(() => localeIndex.value === "root" ? "" : `/${localeIndex.value}`);
const paths = computed(() => readingPaths.map((path) => ({
  ...path,
  posts: path.slugs.map((slug) => posts.find((post) => post.url === `${prefix.value}/posts/2026/09/${slug}.html`)).filter((post) => !!post),
})));
</script>

<template>
  <div class="reading-paths">
    <section v-for="path in paths" :key="path.id" :aria-labelledby="'path-' + path.id">
      <h2 :id="'path-' + path.id">{{ path.titles[key] }}</h2>
      <p>{{ path.descriptions[key] }}</p>
      <ol><li v-for="post in path.posts" :key="post.url"><a :href="withBase(post.url)">{{ post.title }}</a></li></ol>
    </section>
  </div>
</template>

<style scoped>
.reading-paths section { padding: 0.5rem 0 1.25rem; }
.reading-paths p { color: var(--vp-c-text-2); }
.reading-paths li { margin: 0.75rem 0; }
</style>
