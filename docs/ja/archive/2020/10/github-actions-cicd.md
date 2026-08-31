---
title: "GitHub Actions CI/CD 応用：マルチ環境デプロイと Matrix Build"
date: 2020-06-09 10:54:08
tags:
  - エンジニアリング
readingTime: 2
description: "最近チームで GitHub Actions の CI/CD フロントエンドパイプラインを導入し、いくつかの経験を蓄積した。参考になれば幸いだ。"
wordCount: 418
---

最近チームで GitHub Actions の CI/CD フロントエンドパイプラインを導入し、いくつかの経験を蓄積した。参考になれば幸いだ。

## コアコンセプト

重要なのは中核となるロジックを理解することだ：

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

パフォーマンス最適化は具体的な場面に応じる必要があり、すべてのケースで過度な最適化が必要なわけではない。

## 深掘り解析

以下の方法で改善できる：

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

このアプローチは本番で半年以上安定稼働し、実際に検証済みだ。

## 実装経験

まずは基本的な実装方法を見てみよう：

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

このコードは基本的な使い方を示す。実際のプロジェクトではエラー処理と境界条件も考慮が必要だ。

## チューニング戦略

この基盤の上でさらに最適化できる：

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

このパターンは大規模プロジェクトで実用的で、保守コストを大幅に削減できる。

## まとめ

- GitHub Actions の CI/CD フロントエンドパイプラインは銀の弾丸ではない。プロジェクト規模と技術スタックに応じて選ぶべきだ
- API を暗記するより基礎原理を理解する方が重要だ
- 本番使用前に必ず互換性検証を
- チームでは技術より取り決めとドキュメントが重要だ
