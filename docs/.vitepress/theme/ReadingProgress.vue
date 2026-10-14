<script setup lang="ts">
import { ref, computed, watch, nextTick, onMounted, onUnmounted } from "vue";
import { useData, useRoute } from "vitepress";

import { uiCopy } from "./locale";
const { frontmatter, lang } = useData();
const route = useRoute();
const label = computed(() => uiCopy(lang.value).progress);
let observer: ResizeObserver | undefined;
const progress = ref(0);

function onScroll() {
  const scrolled = window.scrollY;
  const total =
    document.documentElement.scrollHeight - window.innerHeight;
  progress.value = total > 0 ? Math.min(100, (scrolled / total) * 100) : 0;
}

onMounted(() => {
  window.addEventListener("scroll", onScroll, { passive: true });
  observer = new ResizeObserver(onScroll);
  observer.observe(document.body);
  onScroll();
});
watch(() => route.path, async () => { await nextTick(); onScroll(); });

onUnmounted(() => {
  window.removeEventListener("scroll", onScroll);
  observer?.disconnect();
});
</script>

<template>
  <div
    v-if="frontmatter.date && frontmatter.layout !== 'home'"
    class="reading-progress-bar"
    :style="{ transform: `scaleX(${progress / 100})` }"
    role="progressbar"
    :aria-label="label"
    :aria-valuenow="Math.round(progress)"
    aria-valuemin="0"
    aria-valuemax="100"
  />
</template>

<style scoped>
.reading-progress-bar {
  position: fixed;
  top: var(--vp-nav-height);
  left: 0;
  width: 100%;
  height: 2px;
  background: linear-gradient(
    90deg,
    var(--vp-c-brand-1),
    var(--vp-c-brand-2, var(--vp-c-brand-1))
  );
  transform-origin: left center;
  z-index: 9999;
  transition: transform 0.08s linear;
  pointer-events: none;
}
</style>
