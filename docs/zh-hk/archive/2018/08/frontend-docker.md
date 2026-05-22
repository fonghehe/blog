---
title: "前端項目 Docker 容器化入門：落地路徑與實戰建議"
date: 2018-08-18 14:39:15
tags:
  - 工程化
readingTime: 1
description: "最近把幾個前端項目容器化了，發現比想象中簡單。記錄一下基礎設定。"
wordCount: 160
---

最近把幾個前端項目容器化了，發現比想象中簡單。記錄一下基礎配置。

## 為什麼前端需要 Docker

- 統一開發/測試/生產環境（消滅"在我機器上能跑"）
- CI/CD 流水線部署更簡單
- 多個項目共存，互不幹擾

## Dockerfile（基礎版）

```dockerfile
# 多階段構建：構建階段
FROM node:10-alpine AS builder

WORKDIR /app

# 先複製 package.json，利用 Docker 層緩存
# 隻有 package.json 變化才重新 npm install
COPY package.json package-lock.json ./
RUN npm ci

# 複製源碼並構建
COPY . .
RUN npm run build

# 生產階段：隻包含 Nginx 和構建產物
FROM nginx:alpine

# 複製構建產物
COPY --from=builder /app/dist /usr/share/nginx/html

# 複製 Nginx 設定
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

    # 靜態資源緩存
    location ~* \.(js|css|png|jpg|gif|ico|svg|woff2?)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # API 代理（可選）
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
# 構建鏡像
docker build -t my-frontend:latest .

# 運行容器（映射 8080 → 容器 80）
docker run -d -p 8080:80 --name my-app my-frontend:latest

# 查看運行中的容器
docker ps

# 查看日誌
docker logs my-app

# 停止和刪除
docker stop my-app && docker rm my-app

# 進入容器調試
docker exec -it my-app sh
```

## docker-compose 多服務

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
# 啓動所有服務
docker-compose up -d

# 查看日誌
docker-compose logs -f frontend

# 停止
docker-compose down
```

## 構建時注入環境變量

```dockerfile
ARG VUE_APP_API_URL=https://api.example.com
ENV VUE_APP_API_URL=${VUE_APP_API_URL}

RUN npm run build
```

```bash
# 構建時傳參
docker build --build-arg VUE_APP_API_URL=https://api.staging.com -t my-app:staging .
```

## 小結

- 多階段構建：Node 鏡像構建，Nginx 鏡像部署，最終鏡像很小
- `.dockerignore` 排除不需要的檔案，加快構建速度
- Nginx 配置 SPA 路由支持（try_files）
- `docker-compose` 管理多服務開發環境
