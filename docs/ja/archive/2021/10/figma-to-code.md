---
title: "Figma to Code：デザインからコードへの自動化"
date: 2021-10-20 11:47:27
tags:
  - フロントエンド
  - エンジニアリング

readingTime: 2
description: "最近在团队中落地Figma to Code 设计稿转代码，において多くの経験を積みました。参考のためにまとめましたので、同様の作業をされる方のお役に立てれば幸いです。"
wordCount: 428
---

最近チーム内で Figma to Code（デザインからコードへの変換）を実践し、多くの経験を積んだ。参考になればとまとめたので、同じ取り組みをする方の役に立てば幸いだ。

## コアコンセプト

基本的な実装方法を見てみよう：

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

このコードは基本的な使い方を示している。実際のプロジェクトではエラー処理や境界条件も考慮する必要がある。

## 詳細分析

この基盤の上にさらに最適化を重ねられる：

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

このパターンは大規模プロジェクトで非常に実用的であり、保守コストを大幅に削減できる。

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

このアプローチにより、コードのテスト性と拡張性が向上する。

## 最適化戦略

全体のサンプルを以下に示す：

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

境界条件の処理には注意が必要だ。これは本番環境において非常に重要である。

## まとめ

- 新しい技術を使うためだけに新しい技術を使うべきではない
- コードサンプルは参考用に過ぎず、ビジネスの場面に応じた調整が必要だ
- Figma to Code（デザインからコードへの変換）は万能ではなく、プロジェクトの規模や技術スタックに応じて選ぶべきだ
