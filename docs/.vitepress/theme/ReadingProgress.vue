<script setup lang="ts">
import { ref, onMounted, onUnmounted } from "vue";
import { useData } from "vitepress";

const { frontmatter } = useData();
const progress = ref(0);

function onScroll() {
  const scrolled = window.scrollY;
  const total =
    document.documentElement.scrollHeight - window.innerHeight;
  progress.value = total > 0 ? Math.min(100, (scrolled / total) * 100) : 0;
}

onMounted(() => {
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();
});

onUnmounted(() => {
  window.removeEventListener("scroll", onScroll);
});
</script>

<template>
  <div
    v-if="frontmatter.layout !== 'home'"
    class="reading-progress-bar"
    :style="{ transform: `scaleX(${progress / 100})` }"
    role="progressbar"
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
