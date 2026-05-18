---
title: "前端首屏效能最佳化實戰"
date: 2018-11-06 16:51:48
tags:
  - 效能最佳化
readingTime: 2
description: "首屏載入速度直接影響使用者體驗，公司專案優化了一輪，記錄一下有效的手段。"
---

首屏載入速度直接影響使用者體驗，公司專案優化了一輪，記錄一下有效的手段。

## 問題診斷

最佳化前先用 Lighthouse 跑分，找到瓶頸：

```bash
lighthouse https://yourdomain.com --output html --output-path ./report.html
```

我們專案的主要問題：FCP 4.2s（應該 < 1.8s），主要原因：

- JS bundle 太大：main.js 2.4MB
- 沒有路由懶載入
- 所有依賴同步載入

## 最佳化一：路由懶載入（最大收益）

```javascript
// 之前：同步 import，打包進 main.js
import Dashboard from "./views/Dashboard.vue";
import Users from "./views/Users.vue";

// 之後：動態 import，按需載入
const routes = [
  { path: "/dashboard", component: () => import("./views/Dashboard.vue") },
  { path: "/users", component: () => import("./views/Users.vue") },
];
```

效果：main.js 從 2.4MB 降到 380KB，FCP 改善最大。

## 最佳化二：gzip/Brotli 壓縮

```bash
# nginx.conf
gzip on;
gzip_comp_level 6;
gzip_types text/plain text/css application/javascript application/json;
gzip_min_length 1024;

# brotli（比 gzip 壓縮率更高，需要 nginx brotli 模組）
brotli on;
brotli_comp_level 6;
brotli_types text/plain text/css application/javascript;
```

也可以在構建時預生成壓縮檔案：

```javascript
// webpack：compression-webpack-plugin
const CompressionPlugin = require("compression-webpack-plugin");

plugins: [
  new CompressionPlugin({
    algorithm: "gzip",
    test: /\.(js|css|html)$/,
    threshold: 10240, // 超過 10KB 才壓縮
    minRatio: 0.8,
  }),
];
```

## 最佳化三：CDN 加速第三方庫

```javascript
// vue.config.js：把大型依賴排除在 webpack 之外
module.exports = {
  configureWebpack: {
    externals: {
      vue: "Vue",
      "element-ui": "ELEMENT",
      echarts: "echarts",
    },
  },
};
```

```html
<!-- 從 CDN 載入，利用快取 -->
<script src="https://cdn.jsdelivr.net/npm/vue@2.6.10/dist/vue.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/element-ui@2.12.0/lib/index.js"></script>
```

## 最佳化四：preload 關鍵資源

```html
<!-- 提示瀏覽器儘早載入關鍵字型/指令碼 -->
<link rel="preload" href="/fonts/main.woff2" as="font" crossorigin />
<link rel="preload" href="/js/chunk-vendors.js" as="script" />

<!-- prefetch：提前載入下一個頁面可能用到的資源 -->
<link rel="prefetch" href="/js/dashboard.js" />
```

Vue CLI 3 會自動為懶載入 chunk 生成 prefetch 標籤。

## 最佳化五：減少阻塞渲染

```html
<!-- CSS 放 head，阻塞渲染（必須）-->
<link rel="stylesheet" href="main.css" />

<!-- JS 放 body 底部，或加 defer/async -->
<script defer src="main.js"></script>
<!-- defer：HTML 解析完後順序執行 -->
<script async src="analytics.js"></script>
<!-- async：下載完立刻執行 -->
```

## 最佳化結果

| 指標            | 最佳化前 | 最佳化後           |
| 
--------------- | ------ | ---------------- |
| FCP             | 4.2s   | 1.6s             |
| JS 包大小       | 2.4MB  | 380KB（+懶載入） |
| Lighthouse 分數 | 42     | 87               |

## 小結

1. 路由懶載入：收益最大，必做
2. gzip 壓縮：服務端配置，一勞永逸
3. CDN 載入第三方庫：減小主包，利用快取
4. preload 關鍵資源：減少渲染阻塞時間
5. JS 加 defer，非關鍵 CSS 非同步載入
