<script setup lang="ts">
import { computed } from "vue";
import { useData } from "vitepress";

const { frontmatter } = useData();

// 用 computed 保证 SPA 导航时响应式更新
const shouldShow = computed(
  () =>
    frontmatter.value.title &&
    frontmatter.value.layout !== "home" &&
    !frontmatter.value.hideTitle,
);
</script>

<template>
  <h1 v-if="shouldShow" class="article-h1">
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
