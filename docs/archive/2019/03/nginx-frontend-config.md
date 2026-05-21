---
title: "Nginx 前端配置完全指南"
date: 2019-03-28 11:14:57
tags:
  - 工程化
readingTime: 1
description: "前端工程师不懂 Nginx 配置，很多部署问题没法自己解决。整理一份常用配置手册。"
wordCount: 171
---

前端工程师不懂 Nginx 配置，很多部署问题没法自己解决。整理一份常用配置手册。

## 基础：SPA 路由支持

```nginx
server {
  listen 80;
  server_name example.com;
  root /var/www/html;
  index index.html;

  # SPA 路由：所有路径都返回 index.html
  location / {
    try_files $uri $uri/ /index.html;
  }
}
```

不配这个，vue-router history 模式刷新会 404。

## HTTPS 配置

```nginx
server {
  listen 443 ssl http2;
  server_name example.com;

  ssl_certificate     /etc/ssl/certs/example.com.pem;
  ssl_certificate_key /etc/ssl/private/example.com.key;

  # SSL 性能优化
  ssl_session_cache shared:SSL:10m;
  ssl_session_timeout 1d;
  ssl_protocols TLSv1.2 TLSv1.3;
  ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256;
  ssl_prefer_server_ciphers off;

  # HSTS（让浏览器记住只用 HTTPS）
  add_header Strict-Transport-Security "max-age=63072000" always;
}

# HTTP 重定向到 HTTPS
server {
  listen 80;
  server_name example.com;
  return 301 https://$host$request_uri;
}
```

## 静态资源缓存

```nginx
server {
  # HTML：不缓存
  location ~* \.html$ {
    add_header Cache-Control "no-cache, must-revalidate";
  }

  # 带 hash 的 JS/CSS：长期缓存
  location ~* \.(js|css)$ {
    add_header Cache-Control "public, max-age=31536000, immutable";
  }

  # 图片/字体
  location ~* \.(jpg|jpeg|png|webp|gif|ico|svg|woff2|woff|ttf)$ {
    add_header Cache-Control "public, max-age=2592000";
    add_header Vary "Accept-Encoding";
  }
}
```

## Gzip 压缩

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

Webpack 构建时可以预先生成 `.gz` 文件（`compression-webpack-plugin`），Nginx 直接发送：

```nginx
location ~* \.(js|css|html)$ {
  gzip_static on;  # 优先发送 .gz 文件
}
```

## 反向代理（解决跨域）

```nginx
server {
  # 前端静态文件
  location / {
    try_files $uri $uri/ /index.html;
  }

  # 代理 API 请求（/api/* → 后端服务）
  location /api/ {
    proxy_pass http://backend:3000/;  # 注意结尾的 /
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

## 安全头

```nginx
add_header X-Frame-Options "SAMEORIGIN" always;
add_header X-Content-Type-Options "nosniff" always;
add_header X-XSS-Protection "1; mode=block" always;
add_header Referrer-Policy "strict-origin-when-cross-origin" always;
add_header Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline';" always;
```

## 负载均衡

```nginx
upstream backend {
  least_conn;  # 最少连接数算法
  server backend1:3000 weight=3;
  server backend2:3000 weight=1;
  server backend3:3000 backup;  # 备用，只有前两个都挂了才用

  keepalive 32;  # 长连接池
}

server {
  location /api/ {
    proxy_pass http://backend;
  }
}
```

## 小结

- `try_files $uri $uri/ /index.html` 是 SPA 路由的关键
- HTTPS 配置加上 HSTS，防止中间人攻击
- 带 hash 的静态文件长期缓存，HTML 不缓存
- Gzip 压缩对 JS/CSS 能减少 60-70% 体积
- 反向代理解决前后端跨域，同时隐藏后端地址
