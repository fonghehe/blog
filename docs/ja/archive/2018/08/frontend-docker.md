---
title: "フロントエンドプロジェクトのDockerコンテナ化入門"
date: 2018-08-18 14:39:15
tags:
  - エンジニアリング
readingTime: 2
description: "最近いくつかのフロントエンドプロジェクトをコンテナ化しました。思ったより簡単でした。基本的な設定をまとめます。"
---

最近いくつかのフロントエンドプロジェクトをコンテナ化しました。思ったより簡単でした。基本的な設定をまとめます。

## フロントエンドにDockerが必要な理由

- 開発・テスト・本番環境の統一（「自分のマシンでは動く」問題の解消）
- CI/CDパイプラインのデプロイが簡単になる
- 複数プロジェクトが共存しても互いに干渉しない

## Dockerfile（基本版）

```dockerfile
# マルチステージビルド：ビルドステージ
FROM node:10-alpine AS builder

WORKDIR /app

# package.jsonを先にコピーしてDockerレイヤーキャッシュを活用
# package.jsonが変わった場合のみnpm installを再実行
COPY package.json package-lock.json ./
RUN npm ci

# ソースコードをコピーしてビルド
COPY . .
RUN npm run build

# 本番ステージ：NginxとビルドされたファイルのみS
FROM nginx:alpine

# ビルド成果物をコピー
COPY --from=builder /app/dist /usr/share/nginx/html

# Nginx設定をコピー
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

## nginx.conf

```nginx
server {
    listen 80;
    server_name localhost;
    root /usr/share/nginx/html;
    index index.html;

    # SPAルーティングサポート（すべてのルートをindex.htmlに向ける）
    location / {
        try_files $uri $uri/ /index.html;
    }

    # 静的リソースのキャッシュ
    location ~* \.(js|css|png|jpg|gif|ico|svg|woff2?)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # APIプロキシ（オプション）
    location /api {
        proxy_pass http://api-server:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

## .dockerignore

```
node_modules
dist
.git
.env.local
*.log
```

## よく使うコマンド

```bash
# イメージをビルド
docker build -t my-frontend:latest .

# コンテナを実行（8080 → コンテナの80にマッピング）
docker run -d -p 8080:80 --name my-app my-frontend:latest

# 実行中のコンテナを確認
docker ps

# ログを確認
docker logs my-app

# 停止と削除
docker stop my-app && docker rm my-app

# コンテナに入ってデバッグ
docker exec -it my-app sh
```

## docker-composeでマルチサービス管理

```yaml
# docker-compose.yml
version: "3.8"

services:
  frontend:
    build: ./frontend
    ports:
      - "80:80"
    depends_on:
      - api
    environment:
      - VUE_APP_API_URL=http://api:3000

  api:
    build: ./api
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - DB_URL=mongodb://db:27017/mydb
    depends_on:
      - db

  db:
    image: mongo:4
    volumes:
      - mongo-data:/data/db

volumes:
  mongo-data:
```

```bash
# すべてのサービスを起動
docker-compose up -d

# ログを確認
docker-compose logs -f frontend

# 停止
docker-compose down
```

## ビルド時に環境変数を注入する

```dockerfile
ARG VUE_APP_API_URL=https://api.example.com
ENV VUE_APP_API_URL=${VUE_APP_API_URL}

RUN npm run build
```

```bash
# ビルド時に引数を渡す
docker build --build-arg VUE_APP_API_URL=https://api.staging.com -t my-app:staging .
```

## まとめ

- マルチステージビルド：Nodeイメージでビルド、Nginxイメージでサービング。最終イメージが小さくなる
- `.dockerignore`で不要なファイルを除外してビルドを高速化
- NginxにSPAルーティングサポート（try_files）の設定が必要
- `docker-compose`でマルチサービスの開発環境を管理
