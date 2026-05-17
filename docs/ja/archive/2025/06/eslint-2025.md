---
title: "ESLint 2025新機能とエコシステム"
date: 2025-06-20 10:00:00
tags:
  - フロントエンド
readingTime: 3
description: "最近チームでESLint 2025新機能とエコシステムを実践し、多くの知見を積みました。参考になれば幸いです。"
---

最近チームでESLint 2025新機能とエコシステムを実践し、多くの知見を積みました。参考になれば幸いです。

## コアコンセプト

この基盤を元に、さらに最適化できます：

```javascript
import { useReducer, useCallback } from "react";

const initialState = { items: [], filter: "", sort: "date" };

function reducer(state, action) {
  switch (action.type) {
    case "SET_ITEMS":
      return { ...state, items: action.payload };
    case "SET_FILTER":
      return { ...state, filter: action.payload };
    case "ADD_ITEM":
      return { ...state, items: [...state.items, action.payload] };
    case "REMOVE_ITEM":
      return {
        ...state,
        items: state.items.filter((i) => i.id !== action.payload),
      };
    default:
      throw new Error(`Unknown: ${action.type}`);
  }
}
```

このパターンは大規模プロジェクトで非常に実用的で、メンテナンスコストを大幅に削減できます。

## 詳細解説

実際のプロジェクトではより複雑な使い方になります：

```javascript
type UnwrapPromise<T> = T extends Promise<infer U> ? U : T

async function fetchUser(id: string) {
  const res = await fetch(`/api/users/${id}`)
  return res.json() as Promise<{ id: string; name: string; email: string }>
}

type User = UnwrapPromise<ReturnType<typeof fetchUser>>

// 型安全なイベントシステム
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

このアプローチにより、コードのテスタビリティと拡張性が向上します。

## 実践経験

完全なサンプルを示します：

```javascript
const express = require("express");
const app = express();

app.use(express.json());

class AppError extends Error {
  constructor(status, message) {
    super(message);
    this.statusCode = status;
  }
}

const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

app.get(
  "/api/users/:id",
  asyncHandler(async (req, res) => {
    const user = await User.findById(req.params.id);
    if (!user) throw new AppError(404, "ユーザーが存在しません");
    res.json({ data: user });
  }),
);
```

境界条件の処理に注意してください。本番環境では非常に重要です。

## チューニング戦略

コアロジックを理解することが重要です：

```javascript
import { useReducer, useCallback } from "react";

const initialState = { items: [], filter: "", sort: "date" };

function reducer(state, action) {
  switch (action.type) {
    case "SET_ITEMS":
      return { ...state, items: action.payload };
    case "SET_FILTER":
      return { ...state, filter: action.payload };
    case "ADD_ITEM":
      return { ...state, items: [...state.items, action.payload] };
    case "REMOVE_ITEM":
      return {
        ...state,
        items: state.items.filter((i) => i.id !== action.payload),
      };
    default:
      throw new Error(`Unknown: ${action.type}`);
  }
}
```

パフォーマンス最適化は具体的なシナリオに合わせる必要があり、すべての場合で過度な最適化が必要なわけではありません。

## 注意事項

以下の方法で改善できます：

```javascript
type UnwrapPromise<T> = T extends Promise<infer U> ? U : T

async function fetchUser(id: string) {
  const res = await fetch(`/api/users/${id}`)
  return res.json() as Promise<{ id: string; name: string; email: string }>
}

type User = UnwrapPromise<ReturnType<typeof fetchUser>>

// 型安全なイベントシステム
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

このソリューションは本番環境で半年以上安定稼働し、実際に検証済みです。

## まとめ

- APIを暗記するより底層の原理を理解することが重要
- 本番環境への適用前に必ず互換性検証を行う
- チーム協働においては、技術よりも規約とドキュメントが重要
- コミュニティの動向に注目し、技術ソリューションは継続的に更新する必要がある
