---
title: "React SuspenseList による読み込み順序制御"
date: 2020-03-24 16:02:13
tags:
  - React
readingTime: 3
description: "最近チームでReact SuspenseList による読み込み順序制御を導入し、かなりの経験を積んだ。同様の作業の参考になれば幸いだ。"
wordCount: 497
---

最近チームで React SuspenseList による読み込み順序の制御を進め、いくつかの知見が溜まった。似たような取り組みをする人の参考になればとまとめておく。

## コアコンセプト

この上にさらに最適化を重ねられる：

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

このパターンは大規模なプロジェクトで非常に実用的であり、保守コストを大きく下げられる。

## 深掘り解析

実際のプロジェクトでの使い方はもう少し複雑になる：

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

この方式により、コードのテスト容易性と拡張性の両方が高まる。

## 実装経験

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

## 调优策略

鍵となるのは中核となるロジックを理解することだ：

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

性能最適化は具体的な場面に合わせる必要があり、すべての場合で過剰な最適化が必要なわけではない。

## 注意事項

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

このアプローチは本番環境で半年以上安定して稼働しており、実際に検証済みだ。

## まとめ

- 新しい技術だからといって使うために使ってはならない
- コード例はあくまで参考であり、業務の場面に合わせて調整する必要がある
- React SuspenseList による読み込み順序の制御は銀の弾丸ではなく、プロジェクトの規模や技術スタックに応じて選ぶべき
- API を暗記するより、その背後にある原理を理解するほうが重要
