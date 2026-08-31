---
title: "GitOps Frontend Deployment Workflow"
date: 2021-08-17 16:44:12
tags:
  - Engineering
  - Frontend

readingTime: 1
description: "GitOps deployment workflows for frontends are being adopted more and more widely. This article starts from real projects and digs into the core principles and best practices."
wordCount: 178
---

GitOps frontend deployment workflows are becoming increasingly widespread in frontend development. This article dives into their core principles and best practices drawn from real projects.

## Basic Usage

Real-world usage is a bit more complex:

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

Through this approach, both the testability and scalability of the code are improved.

## Advanced Usage

Here is a complete example:

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

Pay attention to boundary condition handling, which is critical in production.

## Practical Cases

The key lies in understanding the core logic:

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

Performance optimization should be tailored to specific scenarios; not all cases require over-optimization.

## Performance Optimization

We can improve it in the following ways:

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

This approach has been running stably in production for over six months and has been practically validated.

## Summary

- Stay updated with the community; technical solutions need continuous iteration
- Don't adopt new technology just for the sake of it
- Code examples are for reference only and need to be adjusted according to your business scenario
- GitOps frontend deployment workflows are no silver bullet; choose based on your project size and tech stack
- Understanding underlying principles is more important than memorizing APIs