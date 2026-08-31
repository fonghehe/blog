---
title: "TypeScriptのモジュール拡張と宣言マージ"
date: 2020-04-10 17:13:08
tags:
  - TypeScript
readingTime: 2
description: "最近チームでTypeScript モジュール拡張と宣言マージを導入し、かなりの経験を積んだ。同様の作業の参考になれば幸いだ。"
wordCount: 399
---

最近チームで TypeScript のモジュール拡張と宣言マージを実践し、いくつかの経験を積んだ。参考になればとまとめておく。同じような取り組みをしている人の役に立てば幸いだ。

## コアコンセプト

まずは基本的な実装の仕方を見てみよう：

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

このコードは基本的な使い方を示している。実際のプロジェクトでは、エラー処理や境界条件も考慮する必要がある。

## 深掘り解析

この上にさらに、次のように最適化できる：

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

このパターンは大規模なプロジェクトで非常に実用的で、保守コストを大きく下げられる。

## 実装経験

実際のプロジェクトでの使い方はもう少し複雑になる：

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

この方法により、コードのテスト容易性と拡張性の両方が向上する。

## 调优策略

以下は完全なサンプルだ：

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

境界条件の処理には注意が必要だ。これは本番環境で極めて重要になる。

## まとめ

- 本番環境での使用前に、必ず互換性の検証を行うこと
- 团队协作中约定和文档比技术本身更重要
- コミュニティの動向を継続的に注視し、技術アプローチを適時更新する
