---
title: "CI/CD 快取策略最佳化"
date: 2022-07-25 14:31:36
tags:
  - 前端
readingTime: 1
description: "最近在團隊中落地CI/CD 快取策略最佳化，積累了不少經驗。整理出來供參考，希望對做類似工作的同學有所幫助。"
---

最近在團隊中落地CI/CD 快取策略最佳化，積累了不少經驗。整理出來供參考，希望對做類似工作的同學有所幫助。

## 核心概念

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

這段程式碼展示了基本的使用方式。實際專案中還需要考慮錯誤處理和邊界條件。

## 深度解析

在這個基礎上，我們可以進一步最佳化：

```javascript
const observer = new PerformanceObserver((list) => {
  for (const entry of list.getEntries()) {
    if (entry.entryType === 'largest-contentful-paint') {
      reportMetric('LCP', entry.startTime)
    }
    if (entry.entryType === 'first-input') {
      reportMetric('FID', entry.processingStart - entry.startTime)
    }
  }
})
observer.observe({ entryTypes: ['largest-contentful-paint', 'first-input'] })

```

這種模式在大型專案中非常實用，能顯著降低維護成本。

## 落地經驗

實際專案中的用法會更復雜一些：

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

通過這種方式，程式碼的可測試性和可擴充套件性都得到了提升。

## 調優策略

以下是一個完整的示例：

```javascript
const observer = new PerformanceObserver((list) => {
  for (const entry of list.getEntries()) {
    if (entry.entryType === 'largest-contentful-paint') {
      reportMetric('LCP', entry.startTime)
    }
    if (entry.entryType === 'first-input') {
      reportMetric('FID', entry.processingStart - entry.startTime)
    }
  }
})
observer.observe({ entryTypes: ['largest-contentful-paint', 'first-input'] })

```

注意邊界條件處理，這在生產環境中至關重要。

## 小結

- 理解底層原理比記住 API 更重要
- 生產環境使用前務必做好相容性驗證
- 團隊協作中約定和文件比技術本身更重要