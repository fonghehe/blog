---
title: "Nginx 前端部署常用設定：實踐方法與治理思路"
date: 2018-12-06 10:15:04
tags:
  - 工程化
readingTime: 1
description: "前端項目部署到 Nginx 上，每次都要找設定，乾脆整理一份常用設定備查。"
wordCount: 124
---

前端項目部署到 Nginx 上，每次都要找配置，乾脆整理一份常用配置備查。

## 基礎設定：單頁應用

```nginx
server {
    listen 80;
    server_name example.com;

    root /var/www/dist;
    index index.html;

    # SPA 的關鍵配置：所有路徑都返回 index.html
    # Vue Router 的 history 模式需要這個
    location / {
        try_files $uri $uri/ /index.html;
    }

    # 靜態資源：長期緩存
    location ~* \.(js|css|png|jpg|gif|ico|svg|woff|woff2)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # HTML 文件：不緩存（確保拿到最新的入口文件）
    location ~* \.html$ {
        expires -1;
        add_header Cache-Control "no-cache, no-store, must-revalidate";
    }
}
```

## HTTPS 設定

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

    # HSTS（強製 HTTPS）
    add_header Strict-Transport-Security "max-age=31536000" always;

    root /var/www/dist;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

## 反向代理：前端調後端 API

```nginx
server {
    listen 80;
    server_name example.com;

    root /var/www/dist;

    location / {
        try_files $uri $uri/ /index.html;
    }

    # 把 /api 請求代理到後端服務
    location /api/ {
        proxy_pass http://localhost:3000/;  # 注意：末尾的 / 會去掉 /api 前綴

        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # 超時設置
        proxy_connect_timeout 30s;
        proxy_read_timeout 60s;
    }
}
```

## gzip 壓縮

```nginx
http {
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;    # 小於 1KB 的不壓縮
    gzip_comp_level 6;       # 壓縮級別 1-9，6 是平衡點
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

## 靜態資源緩存策略

```nginx
# 配合 webpack contenthash 的最優緩存策略：
# - HTML 入口檔案：不緩存，每次都拿最新的
# - JS/CSS（帶 hash）：永久緩存，因為內容變化時 hash 也變化

location = /index.html {
    add_header Cache-Control "no-cache";
}

location ~* \.[0-9a-f]{8}\.(js|css)$ {
    # 帶 hash 的文件，永久緩存
    expires 1y;
    add_header Cache-Control "public, immutable";
}
```

## 安全響應頭

```nginx
server {
    add_header X-Frame-Options SAMEORIGIN;           # 防點擊劫持
    add_header X-Content-Type-Options nosniff;       # 防 MIME 嗅探
    add_header X-XSS-Protection "1; mode=block";     # XSS 過濾
    add_header Referrer-Policy "same-origin";
}
```

## 小結

- SPA：`try_files $uri $uri/ /index.html` 支持 history 路由
- 緩存：JS/CSS 用 hash + 永久緩存，HTML 不緩存
- 反向代理：`proxy_pass` 把 `/api` 轉發到後端
- gzip：`gzip_types` 配置要壓縮的 MIME 類型
- HTTPS：HTTP 重定向到 HTTPS，加 HSTS 頭
