---
title: "前端首屏性能优化实战"
date: 2018-11-06 16:51:48
tags:
  - 性能优化
readingTime: 2
description: "首屏加载速度直接影响用户体验，公司项目优化了一轮，记录一下有效的手段。"
wordCount: 284
---

首屏加载速度直接影响用户体验，公司项目优化了一轮，记录一下有效的手段。

## 问题诊断

优化前先用 Lighthouse 跑分，找到瓶颈：

```bash
lighthouse https://yourdomain.com --output html --output-path ./report.html
```

我们项目的主要问题：FCP 4.2s（应该 < 1.8s），主要原因：

- JS bundle 太大：main.js 2.4MB
- 没有路由懒加载
- 所有依赖同步加载

## 优化一：路由懒加载（最大收益）

```javascript
// 之前：同步 import，打包进 main.js
import Dashboard from "./views/Dashboard.vue";
import Users from "./views/Users.vue";

// 之后：动态 import，按需加载
const routes = [
  { path: "/dashboard", component: () => import("./views/Dashboard.vue") },
  { path: "/users", component: () => import("./views/Users.vue") },
];
```

效果：main.js 从 2.4MB 降到 380KB，FCP 改善最大。

## 优化二：gzip/Brotli 压缩

```bash
# nginx.conf
gzip on;
gzip_comp_level 6;
gzip_types text/plain text/css application/javascript application/json;
gzip_min_length 1024;

# brotli（比 gzip 压缩率更高，需要 nginx brotli 模块）
brotli on;
brotli_comp_level 6;
brotli_types text/plain text/css application/javascript;
```

也可以在构建时预生成压缩文件：

```javascript
// webpack：compression-webpack-plugin
const CompressionPlugin = require("compression-webpack-plugin");

plugins: [
  new CompressionPlugin({
    algorithm: "gzip",
    test: /\.(js|css|html)$/,
    threshold: 10240, // 超过 10KB 才压缩
    minRatio: 0.8,
  }),
];
```

## 优化三：CDN 加速第三方库

```javascript
// vue.config.js：把大型依赖排除在 webpack 之外
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
<!-- 从 CDN 加载，利用缓存 -->
<script src="https://cdn.jsdelivr.net/npm/vue@2.6.10/dist/vue.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/element-ui@2.12.0/lib/index.js"></script>
```

## 优化四：preload 关键资源

```html
<!-- 提示浏览器尽早加载关键字体/脚本 -->
<link rel="preload" href="/fonts/main.woff2" as="font" crossorigin />
<link rel="preload" href="/js/chunk-vendors.js" as="script" />

<!-- prefetch：提前加载下一个页面可能用到的资源 -->
<link rel="prefetch" href="/js/dashboard.js" />
```

Vue CLI 3 会自动为懒加载 chunk 生成 prefetch 标签。

## 优化五：减少阻塞渲染

```html
<!-- CSS 放 head，阻塞渲染（必须）-->
<link rel="stylesheet" href="main.css" />

<!-- JS 放 body 底部，或加 defer/async -->
<script defer src="main.js"></script>
<!-- defer：HTML 解析完后顺序执行 -->
<script async src="analytics.js"></script>
<!-- async：下载完立刻执行 -->
```

## 优化结果

| 指标            | 优化前 | 优化后           |
| 
--------------- | ------ | ---------------- |
| FCP             | 4.2s   | 1.6s             |
| JS 包大小       | 2.4MB  | 380KB（+懒加载） |
| Lighthouse 分数 | 42     | 87               |

## 小结

1. 路由懒加载：收益最大，必做
2. gzip 压缩：服务端配置，一劳永逸
3. CDN 加载第三方库：减小主包，利用缓存
4. preload 关键资源：减少渲染阻塞时间
5. JS 加 defer，非关键 CSS 异步加载
