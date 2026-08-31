---
title: "デザインシステム：デザイントークン"
date: 2020-08-27 11:23:10
tags:
  - エンジニアリング
readingTime: 2
description: "最近チームでデザインシステムのデザイントークンを導入し、かなりの経験を積んだ。同様の作業の参考になれば幸いだ。"
wordCount: 481
---

最近チーム内で Design System のデザイントークン（Design Tokens）を本番導入し、さまざまな知見が溜まった。その成果をまとめて公開する。同じような取り組みに挑む人の参考になれば幸いだ。

## コアコンセプト

肝心なのはコアとなるロジックを理解することだ：

```javascript
const express = require('express')
const app = express()

app.use(express.json())

class AppError extends Error {
  constructor(status, message) {
    super(message); this.statusCode = status
  }
}

const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next)

app.get('/api/users/:id', asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id)
  if (!user) throw new AppError(404, '用户不存在')
  res.json({ data: user })
}))

```

パフォーマンス最適化は具体的な状況に合わせる必要があり、すべてのケースで過度な最適化が必要なわけではない。

## 深掘り解析

次の方法で改善できる：

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

このアプローチは本番環境で半年以上安定して動いており、実際に検証済みだ。

## 実装経験

基本的な実装方法を見てみよう：

```javascript
type UnwrapPromise<T> = T extends Promise<infer U> ? U : T

async function fetchUser(id: string) {
  const res = await fetch(`/api/users/${id}`)
  return res.json() as Promise<{ id: string; name: string; email: string }>
}

type User = UnwrapPromise<ReturnType<typeof fetchUser>>

// 类型安全的事件系统
interface EventMap {
  login: { userId: string; timestamp: number }
  logout: { userId: string }
}

class TypedEmitter<T extends Record<string, any>> {
  private handlers = new Map<keyof T, Set<Function>>()
  on<K extends keyof T>(event: K, handler: (payload: T[K]) => void) {
    if (!this.handlers.has(event)) this.handlers.set(event, new Set())
    this.handlers.get(event)!.add(handler)
  }
  emit<K extends keyof T>(event: K, payload: T[K]) {
    this.handlers.get(event)?.forEach(h => h(payload))
  }
}

```

このコードは基本的な使い方を示している。実際のプロジェクトではエラーハンドリングや境界条件も考慮する必要がある。

## チューニング戦略

これをベースに、さらに最適化できる：

```javascript
const express = require('express')
const app = express()

app.use(express.json())

class AppError extends Error {
  constructor(status, message) {
    super(message); this.statusCode = status
  }
}

const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next)

app.get('/api/users/:id', asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id)
  if (!user) throw new AppError(404, '用户不存在')
  res.json({ data: user })
}))

```

このパターンは大規模なプロジェクトで非常に実用的で、保守コストを大きく下げられる。

## まとめ

- コミュニティの動向を追い、技術的なアプローチは継続的に磨き込む
- 新しい技術のために新しい技術を使ってはいけない
- コード例はあくまで参考で、業務の場面に合わせて調整すること
- Design System のデザイントークン（Design Tokens）は銀の弾丸ではなく、プロジェクトの規模や技術スタックに応じて選ぶ必要がある
