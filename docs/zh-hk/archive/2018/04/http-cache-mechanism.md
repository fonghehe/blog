---
title: "HTTP 緩存機製：強緩存與協商緩存"
date: 2018-04-25 16:13:17
tags:
  - 前端
readingTime: 2
description: "HTTP 緩存設定正確可以顯著提升頁面加載效能，但設定錯誤會導致用户看不到最新內容。理解原理後才能做出合理決策。"
wordCount: 459
---

HTTP 緩存配置正確可以顯著提升頁面加載性能，但配置錯誤會導致用户看不到最新內容。理解原理後才能做出合理決策。

## 緩存的兩種類型

```
瀏覽器發起請求
    ↓
是否有緩存？ → 沒有 → 向服務器請求 → 存儲緩存 → 返回
    ↓ 有
強緩存有效？ → 是 → 直接用緩存（不請求服務器）200 from cache
    ↓ 否
向服務器發協商請求 → 未變化 → 304 Not Modified，用緩存
                   → 已變化 → 200，新內容
```

## 強緩存

瀏覽器判斷緩存是否還有效，有效則直接使用，**完全不發請求**。

### Cache-Control（HTTP/1.1，優先）

```
# 服務器響應頭
Cache-Control: max-age=31536000   # 緩存 1 年（秒）
Cache-Control: no-cache           # 不用強緩存，但可以協商緩存
Cache-Control: no-store           # 完全不緩存
Cache-Control: private            # 隻能瀏覽器緩存，CDN 不緩存
Cache-Control: public             # 瀏覽器和 CDN 都可緩存
```

### Expires（HTTP/1.0，低優先級）

```
Expires: Thu, 01 Jan 2019 00:00:00 GMT   # 過期時間（絕對時間）
```

缺點：依賴客户端時鐘，客户端時間不準會有問題。被 `Cache-Control` 取代。

## 協商緩存

瀏覽器攜帶緩存標識向服務器請求，服務器判斷資源是否變化。

### Last-Modified / If-Modified-Since

```
# 第一次請求，服務器響應
Last-Modified: Mon, 01 Jan 2018 10:00:00 GMT

# 後續請求，瀏覽器攜帶
If-Modified-Since: Mon, 01 Jan 2018 10:00:00 GMT

# 服務器判斷：資源沒變化
HTTP/1.1 304 Not Modified

# 服務器判斷：資源變化了
HTTP/1.1 200 OK
Last-Modified: Mon, 15 Jan 2018 09:30:00 GMT
[新的內容]
```

**缺點**：精度是秒級，1 秒內多次修改無法感知。

### ETag / If-None-Match（更精準）

```
# 第一次請求，服務器響應
ETag: "abc123"  # 內容的哈希值

# 後續請求
If-None-Match: "abc123"

# 服務器比較 ETag
HTTP/1.1 304 Not Modified  # 或 200 + 新 ETag
```

ETag 是內容摘要，隻要內容變了 ETag 就變，更精準。

## 前端資源的最佳緩存策略

### HTML 檔案：不緩存或協商緩存

```nginx
location ~* \.html$ {
  add_header Cache-Control "no-cache";
}
```

原因：HTML 是入口，必須能及時更新，讓用户拿到最新的 JS/CSS 文件名。

### 帶 hash 的 JS/CSS：強緩存最大化

```nginx
location ~* \.(js|css)$ {
  add_header Cache-Control "public, max-age=31536000, immutable";
}
```

Webpack 打包時文件名帶 content hash：

```javascript
// webpack.config.js
output: {
  filename: 'js/[name].[contenthash:8].js',
  chunkFilename: 'js/[name].[contenthash:8].chunk.js'
}
```

這樣 `app.a1b2c3d4.js` 內容不變哈希不變，內容變了文件名也變（自動緩存失效）。可以放心設置 1 年強緩存。

### 圖片和字體

```nginx
location ~* \.(jpg|jpeg|png|gif|svg|woff2|ttf)$ {
  add_header Cache-Control "public, max-age=2592000";  # 30天
}
```

## Vue CLI / Webpack 的正確設定

```javascript
// vue.config.js
module.exports = {
  filenameHashing: true, // 默認開啓檔案名雜湊

  chainWebpack: (config) => {
    // 確保 index.html 不緩存
    config.plugin("html").tap((args) => {
      args[0].cache = false;
      return args;
    });
  },
};
```

## 驗證緩存是否生效

Chrome DevTools → Network 面板：

- `200 (from memory cache)` — 強緩存（內存）
- `200 (from disk cache)` — 強緩存（磁盤）
- `304 Not Modified` — 協商緩存命中
- `200` — 緩存未命中，從服務器獲取

**Size 列為 0** 説明緩存命中，沒有實際傳輸數據。

## 小結

- HTML 不要強緩存，用 `no-cache` 確保每次驗證
- JS/CSS 帶 hash 文件名，可以放心設最長強緩存
- 協商緩存（ETag）比 Last-Modified 更精準
- Webpack 的 `contenthash` 是正確更新緩存的關鍵
