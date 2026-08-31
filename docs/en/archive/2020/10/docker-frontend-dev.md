---
title: "Setting Up a Frontend Development Environment with Docker"
date: 2020-10-14 10:24:12
tags:
  - Engineering
readingTime: 1
description: "A systematic guide to setting up frontend development environments with Docker, covering usage, underlying principles, and optimization strategies."
wordCount: 170
---

Setting up a frontend dev environment with Docker comes up more and more often in day-to-day development. This article walks through its usage, underlying principles, and optimization strategies in a systematic way.

## Quick Start

Let's start with the basic implementation:

```dockerfile
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

This snippet shows the basic usage. In real projects you'll still need to account for error handling and edge cases.

## Internal Principles

Building on this, we can optimize further:

```dockerfile
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

This pattern is very practical in large projects and can significantly cut maintenance cost.

## Business Practice

In real projects, the usage gets a bit more involved:

```dockerfile
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

This approach improves both the testability and extensibility of the code.

## Performance Comparison

Here is a complete example:

```dockerfile
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

Pay attention to edge-case handling — it's critical in production.

## Summary

- The code examples are for reference only and should be adapted to your actual use case.
- Setting up a Docker frontend dev environment is no silver bullet; choose it based on your project's scale and tech stack.
- Understanding the underlying principles matters more than memorizing APIs.
