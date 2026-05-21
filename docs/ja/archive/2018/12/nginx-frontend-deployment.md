---
title: "NginxフロントエンドデプロイのTips集"
date: 2018-12-06 10:15:04
tags:
  - エンジニアリング
readingTime: 1
description: "フロントエンドプロジェクトをNginxにデプロイするたびに設定を探すので、よく使う設定をまとめておく。"
wordCount: 205
---

フロントエンドプロジェクトをNginxにデプロイするたびに設定を探すので、よく使う設定をまとめておく。

## 基本設定：シングルページアプリケーション

```nginx
server {
    listen 80;
    server_name example.com;

    root /var/www/dist;
    index index.html;

    # SPA の要：すべてのパスに index.html を返す
    # Vue Router の history モードに必要
    location / {
        try_files $uri $uri/ /index.html;
    }

    # 静的アセット：長期キャッシュ
    location ~* \.(js|css|png|jpg|gif|ico|svg|woff|woff2)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # HTML ファイル：キャッシュしない（常に最新エントリを取得）
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
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name example.com;

    ssl_certificate     /etc/ssl/example.com.crt;
    ssl_certificate_key /etc/ssl/example.com.key;

    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-RSA-AES256-GCM-SHA512:DHE-RSA-AES256-GCM-SHA512;
    ssl_prefer_server_ciphers off;

    add_header Strict-Transport-Security "max-age=31536000" always;

    root /var/www/dist;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

## リバースプロキシ：バックエンド API への転送

```nginx
server {
    listen 80;
    server_name example.com;

    root /var/www/dist;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location /api/ {
        proxy_pass http://localhost:3000/;

        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        proxy_connect_timeout 30s;
        proxy_read_timeout 60s;
    }
}
```

## gzip 圧縮

```nginx
http {
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_comp_level 6;
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

## 静的アセットのキャッシュ戦略

```nginx
location = /index.html {
    add_header Cache-Control "no-cache";
}

location ~* \.[0-9a-f]{8}\.(js|css)$ {
    expires 1y;
    add_header Cache-Control "public, immutable";
}
```

## まとめ

- SPA：`try_files $uri $uri/ /index.html` で history ルーティングを有効化
- キャッシュ：JS/CSS はハッシュ付き永久キャッシュ、HTML はキャッシュしない
- リバースプロキシ：`proxy_pass` で `/api` をバックエンドへ転送
- gzip：圧縮対象の MIME タイプを `gzip_types` に設定
- HTTPS：HTTP → HTTPS リダイレクト + HSTS ヘッダー
