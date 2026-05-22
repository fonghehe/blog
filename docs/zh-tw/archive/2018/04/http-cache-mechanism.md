---
title: "HTTP 快取機製：強快取與協商快取"
date: 2018-04-25 16:13:17
tags:
  - 前端
readingTime: 2
description: "HTTP 快取設定正確可以顯著提升頁面載入效能，但設定錯誤會導致使用者看不到最新內容。理解原理後才能做出合理決策。"
wordCount: 459
---

HTTP 快取配置正確可以顯著提升頁面載入效能，但配置錯誤會導致使用者看不到最新內容。理解原理後才能做出合理決策。

## 快取的兩種型別

```
瀏覽器發起請求
    ↓
是否有快取？ → 沒有 → 向伺服器請求 → 儲存快取 → 返回
    ↓ 有
強快取有效？ → 是 → 直接用快取（不請求伺服器）200 from cache
    ↓ 否
向伺服器發協商請求 → 未變化 → 304 Not Modified，用快取
                   → 已變化 → 200，新內容
```

## 強快取

瀏覽器判斷快取是否還有效，有效則直接使用，**完全不發請求**。

### Cache-Control（HTTP/1.1，優先）

```
# 伺服器響應頭
Cache-Control: max-age=31536000   # 快取 1 年（秒）
Cache-Control: no-cache           # 不用強快取，但可以協商快取
Cache-Control: no-store           # 完全不快取
Cache-Control: private            # 隻能瀏覽器快取，CDN 不快取
Cache-Control: public             # 瀏覽器和 CDN 都可快取
```

### Expires（HTTP/1.0，低優先順序）

```
Expires: Thu, 01 Jan 2019 00:00:00 GMT   # 過期時間（絕對時間）
```

缺點：依賴客戶端時鐘，客戶端時間不準會有問題。被 `Cache-Control` 取代。

## 協商快取

瀏覽器攜帶快取標識向伺服器請求，伺服器判斷資源是否變化。

### Last-Modified / If-Modified-Since

```
# 第一次請求，伺服器響應
Last-Modified: Mon, 01 Jan 2018 10:00:00 GMT

# 後續請求，瀏覽器攜帶
If-Modified-Since: Mon, 01 Jan 2018 10:00:00 GMT

# 伺服器判斷：資源沒變化
HTTP/1.1 304 Not Modified

# 伺服器判斷：資源變化了
HTTP/1.1 200 OK
Last-Modified: Mon, 15 Jan 2018 09:30:00 GMT
[新的內容]
```

**缺點**：精度是秒級，1 秒內多次修改無法感知。

### ETag / If-None-Match（更精準）

```
# 第一次請求，伺服器響應
ETag: "abc123"  # 內容的雜湊值

# 後續請求
If-None-Match: "abc123"

# 伺服器比較 ETag
HTTP/1.1 304 Not Modified  # 或 200 + 新 ETag
```

ETag 是內容摘要，隻要內容變了 ETag 就變，更精準。

## 前端資源的最佳快取策略

### HTML 檔案：不快取或協商快取

```nginx
location ~* \.html$ {
  add_header Cache-Control "no-cache";
}
```

原因：HTML 是入口，必須能及時更新，讓使用者拿到最新的 JS/CSS 檔名。

### 帶 hash 的 JS/CSS：強快取最大化

```nginx
location ~* \.(js|css)$ {
  add_header Cache-Control "public, max-age=31536000, immutable";
}
```

Webpack 打包時檔名帶 content hash：

```javascript
// webpack.config.js
output: {
  filename: 'js/[name].[contenthash:8].js',
  chunkFilename: 'js/[name].[contenthash:8].chunk.js'
}
```

這樣 `app.a1b2c3d4.js` 內容不變雜湊不變，內容變了檔名也變（自動快取失效）。可以放心設定 1 年強快取。

### 圖片和字型

```nginx
location ~* \.(jpg|jpeg|png|gif|svg|woff2|ttf)$ {
  add_header Cache-Control "public, max-age=2592000";  # 30天
}
```

## Vue CLI / Webpack 的正確設定

```javascript
// vue.config.js
module.exports = {
  filenameHashing: true, // 預設開啟檔名雜湊

  chainWebpack: (config) => {
    // 確保 index.html 不快取
    config.plugin("html").tap((args) => {
      args[0].cache = false;
      return args;
    });
  },
};
```

## 驗證快取是否生效

Chrome DevTools → Network 面板：

- `200 (from memory cache)` — 強快取（記憶體）
- `200 (from disk cache)` — 強快取（磁碟）
- `304 Not Modified` — 協商快取命中
- `200` — 快取未命中，從伺服器獲取

**Size 列為 0** 說明快取命中，沒有實際傳輸資料。

## 小結

- HTML 不要強快取，用 `no-cache` 確保每次驗證
- JS/CSS 帶 hash 檔名，可以放心設最長強快取
- 協商快取（ETag）比 Last-Modified 更精準
- Webpack 的 `contenthash` 是正確更新快取的關鍵
