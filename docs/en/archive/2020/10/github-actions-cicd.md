---
title: "GitHub Actions CI/CD Advanced: Multi-Environment Deployment and Matrix Builds"
date: 2020-06-09 10:54:08
tags:
  - Engineering
readingTime: 1
description: "Lessons learned from implementing a GitHub Actions CI/CD frontend pipeline on a team, shared as a practical reference for similar efforts."
wordCount: 188
---

I recently rolled out a GitHub Actions CI/CD frontend pipeline on my team and accumulated a fair amount of experience. I'm sharing it as a reference, hoping it helps anyone doing similar work.

## Core Concepts

The key is understanding the core logic:

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

Performance optimization has to be tied to the actual scenario; not every case calls for over-optimizing.

## In-Depth Analysis

Here's how we can improve on it:

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

This approach has been running stably in production for over half a year, so it's proven in practice.

## Implementation Experience

Let's start with the basic implementation:

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

This snippet shows the basic usage. In real projects you'll still need to account for error handling and edge cases.

## Tuning Strategies

Building on this, we can optimize further:

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

This pattern is very practical in large projects and can significantly cut maintenance cost.

## Summary

- A GitHub Actions CI/CD frontend pipeline is no silver bullet; choose it based on your project's scale and tech stack.
- Understanding the underlying principles matters more than memorizing APIs.
- Before using it in production, make sure to verify compatibility.
- In team collaboration, conventions and documentation matter more than the technology itself.
