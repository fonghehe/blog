---
title: "フロントエンドデプロイ：nginx設定とキャッシュ戦略"
date: 2018-06-12 17:34:52
tags:
  - エンジニアリング
readingTime: 2
description: "フロントエンドのコードはたくさん書いてきましたが、デプロイ部分はずっと運用メンバーに頼っていました。今回自分でnginxを設定し、よくあるシナリオをまとめます。"
---

フロントエンドのコードはたくさん書いてきましたが、デプロイ部分はずっと運用メンバーに頼っていました。今回自分でnginxを設定し、よくあるシナリオをまとめます。

## 基本：SPAのホスティング

```nginx
server {
  listen 80;
  server_name example.com;
  root /var/www/myapp/dist;
  index index.html;

  # SPAの重要設定：すべてのパスでindex.htmlを返す
  location / {
    try_files $uri $uri/ /index.html;
  }
}
```

`try_files $uri $uri/ /index.html`の意味：

1. まずファイル`$uri`（例：`/static/main.js`）を探す
2. 次にディレクトリ`$uri/`を探す
3. どちらもなければ`/index.html`を返す（フロントエンドルーターに委ねる）

## キャッシュ設定

### HTML：キャッシュしない

```nginx
location ~* \.html$ {
  add_header Cache-Control "no-cache, no-store, must-revalidate";
  add_header Pragma "no-cache";
  add_header Expires 0;
}
```

### ハッシュ付き静的ファイル：長期キャッシュ

```nginx
location ~* \.(js|css)$ {
  # ファイル名にハッシュが入っている（例：app.a1b2c3d4.js）ので永久キャッシュ可能
  add_header Cache-Control "public, max-age=31536000, immutable";
}

location ~* \.(png|jpg|jpeg|gif|svg|ico|woff|woff2)$ {
  add_header Cache-Control "public, max-age=2592000";  # 30日
}
```

## gzip圧縮

```nginx
http {
  gzip on;
  gzip_vary on;
  gzip_min_length 1024;  # 1KB未満は圧縮しない
  gzip_comp_level 6;     # 圧縮レベル1-9、6は速度と圧縮率のバランス
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

ビルド時にすでに`.gz`ファイルを生成している場合、直接使用することでランタイム圧縮を省けます：

```nginx
# Webpackでcompression-webpack-pluginを有効にして.gzファイルを生成
location ~* \.(js|css)$ {
  gzip_static on;  # 静的な.gzファイルを優先使用
  add_header Cache-Control "public, max-age=31536000, immutable";
}
```

## HTTPS設定

```nginx
server {
  listen 80;
  server_name example.com;
  return 301 https://$host$request_uri;  # HTTPをHTTPSにリダイレクト
}

server {
  listen 443 ssl http2;  # HTTP/2を有効化
  server_name example.com;

  ssl_certificate /etc/letsencrypt/live/example.com/fullchain.pem;
  ssl_certificate_key /etc/letsencrypt/live/example.com/privkey.pem;

  # セキュリティ設定
  ssl_protocols TLSv1.2 TLSv1.3;
  ssl_ciphers HIGH:!aNULL:!MD5;
  ssl_prefer_server_ciphers on;
  ssl_session_cache shared:SSL:10m;

  # HSTS：ブラウザにHTTPS使用を強制
  add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;

  root /var/www/myapp/dist;
  # ... 残りの設定
}
```

## APIプロキシ

フロントエンド・バックエンド分離構成では、フロントエンドからバックエンドAPIに直接リクエストするとCORSの問題が発生します。nginxのプロキシで解決：

```nginx
server {
  # フロントエンドのリソース
  location / {
    root /var/www/frontend/dist;
    try_files $uri $uri/ /index.html;
  }

  # APIリクエストをバックエンドにプロキシ
  location /api/ {
    proxy_pass http://localhost:8080/;  # バックエンドサービスに転送
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;

    # WebSocketサポート
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
  }
}
```

## セキュリティレスポンスヘッダー

```nginx
# serverブロックまたはhttpブロックに追加
add_header X-Content-Type-Options "nosniff" always;
add_header X-Frame-Options "SAMEORIGIN" always;
add_header X-XSS-Protection "1; mode=block" always;
add_header Referrer-Policy "strict-origin-when-cross-origin" always;
add_header Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline'" always;
```

## 完全な設定例

```nginx
server {
  listen 443 ssl http2;
  server_name myapp.example.com;

  ssl_certificate /etc/ssl/cert.pem;
  ssl_certificate_key /etc/ssl/key.pem;

  root /var/www/myapp/dist;

  # セキュリティヘッダー
  add_header X-Frame-Options SAMEORIGIN;
  add_header X-Content-Type-Options nosniff;

  # index.html - キャッシュなし
  location = /index.html {
    add_header Cache-Control "no-cache";
  }

  # ハッシュ付き静的ファイル - 長期キャッシュ
  location ~* \.(js|css)$ {
    add_header Cache-Control "public, max-age=31536000, immutable";
    gzip_static on;
  }

  # 画像
  location ~* \.(png|jpg|jpeg|gif|svg|ico|woff2)$ {
    add_header Cache-Control "public, max-age=2592000";
  }

  # SPAルーティング
  location / {
    try_files $uri $uri/ /index.html;
  }

  # APIプロキシ
  location /api/ {
    proxy_pass http://localhost:3000/;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
  }
}
```

## まとめ

- SPAには必ず`try_files ... /index.html`を設定する
- HTMLはキャッシュせず、ハッシュ付きファイルは永久キャッシュ
- gzip圧縮を有効にする——JSは通常70%圧縮できる
- HTTPS + HTTP/2はモダンな標準構成
