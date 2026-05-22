---
title: "Nginx 前端設定完全指南：落地路徑與實戰建議"
date: 2019-03-28 11:14:57
tags:
  - 工程化
readingTime: 1
description: "前端工程師不懂 Nginx 設定，很多部署問題沒法自己解決。整理一份常用設定手冊。"
wordCount: 171
---

前端工程師不懂 Nginx 配置，很多部署問題沒法自己解決。整理一份常用配置手冊。

## 基礎：SPA 路由支援

```nginx
server {
  listen 80;
  server_name example.com;
  root /var/www/html;
  index index.html;

  # SPA 路由：所有路徑都返回 index.html
  location / {
    try_files $uri $uri/ /index.html;
  }
}
```

不配這個，vue-router history 模式刷新會 404。

## HTTPS 設定

```nginx
server {
  listen 443 ssl http2;
  server_name example.com;

  ssl_certificate     /etc/ssl/certs/example.com.pem;
  ssl_certificate_key /etc/ssl/private/example.com.key;

  # SSL 性能優化
  ssl_session_cache shared:SSL:10m;
  ssl_session_timeout 1d;
  ssl_protocols TLSv1.2 TLSv1.3;
  ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256;
  ssl_prefer_server_ciphers off;

  # HSTS（讓瀏覽器記住隻用 HTTPS）
  add_header Strict-Transport-Security "max-age=63072000" always;
}

# HTTP 重定向到 HTTPS
server {
  listen 80;
  server_name example.com;
  return 301 https://$host$request_uri;
}
```

## 靜態資源緩存

```nginx
server {
  # HTML：不緩存
  location ~* \.html$ {
    add_header Cache-Control "no-cache, must-revalidate";
  }

  # 帶 hash 的 JS/CSS：長期緩存
  location ~* \.(js|css)$ {
    add_header Cache-Control "public, max-age=31536000, immutable";
  }

  # 圖片/字體
  location ~* \.(jpg|jpeg|png|webp|gif|ico|svg|woff2|woff|ttf)$ {
    add_header Cache-Control "public, max-age=2592000";
    add_header Vary "Accept-Encoding";
  }
}
```

## Gzip 壓縮

```nginx
http {
  gzip on;
  gzip_vary on;
  gzip_min_length 1024;
  gzip_proxied expired no-cache no-store private auth;
  gzip_types
    text/plain
    text/css
    text/javascript
    application/javascript
    application/json
    application/xml
    image/svg+xml;
  gzip_comp_level 6;
}
```

Webpack 構建時可以預先生成 `.gz` 文件（`compression-webpack-plugin`），Nginx 直接發送：

```nginx
location ~* \.(js|css|html)$ {
  gzip_static on;  # 優先發送 .gz 文件
}
```

## 反向代理（解決跨域）

```nginx
server {
  # 前端靜態文件
  location / {
    try_files $uri $uri/ /index.html;
  }

  # 代理 API 請求（/api/* → 後端服務）
  location /api/ {
    proxy_pass http://backend:3000/;  # 注意結尾的 /
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;

    # WebSocket 支持
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
  }
}
```

## 安全頭

```nginx
add_header X-Frame-Options "SAMEORIGIN" always;
add_header X-Content-Type-Options "nosniff" always;
add_header X-XSS-Protection "1; mode=block" always;
add_header Referrer-Policy "strict-origin-when-cross-origin" always;
add_header Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline';" always;
```

## 負載平衡

```nginx
upstream backend {
  least_conn;  # 最少連接數算法
  server backend1:3000 weight=3;
  server backend2:3000 weight=1;
  server backend3:3000 backup;  # 備用，隻有前兩個都掛了才用

  keepalive 32;  # 長連接池
}

server {
  location /api/ {
    proxy_pass http://backend;
  }
}
```

## 小結

- `try_files $uri $uri/ /index.html` 是 SPA 路由的關鍵
- HTTPS 配置加上 HSTS，防止中間人攻擊
- 帶 hash 的靜態文件長期緩存，HTML 不緩存
- Gzip 壓縮對 JS/CSS 能減少 60-70% 體積
- 反向代理解決前後端跨域，同時隱藏後端地址
