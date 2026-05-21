---
title: "HTTP/2 對前端資源載入的實際影響"
date: 2018-02-13 17:42:20
tags:
  - 前端
readingTime: 3
description: "HTTP/2 已經推出幾年了，但很多前端開發者還不清楚它到底改變了什麼，以及對前端最佳化策略的影響。這篇文章講實際的變化。"
wordCount: 709
---

HTTP/2 已經推出幾年了，但很多前端開發者還不清楚它到底改變了什麼，以及對前端最佳化策略的影響。這篇文章講實際的變化。

## HTTP/1.1 的主要瓶頸

在 HTTP/1.1 時代，瀏覽器對同一域名的併發請求數有限制（一般 6 個）。這導致了一個經典問題：

```
資源 1 ──── 等待 ──────── 載入
資源 2 ──── 等待 ──────────── 載入
資源 3 ──── 等待 ────────────── 載入
資源 4                 ─── 等待 ──── 載入
資源 5                 ─── 等待 ──────── 載入
資源 6                 ─── 等待 ────────── 載入
```

為了繞過這個限制，我們發明了很多"技巧"：

- **Domain Sharding**（域名分片）：把資源分佈到多個子域名
- **Image Sprites**（雪碧圖）：把多個小圖合併成一張大圖
- **檔案合併**：把多個 JS/CSS 合併成一個大檔案

## HTTP/2 的多路複用

HTTP/2 的核心改進是**多路複用（Multiplexing）**：一條 TCP 連線可以同時傳輸多個請求和響應，不再有併發數限制。

```
HTTP/1.1                    HTTP/2

請求1  ───────── 響應1      請求1 ─┐ 響應1 ─┐
等待...                     請求2  ├──────  ├── 同時
請求2  ───────── 響應2      請求3  ┘ 響應2  │
等待...                           響應3 ─┘
請求3  ───────── 響應3
```

## 對前端最佳化策略的影響

### Domain Sharding 不再必要

HTTP/1.1 時代，`cdn1.example.com`、`cdn2.example.com` 繞過併發限制，現在反而有害：

- HTTP/2 多路複用在同一連線上工作
- 多域名 = 多條 TCP 連線 = 更多握手開銷
- **結論**：HTTP/2 下合併到同一域名更好

### 檔案合併策略變了

HTTP/1.1：把所有 JS 合併成一個大檔案，減少請求數
HTTP/2：請求數不再是瓶頸，可以適當拆分檔案

```javascript
// HTTP/1.1 時代的 Webpack 配置思路
// 儘量合併，減少檔案數

// HTTP/2 時代
// 可以按模組拆分，利用瀏覽器快取的細粒度
optimization: {
  splitChunks: {
    cacheGroups: {
      vue: { test: /vue/, name: 'vue', chunks: 'all' },
      axios: { test: /axios/, name: 'axios', chunks: 'all' },
      elementUI: { test: /element-ui/, name: 'element-ui', chunks: 'all' }
    }
  }
}
```

細粒度拆分的好處：`vue` 版本不變的話，使用者訪問新版本時不需要重新下載 `vue.js`。

### Server Push

HTTP/2 支援伺服器主動推送資源：

```
瀏覽器: 請求 index.html
伺服器: 給你 index.html，順便給你 main.css 和 main.js（你等會肯定要的）
瀏覽器: （main.css 和 main.js 已經在本地了，不用再請求了）
```

Nginx 配置 Server Push：

```nginx
location = /index.html {
  http2_push /static/main.css;
  http2_push /static/main.js;
}
```

### 雪碧圖依然有價值（部分場景）

雖然 HTTP/2 解決了請求併發問題，但每個小圖示都是獨立檔案的話，有些開銷還是存在的（連線建立、TLS 握手等對 HTTP/2 影響小，但圖示通常還有其他原因合併）。

**Icon font 或 SVG Sprite 依然是更好的圖示方案**，但不是因為請求數，而是因為可控性和可維護性。

## 檢查你的網站是否使用 HTTP/2

在 Chrome DevTools 的 Network 面板，右鍵表頭，開啟 "Protocol" 列：

- `h2` = HTTP/2
- `http/1.1` = HTTP/1.1

如果你的伺服器還沒升級 HTTP/2，以下是 Nginx 的配置方式：

```nginx
server {
  listen 443 ssl http2;          # 關鍵：加上 http2
  ssl_certificate /path/to/cert.pem;
  ssl_certificate_key /path/to/key.pem;

  # HTTP/2 需要 HTTPS，所以先確保 HTTPS 配置正確
}
```

## 實際壓測資料（參考）

在我們的中後臺專案（約 30 個 JS/CSS 檔案）對比：

| 場景                 | 首次載入時間 |
| 
-------------------- | ------------ |
| HTTP/1.1             | 2.8s         |
| HTTP/2               | 1.6s         |
| HTTP/2 + Server Push | 1.2s         |

不同網路環境差異較大，但 HTTP/2 的改善通常是明顯的。

## 小結

- HTTP/2 多路複用解決了併發限制，很多 HTTP/1.1 時代的"最佳化技巧"不再必要
- 域名分片反而有害，合併到同一域名更好
- 檔案可以適當細粒度拆分，提高快取利用率
- Server Push 是額外增益，但需要服務端支援
- 升級 HTTP/2 需要先有 HTTPS
