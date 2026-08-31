---
title: "BFF：Backend For Frontend パターン"
date: 2021-05-28 14:31:38
tags:
  - エンジニアリング
  - フロントエンド

readingTime: 2
description: "在日常开发中，BFF Backend For Frontend 模式の使用頻度が高まっています。本記事では、その使い方、原理、最適化戦略を体系的に説明します。"
wordCount: 414
---

日常の開発において、BFF（Backend For Frontend）パターンの活用頻度が高まっている。本記事では、その使い方、仕組み、最適化の戦略を体系的に解説する。

## クイックスタート

基本的な実装方法を見てみよう：

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

このコードは基本的な使い方を示している。実際のプロジェクトでは、エラー処理や境界条件も考慮する必要がある。

## 内部原理

この基盤の上でさらに最適化できる：

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

このパターンは大規模プロジェクトで非常に実用的で、保守コストを大幅に削減できる。

## ビジネス実践

実際のプロジェクトでは、より複雑な使い方になる：

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

このアプローチにより、コードのテスト容易性とスケーラビリティが向上する。

## パフォーマンス比較

全体のサンプルを以下に示す：

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

境界条件の処理には注意が必要だ。本番環境では特に重要になる。

## まとめ

- 新しい技術を使うためだけに新しい技術を使わないでください
- コードサンプルは参考用であり、実際のユースケースに合わせて調整が必要だ
- BFF（Backend For Frontend）パターンは万能薬ではなく、プロジェクトの規模や技術スタックに応じて選ぶ必要がある