---
title: "HTTP 缓存机制：强缓存与协商缓存"
date: 2018-04-25 16:13:17
tags:
  - 前端
---

HTTP 缓存配置正确可以显著提升页面加载性能，但配置错误会导致用户看不到最新内容。理解原理后才能做出合理决策。

## 缓存的两种类型

```
浏览器发起请求
    ↓
是否有缓存？ → 没有 → 向服务器请求 → 存储缓存 → 返回
    ↓ 有
强缓存有效？ → 是 → 直接用缓存（不请求服务器）200 from cache
    ↓ 否
向服务器发协商请求 → 未变化 → 304 Not Modified，用缓存
                   → 已变化 → 200，新内容
```

## 强缓存

浏览器判断缓存是否还有效，有效则直接使用，**完全不发请求**。

### Cache-Control（HTTP/1.1，优先）

```
# 服务器响应头
Cache-Control: max-age=31536000   # 缓存 1 年（秒）
Cache-Control: no-cache           # 不用强缓存，但可以协商缓存
Cache-Control: no-store           # 完全不缓存
Cache-Control: private            # 只能浏览器缓存，CDN 不缓存
Cache-Control: public             # 浏览器和 CDN 都可缓存
```

### Expires（HTTP/1.0，低优先级）

```
Expires: Thu, 01 Jan 2019 00:00:00 GMT   # 过期时间（绝对时间）
```

缺点：依赖客户端时钟，客户端时间不准会有问题。被 `Cache-Control` 取代。

## 协商缓存

浏览器携带缓存标识向服务器请求，服务器判断资源是否变化。

### Last-Modified / If-Modified-Since

```
# 第一次请求，服务器响应
Last-Modified: Mon, 01 Jan 2018 10:00:00 GMT

# 后续请求，浏览器携带
If-Modified-Since: Mon, 01 Jan 2018 10:00:00 GMT

# 服务器判断：资源没变化
HTTP/1.1 304 Not Modified

# 服务器判断：资源变化了
HTTP/1.1 200 OK
Last-Modified: Mon, 15 Jan 2018 09:30:00 GMT
[新的内容]
```

**缺点**：精度是秒级，1 秒内多次修改无法感知。

### ETag / If-None-Match（更精准）

```
# 第一次请求，服务器响应
ETag: "abc123"  # 内容的哈希值

# 后续请求
If-None-Match: "abc123"

# 服务器比较 ETag
HTTP/1.1 304 Not Modified  # 或 200 + 新 ETag
```

ETag 是内容摘要，只要内容变了 ETag 就变，更精准。

## 前端资源的最佳缓存策略

### HTML 文件：不缓存或协商缓存

```nginx
location ~* \.html$ {
  add_header Cache-Control "no-cache";
}
```

原因：HTML 是入口，必须能及时更新，让用户拿到最新的 JS/CSS 文件名。

### 带 hash 的 JS/CSS：强缓存最大化

```nginx
location ~* \.(js|css)$ {
  add_header Cache-Control "public, max-age=31536000, immutable";
}
```

Webpack 打包时文件名带 content hash：

```javascript
// webpack.config.js
output: {
  filename: 'js/[name].[contenthash:8].js',
  chunkFilename: 'js/[name].[contenthash:8].chunk.js'
}
```

这样 `app.a1b2c3d4.js` 内容不变哈希不变，内容变了文件名也变（自动缓存失效）。可以放心设置 1 年强缓存。

### 图片和字体

```nginx
location ~* \.(jpg|jpeg|png|gif|svg|woff2|ttf)$ {
  add_header Cache-Control "public, max-age=2592000";  # 30天
}
```

## Vue CLI / Webpack 的正确配置

```javascript
// vue.config.js
module.exports = {
  filenameHashing: true, // 默认开启文件名哈希

  chainWebpack: (config) => {
    // 确保 index.html 不缓存
    config.plugin("html").tap((args) => {
      args[0].cache = false;
      return args;
    });
  },
};
```

## 验证缓存是否生效

Chrome DevTools → Network 面板：

- `200 (from memory cache)` — 强缓存（内存）
- `200 (from disk cache)` — 强缓存（磁盘）
- `304 Not Modified` — 协商缓存命中
- `200` — 缓存未命中，从服务器获取

**Size 列为 0** 说明缓存命中，没有实际传输数据。

## 小结

- HTML 不要强缓存，用 `no-cache` 确保每次验证
- JS/CSS 带 hash 文件名，可以放心设最长强缓存
- 协商缓存（ETag）比 Last-Modified 更精准
- Webpack 的 `contenthash` 是正确更新缓存的关键
