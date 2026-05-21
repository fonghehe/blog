---
title: "Cross-Origin Request Solutions"
date: 2018-09-26 16:39:34
tags:
  - Frontend
readingTime: 2
description: "Cross-origin issues are unavoidable in frontend development. Here's an overview of common solutions and when to use each one."
wordCount: 157
---

Cross-origin issues are unavoidable in frontend development. Here's an overview of common solutions and when to use each one.

## What is Cross-Origin

The browser's same-origin policy: any difference in protocol, domain, or port constitutes cross-origin.

```
https://api.example.com  vs  https://www.example.com  → cross-origin (different subdomain)
http://example.com       vs  https://example.com       → cross-origin (different protocol)
https://example.com      vs  https://example.com:8080  → cross-origin (different port)
https://example.com      vs  https://example.com       → same-origin ✅
```

## Solution 1: CORS (Most Recommended)

Set response headers on the server to allow cross-origin requests:

```javascript
// Node.js / Express
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "https://www.example.com");
  // Or allow all origins (development)
  res.setHeader("Access-Control-Allow-Origin", "*");

  res.setHeader(
    "Access-Control-Allow-Methods",
    "GET, POST, PUT, DELETE, OPTIONS",
  );
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Access-Control-Allow-Credentials", "true"); // Allow cookies

  if (req.method === "OPTIONS") {
    // Preflight request
    res.status(200).end();
    return;
  }

  next();
});
```

**Frontend notes:**

```javascript
// Cross-origin requests with cookies: both sides need configuration
fetch("https://api.example.com/data", {
  credentials: "include", // Send cookies
});

// axios
axios.defaults.withCredentials = true;
```

**Note**: When `Access-Control-Allow-Origin` is `*`, you cannot also set `Access-Control-Allow-Credentials: true`.

## Solution 2: Dev Proxy

Simplest solution for development — webpack dev server proxies requests:

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

Frontend requests `/api/users` → proxied to `https://api.example.com/users`. The browser sees same-origin requests (all localhost) — no cross-origin issue.

## Solution 3: Nginx Reverse Proxy

Common in production — proxy at the Nginx layer:

```nginx
server {
  listen 80;
  server_name www.example.com;

  location / {
    root /var/www/html;
    try_files $uri $uri/ /index.html;
  }

  # Proxy API requests
  location /api {
    proxy_pass https://api.internal.com;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
  }
}
```

The frontend only requests same-origin `/api`; Nginx handles the forwarding.

## Solution 4: JSONP (Outdated)

Only supports GET. Exploits the fact that `<script>` tags aren't restricted by same-origin policy:

```javascript
// Frontend
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

// Server must return: callbackName({"key": "value"})
```

Rarely used now — CORS is better.

## Solution 5: postMessage (iframe Communication)

Communication between iframes or windows from different origins:

```javascript
// Parent page: send a message
const iframe = document.getElementById("myFrame");
iframe.contentWindow.postMessage(
  { type: "REQUEST_DATA", payload: { id: 1 } },
  "https://other.example.com", // Target origin — must be specified
);

// iframe page: receive a message
window.addEventListener("message", (e) => {
  // Security check: verify origin
  if (e.origin !== "https://www.example.com") return;

  const { type, payload } = e.data;

  if (type === "REQUEST_DATA") {
    // Handle request, reply to parent
    e.source.postMessage({ type: "RESPONSE_DATA", data: result }, e.origin);
  }
});
```
