---
title: "前端部署：nginx 配置与缓存策略"
date: 2018-06-12 17:34:52
tags:
  - 工程化
---

写了很多前端代码，但部署环节经常依赖运维同学。这次自己动手配了一个 nginx，把常见场景整理一下。

## 基础：托管 SPA

```nginx
server {
  listen 80;
  server_name example.com;
  root /var/www/myapp/dist;
  index index.html;

  # SPA 关键配置：所有路径都返回 index.html
  location / {
    try_files $uri $uri/ /index.html;
  }
}
```

`try_files $uri $uri/ /index.html` 的意思：

1. 先找文件 `$uri`（如 `/static/main.js`）
2. 再找目录 `$uri/`
3. 都没有则返回 `/index.html`（交给前端路由处理）

## 缓存配置

### HTML：不缓存

```nginx
location ~* \.html$ {
  add_header Cache-Control "no-cache, no-store, must-revalidate";
  add_header Pragma "no-cache";
  add_header Expires 0;
}
```

### 带 hash 的静态资源：长期缓存

```nginx
location ~* \.(js|css)$ {
  # 文件名带 hash（如 app.a1b2c3d4.js），可以永久缓存
  add_header Cache-Control "public, max-age=31536000, immutable";
}

location ~* \.(png|jpg|jpeg|gif|svg|ico|woff|woff2)$ {
  add_header Cache-Control "public, max-age=2592000";  # 30天
}
```

## gzip 压缩

```nginx
http {
  gzip on;
  gzip_vary on;
  gzip_min_length 1024;  # 小于 1KB 不压缩
  gzip_comp_level 6;     # 压缩级别 1-9，6 是速度和压缩率的平衡
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

如果构建时已生成 `.gz` 文件，可以直接使用，省去运行时压缩：

```nginx
# Webpack 开启 compression-webpack-plugin 生成 .gz 文件
location ~* \.(js|css)$ {
  gzip_static on;  # 优先使用 .gz 静态文件
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
  listen 443 ssl http2;  # 开启 HTTP/2
  server_name example.com;

  ssl_certificate /etc/letsencrypt/live/example.com/fullchain.pem;
  ssl_certificate_key /etc/letsencrypt/live/example.com/privkey.pem;

  # 安全配置
  ssl_protocols TLSv1.2 TLSv1.3;
  ssl_ciphers HIGH:!aNULL:!MD5;
  ssl_prefer_server_ciphers on;
  ssl_session_cache shared:SSL:10m;

  # HSTS：强制浏览器用 HTTPS
  add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;

  root /var/www/myapp/dist;
  # ... 其余配置
}
```

## API 代理

前后端分离，前端直接请求后端 API 会有跨域问题，用 nginx 代理解决：

```nginx
server {
  # 前端资源
  location / {
    root /var/www/frontend/dist;
    try_files $uri $uri/ /index.html;
  }

  # API 请求代理到后端
  location /api/ {
    proxy_pass http://localhost:8080/;  # 转发到后端服务
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;

    # WebSocket 支持
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
  }
}
```

## 安全响应头

```nginx
# 在 server 块或 http 块里添加
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

  # 安全头
  add_header X-Frame-Options SAMEORIGIN;
  add_header X-Content-Type-Options nosniff;

  # index.html - 不缓存
  location = /index.html {
    add_header Cache-Control "no-cache";
  }

  # 带 hash 的静态资源 - 长期缓存
  location ~* \.(js|css)$ {
    add_header Cache-Control "public, max-age=31536000, immutable";
    gzip_static on;
  }

  # 图片
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

## 小结

- SPA 必须配 `try_files ... /index.html`
- HTML 不缓存，带 hash 的资源永久缓存
- 开 gzip 压缩，JS 通常能压缩 70%
- HTTPS + HTTP/2 是现代标配
