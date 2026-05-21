---
title: "HTTP 缓存深入理解：强缓存与协商缓存"
date: 2019-02-23 10:46:09
tags:
  - 前端
readingTime: 2
description: "HTTP 缓存是前端性能优化的重要一环，但很多人对强缓存和协商缓存的区别不清楚，导致要么缓存不生效，要么更新不及时。"
wordCount: 225
---

HTTP 缓存是前端性能优化的重要一环，但很多人对强缓存和协商缓存的区别不清楚，导致要么缓存不生效，要么更新不及时。

## 缓存流程

```
请求资源
  ↓
浏览器有缓存?
  → 否：直接请求服务器
  → 是：检查强缓存（Cache-Control / Expires）
       → 未过期：直接用缓存（200 from cache）
       → 已过期：协商缓存（发请求带 If-None-Match / If-Modified-Since）
                 → 服务器返回 304：用本地缓存
                 → 服务器返回 200：用新资源
```

## 强缓存

```http
# 响应头
Cache-Control: max-age=31536000  # 缓存 1 年（秒）
Cache-Control: no-cache          # 不使用强缓存（还是会协商）
Cache-Control: no-store          # 完全不缓存
Cache-Control: private           # 只能浏览器缓存，不能 CDN 缓存
Cache-Control: public            # 可以 CDN 缓存
Expires: Wed, 23 Feb 2020 00:00:00 GMT  # 老式写法，以服务器时间为准
```

`Cache-Control` 优先级高于 `Expires`，现代项目用 `Cache-Control`。

## 协商缓存

```http
# 响应头（第一次请求）
ETag: "abc123"                         # 资源的唯一标识（内容哈希）
Last-Modified: Tue, 22 Feb 2019 10:00:00 GMT

# 请求头（再次请求，强缓存过期后）
If-None-Match: "abc123"               # 上次的 ETag
If-Modified-Since: Tue, 22 Feb 2019 10:00:00 GMT

# 服务器响应：没有改变
HTTP/1.1 304 Not Modified             # 浏览器用本地缓存
# 服务器响应：已改变
HTTP/1.1 200 OK + 新资源
```

`ETag` 精度更高（内容级别），`Last-Modified` 精度到秒，推荐用 ETag。

## 静态资源缓存策略

```nginx
# nginx 配置示例

# HTML：不缓存（用协商缓存，保证能拿到最新入口文件）
location ~* \.html$ {
  add_header Cache-Control "no-cache";
  add_header ETag "";
}

# 带 hash 的 JS/CSS：长期缓存
# （内容变了 hash 变，文件名变，自动更新）
location ~* \.(js|css)$ {
  add_header Cache-Control "public, max-age=31536000, immutable";
}

# 图片：1 个月
location ~* \.(jpg|png|gif|webp|svg)$ {
  add_header Cache-Control "public, max-age=2592000";
}

# 字体：1 年
location ~* \.(woff2|woff|ttf)$ {
  add_header Cache-Control "public, max-age=31536000, immutable";
}
```

## Webpack 配置 Hash

```javascript
// webpack.config.js（生产）
module.exports = {
  output: {
    filename: "[name].[contenthash:8].js", // 内容哈希
    chunkFilename: "[name].[contenthash:8].chunk.js",
  },
  optimization: {
    // 确保 vendor 的 hash 稳定（只有依赖变化才变）
    moduleIds: "hashed",
    runtimeChunk: "single", // runtime 单独打包，避免影响其他 chunk 的 hash
    splitChunks: {
      cacheGroups: {
        vendor: {
          test: /[\\/]node_modules[\\/]/,
          name: "vendors",
          chunks: "all",
        },
      },
    },
  },
};
```

这样配置后：

- `index.html`：服务器 `no-cache`，每次验证
- `vendors.xxx.js`：第三方库变化才重新下载（长期缓存）
- `app.xxx.js`：业务代码，改了 hash 变，强制更新

## Service Worker 缓存

```javascript
// sw.js：更精细的缓存控制
const CACHE_NAME = "v1";
const STATIC_ASSETS = ["/app.js", "/styles.css"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS)),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;

  // API 请求：网络优先
  if (request.url.includes("/api/")) {
    event.respondWith(fetch(request).catch(() => caches.match(request)));
    return;
  }

  // 静态资源：缓存优先
  event.respondWith(
    caches.match(request).then((cached) => cached || fetch(request)),
  );
});
```

## 小结

- 强缓存：`Cache-Control: max-age`，未过期直接用，不发请求
- 协商缓存：`ETag + If-None-Match`，304 用本地缓存，200 用新资源
- 静态资源加 contenthash，HTML 不缓存，是最实用的策略
- `immutable` 告诉浏览器"内容永远不变"，更激进地缓存
