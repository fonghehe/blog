---
title: "フロントエンドDockerデプロイメント方法"
date: 2019-09-20 10:13:42
tags:
  - エンジニアリング
readingTime: 5
description: "前端项目不再只是几个静态文件放到 CDN 上那么简单。越来越多的前端应用需要 Node.js 服务端渲染、Nginx 反向代理、环境变量注入等能力。Docker 提供了一致的运行环境，让前端项目可以在任何地方以相同的方式构建和运行。本文将从零搭建前端项目的 Docker 化部署方案。"
wordCount: 989
---

フロントエンドのプロジェクトは、単にいくつかの静的ファイルを CDN に置くだけのものではなくなった。Node.js によるサーバーサイドレンダリング、Nginx のリバースプロキシ、環境変数の注入といった要件を持つフロントエンドアプリケーションが増えている。Docker は一貫した実行環境を提供し、どこでも同じ方法でビルド・実行できるようにする。本記事ではゼロからフロントエンドプロジェクトの Docker 化デプロイを構築する。

## なぜフロントエンドにDockerが必要か

1. **環境の一貫性** — 開発・テスト・本番環境が完全に一致し、「自分の環境では動いたのに」という問題が消える
2. **依存関係の分離** — プロジェクトごとに Node.js のバージョンやシステム依存を互いに影響させない
3. **デプロイの高速化** — イメージそのものが成果物であり、デプロイ時に再ビルドする必要がない
4. **弾性スケーリング** — コンテナ化すれば水平スケールを容易に行える

## 基本的なDockerfile：静的サイト

```dockerfile
# 第一阶段：构建
FROM node:12-alpine AS builder

WORKDIR /app

# 先复制 package.json 和 lock 文件，利用 Docker 缓存层
COPY package.json package-lock.json ./
RUN npm ci --registry=https://registry.npm.taobao.org

# 复制源码并构建
COPY . .
RUN npm run build

# 第二阶段：部署（只保留构建产物）
FROM nginx:1.17-alpine

# 复制构建产物到 nginx 目录
COPY --from=builder /app/build /usr/share/nginx/html

# 自定义 nginx 配置
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
```

### 多阶段构建说明

マルチステージビルドは Docker の重要な特性だ：

- 第1段階（`builder`）は完全な Node.js イメージを使ってプロジェクトをビルドする
- 第2段階は軽量な Nginx イメージを使い、ビルド成果物だけをコピーする
- 最終的なイメージには Node.js や npm、ソースコードなどが含まれず、サイズを 20MB 以内に収められる

## Nginx設定

```nginx
# nginx.conf
server {
    listen 80;
    server_name localhost;
    root /usr/share/nginx/html;
    index index.html;

    # gzip 压缩
    gzip on;
    gzip_min_length 1000;
    gzip_types text/plain text/css application/json application/javascript text/xml;

    # 静态资源缓存
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # SPA 路由支持（所有路径都返回 index.html）
    location / {
        try_files $uri $uri/ /index.html;
    }

    # API 反向代理
    location /api/ {
        proxy_pass http://backend:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # 健康检查
    location /health {
        return 200 'OK';
        add_header Content-Type text/plain;
    }
}
```

## Docker Composeによるオーケストレーション

フロントエンド + バックエンド + データベースを含む全体のオーケストレーション：

```yaml
# docker-compose.yml
version: '3.7'

services:
  # 前端
  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile
    ports:
      - "80:80"
    depends_on:
      - backend
    environment:
      - NODE_ENV=production
    restart: unless-stopped

  # 后端 API
  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - DB_HOST=postgres
      - DB_PORT=5432
      - DB_NAME=myapp
      - REDIS_URL=redis://redis:6379
    depends_on:
      - postgres
      - redis
    restart: unless-stopped

  # 数据库
  postgres:
    image: postgres:12-alpine
    environment:
      POSTGRES_DB: myapp
      POSTGRES_USER: admin
      POSTGRES_PASSWORD: secret
    volumes:
      - postgres_data:/var/lib/postgresql/data
    restart: unless-stopped

  # 缓存
  redis:
    image: redis:5-alpine
    restart: unless-stopped

volumes:
  postgres_data:
```

## 環境変数の注入

Docker でビルドすると、環境変数は成果物にハードコードされる。実行時に環境変数を注入するアプローチはいくつかある：

### アプローチ1：実行時にテンプレート変数を置換する

```dockerfile
FROM nginx:1.17-alpine

COPY --from=builder /app/build /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

ENTRYPOINT ["/entrypoint.sh"]
CMD ["nginx", "-g", "daemon off;"]
```

```bash
#!/bin/sh
# entrypoint.sh

# 将环境变量注入到 JS 文件中
# HTML 中使用 __API_URL__ 占位符
if [ -n "$API_URL" ]; then
  find /usr/share/nginx/html -name "*.js" -exec \
    sed -i "s|__API_URL__|$API_URL|g" {} \;
fi

if [ -n "$SENTRY_DSN" ]; then
  find /usr/share/nginx/html -name "*.js" -exec \
    sed -i "s|__SENTRY_DSN__|$SENTRY_DSN|g" {} \;
fi

exec "$@"
```

```yaml
services:
  frontend:
    build: ./frontend
    environment:
      - API_URL=https://api.example.com
      - SENTRY_DSN=https://xxx@sentry.io/123
```

### アプローチ2：実行時の設定ファイル

```html
<!-- public/config.js -->
window.__CONFIG__ = {
  API_URL: '__API_URL__',
  SENTRY_DSN: '__SENTRY_DSN__',
  VERSION: '__VERSION__',
};
```

```html
<!-- public/index.html -->
<head>
  <script src="/config.js"></script>
  <script src="/static/js/main.js"></script>
</head>
```

アプリケーションコードでの使用：

```js
const config = window.__CONFIG__ || {};

export const API_URL = config.API_URL || '/api';
export const SENTRY_DSN = config.SENTRY_DSN || '';
```

これで `config.js` は Webpack にバンドルされなくなり、独立して差し替えられる。

## CI/CD統合

```yaml
# .github/workflows/deploy.yml
name: Build and Deploy

on:
  push:
    branches: [master]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2

      - name: Login to Docker Registry
        run: echo "$&#123;&#123; secrets.DOCKER_PASSWORD &#125;&#125;" | docker login -u "$&#123;&#123; secrets.DOCKER_USERNAME &#125;&#125;" --password-stdin

      - name: Build Docker image
        run: |
          docker build \
            --build-arg NODE_ENV=production \
            -t myapp/frontend:$&#123;&#123; github.sha &#125;&#125; \
            -t myapp/frontend:latest \
            ./frontend

      - name: Push Docker image
        run: |
          docker push myapp/frontend:$&#123;&#123; github.sha &#125;&#125;
          docker push myapp/frontend:latest

      - name: Deploy to production
        run: |
          ssh deploy@server "cd /opt/myapp && \
            docker-compose pull frontend && \
            docker-compose up -d frontend"
```

## 本番環境の最適化

### .dockerignore

```
node_modules
.git
.gitignore
*.md
.env.local
.DS_Store
coverage
.nyc_output
*.log
```

### 健康检查

```dockerfile
FROM nginx:1.17-alpine

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -qO- http://localhost/health || exit 1
```

### 安全配置

```dockerfile
# 使用非 root 用户运行
FROM nginx:1.17-alpine

RUN addgroup -g 1001 -S appgroup && \
    adduser -u 1001 -S appuser -G appgroup

COPY --from=builder --chown=appuser:appgroup /app/build /usr/share/nginx/html
COPY --chown=appuser:appgroup nginx.conf /etc/nginx/conf.d/default.conf

USER appuser
```

### 镜像体积优化

```bash
# 查看镜像各层大小
docker history myapp/frontend

# 最终镜像对比
# 完整 node 镜像：~900MB
# node-alpine + 多阶段构建：~20MB
# 去除不需要的文件：~15MB
```

## まとめ

- マルチステージビルドでビルド環境と実行環境を分離し、最終イメージには必要な実行ファイルだけを含める
- Nginx を静的ファイルサーバー兼リバースプロキシとし、SPA のルーティング対応と gzip 圧縮を設定する
- 環境変数の注入は、sed でテンプレート変数を置換するか、独立した config.js ファイルで実現できる
- Docker Compose でフロントエンド・バックエンド・依存サービスをオーケストレーションし、docker-compose.yml 自体がアーキテクチャドキュメントになる
- CI/CD で Docker イメージをビルドして Registry にプッシュし、デプロイ時は pull と restart だけで済む
- .dockerignore、非 root ユーザー、ヘルスチェックといった本番環境のセキュリティ・信頼性設定に留意する
