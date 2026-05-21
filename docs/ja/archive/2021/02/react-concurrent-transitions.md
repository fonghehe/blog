---
title: "React 18 useTransition：ノンブロッキング更新"
date: 2021-02-09 17:04:01
tags:
  - React
  - JavaScript

readingTime: 2
description: "React 18 useTransition 非阻塞更新このテーマはコミュニティで何度も議論されていますが、バージョンアップに伴い多くの結論は更新が必要です。本記事では最新バージョンをベースに改めて整理します。"
wordCount: 425
---

React 18 useTransition 非阻塞更新このテーマはコミュニティで何度も議論されていますが、バージョンアップに伴い多くの結論は更新が必要です。本記事では最新バージョンをベースに改めて整理します。

## 入門ガイド

まず基本的な実装方法を見てみましょう：

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

このコードは基本的な使い方を示しています。実際のプロジェクトではエラー処理と境界条件も考慮する必要があります。

## ソースコード分析

この基盤の上でさらに最適化できます：

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

このパターンは大規模プロジェクトで非常に実用的で、保守コストを大幅に削減できます。

## 実際のシナリオへの応用

实际项目中的用法会更复杂一些：

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

このアプローチにより、コードのテスト可能性とスケーラビリティが向上します。

## 最適化テクニック

完全な例を以下に示します：

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

境界条件の処理に注意してください。これは本番環境で非常に重要です。

## まとめ

- React 18 useTransition 非阻塞更新不是银弹，需要根据项目规模和技术栈选择
- 基礎的な原理を理解することは、APIを暗記することより重要です
- 本番環境で使用する前に必ず互換性を確認してください
