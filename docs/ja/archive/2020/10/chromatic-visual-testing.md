---
title: "Chromatic ビジュアルリグレッションテスト"
date: 2020-10-21 15:31:04
tags:
  - 测试
readingTime: 2
description: "最近チームでChromatic ビジュアルリグレッションテストを導入し、かなりの経験を積んだ。同様の作業の参考になれば幸いだ。"
wordCount: 379
---

最近チームで Chromatic のビジュアルリグレッションテストを導入し、いくつかの経験を蓄積した。参考になれば幸いだ。

## コアコンセプト

まずは基本的な実装方法を見てみよう：

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

このコードは基本的な使い方を示す。実際のプロジェクトではエラー処理と境界条件も考慮が必要だ。

## 深掘り解析

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

このパターンは大規模プロジェクトで実用的で、保守コストを大幅に削減できる。

## 実装経験

実際のプロジェクトでは使い方はもう少し複雑になる：

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

この方法によりコードのテスト容易性と拡張性が向上した。

## チューニング戦略

以下は全体のサンプルだ：

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

境界条件の処理に注意せよ。本番環境で極めて重要だ。

## まとめ

- コード例は参考用。実際のビジネス場面に合わせ調整せよ
- Chromatic のビジュアルリグレッションテストは銀の弾丸ではない。プロジェクト規模と技術スタックに応じて選ぶべきだ
- API を暗記するより基礎原理を理解する方が重要だ
