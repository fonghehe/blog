<script setup lang="ts">
import { useData } from "vitepress";

const { frontmatter } = useData();
</script>

<template>
  <h1 v-if="frontmatter.title" class="article-h1">
    {{ frontmatter.title }}
  </h1>
</template>

<style scoped>
.article-h1 {
  font-size: 1.9rem;
  font-weight: 700;
  line-height: 1.35;
  margin-bottom: 1rem;
  color: var(--vp-c-text-1);
  letter-spacing: -0.01em;
}
</style>
