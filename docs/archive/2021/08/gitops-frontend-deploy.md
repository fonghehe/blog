---
title: "GitOps 前端部署工作流"
date: 2021-08-17 16:44:12
tags:
  - Git
  - 工程化
readingTime: 1
description: "GitOps 前端部署工作流在前端开发中的应用越来越广泛。本文从实际项目出发，深入分析其核心原理和最佳实践。"
wordCount: 275
---

GitOps 前端部署工作流在前端圈子里越来越流行，本文结合实际项目，深入分析它的核心原理和最佳实践。

## 基础用法

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

## 进阶用法

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

## 实战案例

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

## 性能优化

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

- 关注社区动态，技术方案要持续迭代
- 不要为了用新技术而用新技术
- 代码示例仅供参考，要按业务场景调整
- GitOps 前端部署工作流不是银弹，得按项目规模和技术栈来选
- 理解底层原理比记 API 更重要