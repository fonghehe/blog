---
title: "Capacitorクロスプラットフォームアプリ開発"
date: 2020-11-18 09:32:57
tags:
  - 跨平台
readingTime: 3
description: "最近チームでCapacitor クロスプラットフォームアプリ開発を導入し、かなりの経験を積んだ。同様の作業の参考になれば幸いだ。"
wordCount: 502
---

最近チームで Capacitor を用いたクロスプラットフォーム開発を本番導入し、いくつかの知見が溜まった。似たような取り組みをされている方の参考になれば幸いだ。

## コアコンセプト

これを土台に、さらに最適化を進められる：

```javascript
import React, { useState, useCallback } from 'react'
import { View, Text, FlatList, TouchableOpacity, StyleSheet } from 'react-native'

const ItemList = ({ data, onRefresh }) => {
  const [refreshing, setRefreshing] = useState(false)
  const handleRefresh = useCallback(async () => {
    setRefreshing(true)
    await onRefresh()
    setRefreshing(false)
  }, [onRefresh])

  const renderItem = useCallback(({ item }) => (
    <TouchableOpacity style={styles.item}>
      <Text style={styles.title}>{item.title}</Text>
    </TouchableOpacity>
  ), [])

  return (
    <FlatList data={data} renderItem={renderItem}
      keyExtractor={item => item.id}
      refreshing={refreshing} onRefresh={handleRefresh} />
  )
}

```

このパターンは大規模なプロジェクトで非常に実用的で、保守コストを大きく下げられる。

## 深掘り解析

実際のプロジェクトでは、もう少し複雑な使い方になる：

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

この手法により、コードのテスト容易性と拡張性の両方が向上する。

## 実装経験

以下に全体のサンプルを示す：

```javascript
import React, { useState, useCallback } from 'react'
import { View, Text, FlatList, TouchableOpacity, StyleSheet } from 'react-native'

const ItemList = ({ data, onRefresh }) => {
  const [refreshing, setRefreshing] = useState(false)
  const handleRefresh = useCallback(async () => {
    setRefreshing(true)
    await onRefresh()
    setRefreshing(false)
  }, [onRefresh])

  const renderItem = useCallback(({ item }) => (
    <TouchableOpacity style={styles.item}>
      <Text style={styles.title}>{item.title}</Text>
    </TouchableOpacity>
  ), [])

  return (
    <FlatList data={data} renderItem={renderItem}
      keyExtractor={item => item.id}
      refreshing={refreshing} onRefresh={handleRefresh} />
  )
}

```

境界条件の処理には注意しよう。本番環境では極めて重要なポイントだ。

## チューニング戦略

ポイントは中核となるロジックを理解することだ：

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

パフォーマンスチューニングは具体的な場面に合わせる必要があり、あらゆるケースで過剰な最適化が必要なわけではない。

## 注意事項

次の方法で改善できる：

```javascript
import React, { useState, useCallback } from 'react'
import { View, Text, FlatList, TouchableOpacity, StyleSheet } from 'react-native'

const ItemList = ({ data, onRefresh }) => {
  const [refreshing, setRefreshing] = useState(false)
  const handleRefresh = useCallback(async () => {
    setRefreshing(true)
    await onRefresh()
    setRefreshing(false)
  }, [onRefresh])

  const renderItem = useCallback(({ item }) => (
    <TouchableOpacity style={styles.item}>
      <Text style={styles.title}>{item.title}</Text>
    </TouchableOpacity>
  ), [])

  return (
    <FlatList data={data} renderItem={renderItem}
      keyExtractor={item => item.id}
      refreshing={refreshing} onRefresh={handleRefresh} />
  )
}

```

このアプローチは本番環境で半年以上安定稼働しており、実際に検証済みだ。

## まとめ

- API を暗記するより、根本的な仕組みを理解することが大切だ
- 本番環境で使う前に、必ず互換性の検証を行うこと
- チームでの開発では、技術そのものより合意形成とドキュメントが重要になる
- コミュニティの動向を追い、技術的アプローチは継続的に改善していくこと
