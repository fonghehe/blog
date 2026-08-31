---
title: "2020年のレスポンシブデザイン ベストプラクティス"
date: 2020-11-16 17:34:26
tags:
  - CSS
readingTime: 2
description: "最近チームで2020 レスポンシブデザインベストプラクティスを導入し、かなりの経験を積んだ。同様の作業の参考になれば幸いだ。"
wordCount: 422
---

最近チームで 2020 年のレスポンシブデザインのベストプラクティスを本番導入し、いくつかの知見が溜まった。似たような取り組みをされている方の参考になれば幸いだ。

## コアコンセプト

まずは基本的な実装方法を見ていこう：

```javascript
type DeepPartial<T> = T extends object ? { [P in keyof T]?: DeepPartial<T[P]> } : T

interface AppConfig {
  api: { baseUrl: string; timeout: number; retries: number }
  ui: { theme: 'light' | 'dark'; language: string; pageSize: number }
}

type PartialConfig = DeepPartial<AppConfig>

function mergeConfig(defaults: AppConfig, overrides: PartialConfig): AppConfig {
  const result = { ...defaults }
  for (const key of Object.keys(overrides) as (keyof AppConfig)[]) {
    if (overrides[key] && typeof overrides[key] === 'object') {
      result[key] = { ...defaults[key], ...overrides[key] } as any
    }
  }
  return result
}

```

このコードは基本的な使い方を示している。実際のプロジェクトでは、エラー処理と境界条件も考慮する必要がある。

## 深掘り解析

これを土台に、さらに最適化を進められる：

```javascript
:root {
  --bg: light-dark(#fff, #1a1a2e);
  --text: light-dark(#333, #e0e0e0);
  --accent: light-dark(#2563eb, #60a5fa);
  color-scheme: light dark;
}

.carousel {
  display: flex; gap: 1rem; overflow-x: auto;
  scroll-snap-type: x mandatory;
  scroll-padding: 1rem;
}

.carousel__item {
  flex: 0 0 80%; scroll-snap-align: start;
  border-radius: 12px; transition: scale 0.3s ease;
}

```

このパターンは大規模なプロジェクトで非常に実用的で、保守コストを大きく下げられる。

## 実装経験

実際のプロジェクトでは、もう少し複雑な使い方になる：

```javascript
import { useState, useEffect, useCallback } from 'react'

function DataList({ endpoint, pageSize = 20 }) {
  const [data, setData] = useState([])
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(false)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`${endpoint}?page=${page}&size=${pageSize}`)
      setData(await res.json())
    } finally { setLoading(false) }
  }, [endpoint, page, pageSize])

  useEffect(() => { fetchData() }, [fetchData])

  return <div>{loading ? <Spinner /> : <List items={data} />}</div>
}

```

この手法により、コードのテスト容易性と拡張性の両方が向上する。

## チューニング戦略

以下に全体のサンプルを示す：

```javascript
type DeepPartial<T> = T extends object ? { [P in keyof T]?: DeepPartial<T[P]> } : T

interface AppConfig {
  api: { baseUrl: string; timeout: number; retries: number }
  ui: { theme: 'light' | 'dark'; language: string; pageSize: number }
}

type PartialConfig = DeepPartial<AppConfig>

function mergeConfig(defaults: AppConfig, overrides: PartialConfig): AppConfig {
  const result = { ...defaults }
  for (const key of Object.keys(overrides) as (keyof AppConfig)[]) {
    if (overrides[key] && typeof overrides[key] === 'object') {
      result[key] = { ...defaults[key], ...overrides[key] } as any
    }
  }
  return result
}

```

境界条件の処理には注意しよう。本番環境では極めて重要なポイントだ。

## まとめ

- 本番環境で使う前に、必ず互換性の検証を行うこと
- チームでの開発では、技術そのものより合意形成とドキュメントが重要になる
- コミュニティの動向を追い、技術的アプローチは継続的に改善していくこと
