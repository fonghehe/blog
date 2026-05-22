---
title: "前端 Docker 化部署方案：實踐方法與治理思路"
date: 2019-09-20 10:13:42
tags:
  - 工程化
readingTime: 4
description: "前端項目不再隻是幾個靜態檔案放到 CDN 上那麼簡單。越來越多的前端應用需要 Node.js 服務端渲染、Nginx 反向代理、環境變量注入等能力。Docker 提供了一致的運行環境，讓前端項目可以在任何地方以相同的方式構建和運行。本文將從零搭建前端項目的 Docker 化部署方案。"
wordCount: 579
---

前端項目不再隻是幾個靜態檔案放到 CDN 上那麼簡單。越來越多的前端應用需要 Node.js 服務端渲染、Nginx 反向代理、環境變量注入等能力。Docker 提供了一致的運行環境，讓前端項目可以在任何地方以相同的方式構建和運行。本文將從零搭建前端項目的 Docker 化部署方案。

## 為什麼前端需要 Docker

1. **環境一致性** — 開發、測試、生產環境完全一致，告別"在我機器上沒問題"
2. **依賴隔離** — 不同項目的 Node.js 版本、系統依賴互不影響
3. **快速部署** — 鏡像即產物，部署時不需要重新構建
4. **彈性伸縮** — 容器化後可以方便地水平擴展

## 基礎 Dockerfile：純靜態站點

```dockerfile
# 第一階段：構建
FROM node:12-alpine AS builder

WORKDIR /app

# 先複製 package.json 和 lock 檔案，利用 Docker 緩存層
COPY package.json package-lock.json ./
RUN npm ci --registry=https://registry.npm.taobao.org

# 複製源碼並構建
COPY . .
RUN npm run build

# 第二階段：部署（隻保留構建產物）
FROM nginx:1.17-alpine

# 複製構建產物到 nginx 目錄
COPY --from=builder /app/build /usr/share/nginx/html

# 自定義 nginx 設定
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
```

### 多階段構建説明

多階段構建是 Docker 的重要特性：

- 第一階段（`builder`）使用完整的 Node.js 鏡像構建項目
- 第二階段使用輕量的 Nginx 鏡像，隻複製構建產物
- 最終鏡像不包含 Node.js、npm、源碼等，體積可以控製在 20MB 以內

## Nginx 設定

```nginx
# nginx.conf
server {
    listen 80;
    server_name localhost;
    root /usr/share/nginx/html;
    index index.html;

    # gzip 壓縮
    gzip on;
    gzip_min_length 1000;
    gzip_types text/plain text/css application/json application/javascript text/xml;

    # 靜態資源緩存
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # SPA 路由支持（所有路徑都返回 index.html）
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

    # 健康檢查
    location /health {
        return 200 'OK';
        add_header Content-Type text/plain;
    }
}
```

## Docker Compose 編排

前端 + 後端 + 數據庫的完整編排：

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

  # 後端 API
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

  # 數據庫
  postgres:
    image: postgres:12-alpine
    environment:
      POSTGRES_DB: myapp
      POSTGRES_USER: admin
      POSTGRES_PASSWORD: secret
    volumes:
      - postgres_data:/var/lib/postgresql/data
    restart: unless-stopped

  # 緩存
  redis:
    image: redis:5-alpine
    restart: unless-stopped

volumes:
  postgres_data:
```

## 環境變量注入

Docker 構建後，環境變量被硬編碼在產物中。運行時注入環境變量有幾種方案：

### 方案一：運行時替換範本變量

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

# 將環境變量注入到 JS 檔案中
# HTML 中使用 __API_URL__ 佔位符
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

### 方案二：運行時設定檔案

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

應用代碼中使用：

```js
const config = window.__CONFIG__ || {};

export const API_URL = config.API_URL || '/api';
export const SENTRY_DSN = config.SENTRY_DSN || '';
```

這樣 `config.js` 不會被 Webpack 打包，可以獨立替換。

## CI/CD 集成

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

## 生產環境優化

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

### 健康檢查

```dockerfile
FROM nginx:1.17-alpine

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -qO- http://localhost/health || exit 1
```

### 安全設定

```dockerfile
# 使用非 root 用户運行
FROM nginx:1.17-alpine

RUN addgroup -g 1001 -S appgroup && \
    adduser -u 1001 -S appuser -G appgroup

COPY --from=builder --chown=appuser:appgroup /app/build /usr/share/nginx/html
COPY --chown=appuser:appgroup nginx.conf /etc/nginx/conf.d/default.conf

USER appuser
```

### 鏡像體積優化

```bash
# 查看鏡像各層大小
docker history myapp/frontend

# 最終鏡像對比
# 完整 node 鏡像：~900MB
# node-alpine + 多階段構建：~20MB
# 去除不需要的檔案：~15MB
```

## 小結

- 使用多階段構建分離構建環境和運行環境，最終鏡像隻包含必要的運行檔案
- Nginx 作為靜態文件服務器 + 反向代理，配置 SPA 路由支持和 gzip 壓縮
- 環境變量注入可以通過 sed 替換模板變量或獨立的 config.js 文件實現
- Docker Compose 編排前端、後端和依賴服務，docker-compose.yml 即架構文檔
- CI/CD 中構建 Docker 鏡像並推送到 Registry，部署時隻需 pull 和 restart
- 注意 .dockerignore、非 root 用户、健康檢查等生產環境安全和可靠性配置
