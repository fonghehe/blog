---
title: "Nginx 前端部署常用配置"
date: 2018-12-06 10:15:04
tags:
  - 工程化
readingTime: 1
description: "前端项目部署到 Nginx 上，每次都要找配置，干脆整理一份常用配置备查。"
---

前端项目部署到 Nginx 上，每次都要找配置，干脆整理一份常用配置备查。

## 基础配置：单页应用

```nginx
server {
    listen 80;
    server_name example.com;

    root /var/www/dist;
    index index.html;

    # SPA 的关键配置：所有路径都返回 index.html
    # Vue Router 的 history 模式需要这个
    location / {
        try_files $uri $uri/ /index.html;
    }

    # 静态资源：长期缓存
    location ~* \.(js|css|png|jpg|gif|ico|svg|woff|woff2)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # HTML 文件：不缓存（确保拿到最新的入口文件）
    location ~* \.html$ {
        expires -1;
        add_header Cache-Control "no-cache, no-store, must-revalidate";
    }
}
```

## HTTPS 配置

```nginx
server {
    listen 80;
    server_name example.com;
    # HTTP 重定向到 HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name example.com;

    ssl_certificate     /etc/ssl/example.com.crt;
    ssl_certificate_key /etc/ssl/example.com.key;

    # 安全配置
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-RSA-AES256-GCM-SHA512:DHE-RSA-AES256-GCM-SHA512;
    ssl_prefer_server_ciphers off;

    # HSTS（强制 HTTPS）
    add_header Strict-Transport-Security "max-age=31536000" always;

    root /var/www/dist;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

## 反向代理：前端调后端 API

```nginx
server {
    listen 80;
    server_name example.com;

    root /var/www/dist;

    location / {
        try_files $uri $uri/ /index.html;
    }

    # 把 /api 请求代理到后端服务
    location /api/ {
        proxy_pass http://localhost:3000/;  # 注意：末尾的 / 会去掉 /api 前缀

        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # 超时设置
        proxy_connect_timeout 30s;
        proxy_read_timeout 60s;
    }
}
```

## gzip 压缩

```nginx
http {
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;    # 小于 1KB 的不压缩
    gzip_comp_level 6;       # 压缩级别 1-9，6 是平衡点
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

## 静态资源缓存策略

```nginx
# 配合 webpack contenthash 的最优缓存策略：
# - HTML 入口文件：不缓存，每次都拿最新的
# - JS/CSS（带 hash）：永久缓存，因为内容变化时 hash 也变化

location = /index.html {
    add_header Cache-Control "no-cache";
}

location ~* \.[0-9a-f]{8}\.(js|css)$ {
    # 带 hash 的文件，永久缓存
    expires 1y;
    add_header Cache-Control "public, immutable";
}
```

## 安全响应头

```nginx
server {
    add_header X-Frame-Options SAMEORIGIN;           # 防点击劫持
    add_header X-Content-Type-Options nosniff;       # 防 MIME 嗅探
    add_header X-XSS-Protection "1; mode=block";     # XSS 过滤
    add_header Referrer-Policy "same-origin";
}
```

## 小结

- SPA：`try_files $uri $uri/ /index.html` 支持 history 路由
- 缓存：JS/CSS 用 hash + 永久缓存，HTML 不缓存
- 反向代理：`proxy_pass` 把 `/api` 转发到后端
- gzip：`gzip_types` 配置要压缩的 MIME 类型
- HTTPS：HTTP 重定向到 HTTPS，加 HSTS 头
