---
title: "Nginxフロントエンド設定完全ガイド"
date: 2019-03-28 11:14:57
tags:
  - エンジニアリング
readingTime: 1
description: "Nginx設定を理解していないフロントエンドエンジニアは、多くのデプロイ問題を自分で解決できない。ここに実用的な設定リファレンスをまとめる。"
---

Nginx設定を理解していないフロントエンドエンジニアは、多くのデプロイ問題を自分で解決できない。ここに実用的な設定リファレンスをまとめる。

## 基本：SPAルーティングのサポート

```nginx
server {
  listen 80;
  server_name example.com;
  root /var/www/html;
  index index.html;

  # SPAルーティング：すべてのパスがindex.htmlを返す
  location / {
    try_files $uri $uri/ /index.html;
  }
}
```

これを設定しないと、vue-routerのhistoryモードでページをリロードすると404になる。

## HTTPS設定

```nginx
server {
  listen 443 ssl http2;
  server_name example.com;

  ssl_certificate     /etc/ssl/certs/example.com.pem;
  ssl_certificate_key /etc/ssl/private/example.com.key;

  # SSLパフォーマンス最適化
  ssl_session_cache shared:SSL:10m;
  ssl_session_timeout 1d;
  ssl_protocols TLSv1.2 TLSv1.3;
  ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256;
  ssl_prefer_server_ciphers off;

  # HSTS（ブラウザにHTTPSのみを使うよう記憶させる）
  add_header Strict-Transport-Security "max-age=63072000" always;
}

# HTTPをHTTPSにリダイレクト
server {
  listen 80;
  server_name example.com;
  return 301 https://$host$request_uri;
}
```

## 静的リソースのキャッシュ

```nginx
server {
  # HTML：キャッシュなし
  location ~* \.html$ {
    add_header Cache-Control "no-cache, must-revalidate";
  }

  # ハッシュ付きJS/CSS：長期キャッシュ
  location ~* \.(js|css)$ {
    add_header Cache-Control "public, max-age=31536000, immutable";
  }

  # 画像/フォント
  location ~* \.(jpg|jpeg|png|webp|gif|ico|svg|woff2|woff|ttf)$ {
    add_header Cache-Control "public, max-age=2592000";
    add_header Vary "Accept-Encoding";
  }
}
```

## Gzip圧縮

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

Webpackビルド時に`.gz`ファイルを事前生成（`compression-webpack-plugin`）しておき、Nginxが直接配信できる。
