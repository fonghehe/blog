---
title: "前端效能最佳化完整清單"
date: 2020-08-18 15:34:32
tags:
  - 前端
readingTime: 2
description: "整理了一份前端效能最佳化清單，從網路、資源、渲染、執行時四個維度系統梳理。有了監控資料後，按清單逐項最佳化效果顯著。"
wordCount: 191
---

整理了一份前端效能最佳化清單，從網路、資源、渲染、執行時四個維度系統梳理。有了監控資料後，按清單逐項最佳化效果顯著。

## 網路最佳化

```nginx
# Nginx 開啟 gzip
gzip on;
gzip_types text/plain text/css application/json application/javascript text/xml;
gzip_min_length 1024;
gzip_comp_level 6;

# 開啟 Brotli（比 gzip 小 20%）
brotli on;
brotli_types text/plain text/css application/json application/javascript;
brotli_comp_level 6;

# 強快取 + 協商快取
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

<!-- 預載入關鍵資源 -->
<link rel="preload" href="/fonts/main.woff2" as="font" crossorigin>
<link rel="preload" href="/critical.css" as="style">
```

## 資源最佳化

```javascript
// webpack.config.js 最佳化配置
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

// 圖片最佳化
// 1. 使用 WebP 格式
<picture>
  <source srcset="image.webp" type="image/webp">
  <img src="image.jpg" alt="..." loading="lazy">
</picture>

// 2. 圖片懶載入（原生）
<img src="photo.jpg" loading="lazy" width="400" height="300">

// 3. 響應式圖片
<img srcset="small.jpg 400w, medium.jpg 800w, large.jpg 1200w"
     sizes="(max-width: 600px) 400px, (max-width: 1000px) 800px, 1200px"
     src="medium.jpg" alt="...">
```

## 關鍵渲染路徑最佳化

```html
<!-- 內聯關鍵 CSS -->
<head>
  <style>
    /* 首屏關鍵樣式內聯 */
    body { margin: 0; font-family: -apple-system, sans-serif; }
    .header { height: 60px; background: #fff; }
    .hero { height: 400px; }
  </style>

  <!-- 非同步載入非關鍵 CSS -->
  <link rel="preload" href="main.css" as="style"
        onload="this.onload=null;this.rel='stylesheet'">

  <!-- JS 非同步載入 -->
  <script defer src="main.js"></script>
</head>
```

```javascript
// 程式碼分割 + 懶載入
// 非首屏元件按需載入
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

## 執行時最佳化

```javascript
// 1. 虛擬列表：渲染萬級資料
// 使用 vue-virtual-scroller 或 react-window

// 2. 防抖和節流
function debounce(fn, delay) {
  let timer;
  return function(...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), delay);
  };
}

// 搜尋輸入防抖
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
console.log(element.offsetWidth); // 強制同步佈局
element.style.height = '100px';

// 好：先讀後寫
const width = element.offsetWidth;
const height = element.offsetHeight;
element.style.width = width + 10 + 'px';
element.style.height = height + 10 + 'px';
```

## Vue 專項最佳化

```javascript
{% raw %}
// 1. v-if vs v-show
// 頻繁切換用 v-show，條件少變用 v-if

// 2. 列表 key 使用唯一標識
<li v-for="item in list" :key="item.id">

// 3. Object.freeze 凍結不需要響應式的資料
const staticData = Object.freeze(largeList);

// 4. 函式式元件（無狀態元件）
<template functional>
  <div class="tag">{{ props.label }}</div>
</template>

// 5. 計算屬性快取
computed: {
  filteredList() {
    return this.list.filter(item => item.active);
  },
}
{% endraw %}
```

## 最佳化檢查清單

```markdown
□ 開啟 gzip / brotli 壓縮
□ 配置靜態資源強快取（hash 檔名）
□ CDN 分發靜態資源
□ DNS 預解析關鍵域名
□ 圖片使用 WebP 格式 + 懶載入
□ 首屏 CSS 內聯，非關鍵 CSS 非同步載入
□ JS 程式碼分割 + 按需載入
□ Tree Shaking 移除無用程式碼
□ 列表資料使用虛擬滾動
□ 長任務拆分或使用 Web Worker
□ 啟用 HTTP/2
□ 移除未使用的依賴
□ 配置 preload / prefetch
```

## 小結

- 效能最佳化要系統化：網路、資源、渲染、執行時四個維度
- 先測量再最佳化，用 Web Vitals 和 Performance API 量化效果
- 壓縮和快取是投入產出比最高的最佳化
- 程式碼分割和懶載入是現代前端應用的標配
- 執行時最佳化關注虛擬列表和避免不必要的重渲染
