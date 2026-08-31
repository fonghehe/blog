---
title: "Vercel 前端部署与预览环境"
date: 2021-08-05 10:05:01
tags:
  - 前端
  - 工程化
readingTime: 1
description: "关于Vercel 前端部署与预览环境，很多开发者只停留在 API 调用层面。本文试图从生产环境的角度，讨论实际中会遇到的问题和解决方案。"
wordCount: 282
---

关于 Vercel 前端部署与预览环境，很多开发者只停留在 API 调用层面。本文试图从生产环境的角度，讨论实际中会遇到的问题和解决方案。

## 基本原理

真实项目里的用法会更复杂：

```javascript
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN corepack enable && pnpm install --frozen-lockfile

FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN pnpm build

FROM nginx:alpine AS runner
COPY --from=builder /app/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]

```

这样做代码的可测试性和可扩展性都会更好。

## 高级特性

下面看一个完整示例：

```javascript
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN corepack enable && pnpm install --frozen-lockfile

FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN pnpm build

FROM nginx:alpine AS runner
COPY --from=builder /app/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]

```

边界条件一定要处理好，生产环境里这点很关键。

## 项目实践

关键在于吃透它的核心逻辑：

```javascript
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN corepack enable && pnpm install --frozen-lockfile

FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN pnpm build

FROM nginx:alpine AS runner
COPY --from=builder /app/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]

```

性能优化要看场景，不必处处都做过度优化。

## 最佳实践

看看可以从哪些角度改进：

```javascript
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN corepack enable && pnpm install --frozen-lockfile

FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN pnpm build

FROM nginx:alpine AS runner
COPY --from=builder /app/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]

```

这套方案已在线上稳定运行半年多，经过了实战检验。

## 小结

- 上生产前务必做好兼容性验证
- 团队协作里约定和文档比技术本身更重要
- 关注社区动态，技术方案要持续迭代
- 不要为了用新技术而用新技术
- 代码示例仅供参考，要按业务场景调整