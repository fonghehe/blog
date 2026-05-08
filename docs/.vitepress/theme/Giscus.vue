<script setup lang="ts">
import { onMounted, watch, ref } from "vue";
import { useData, useRoute } from "vitepress";

const { isDark } = useData();
const route = useRoute();
const container = ref<HTMLElement>();

const GISCUS_REPO = "fonghehe/blog";
const GISCUS_REPO_ID = "MDEwOlJlcG9zaXRvcnkyMTUxOTg3MTQ=";
const GISCUS_CATEGORY = "Announcements";
const GISCUS_CATEGORY_ID = "DIC_kwDODNOr-s4C8kR_";

function loadGiscus() {
  if (!container.value) return;
  container.value.innerHTML = "";

  const script = document.createElement("script");
  script.src = "https://giscus.app/client.js";
  script.setAttribute("data-repo", GISCUS_REPO);
  script.setAttribute("data-repo-id", GISCUS_REPO_ID);
  script.setAttribute("data-category", GISCUS_CATEGORY);
  script.setAttribute("data-category-id", GISCUS_CATEGORY_ID);
  script.setAttribute("data-mapping", "pathname");
  script.setAttribute("data-strict", "0");
  script.setAttribute("data-reactions-enabled", "1");
  script.setAttribute("data-emit-metadata", "0");
  script.setAttribute("data-input-position", "top");
  script.setAttribute("data-theme", isDark.value ? "dark" : "light");
  script.setAttribute("data-lang", "zh-CN");
  script.setAttribute("data-loading", "lazy");
  script.crossOrigin = "anonymous";
  script.async = true;
  container.value.appendChild(script);
}

onMounted(loadGiscus);

// 路由切换时重新加载（SPA 导航）
watch(() => route.path, loadGiscus);

// 切换深色/浅色主题时同步通知 giscus iframe
watch(isDark, (dark) => {
  const iframe = container.value?.querySelector<HTMLIFrameElement>(
    "iframe.giscus-frame",
  );
  if (iframe) {
    iframe.contentWindow?.postMessage(
      { giscus: { setConfig: { theme: dark ? "dark" : "light" } } },
      "https://giscus.app",
    );
  }
});
</script>

<template>
  <div ref="container" class="giscus-wrapper" />
</template>

<style scoped>
.giscus-wrapper {
  margin-top: 3rem;
  padding-top: 2rem;
  border-top: 1px solid var(--vp-c-divider);
}
</style>
