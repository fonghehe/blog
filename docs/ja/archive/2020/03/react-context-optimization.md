---
title: "React Contextのパフォーマンス最適化戦略"
date: 2020-03-20 14:47:24
tags:
  - React
readingTime: 2
description: "日々の開発でReact Context のパフォーマンス最適化の利用頻度はますます高まっている。本記事ではその使い方・原理・最適化戦略を体系的に解説する。"
wordCount: 398
---

日々の開発において React Context のパフォーマンス最適化戦略の出番は増えている。本稿ではその使い方・原理・最適化戦略を体系的に解説する。

## クイックスタート

基本的な実装のしかたから見ていこう：

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

このコードは基本的な使い方を示している。実際のプロジェクトではエラー処理や境界条件も考慮する必要がある。

## 内部原理

この上にさらに最適化を重ねられる：

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

このパターンは大規模なプロジェクトで非常に実用的であり、保守コストを大きく下げられる。

## ビジネス実践

実際のプロジェクトでの使い方はもう少し複雑になる：

```javascript
import { useRef, useEffect, useState } from 'react'

function useIntersectionObserver(options = {}) {
  const [isVisible, setIsVisible] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => {
      setIsVisible(entry.isIntersecting)
    }, { threshold: 0.1, ...options })
    const el = ref.current
    if (el) observer.observe(el)
    return () => { if (el) observer.unobserve(el) }
  }, [])

  return [ref, isVisible]
}

```

この方式により、コードのテスト容易性と拡張性の両方が高まる。

## パフォーマンス比較

以下は全体のサンプルだ：

```javascript
import { useReducer, useCallback } from 'react'

const initialState = { items: [], filter: '', sort: 'date' }

function reducer(state, action) {
  switch (action.type) {
    case 'SET_ITEMS': return { ...state, items: action.payload }
    case 'SET_FILTER': return { ...state, filter: action.payload }
    case 'ADD_ITEM': return { ...state, items: [...state.items, action.payload] }
    case 'REMOVE_ITEM': return { ...state, items: state.items.filter(i => i.id !== action.payload) }
    default: throw new Error(`Unknown: ${action.type}`)
  }
}

```

境界条件の処理に注意すること。これは本番環境では極めて重要だ。

## まとめ

- API を暗記するより、その背後にある原理を理解するほうが重要
- 本番環境で使う前には必ず互換性の検証を行う
- チーム開発では、技術そのものよりも取り決めとドキュメントのほうが重要
