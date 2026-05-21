---
title: "前端部署：nginx 配置與快取策略"
date: 2018-06-12 17:34:52
tags:
  - 工程化
readingTime: 2
description: "寫了很多前端程式碼，但部署環節經常依賴運維同學。這次自己動手配了一個 nginx，把常見場景整理一下。"
wordCount: 223
---

寫了很多前端程式碼，但部署環節經常依賴運維同學。這次自己動手配了一個 nginx，把常見場景整理一下。

## 基礎：託管 SPA

```nginx
server {
  listen 80;
  server_name example.com;
  root /var/www/myapp/dist;
  index index.html;

  # SPA 關鍵配置：所有路徑都返回 index.html
  location / {
    try_files $uri $uri/ /index.html;
  }
}
```

`try_files $uri $uri/ /index.html` 的意思：

1. 先找檔案 `$uri`（如 `/static/main.js`）
2. 再找目錄 `$uri/`
3. 都沒有則返回 `/index.html`（交給前端路由處理）

## 快取配置

### HTML：不快取

```nginx
location ~* \.html$ {
  add_header Cache-Control "no-cache, no-store, must-revalidate";
  add_header Pragma "no-cache";
  add_header Expires 0;
}
```

### 帶 hash 的靜態資源：長期快取

```nginx
location ~* \.(js|css)$ {
  # 檔名帶 hash（如 app.a1b2c3d4.js），可以永久快取
  add_header Cache-Control "public, max-age=31536000, immutable";
}

location ~* \.(png|jpg|jpeg|gif|svg|ico|woff|woff2)$ {
  add_header Cache-Control "public, max-age=2592000";  # 30天
}
```

## gzip 壓縮

```nginx
http {
  gzip on;
  gzip_vary on;
  gzip_min_length 1024;  # 小於 1KB 不壓縮
  gzip_comp_level 6;     # 壓縮級別 1-9，6 是速度和壓縮率的平衡
  gzip_types
    text/plain
    text/css
    text/javascript
    application/javascript
    application/json
    application/xml
    image/svg+xml;
}
```

如果構建時已生成 `.gz` 檔案，可以直接使用，省去執行時壓縮：

```nginx
# Webpack 開啟 compression-webpack-plugin 生成 .gz 檔案
location ~* \.(js|css)$ {
  gzip_static on;  # 優先使用 .gz 靜態檔案
  add_header Cache-Control "public, max-age=31536000, immutable";
}
```

## HTTPS 配置

```nginx
server {
  listen 80;
  server_name example.com;
  return 301 https://$host$request_uri;  # HTTP 重定向到 HTTPS
}

server {
  listen 443 ssl http2;  # 開啟 HTTP/2
  server_name example.com;

  ssl_certificate /etc/letsencrypt/live/example.com/fullchain.pem;
  ssl_certificate_key /etc/letsencrypt/live/example.com/privkey.pem;

  # 安全配置
  ssl_protocols TLSv1.2 TLSv1.3;
  ssl_ciphers HIGH:!aNULL:!MD5;
  ssl_prefer_server_ciphers on;
  ssl_session_cache shared:SSL:10m;

  # HSTS：強制瀏覽器用 HTTPS
  add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;

  root /var/www/myapp/dist;
  # ... 其餘配置
}
```

## API 代理

前後端分離，前端直接請求後端 API 會有跨域問題，用 nginx 代理解決：

```nginx
server {
  # 前端資源
  location / {
    root /var/www/frontend/dist;
    try_files $uri $uri/ /index.html;
  }

  # API 請求代理到後端
  location /api/ {
    proxy_pass http://localhost:8080/;  # 轉發到後端服務
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;

    # WebSocket 支援
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
  }
}
```

## 安全響應頭

```nginx
# 在 server 塊或 http 塊裡新增
add_header X-Content-Type-Options "nosniff" always;
add_header X-Frame-Options "SAMEORIGIN" always;
add_header X-XSS-Protection "1; mode=block" always;
add_header Referrer-Policy "strict-origin-when-cross-origin" always;
add_header Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline'" always;
```

## 完整配置示例

```nginx
server {
  listen 443 ssl http2;
  server_name myapp.example.com;

  ssl_certificate /etc/ssl/cert.pem;
  ssl_certificate_key /etc/ssl/key.pem;

  root /var/www/myapp/dist;

  # 安全頭
  add_header X-Frame-Options SAMEORIGIN;
  add_header X-Content-Type-Options nosniff;

  # index.html - 不快取
  location = /index.html {
    add_header Cache-Control "no-cache";
  }

  # 帶 hash 的靜態資源 - 長期快取
  location ~* \.(js|css)$ {
    add_header Cache-Control "public, max-age=31536000, immutable";
    gzip_static on;
  }

  # 圖片
  location ~* \.(png|jpg|jpeg|gif|svg|ico|woff2)$ {
    add_header Cache-Control "public, max-age=2592000";
  }

  # SPA 路由
  location / {
    try_files $uri $uri/ /index.html;
  }

  # API 代理
  location /api/ {
    proxy_pass http://localhost:3000/;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
  }
}
```

## 小結

- SPA 必須配 `try_files ... /index.html`
- HTML 不快取，帶 hash 的資源永久快取
- 開 gzip 壓縮，JS 通常能壓縮 70%
- HTTPS + HTTP/2 是現代標配
