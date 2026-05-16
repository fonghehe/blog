---
title: "Containerizing Frontend Projects with Docker"
date: 2018-08-18 14:39:15
tags:
  - Engineering
readingTime: 1
description: "I recently containerized several frontend projects and found it simpler than expected. Here's a guide to the basic setup."
---

I recently containerized several frontend projects and found it simpler than expected. Here's a guide to the basic setup.

## Why Frontend Projects Need Docker

- Unified development/testing/production environments (eliminate "works on my machine")
- Simpler CI/CD pipeline deployments
- Multiple projects coexist without interfering with each other

## Dockerfile (Basic Version)

```dockerfile
# Multi-stage build: build stage
FROM node:10-alpine AS builder

WORKDIR /app

# Copy package.json first to leverage Docker layer caching
# Only reinstalls when package.json changes
COPY package.json package-lock.json ./
RUN npm ci

# Copy source and build
COPY . .
RUN npm run build

# Production stage: only Nginx and build artifacts
FROM nginx:alpine

# Copy build artifacts
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy Nginx config
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

    # SPA routing support (all routes point to index.html)
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Static resource caching
    location ~* \.(js|css|png|jpg|gif|ico|svg|woff2?)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # API proxy (optional)
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

## Common Commands

```bash
# Build image
docker build -t my-frontend:latest .

# Run container (map 8080 → container 80)
docker run -d -p 8080:80 --name my-app my-frontend:latest

# List running containers
docker ps

# View logs
docker logs my-app

# Stop and remove
docker stop my-app && docker rm my-app

# Enter container for debugging
docker exec -it my-app sh
```

## docker-compose Multi-Service Setup

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
# Start all services
docker-compose up -d

# View logs
docker-compose logs -f frontend

# Stop
docker-compose down
```

## Injecting Environment Variables at Build Time

```dockerfile
ARG VUE_APP_API_URL=https://api.example.com
ENV VUE_APP_API_URL=${VUE_APP_API_URL}

RUN npm run build
```

```bash
# Pass arguments at build time
docker build --build-arg VUE_APP_API_URL=https://api.staging.com -t my-app:staging .
```

## Summary

- Multi-stage build: Node image for building, Nginx image for serving — the final image is very small
- `.dockerignore` excludes unnecessary files, speeds up builds
- Nginx config needs SPA routing support (try_files)
- `docker-compose` manages multi-service development environments
