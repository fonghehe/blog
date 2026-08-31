---
title: "Frontend Docker Deployment Solutions"
date: 2019-09-20 10:13:42
tags:
  - Engineering
readingTime: 4
description: "Frontend projects are no longer just a few static files dropped onto a CDN. More and more frontend applications need capabilities like Node.js server-side rendering, Nginx reverse proxying, and environment-variable injection. Docker provides a consistent runtime environment, letting a frontend project be built and run the same way anywhere. This article builds a Docker-based deployment setup for a frontend project from scratch."
wordCount: 373
---

Frontend projects are no longer just a few static files dropped onto a CDN. More and more frontend applications need capabilities like Node.js server-side rendering, Nginx reverse proxying, and environment-variable injection. Docker provides a consistent runtime environment, letting a frontend project be built and run the same way anywhere. This article builds a Docker-based deployment setup for a frontend project from scratch.

## Why Frontend Projects Need Docker

1. **Environment consistency** — development, staging, and production environments are identical, saying goodbye to "works on my machine."
2. **Dependency isolation** — different projects' Node.js versions and system dependencies don't interfere with each other.
3. **Fast deployment** — the image itself is the artifact; no rebuild is needed at deploy time.
4. **Elastic scaling** — once containerized, it's easy to scale out horizontally.

## Basic Dockerfile: Static Sites

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

### Notes on Multi-Stage Builds

Multi-stage builds are an important Docker feature:

- The first stage (`builder`) uses a full Node.js image to build the project.
- The second stage uses a lightweight Nginx image and only copies the build artifacts.
- The final image excludes Node.js, npm, and source code, keeping its size under 20MB.

## Nginx Configuration

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

## Docker Compose Orchestration

Full orchestration of frontend + backend + database:

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

## Environment Variable Injection

After a Docker build, environment variables are hardcoded into the artifacts. There are a few approaches to injecting them at runtime:

### Approach 1: Substitute Template Variables at Runtime

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

### Approach 2: Runtime Configuration File

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

Used in application code:

```js
const config = window.__CONFIG__ || {};

export const API_URL = config.API_URL || '/api';
export const SENTRY_DSN = config.SENTRY_DSN || '';
```

This way `config.js` is not bundled by Webpack and can be replaced independently.

## CI/CD Integration

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

## Production Optimization

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

### Health Checks

```dockerfile
FROM nginx:1.17-alpine

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -qO- http://localhost/health || exit 1
```

### Security Configuration

```dockerfile
# 使用非 root 用户运行
FROM nginx:1.17-alpine

RUN addgroup -g 1001 -S appgroup && \
    adduser -u 1001 -S appuser -G appgroup

COPY --from=builder --chown=appuser:appgroup /app/build /usr/share/nginx/html
COPY --chown=appuser:appgroup nginx.conf /etc/nginx/conf.d/default.conf

USER appuser
```

### Image Size Optimization

```bash
# 查看镜像各层大小
docker history myapp/frontend

# 最终镜像对比
# 完整 node 镜像：~900MB
# node-alpine + 多阶段构建：~20MB
# 去除不需要的文件：~15MB
```

## Summary

- Use multi-stage builds to separate the build environment from the runtime environment, so the final image contains only the files needed to run.
- Use Nginx as a static file server plus reverse proxy, with SPA route support and gzip compression configured.
- Inject environment variables either by substituting template variables with `sed` or via a standalone `config.js` file.
- Use Docker Compose to orchestrate the frontend, backend, and dependent services—`docker-compose.yml` doubles as architecture documentation.
- In CI/CD, build the Docker image and push it to a registry; deployment only needs to pull and restart.
- Pay attention to production safety and reliability settings such as `.dockerignore`, a non-root user, and health checks.
