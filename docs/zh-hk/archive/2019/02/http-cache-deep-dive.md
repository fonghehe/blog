---
title: "HTTP 緩存深入理解：強緩存與協商緩存"
date: 2019-02-23 10:46:09
tags:
  - 前端
readingTime: 2
description: "HTTP 緩存是前端性能優化的重要一環，但很多人對強緩存和協商緩存的區別不清楚，導致要麼緩存不生效，要麼更新不及時。"
wordCount: 225
---

HTTP 緩存是前端性能優化的重要一環，但很多人對強緩存和協商緩存的區別不清楚，導致要麼緩存不生效，要麼更新不及時。

## 緩存流程

```
請求資源
  ↓
瀏覽器有緩存?
  → 否：直接請求服務器
  → 是：檢查強緩存（Cache-Control / Expires）
       → 未過期：直接用緩存（200 from cache）
       → 已過期：協商緩存（發請求帶 If-None-Match / If-Modified-Since）
                 → 服務器返回 304：用本地緩存
                 → 服務器返回 200：用新資源
```

## 強緩存

```http
# 響應頭
Cache-Control: max-age=31536000  # 緩存 1 年（秒）
Cache-Control: no-cache          # 不使用強緩存（還是會協商）
Cache-Control: no-store          # 完全不緩存
Cache-Control: private           # 只能瀏覽器緩存，不能 CDN 緩存
Cache-Control: public            # 可以 CDN 緩存
Expires: Wed, 23 Feb 2020 00:00:00 GMT  # 老式寫法，以服務器時間為準
```

`Cache-Control` 優先級高於 `Expires`，現代項目用 `Cache-Control`。

## 協商緩存

```http
# 響應頭（第一次請求）
ETag: "abc123"                         # 資源的唯一標識（內容哈希）
Last-Modified: Tue, 22 Feb 2019 10:00:00 GMT

# 請求頭（再次請求，強緩存過期後）
If-None-Match: "abc123"               # 上次的 ETag
If-Modified-Since: Tue, 22 Feb 2019 10:00:00 GMT

# 服務器響應：沒有改變
HTTP/1.1 304 Not Modified             # 瀏覽器用本地緩存
# 服務器響應：已改變
HTTP/1.1 200 OK + 新資源
```

`ETag` 精度更高（內容級別），`Last-Modified` 精度到秒，推薦用 ETag。

## 靜態資源緩存策略

```nginx
# nginx 配置示例

# HTML：不緩存（用協商緩存，保證能拿到最新入口文件）
location ~* \.html$ {
  add_header Cache-Control "no-cache";
  add_header ETag "";
}

# 帶 hash 的 JS/CSS：長期緩存
# （內容變了 hash 變，文件名變，自動更新）
location ~* \.(js|css)$ {
  add_header Cache-Control "public, max-age=31536000, immutable";
}

# 圖片：1 個月
location ~* \.(jpg|png|gif|webp|svg)$ {
  add_header Cache-Control "public, max-age=2592000";
}

# 字體：1 年
location ~* \.(woff2|woff|ttf)$ {
  add_header Cache-Control "public, max-age=31536000, immutable";
}
```

## Webpack 配置 Hash

```javascript
// webpack.config.js（生產）
module.exports = {
  output: {
    filename: "[name].[contenthash:8].js", // 內容哈希
    chunkFilename: "[name].[contenthash:8].chunk.js",
  },
  optimization: {
    // 確保 vendor 的 hash 穩定（只有依賴變化才變）
    moduleIds: "hashed",
    runtimeChunk: "single", // runtime 單獨打包，避免影響其他 chunk 的 hash
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

這樣配置後：

- `index.html`：服務器 `no-cache`，每次驗證
- `vendors.xxx.js`：第三方庫變化才重新下載（長期緩存）
- `app.xxx.js`：業務代碼，改了 hash 變，強制更新

## Service Worker 緩存

```javascript
// sw.js：更精細的緩存控制
const CACHE_NAME = "v1";
const STATIC_ASSETS = ["/app.js", "/styles.css"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS)),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;

  // API 請求：網絡優先
  if (request.url.includes("/api/")) {
    event.respondWith(fetch(request).catch(() => caches.match(request)));
    return;
  }

  // 靜態資源：緩存優先
  event.respondWith(
    caches.match(request).then((cached) => cached || fetch(request)),
  );
});
```

## 小結

- 強緩存：`Cache-Control: max-age`，未過期直接用，不發請求
- 協商緩存：`ETag + If-None-Match`，304 用本地緩存，200 用新資源
- 靜態資源加 contenthash，HTML 不緩存，是最實用的策略
- `immutable` 告訴瀏覽器"內容永遠不變"，更激進地緩存
