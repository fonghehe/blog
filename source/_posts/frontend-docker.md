---
title: "前端项目 Docker 容器化入门"
date: 2018-08-18 14:39:15
tags:
  - 工程化
---

最近把几个前端项目容器化了，发现比想象中简单。记录一下基础配置。

## 为什么前端需要 Docker

- 统一开发/测试/生产环境（消灭"在我机器上能跑"）
- CI/CD 流水线部署更简单
- 多个项目共存，互不干扰

## Dockerfile（基础版）

```dockerfile
# 多阶段构建：构建阶段
FROM node:10-alpine AS builder

WORKDIR /app

# 先复制 package.json，利用 Docker 层缓存
# 只有 package.json 变化才重新 npm install
COPY package.json package-lock.json ./
RUN npm ci

# 复制源码并构建
COPY . .
RUN npm run build

# 生产阶段：只包含 Nginx 和构建产物
FROM nginx:alpine

# 复制构建产物
COPY --from=builder /app/dist /usr/share/nginx/html

# 复制 Nginx 配置
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

    # SPA 路由支持（所有路由指向 index.html）
    location / {
        try_files $uri $uri/ /index.html;
    }

    # 静态资源缓存
    location ~* \.(js|css|png|jpg|gif|ico|svg|woff2?)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # API 代理（可选）
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

## 常用命令

```bash
# 构建镜像
docker build -t my-frontend:latest .

# 运行容器（映射 8080 → 容器 80）
docker run -d -p 8080:80 --name my-app my-frontend:latest

# 查看运行中的容器
docker ps

# 查看日志
docker logs my-app

# 停止和删除
docker stop my-app && docker rm my-app

# 进入容器调试
docker exec -it my-app sh
```

## docker-compose 多服务

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
# 启动所有服务
docker-compose up -d

# 查看日志
docker-compose logs -f frontend

# 停止
docker-compose down
```

## 构建时注入环境变量

```dockerfile
ARG VUE_APP_API_URL=https://api.example.com
ENV VUE_APP_API_URL=${VUE_APP_API_URL}

RUN npm run build
```

```bash
# 构建时传参
docker build --build-arg VUE_APP_API_URL=https://api.staging.com -t my-app:staging .
```

## 小结

- 多阶段构建：Node 镜像构建，Nginx 镜像部署，最终镜像很小
- `.dockerignore` 排除不需要的文件，加快构建速度
- Nginx 配置 SPA 路由支持（try_files）
- `docker-compose` 管理多服务开发环境
