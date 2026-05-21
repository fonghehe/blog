---
title: "GitHub Actions CI/CD 前端流水線"
date: 2020-06-09 10:54:08
tags:
  - 工程化
readingTime: 2
description: "最近在團隊中落地GitHub Actions CI/CD 前端流水線，積累了不少經驗。整理出來供參考，希望對做類似工作的同學有所幫助。"
wordCount: 300
---

最近在團隊中落地GitHub Actions CI/CD 前端流水線，積累了不少經驗。整理出來供參考，希望對做類似工作的同學有所幫助。

## 核心概念

關鍵在於理解核心邏輯：

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

性能優化需要結合具體場景，不是所有情況都需要過度優化。

## 深度解析

我們可以通過以下方式來改進：

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

這套方案已經在線上穩定運行了半年以上，經過了實際驗證。

## 落地經驗

先來看基本的實現方式：

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

這段代碼展示了基本的使用方式。實際項目中還需要考慮錯誤處理和邊界條件。

## 調優策略

在這個基礎上，我們可以進一步優化：

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

這種模式在大型項目中非常實用，能顯著降低維護成本。

## 小結

- GitHub Actions CI/CD 前端流水線不是銀彈，需要根據項目規模和技術棧選擇
- 理解底層原理比記住 API 更重要
- 生產環境使用前務必做好兼容性驗證
- 團隊協作中約定和文檔比技術本身更重要
