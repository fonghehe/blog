---
title: "跨域請求的各種解決方案"
date: 2018-09-26 16:39:34
tags:
  - 前端
readingTime: 3
description: "跨域是前端開發繞不過去的問題。整理一下常見的解決方案，以及各自的適用場景。"
---

跨域是前端開發繞不過去的問題。整理一下常見的解決方案，以及各自的適用場景。

## 什麼是跨域

瀏覽器的同源策略：協議、域名、端口任意一個不同就是跨域。

```
https://api.example.com  和  https://www.example.com  → 跨域（子域名不同）
http://example.com       和  https://example.com      → 跨域（協議不同）
https://example.com      和  https://example.com:8080 → 跨域（端口不同）
https://example.com      和  https://example.com      → 同源 ✅
```

## 方案一：CORS（最推薦）

服務端設置響應頭，允許跨域請求：

```javascript
// Node.js / Express
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "https://www.example.com");
  // 或者允許所有來源（開發環境）
  res.setHeader("Access-Control-Allow-Origin", "*");

  res.setHeader(
    "Access-Control-Allow-Methods",
    "GET, POST, PUT, DELETE, OPTIONS",
  );
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Access-Control-Allow-Credentials", "true"); // 允許攜帶 cookie

  if (req.method === "OPTIONS") {
    // 預檢請求
    res.status(200).end();
    return;
  }

  next();
});
```

**前端注意事項：**

```javascript
// 跨域請求攜帶 cookie：需要兩邊都配置
fetch("https://api.example.com/data", {
  credentials: "include", // 攜帶 cookie
});

// axios
axios.defaults.withCredentials = true;
```

**注意**：`Access-Control-Allow-Origin` 為 `*` 時，不能同時設 `Access-Control-Allow-Credentials: true`。

## 方案二：開發環境代理

開發環境最簡單的方案，webpack dev server 做代理：

```javascript
// vue.config.js
module.exports = {
  devServer: {
    proxy: {
      "/api": {
        target: "https://api.example.com",
        changeOrigin: true,
        pathRewrite: { "^/api": "" },
      },
    },
  },
};
```

前端請求 `/api/users` → 代理轉發到 `https://api.example.com/users`。

瀏覽器看到的是同域請求（都是 localhost），沒有跨域問題。

## 方案三：Nginx 反向代理

生產環境常用，在 Nginx 層做代理：

```nginx
server {
  listen 80;
  server_name www.example.com;

  location / {
    root /var/www/html;
    try_files $uri $uri/ /index.html;
  }

  # 代理 API 請求
  location /api {
    proxy_pass https://api.internal.com;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
  }
}
```

前端只需要請求同域的 `/api`，Nginx 負責轉發。

## 方案四：JSONP（已過時）

只支持 GET 請求，利用 script 標籤不受同源策略限制：

```javascript
// 前端
function jsonp(url, callback) {
  const callbackName = `jsonp_${Date.now()}`;
  window[callbackName] = (data) => {
    callback(data);
    delete window[callbackName];
    script.remove();
  };

  const script = document.createElement("script");
  script.src = `${url}?callback=${callbackName}`;
  document.head.appendChild(script);
}

jsonp("https://api.example.com/data", (data) => {
  console.log(data);
});

// 服務端需要返回：callbackName({"key": "value"})
```

現在幾乎不用了，CORS 更好。

## 方案五：postMessage（iframe 通信）

不同域的 iframe 或窗口之間通信：

```javascript
// 父頁面：發送消息
const iframe = document.getElementById("myFrame");
iframe.contentWindow.postMessage(
  { type: "REQUEST_DATA", payload: { id: 1 } },
  "https://other.example.com", // 目標域名，必須指定
);

// iframe 頁面：接收消息
window.addEventListener("message", (e) => {
  // 安全檢查：驗證來源
  if (e.origin !== "https://www.example.com") return;

  const { type, payload } = e.data;

  if (type === "REQUEST_DATA") {
    // 處理請求，回覆父頁面
    e.source.postMessage({ type: "RESPONSE_DATA", data: result }, e.origin);
  }
});
```

## 方案六：document.domain（同主域不同子域）

只適用於同主域（如 `a.example.com` 和 `b.example.com`）：

```javascript
// a.example.com 和 b.example.com 都設置：
document.domain = "example.com";
// 然後就可以互相訪問 document 了
```

這個方案有安全問題，新版瀏覽器已在逐步廢棄。

## 各方案對比

| 方案        | 適用場景        | 優點                       | 缺點                   |
| 
----------- | --------------- | -------------------------- | ---------------------- |
| CORS        | 所有場景        | 標準方案，支持所有請求類型 | 需要服務端配合         |
| 開發代理    | 僅開發環境      | 配置簡單                   | 生產環境無效           |
| Nginx 代理  | 生產環境        | 前端無感知                 | 需要運維配合           |
| JSONP       | 歷史遺留        | 兼容老瀏覽器               | 只支持 GET，有安全風險 |
| postMessage | iframe/窗口通信 | 跨域通信的標準方式         | 只適合特定場景         |

## 小結

- 項目推薦用 CORS + Nginx 代理的組合
- 開發環境用 webpack devServer proxy，零配置
- JSONP 基本可以忘掉了，除非維護老項目
- `postMessage` 是 iframe 通信的正確方式，注意驗證 `e.origin`
