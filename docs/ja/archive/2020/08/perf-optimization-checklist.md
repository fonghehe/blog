---
title: "フロントエンド パフォーマンス最適化 完全チェックリスト"
date: 2020-08-18 15:34:32
tags:
  - フロントエンド
readingTime: 2
description: "整理了一份前端性能优化清单，从网络、资源、渲染、运行时四个维度系统梳理。有了监控数据后，按清单逐项优化效果显著。"
---

整理了一份前端性能优化清单，从网络、资源、渲染、运行时四个维度系统梳理。有了监控数据后，按清单逐项优化效果显著。

## ネットワーク最適化

```nginx
# Nginx 开启 gzip
gzip on;
gzip_types text/plain text/css application/json application/javascript text/xml;
gzip_min_length 1024;
gzip_comp_level 6;

# 开启 Brotli（比 gzip 小 20%）
brotli on;
brotli_types text/plain text/css application/json application/javascript;
brotli_comp_level 6;

# 强缓存 + 协商缓存
location ~* \.(js|css|png|jpg|gif|woff2?)$ {
    expires 1y;
    add_header Cache-Control "public, immutable";
}

location /index.html {
    add_header Cache-Control "no-cache";
    etag on;
}
```

```html
<!-- DNS 预解析 -->
<link rel="dns-prefetch" href="//api.example.com">
<link rel="preconnect" href="https://cdn.example.com">

<!-- 预加载关键资源 -->
<link rel="preload" href="/fonts/main.woff2" as="font" crossorigin>
<link rel="preload" href="/critical.css" as="style">
```

## リソース最適化

```javascript
// webpack.config.js 优化配置
module.exports = {
  optimization: {
    splitChunks: {
      chunks: 'all',
      cacheGroups: {
        vue: {
          test: /[\\/]node_modules[\\/](vue|vue-router|vuex)/,
          name: 'vue-vendor',
          priority: 20,
        },
        vendors: {
          test: /[\\/]node_modules[\\/]/,
          name: 'vendors',
          priority: 10,
          minSize: 30000,
        },
      },
    },
  },
};

// 图片优化
// 1. 使用 WebP 格式
<picture>
  <source srcset="image.webp" type="image/webp">
  <img src="image.jpg" alt="..." loading="lazy">
</picture>

// 2. 图片懒加载（原生）
<img src="photo.jpg" loading="lazy" width="400" height="300">

// 3. 响应式图片
<img srcset="small.jpg 400w, medium.jpg 800w, large.jpg 1200w"
     sizes="(max-width: 600px) 400px, (max-width: 1000px) 800px, 1200px"
     src="medium.jpg" alt="...">
```

## クリティカルレンダリングパスの最適化

```html
<!-- 内联关键 CSS -->
<head>
  <style>
    /* 首屏关键样式内联 */
    body { margin: 0; font-family: -apple-system, sans-serif; }
    .header { height: 60px; background: #fff; }
    .hero { height: 400px; }
  </style>

  <!-- 异步加载非关键 CSS -->
  <link rel="preload" href="main.css" as="style"
        onload="this.onload=null;this.rel='stylesheet'">

  <!-- JS 异步加载 -->
  <script defer src="main.js"></script>
</head>
```

```javascript
// 代码分割 + 懒加载
// 非首屏组件按需加载
const HeavyChart = () => import(
  /* webpackChunkName: "chart" */
  /* webpackPrefetch: true */
  '@/components/HeavyChart.vue'
);

// 路由级别分割
const routes = [
  {
    path: '/',
    component: () => import('@/views/Home.vue'),
  },
  {
    path: '/admin',
    component: () => import('@/views/Admin.vue'),
  },
];
```

## ランタイム最適化

```javascript
// 1. 虚拟列表：渲染万级数据
// 使用 vue-virtual-scroller 或 react-window

// 2. 防抖和节流
function debounce(fn, delay) {
  let timer;
  return function(...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), delay);
  };
}

// 搜索输入防抖
const debouncedSearch = debounce(handleSearch, 300);
input.addEventListener('input', debouncedSearch);

// 3. Web Worker 处理大数据
const worker = new Worker('worker.js');
worker.postMessage({ type: 'PROCESS_DATA', data: largeDataset });
worker.onmessage = (e) => {
  console.log('处理完成:', e.data);
};

// 4. 避免布局抖动
// 不好：读写交替
element.style.width = '100px';
console.log(element.offsetWidth); // 强制同步布局
element.style.height = '100px';

// 好：先读后写
const width = element.offsetWidth;
const height = element.offsetHeight;
element.style.width = width + 10 + 'px';
element.style.height = height + 10 + 'px';
```

## Vue固有の最適化

```javascript
{% raw %}
// 1. v-if vs v-show
// 频繁切换用 v-show，条件少变用 v-if

// 2. 列表 key 使用唯一标识
<li v-for="item in list" :key="item.id">

// 3. Object.freeze 冻结不需要响应式的数据
const staticData = Object.freeze(largeList);

// 4. 函数式组件（无状态组件）
<template functional>
  <div class="tag">{{ props.label }}</div>
</template>

// 5. 计算属性缓存
computed: {
  filteredList() {
    return this.list.filter(item => item.active);
  },
}
{% endraw %}
```

## 最適化チェックリスト

```markdown
□ 开启 gzip / brotli 压缩
□ 配置静态资源强缓存（hash 文件名）
□ CDN 分发静态资源
□ DNS 预解析关键域名
□ 图片使用 WebP 格式 + 懒加载
□ 首屏 CSS 内联，非关键 CSS 异步加载
□ JS 代码分割 + 按需加载
□ Tree Shaking 移除无用代码
□ 列表数据使用虚拟滚动
□ 长任务拆分或使用 Web Worker
□ 启用 HTTP/2
□ 移除未使用的依赖
□ 配置 preload / prefetch
```

## まとめ

- 性能优化要系统化：网络、资源、渲染、运行时四个维度
- 先测量再优化，用 Web Vitals 和 Performance API 量化效果
- 压缩和缓存是投入产出比最高的优化
- 代码分割和懒加载是现代前端应用的标配
- 运行时优化关注虚拟列表和避免不必要的重渲染
