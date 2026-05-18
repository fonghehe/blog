---
title: "前端 Docker 化部署方案"
date: 2019-09-20 10:13:42
tags:
  - 工程化
readingTime: 4
description: "前端项目不再只是几个静态文件放到 CDN 上那么简单。越来越多的前端应用需要 Node.js 服务端渲染、Nginx 反向代理、环境变量注入等能力。Docker 提供了一致的运行环境，让前端项目可以在任何地方以相同的方式构建和运行。本文将从零搭建前端项目的 Docker 化部署方案。"
---

前端项目不再只是几个静态文件放到 CDN 上那么简单。越来越多的前端应用需要 Node.js 服务端渲染、Nginx 反向代理、环境变量注入等能力。Docker 提供了一致的运行环境，让前端项目可以在任何地方以相同的方式构建和运行。本文将从零搭建前端项目的 Docker 化部署方案。

## 为什么前端需要 Docker

1. **环境一致性** — 开发、测试、生产环境完全一致，告别"在我机器上没问题"
2. **依赖隔离** — 不同项目的 Node.js 版本、系统依赖互不影响
3. **快速部署** — 镜像即产物，部署时不需要重新构建
4. **弹性伸缩** — 容器化后可以方便地水平扩展

## 基础 Dockerfile：纯静态站点

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

多阶段构建是 Docker 的重要特性：

- 第一阶段（`builder`）使用完整的 Node.js 镜像构建项目
- 第二阶段使用轻量的 Nginx 镜像，只复制构建产物
- 最终镜像不包含 Node.js、npm、源码等，体积可以控制在 20MB 以内

## Nginx 配置

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

## Docker Compose 编排

前端 + 后端 + 数据库的完整编排：

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

## 环境变量注入

Docker 构建后，环境变量被硬编码在产物中。运行时注入环境变量有几种方案：

### 方案一：运行时替换模板变量

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

### 方案二：运行时配置文件

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

应用代码中使用：

```js
const config = window.__CONFIG__ || {};

export const API_URL = config.API_URL || '/api';
export const SENTRY_DSN = config.SENTRY_DSN || '';
```

这样 `config.js` 不会被 Webpack 打包，可以独立替换。

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

## 生产环境优化

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

## 小结

- 使用多阶段构建分离构建环境和运行环境，最终镜像只包含必要的运行文件
- Nginx 作为静态文件服务器 + 反向代理，配置 SPA 路由支持和 gzip 压缩
- 环境变量注入可以通过 sed 替换模板变量或独立的 config.js 文件实现
- Docker Compose 编排前端、后端和依赖服务，docker-compose.yml 即架构文档
- CI/CD 中构建 Docker 镜像并推送到 Registry，部署时只需 pull 和 restart
- 注意 .dockerignore、非 root 用户、健康检查等生产环境安全和可靠性配置
