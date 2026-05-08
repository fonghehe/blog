---
title: "跨域请求的各种解决方案"
date: 2018-09-26 16:39:34
tags:
  - 前端
---

跨域是前端开发绕不过去的问题。整理一下常见的解决方案，以及各自的适用场景。

## 什么是跨域

浏览器的同源策略：协议、域名、端口任意一个不同就是跨域。

```
https://api.example.com  和  https://www.example.com  → 跨域（子域名不同）
http://example.com       和  https://example.com      → 跨域（协议不同）
https://example.com      和  https://example.com:8080 → 跨域（端口不同）
https://example.com      和  https://example.com      → 同源 ✅
```

## 方案一：CORS（最推荐）

服务端设置响应头，允许跨域请求：

```javascript
// Node.js / Express
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "https://www.example.com");
  // 或者允许所有来源（开发环境）
  res.setHeader("Access-Control-Allow-Origin", "*");

  res.setHeader(
    "Access-Control-Allow-Methods",
    "GET, POST, PUT, DELETE, OPTIONS",
  );
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Access-Control-Allow-Credentials", "true"); // 允许携带 cookie

  if (req.method === "OPTIONS") {
    // 预检请求
    res.status(200).end();
    return;
  }

  next();
});
```

**前端注意事项：**

```javascript
// 跨域请求携带 cookie：需要两边都配置
fetch("https://api.example.com/data", {
  credentials: "include", // 携带 cookie
});

// axios
axios.defaults.withCredentials = true;
```

**注意**：`Access-Control-Allow-Origin` 为 `*` 时，不能同时设 `Access-Control-Allow-Credentials: true`。

## 方案二：开发环境代理

开发环境最简单的方案，webpack dev server 做代理：

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

前端请求 `/api/users` → 代理转发到 `https://api.example.com/users`。

浏览器看到的是同域请求（都是 localhost），没有跨域问题。

## 方案三：Nginx 反向代理

生产环境常用，在 Nginx 层做代理：

```nginx
server {
  listen 80;
  server_name www.example.com;

  location / {
    root /var/www/html;
    try_files $uri $uri/ /index.html;
  }

  # 代理 API 请求
  location /api {
    proxy_pass https://api.internal.com;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
  }
}
```

前端只需要请求同域的 `/api`，Nginx 负责转发。

## 方案四：JSONP（已过时）

只支持 GET 请求，利用 script 标签不受同源策略限制：

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

// 服务端需要返回：callbackName({"key": "value"})
```

现在几乎不用了，CORS 更好。

## 方案五：postMessage（iframe 通信）

不同域的 iframe 或窗口之间通信：

```javascript
// 父页面：发送消息
const iframe = document.getElementById("myFrame");
iframe.contentWindow.postMessage(
  { type: "REQUEST_DATA", payload: { id: 1 } },
  "https://other.example.com", // 目标域名，必须指定
);

// iframe 页面：接收消息
window.addEventListener("message", (e) => {
  // 安全检查：验证来源
  if (e.origin !== "https://www.example.com") return;

  const { type, payload } = e.data;

  if (type === "REQUEST_DATA") {
    // 处理请求，回复父页面
    e.source.postMessage({ type: "RESPONSE_DATA", data: result }, e.origin);
  }
});
```

## 方案六：document.domain（同主域不同子域）

只适用于同主域（如 `a.example.com` 和 `b.example.com`）：

```javascript
// a.example.com 和 b.example.com 都设置：
document.domain = "example.com";
// 然后就可以互相访问 document 了
```

这个方案有安全问题，新版浏览器已在逐步废弃。

## 各方案对比

| 方案        | 适用场景        | 优点                       | 缺点                   |
| ----------- | --------------- | -------------------------- | ---------------------- |
| CORS        | 所有场景        | 标准方案，支持所有请求类型 | 需要服务端配合         |
| 开发代理    | 仅开发环境      | 配置简单                   | 生产环境无效           |
| Nginx 代理  | 生产环境        | 前端无感知                 | 需要运维配合           |
| JSONP       | 历史遗留        | 兼容老浏览器               | 只支持 GET，有安全风险 |
| postMessage | iframe/窗口通信 | 跨域通信的标准方式         | 只适合特定场景         |

## 小结

- 项目推荐用 CORS + Nginx 代理的组合
- 开发环境用 webpack devServer proxy，零配置
- JSONP 基本可以忘掉了，除非维护老项目
- `postMessage` 是 iframe 通信的正确方式，注意验证 `e.origin`
