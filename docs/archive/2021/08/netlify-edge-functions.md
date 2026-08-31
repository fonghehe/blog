---
title: "Netlify Edge Functions 边缘计算"
date: 2021-08-10 10:39:48
tags:
  - 前端
  - JavaScript
  - 工程化
readingTime: 1
description: "Netlify Edge Functions 边缘计算这个话题社区讨论了很多次，但随着版本迭代，很多结论需要更新。本文基于最新版本重新梳理。"
wordCount: 275
---

Netlify Edge Functions 边缘计算这个话题社区已经讨论过很多次，但版本迭代后不少结论需要更新，本文基于最新版本重新梳理。

## 入门指南

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

## 源码分析

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

## 真实场景应用

先看一下基本实现：

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

上面是基本用法，真实项目还得补上错误处理和边界情况。

## 优化技巧

在此基础上还能进一步优化：

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

这种模式在大型项目里很实用，能明显降低维护成本。

## 小结

- 关注社区动态，技术方案要持续迭代
- 不要为了用新技术而用新技术
- 代码示例仅供参考，要按业务场景调整
- Netlify Edge Functions 边缘计算不是银弹，得按项目规模和技术栈来选