<script setup lang="ts">
import { useData } from "vitepress";

const { site } = useData();
const base = site.value.base ?? "/";
</script>

<template>
  <div class="not-found">
    <div class="not-found-inner">
      <div class="error-code">404</div>
      <h1 class="error-title">页面不见了</h1>
      <p class="error-desc">
        这个页面可能已被迁移、删除，或者链接有误。<br />
        你可以从下面的入口重新出发：
      </p>
      <div class="error-actions">
        <a :href="base" class="btn btn-primary">← 返回首页</a>
        <a :href="base + 'posts/'" class="btn btn-secondary">最新文章</a>
        <a :href="base + 'archive/'" class="btn btn-secondary">文章归档</a>
      </div>
    </div>
  </div>
</template>

<style scoped>
.not-found {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: calc(100vh - var(--vp-nav-height));
  padding: 2rem;
  text-align: center;
}

.not-found-inner {
  max-width: 480px;
}

.error-code {
  font-size: clamp(4rem, 15vw, 7rem);
  font-weight: 800;
  line-height: 1;
  background: linear-gradient(
    135deg,
    var(--vp-c-brand-1),
    var(--vp-c-brand-2, var(--vp-c-brand-1))
  );
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  margin-bottom: 1rem;
  letter-spacing: -0.04em;
}

.error-title {
  font-size: 1.8rem;
  font-weight: 700;
  color: var(--vp-c-text-1);
  margin-bottom: 0.75rem;
}

.error-desc {
  color: var(--vp-c-text-2);
  font-size: 0.95rem;
  line-height: 1.7;
  margin-bottom: 2rem;
}

.error-actions {
  display: flex;
  gap: 0.75rem;
  justify-content: center;
  flex-wrap: wrap;
}

.btn {
  display: inline-block;
  padding: 0.5rem 1.25rem;
  border-radius: 8px;
  font-size: 0.9rem;
  font-weight: 500;
  text-decoration: none;
  transition: opacity 0.2s, transform 0.15s;
}

.btn:hover {
  opacity: 0.85;
  transform: translateY(-1px);
}

.btn-primary {
  background: var(--vp-c-brand-1);
  color: white;
}

.btn-secondary {
  background: var(--vp-c-default-soft);
  color: var(--vp-c-text-1);
  border: 1px solid var(--vp-c-divider);
}
</style>
