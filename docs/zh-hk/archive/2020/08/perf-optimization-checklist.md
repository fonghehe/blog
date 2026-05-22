---
title: "前端效能優化完整清單：實踐方法與治理思路"
date: 2020-08-18 15:34:32
tags:
  - 前端
readingTime: 2
description: "整理了一份前端效能優化清單，從網絡、資源、渲染、運行時四個維度系統梳理。有了監控數據後，按清單逐項優化效果顯著。"
wordCount: 178
---

整理了一份前端性能優化清單，從網絡、資源、渲染、運行時四個維度系統梳理。有了監控數據後，按清單逐項優化效果顯著。

## 網絡優化

```nginx
# Nginx 開啓 gzip
gzip on;
gzip_types text/plain text/css application/json application/javascript text/xml;
gzip_min_length 1024;
gzip_comp_level 6;

# 開啓 Brotli（比 gzip 小 20%）
brotli on;
brotli_types text/plain text/css application/json application/javascript;
brotli_comp_level 6;

# 強緩存 + 協商緩存
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
<!-- DNS 預解析 -->
<link rel="dns-prefetch" href="//api.example.com">
<link rel="preconnect" href="https://cdn.example.com">

<!-- 預加載關鍵資源 -->
<link rel="preload" href="/fonts/main.woff2" as="font" crossorigin>
<link rel="preload" href="/critical.css" as="style">
```

## 資源優化

```javascript
// webpack.config.js 優化配置
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

// 圖片優化
// 1. 使用 WebP 格式
<picture>
  <source srcset="image.webp" type="image/webp">
  <img src="image.jpg" alt="..." loading="lazy">
</picture>

// 2. 圖片懶加載（原生）
<img src="photo.jpg" loading="lazy" width="400" height="300">

// 3. 響應式圖片
<img srcset="small.jpg 400w, medium.jpg 800w, large.jpg 1200w"
     sizes="(max-width: 600px) 400px, (max-width: 1000px) 800px, 1200px"
     src="medium.jpg" alt="...">
```

## 關鍵渲染路徑優化

```html
<!-- 內聯關鍵 CSS -->
<head>
  <style>
    /* 首屏關鍵樣式內聯 */
    body { margin: 0; font-family: -apple-system, sans-serif; }
    .header { height: 60px; background: #fff; }
    .hero { height: 400px; }
  </style>

  <!-- 異步加載非關鍵 CSS -->
  <link rel="preload" href="main.css" as="style"
        onload="this.onload=null;this.rel='stylesheet'">

  <!-- JS 異步加載 -->
  <script defer src="main.js"></script>
</head>
```

```javascript
// 代碼分割 + 懶加載
// 非首屏組件按需加載
const HeavyChart = () => import(
  /* webpackChunkName: "chart" */
  /* webpackPrefetch: true */
  '@/components/HeavyChart.vue'
);

// 路由級別分割
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

## 運行時優化

```javascript
// 1. 虛擬列表：渲染萬級數據
// 使用 vue-virtual-scroller 或 react-window

// 2. 防抖和節流
function debounce(fn, delay) {
  let timer;
  return function(...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), delay);
  };
}

// 搜索輸入防抖
const debouncedSearch = debounce(handleSearch, 300);
input.addEventListener('input', debouncedSearch);

// 3. Web Worker 處理大數據
const worker = new Worker('worker.js');
worker.postMessage({ type: 'PROCESS_DATA', data: largeDataset });
worker.onmessage = (e) => {
  console.log('處理完成:', e.data);
};

// 4. 避免佈局抖動
// 不好：讀寫交替
element.style.width = '100px';
console.log(element.offsetWidth); // 強製同步佈局
element.style.height = '100px';

// 好：先讀後寫
const width = element.offsetWidth;
const height = element.offsetHeight;
element.style.width = width + 10 + 'px';
element.style.height = height + 10 + 'px';
```

## Vue 專項優化

```javascript
{% raw %}
// 1. v-if vs v-show
// 頻繁切換用 v-show，條件少變用 v-if

// 2. 列表 key 使用唯一標識
<li v-for="item in list" :key="item.id">

// 3. Object.freeze 凍結不需要響應式的數據
const staticData = Object.freeze(largeList);

// 4. 函數式組件（無狀態組件）
<template functional>
  <div class="tag">{{ props.label }}</div>
</template>

// 5. 計算屬性緩存
computed: {
  filteredList() {
    return this.list.filter(item => item.active);
  },
}
{% endraw %}
```

## 優化檢查清單

```markdown
□ 開啓 gzip / brotli 壓縮
□ 配置靜態資源強緩存（hash 文件名）
□ CDN 分發靜態資源
□ DNS 預解析關鍵域名
□ 圖片使用 WebP 格式 + 懶加載
□ 首屏 CSS 內聯，非關鍵 CSS 異步加載
□ JS 代碼分割 + 按需加載
□ Tree Shaking 移除無用代碼
□ 列表數據使用虛擬滾動
□ 長任務拆分或使用 Web Worker
□ 啓用 HTTP/2
□ 移除未使用的依賴
□ 配置 preload / prefetch
```

## 小結

- 性能優化要系統化：網絡、資源、渲染、運行時四個維度
- 先測量再優化，用 Web Vitals 和 Performance API 量化效果
- 壓縮和緩存是投入產出比最高的優化
- 代碼分割和懶加載是現代前端應用的標配
- 運行時優化關注虛擬列表和避免不必要的重渲染
